'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  VideoCameraSlashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

interface ViewerProps {
  streamId: string;
  onViewerCountChange?: (count: number) => void;
  onStreamStatusChange?: (status: 'loading' | 'connected' | 'disconnected' | 'ended') => void;
}

// ICE servers configuration (same as broadcaster)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function WebRTCViewer({
  streamId,
  onViewerCountChange,
  onStreamStatusChange
}: ViewerProps) {
  const { data: session } = useSession();
  
  // State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [streamStatus, setStreamStatus] = useState<'loading' | 'connected' | 'disconnected' | 'ended'>('loading');
  const [viewerCount, setViewerCount] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'fair' | 'poor'>('good');
  
  // Refs
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    initializeConnection();
    
    return () => {
      cleanup();
    };
  }, [streamId]);

  const initializeConnection = async () => {
    try {
      setConnectionStatus('connecting');
      onStreamStatusChange?.('loading');
      
      // Initialize socket connection
      socketRef.current = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || '', {
        auth: {
          token: session?.accessToken || 'placeholder-token'
        },
        transports: ['websocket', 'polling']
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        
        // Join stream room as viewer
        socket.emit('stream:join', {
          streamId,
          isOwner: false
        });
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        setConnectionStatus('disconnected');
        setStreamStatus('disconnected');
        onStreamStatusChange?.('disconnected');
        
        // Attempt to reconnect
        attemptReconnect();
      });

      socket.on('broadcaster-available', () => {
        console.log('Broadcaster is available');
        requestStream();
      });

      socket.on('broadcaster-joined', () => {
        console.log('Broadcaster joined');
        requestStream();
      });

      socket.on('broadcaster-left', () => {
        console.log('Broadcaster left');
        handleBroadcasterLeft();
      });

      socket.on('offer', async ({ offer, senderId }) => {
        console.log('Received offer from broadcaster:', senderId);
        await handleOffer(offer, senderId);
      });

      socket.on('ice-candidate', async ({ candidate, senderId }) => {
        console.log('Received ICE candidate from broadcaster');
        await handleIceCandidate(candidate);
      });

      socket.on('viewer-count-update', ({ count }) => {
        setViewerCount(count);
        onViewerCountChange?.(count);
      });

      socket.on('stream-started', () => {
        console.log('Stream started');
        setStreamStatus('connected');
        onStreamStatusChange?.('connected');
      });

      socket.on('stream-ended', () => {
        console.log('Stream ended');
        handleStreamEnded();
      });

      socket.on('quality-changed', ({ quality, bitrate }) => {
        console.log('Stream quality changed:', quality, bitrate);
        toast.success(`Stream quality: ${quality}`);
      });

    } catch (error) {
      console.error('Failed to initialize connection:', error);
      setConnectionStatus('failed');
      setStreamStatus('disconnected');
      onStreamStatusChange?.('disconnected');
    }
  };

  const requestStream = () => {
    if (socketRef.current && connectionStatus === 'connected') {
      console.log('Requesting stream from broadcaster');
      socketRef.current.emit('request-stream');
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, senderId: string) => {
    try {
      // Create peer connection
      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: ICE_SERVERS
      });

      const peerConnection = peerConnectionRef.current;

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        const [remoteStream] = event.streams;
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          setStreamStatus('connected');
          onStreamStatusChange?.('connected');
        }

        // Monitor connection quality
        monitorConnectionQuality();
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: senderId
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('Connection state changed:', state);
        
        if (state === 'connected') {
          setStreamStatus('connected');
          onStreamStatusChange?.('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          setStreamStatus('disconnected');
          onStreamStatusChange?.('disconnected');
          
          // Try to reconnect
          if (state === 'failed') {
            attemptReconnect();
          }
        }
      };

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back to broadcaster
      if (socketRef.current) {
        socketRef.current.emit('answer', {
          answer,
          targetId: senderId
        });
      }

    } catch (error) {
      console.error('Failed to handle offer:', error);
      toast.error('Failed to connect to stream');
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Failed to add ICE candidate:', error);
      }
    }
  };

  const handleBroadcasterLeft = () => {
    setStreamStatus('ended');
    onStreamStatusChange?.('ended');
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    toast.info('Stream ended: Broadcaster disconnected');
  };

  const handleStreamEnded = () => {
    setStreamStatus('ended');
    onStreamStatusChange?.('ended');
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    cleanup();
    toast.info('Stream has ended');
  };

  const attemptReconnect = () => {
    if (reconnectAttempts >= 5) {
      toast.error('Unable to reconnect to stream');
      return;
    }

    setReconnectAttempts(prev => prev + 1);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Reconnection attempt ${reconnectAttempts + 1}`);
      initializeConnection();
    }, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)); // Exponential backoff
  };

  const monitorConnectionQuality = () => {
    if (!peerConnectionRef.current) return;

    const checkStats = async () => {
      try {
        const stats = await peerConnectionRef.current!.getStats();
        let inboundRTP = null;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            inboundRTP = report;
          }
        });

        if (inboundRTP) {
          const packetsLost = inboundRTP.packetsLost || 0;
          const packetsReceived = inboundRTP.packetsReceived || 1;
          const lossRate = packetsLost / (packetsLost + packetsReceived);

          if (lossRate > 0.1) {
            setNetworkQuality('poor');
          } else if (lossRate > 0.05) {
            setNetworkQuality('fair');
          } else {
            setNetworkQuality('good');
          }
        }
      } catch (error) {
        console.error('Failed to get connection stats:', error);
      }
    };

    // Check stats every 5 seconds
    const statsInterval = setInterval(checkStats, 5000);
    
    // Clean up interval when component unmounts or connection closes
    return () => clearInterval(statsInterval);
  };

  const togglePlay = () => {
    if (remoteVideoRef.current) {
      if (isPlaying) {
        remoteVideoRef.current.pause();
      } else {
        remoteVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = newVolume;
    }
  };

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const getStatusColor = () => {
    switch (streamStatus) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'loading': return 'bg-yellow-100 text-yellow-800';
      case 'ended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getNetworkQualityColor = () => {
    switch (networkQuality) {
      case 'good': return 'text-green-600';
      case 'fair': return 'text-yellow-600';
      default: return 'text-red-600';
    }
  };

  const getStatusText = () => {
    switch (streamStatus) {
      case 'loading': return 'Connecting...';
      case 'connected': return 'Live';
      case 'ended': return 'Stream Ended';
      default: return 'Disconnected';
    }
  };

  return (
    <Card className="w-full overflow-hidden">
      <div className="relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full aspect-video bg-black"
          onLoadedMetadata={() => {
            console.log('Video metadata loaded');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.volume = volume;
              remoteVideoRef.current.muted = isMuted;
            }
          }}
        />
        
        {/* Status Overlay */}
        <div className="absolute top-4 left-4 flex items-center space-x-2">
          <Badge className={getStatusColor()}>
            {streamStatus === 'connected' && '🔴'} {getStatusText()}
          </Badge>
          
          {streamStatus === 'connected' && (
            <Badge variant="outline" className="bg-black/50 text-white border-white/20">
              {viewerCount} viewers
            </Badge>
          )}
        </div>

        {/* Network Quality Indicator */}
        {streamStatus === 'connected' && (
          <div className="absolute top-4 right-4">
            <div className={`text-sm font-medium ${getNetworkQualityColor()}`}>
              {networkQuality === 'good' && '●●●'}
              {networkQuality === 'fair' && '●●○'}
              {networkQuality === 'poor' && '●○○'}
            </div>
          </div>
        )}

        {/* Loading State */}
        {streamStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">Connecting to stream...</p>
              {reconnectAttempts > 0 && (
                <p className="text-sm opacity-75">Reconnection attempt {reconnectAttempts}</p>
              )}
            </div>
          </div>
        )}

        {/* Disconnected State */}
        {streamStatus === 'disconnected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <ExclamationTriangleIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Connection Lost</p>
              <p className="text-sm opacity-75 mb-4">
                {reconnectAttempts > 0 ? 'Attempting to reconnect...' : 'Stream unavailable'}
              </p>
              {reconnectAttempts === 0 && (
                <Button
                  onClick={initializeConnection}
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Ended State */}
        {streamStatus === 'ended' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <VideoCameraSlashIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Stream Ended</p>
              <p className="text-sm opacity-75">Thanks for watching!</p>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        {streamStatus === 'connected' && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-4">
                <button onClick={togglePlay} className="hover:bg-white/20 rounded p-2">
                  {isPlaying ? (
                    <PauseIcon className="h-6 w-6" />
                  ) : (
                    <PlayIcon className="h-6 w-6" />
                  )}
                </button>
                
                <div className="flex items-center space-x-2">
                  <button onClick={toggleMute} className="hover:bg-white/20 rounded p-1">
                    {isMuted ? (
                      <SpeakerXMarkIcon className="h-5 w-5" />
                    ) : (
                      <SpeakerWaveIcon className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>
              
              <div className="text-sm opacity-75">
                Network: <span className={getNetworkQualityColor()}>{networkQuality}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}