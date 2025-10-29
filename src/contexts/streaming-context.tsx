'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';

export interface StreamInfo {
  id: string;
  title: string;
  description: string;
  streamerId: string;
  streamerName: string;
  streamerAvatar: string;
  category: string;
  tags: string[];
  isLive: boolean;
  viewerCount: number;
  startedAt: Date;
  thumbnailUrl?: string;
  isRecording: boolean;
  isPrivate: boolean;
  price?: number; // For paid streams
}

export interface StreamMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'tip' | 'follow' | 'subscription' | 'system';
  amount?: number; // For tips
  isHighlighted?: boolean;
  isModerator?: boolean;
  isStreamer?: boolean;
}

export interface StreamSettings {
  title: string;
  description: string;
  category: string;
  tags: string[];
  isPrivate: boolean;
  price?: number;
  allowRecording: boolean;
  chatEnabled: boolean;
  slowModeEnabled: boolean;
  followersOnly: boolean;
}

interface StreamingContextType {
  // Stream state
  currentStream: StreamInfo | null;
  isStreaming: boolean;
  isViewing: boolean;
  
  // WebRTC state
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peer: Peer.Instance | null;
  
  // Chat state
  messages: StreamMessage[];
  onlineViewers: Array<{
    id: string;
    username: string;
    avatar: string;
    isModerator: boolean;
    isSubscriber: boolean;
  }>;
  
  // Socket connection
  socket: Socket | null;
  isConnected: boolean;
  
  // Stream controls
  startStream: (settings: StreamSettings) => Promise<void>;
  endStream: () => Promise<void>;
  joinStream: (streamId: string) => Promise<void>;
  leaveStream: () => void;
  
  // Media controls
  toggleVideo: () => void;
  toggleAudio: () => void;
  switchCamera: () => void;
  shareScreen: () => Promise<void>;
  stopScreenShare: () => void;
  
  // Chat functions
  sendMessage: (message: string) => void;
  sendTip: (amount: number, message?: string) => void;
  
  // Stream info
  updateStreamSettings: (settings: Partial<StreamSettings>) => void;
  getStreamAnalytics: () => Promise<any>;
  
  // Recording
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
}

const StreamingContext = createContext<StreamingContextType | null>(null);

export const useStreaming = () => {
  const context = useContext(StreamingContext);
  if (!context) {
    throw new Error('useStreaming must be used within a StreamingProvider');
  }
  return context;
};

interface StreamingProviderProps {
  children: ReactNode;
  userId: string;
  userInfo: {
    id: string;
    name: string;
    avatar: string;
    isSubscriber: boolean;
    isModerator: boolean;
  };
}

export function StreamingProvider({ children, userId, userInfo }: StreamingProviderProps) {
  // Stream state
  const [currentStream, setCurrentStream] = useState<StreamInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  
  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [onlineViewers, setOnlineViewers] = useState<any[]>([]);
  
  // Socket connection
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('/streaming', {
      query: { userId, username: userInfo.name }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to streaming server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from streaming server');
    });

    // Stream events
    newSocket.on('stream-started', (streamInfo: StreamInfo) => {
      setCurrentStream(streamInfo);
      setIsStreaming(streamInfo.streamerId === userId);
    });

    newSocket.on('stream-ended', () => {
      setCurrentStream(null);
      setIsStreaming(false);
      setIsViewing(false);
    });

    newSocket.on('viewer-count-updated', (count: number) => {
      if (currentStream) {
        setCurrentStream(prev => prev ? { ...prev, viewerCount: count } : null);
      }
    });

    newSocket.on('viewers-updated', (viewers: any[]) => {
      setOnlineViewers(viewers);
    });

    // Chat events
    newSocket.on('new-message', (message: StreamMessage) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('message-deleted', (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    // WebRTC signaling
    newSocket.on('offer', async (offer: RTCSessionDescriptionInit, senderId: string) => {
      if (!isStreaming) {
        await handleOffer(offer, senderId);
      }
    });

    newSocket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      if (peer) {
        peer.signal(answer);
      }
    });

    newSocket.on('ice-candidate', (candidate: RTCIceCandidateInit) => {
      if (peer) {
        peer.signal(candidate);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId, userInfo.name]);

  // WebRTC offer handling for viewers
  const handleOffer = async (offer: RTCSessionDescriptionInit, senderId: string) => {
    const viewerPeer = new Peer({ initiator: false, trickle: false });
    
    viewerPeer.on('signal', (signal) => {
      socket?.emit('answer', signal, senderId);
    });

    viewerPeer.on('stream', (stream) => {
      setRemoteStream(stream);
    });

    viewerPeer.signal(offer);
    setPeer(viewerPeer);
  };

  const startStream = async (settings: StreamSettings): Promise<void> => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      
      // Create peer for streaming
      const streamerPeer = new Peer({ initiator: true, trickle: false, stream });
      
      streamerPeer.on('signal', (signal) => {
        socket?.emit('offer', signal);
      });
      
      setPeer(streamerPeer);
      
      // Start the stream on server
      const streamInfo: Partial<StreamInfo> = {
        title: settings.title,
        description: settings.description,
        streamerId: userId,
        streamerName: userInfo.name,
        streamerAvatar: userInfo.avatar,
        category: settings.category,
        tags: settings.tags,
        isPrivate: settings.isPrivate,
        price: settings.price,
        isRecording: settings.allowRecording
      };
      
      socket?.emit('start-stream', streamInfo);
      setIsStreaming(true);

    } catch (error) {
      console.error('Failed to start stream:', error);
      throw error;
    }
  };

  const endStream = async (): Promise<void> => {
    try {
      // Stop local stream
      localStream?.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      
      // Close peer connection
      peer?.destroy();
      setPeer(null);
      
      // Stop recording if active
      if (isRecording) {
        stopRecording();
      }
      
      // End stream on server
      socket?.emit('end-stream');
      setIsStreaming(false);
      setCurrentStream(null);

    } catch (error) {
      console.error('Failed to end stream:', error);
      throw error;
    }
  };

  const joinStream = async (streamId: string): Promise<void> => {
    try {
      socket?.emit('join-stream', streamId);
      setIsViewing(true);
    } catch (error) {
      console.error('Failed to join stream:', error);
      throw error;
    }
  };

  const leaveStream = (): void => {
    socket?.emit('leave-stream');
    setIsViewing(false);
    
    // Clean up peer connection
    peer?.destroy();
    setPeer(null);
    setRemoteStream(null);
  };

  const toggleVideo = (): void => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const toggleAudio = (): void => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const switchCamera = async (): Promise<void> => {
    try {
      const videoTrack = localStream?.getVideoTracks()[0];
      if (videoTrack) {
        // Toggle between front and back camera (mobile)
        const constraints = {
          video: {
            facingMode: videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user'
          },
          audio: true
        };
        
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Replace track in peer connection
        if (peer && peer.streams && peer.streams.length > 0) {
          const sender = peer.streams[0];
          // Replace video track
          const newVideoTrack = newStream.getVideoTracks()[0];
          // Note: This is simplified - actual implementation would need proper WebRTC track replacement
          localStream?.getVideoTracks().forEach(track => track.stop());
          setLocalStream(newStream);
        }
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  const shareScreen = async (): Promise<void> => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Replace video track with screen share
      if (peer && localStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        // Note: Simplified implementation
        setLocalStream(screenStream);
      }
    } catch (error) {
      console.error('Failed to start screen share:', error);
    }
  };

  const stopScreenShare = (): void => {
    // Switch back to camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
      })
      .catch(console.error);
  };

  const sendMessage = (message: string): void => {
    if (socket && currentStream) {
      const chatMessage: Partial<StreamMessage> = {
        message,
        userId,
        username: userInfo.name,
        avatar: userInfo.avatar,
        type: 'message',
        timestamp: new Date()
      };
      
      socket.emit('send-message', currentStream.id, chatMessage);
    }
  };

  const sendTip = (amount: number, message?: string): void => {
    if (socket && currentStream) {
      const tipMessage: Partial<StreamMessage> = {
        message: message || '',
        userId,
        username: userInfo.name,
        avatar: userInfo.avatar,
        type: 'tip',
        amount,
        timestamp: new Date(),
        isHighlighted: true
      };
      
      socket.emit('send-tip', currentStream.id, tipMessage);
    }
  };

  const updateStreamSettings = (settings: Partial<StreamSettings>): void => {
    if (socket && currentStream && isStreaming) {
      socket.emit('update-stream-settings', currentStream.id, settings);
    }
  };

  const getStreamAnalytics = async (): Promise<any> => {
    // This would fetch analytics from your backend
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          totalViewers: 150,
          peakViewers: 89,
          averageViewTime: '12:34',
          totalTips: 245.50,
          newFollowers: 23,
          chatMessages: 456
        });
      }, 1000);
    });
  };

  const startRecording = (): void => {
    if (localStream) {
      const mediaRecorder = new MediaRecorder(localStream);
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Save recording (in real app, upload to server)
        const a = document.createElement('a');
        a.href = url;
        a.download = `stream-${Date.now()}.webm`;
        a.click();
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const value: StreamingContextType = {
    // Stream state
    currentStream,
    isStreaming,
    isViewing,
    
    // WebRTC state
    localStream,
    remoteStream,
    peer,
    
    // Chat state
    messages,
    onlineViewers,
    
    // Socket connection
    socket,
    isConnected,
    
    // Stream controls
    startStream,
    endStream,
    joinStream,
    leaveStream,
    
    // Media controls
    toggleVideo,
    toggleAudio,
    switchCamera,
    shareScreen,
    stopScreenShare,
    
    // Chat functions
    sendMessage,
    sendTip,
    
    // Stream info
    updateStreamSettings,
    getStreamAnalytics,
    
    // Recording
    startRecording,
    stopRecording,
    isRecording
  };

  return (
    <StreamingContext.Provider value={value}>
      {children}
    </StreamingContext.Provider>
  );
}