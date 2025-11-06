'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  XMarkIcon,
  ComputerDesktopIcon,
  StopIcon,
  PlayIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

interface BroadcasterProps {
  streamId: string;
  streamKey: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onViewerCountChange?: (count: number) => void;
}

interface StreamQuality {
  label: string;
  width: number;
  height: number;
  frameRate: number;
  bitRate: number;
}

const STREAM_QUALITIES: StreamQuality[] = [
  { label: '480p', width: 854, height: 480, frameRate: 30, bitRate: 1000 },
  { label: '720p', width: 1280, height: 720, frameRate: 30, bitRate: 2500 },
  { label: '1080p', width: 1920, height: 1080, frameRate: 30, bitRate: 5000 },
];

// ICE servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // In production, you'd add TURN servers here:
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'your-username',
  //   credential: 'your-credential'
  // }
];

export default function WebRTCBroadcaster({
  streamId,
  streamKey,
  onStreamStart,
  onStreamEnd,
  onViewerCountChange,
}: BroadcasterProps) {
  const { data: session } = useSession();

  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(STREAM_QUALITIES[1]); // Default to 720p
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    initializeConnection();

    return () => {
      cleanup();
    };
  }, [streamId]);

  const initializeConnection = async () => {
    if (!session?.user?.id) return;

    try {
      setConnectionStatus('connecting');

      // Initialize socket connection for streaming namespace
      const wsUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001/streaming'
        : '/streaming';
        
      socketRef.current = io(wsUrl, {
        auth: {
          token: session.accessToken || 'placeholder-token',
        },
        transports: ['websocket', 'polling'],
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Join stream room as broadcaster
        socket.emit('stream:join', {
          streamId,
          isOwner: true,
        });

        toast.success('Connected to streaming server');
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        toast.error('Disconnected from streaming server');
      });

      socket.on('stream-request', async ({ viewerId }) => {
        console.log('Stream request from viewer:', viewerId);
        await createPeerConnection(viewerId);
      });

      socket.on('answer', async ({ answer, senderId }) => {
        console.log('Received answer from viewer:', senderId);
        const peerConnection = peerConnectionsRef.current.get(senderId);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on('ice-candidate', async ({ candidate, senderId }) => {
        const peerConnection = peerConnectionsRef.current.get(senderId);
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on('viewer-joined', ({ viewerId, totalViewers }) => {
        console.log('New viewer joined:', viewerId);
        setViewerCount(totalViewers);
        onViewerCountChange?.(totalViewers);
      });

      socket.on('viewer-count-update', ({ count }) => {
        setViewerCount(count);
        onViewerCountChange?.(count);
      });
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      setConnectionStatus('disconnected');
      toast.error('Failed to connect to streaming server');
    }
  };

  const startStreaming = async () => {
    try {
      // Get user media with selected quality
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: selectedQuality.width },
          height: { ideal: selectedQuality.height },
          frameRate: { ideal: selectedQuality.frameRate },
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Display local stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      onStreamStart?.();

      // Notify signaling server
      if (socketRef.current) {
        socketRef.current.emit('broadcaster-ready');
        socketRef.current.emit('start-stream');
      }

      toast.success('Stream started successfully!');
    } catch (error) {
      console.error('Failed to start streaming:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  const stopStreaming = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    // Clear local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setIsScreenSharing(false);
    onStreamEnd?.();

    // Notify signaling server
    if (socketRef.current) {
      socketRef.current.emit('stop-stream');
    }

    toast.success('Stream stopped');
  };

  const createPeerConnection = async (viewerId: string) => {
    if (!localStreamRef.current) return;

    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    // Add local stream to peer connection
    localStreamRef.current.getTracks().forEach(track => {
      if (localStreamRef.current) {
        peerConnection.addTrack(track, localStreamRef.current);
      }
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: viewerId,
        });
      }
    };

    // Store peer connection
    peerConnectionsRef.current.set(viewerId, peerConnection);

    try {
      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer to viewer
      if (socketRef.current) {
        socketRef.current.emit('offer', {
          offer,
          targetId: viewerId,
        });
      }
    } catch (error) {
      console.error('Failed to create peer connection:', error);
    }
  };

  const toggleCamera = async () => {
    if (!localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !cameraEnabled;
      setCameraEnabled(!cameraEnabled);

      // Update all peer connections
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track === videoTrack);
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
    }
  };

  const toggleMicrophone = () => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micEnabled;
      setMicEnabled(!micEnabled);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace video track with screen share
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack && localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(videoTrack);

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Update all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        setIsScreenSharing(true);
        setCameraEnabled(false);

        // Handle screen share ending
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (error) {
      console.error('Failed to start screen share:', error);
      toast.error('Failed to start screen sharing');
    }
  };

  const stopScreenShare = async () => {
    if (!isScreenSharing) return;

    try {
      // Switch back to camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: selectedQuality.width },
          height: { ideal: selectedQuality.height },
          frameRate: { ideal: selectedQuality.frameRate },
        },
      });

      const videoTrack = cameraStream.getVideoTracks()[0];
      if (videoTrack && localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(videoTrack);

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Update all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        setIsScreenSharing(false);
        setCameraEnabled(true);
      }
    } catch (error) {
      console.error('Failed to stop screen share:', error);
      toast.error('Failed to switch back to camera');
    }
  };

  const changeQuality = async (quality: StreamQuality) => {
    setSelectedQuality(quality);

    if (socketRef.current) {
      socketRef.current.emit('stream-quality-change', {
        quality: quality.label,
        bitrate: quality.bitRate,
      });
    }

    toast.success(`Stream quality changed to ${quality.label}`);
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  return (
    <Card className='w-full max-w-4xl mx-auto'>
      <CardHeader>
        <div className='flex justify-between items-center'>
          <CardTitle className='flex items-center space-x-2'>
            <VideoCameraIcon className='h-6 w-6' />
            <span>Live Streaming Control</span>
          </CardTitle>

          <div className='flex items-center space-x-2'>
            <Badge className={getConnectionStatusColor()}>
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </Badge>

            {isStreaming && (
              <Badge className='bg-red-100 text-red-800 animate-pulse'>🔴 LIVE</Badge>
            )}

            <div className='flex items-center text-sm text-gray-600'>
              <span>{viewerCount} viewers</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Video Preview */}
        <div className='relative'>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className='w-full aspect-video bg-black rounded-lg'
          />

          {!isStreaming && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg'>
              <div className='text-center text-white'>
                <VideoCameraIcon className='h-16 w-16 mx-auto mb-4 opacity-50' />
                <p className='text-lg font-medium'>Click "Start Stream" to begin</p>
              </div>
            </div>
          )}

          {/* Stream Quality Indicator */}
          {isStreaming && (
            <div className='absolute top-4 right-4'>
              <Badge variant='outline' className='bg-black/50 text-white border-white/20'>
                {selectedQuality.label}
              </Badge>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center space-x-2'>
            {!isStreaming ? (
              <Button
                onClick={startStreaming}
                disabled={!isConnected}
                className='bg-red-600 hover:bg-red-700 text-white'
              >
                <PlayIcon className='h-4 w-4 mr-2' />
                Start Stream
              </Button>
            ) : (
              <Button
                onClick={stopStreaming}
                variant='outline'
                className='border-red-300 text-red-600 hover:bg-red-50'
              >
                <StopIcon className='h-4 w-4 mr-2' />
                Stop Stream
              </Button>
            )}

            {isStreaming && (
              <>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={toggleCamera}
                  className={!cameraEnabled ? 'bg-red-50 border-red-300' : ''}
                >
                  {cameraEnabled ? (
                    <VideoCameraIcon className='h-4 w-4' />
                  ) : (
                    <VideoCameraSlashIcon className='h-4 w-4' />
                  )}
                </Button>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={toggleMicrophone}
                  className={!micEnabled ? 'bg-red-50 border-red-300' : ''}
                >
                  {micEnabled ? (
                    <MicrophoneIcon className='h-4 w-4' />
                  ) : (
                    <XMarkIcon className='h-4 w-4' />
                  )}
                </Button>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className={isScreenSharing ? 'bg-blue-50 border-blue-300' : ''}
                >
                  <ComputerDesktopIcon className='h-4 w-4' />
                </Button>
              </>
            )}
          </div>

          {/* Quality Selection */}
          <div className='flex items-center space-x-2'>
            <CogIcon className='h-4 w-4 text-gray-500' />
            <select
              value={selectedQuality.label}
              onChange={e => {
                const quality = STREAM_QUALITIES.find(q => q.label === e.target.value);
                if (quality) changeQuality(quality);
              }}
              className='px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              {STREAM_QUALITIES.map(quality => (
                <option key={quality.label} value={quality.label}>
                  {quality.label} ({quality.width}x{quality.height})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stream Info */}
        {isStreaming && (
          <div className='bg-gray-50 p-4 rounded-lg'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
              <div>
                <span className='font-medium text-gray-700'>Quality:</span>
                <p className='text-gray-600'>{selectedQuality.label}</p>
              </div>
              <div>
                <span className='font-medium text-gray-700'>Resolution:</span>
                <p className='text-gray-600'>
                  {selectedQuality.width}x{selectedQuality.height}
                </p>
              </div>
              <div>
                <span className='font-medium text-gray-700'>Frame Rate:</span>
                <p className='text-gray-600'>{selectedQuality.frameRate} fps</p>
              </div>
              <div>
                <span className='font-medium text-gray-700'>Bitrate:</span>
                <p className='text-gray-600'>{selectedQuality.bitRate} kbps</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isConnected && (
          <div className='bg-yellow-50 border border-yellow-200 p-4 rounded-lg'>
            <p className='text-yellow-800 text-sm'>
              📡 Connecting to streaming server... Please wait.
            </p>
          </div>
        )}

        {isConnected && !isStreaming && (
          <div className='bg-blue-50 border border-blue-200 p-4 rounded-lg'>
            <p className='text-blue-800 text-sm'>
              🎥 Ready to stream! Click "Start Stream" to begin broadcasting to your fans.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
