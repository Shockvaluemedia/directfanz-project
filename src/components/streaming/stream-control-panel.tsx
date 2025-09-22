'use client';

import React, { useState, useRef, useEffect } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { useStreaming } from '@/contexts/streaming-context';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Camera,
  Settings,
  Users,
  DollarSign,
  Eye,
  Clock,
  Square,
  Circle,
  Wifi,
  WifiOff,
  Volume2,
  VolumeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamControlPanelProps {
  className?: string;
}

export function StreamControlPanel({ className }: StreamControlPanelProps) {
  const {
    localStream,
    currentStream,
    isStreaming,
    isConnected,
    isRecording,
    startRecording,
    stopRecording,
    toggleVideo,
    toggleAudio,
    switchCamera,
    shareScreen,
    stopScreenShare,
    endStream,
    getStreamAnalytics
  } = useStreaming();

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update video element when local stream changes
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Load analytics
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(async () => {
        try {
          const data = await getStreamAnalytics();
          setAnalytics(data);
        } catch (error) {
          console.error('Failed to load analytics:', error);
        }
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isStreaming, getStreamAnalytics]);

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoEnabled(!isVideoEnabled);
  };

  const handleToggleAudio = () => {
    toggleAudio();
    setIsAudioEnabled(!isAudioEnabled);
  };

  const handleShareScreen = async () => {
    try {
      if (isSharingScreen) {
        stopScreenShare();
        setIsSharingScreen(false);
      } else {
        await shareScreen();
        setIsSharingScreen(true);
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const handleEndStream = async () => {
    try {
      await endStream();
    } catch (error) {
      console.error('Failed to end stream:', error);
    }
  };

  if (!isStreaming) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Live Preview */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Circle className="w-4 h-4 text-red-500 fill-current animate-pulse" />
                <Circle className="absolute inset-0 w-4 h-4 text-red-500 animate-ping" />
              </div>
              <span>Live Preview</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm">
              {isConnected ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-600">
                  <WifiOff className="w-4 h-4" />
                  Disconnected
                </div>
              )}
            </div>
          </EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Video overlay controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20">
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
                  LIVE
                </div>
                <div className="px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-sm">
                  {currentStream?.viewerCount || 0} viewers
                </div>
                {isRecording && (
                  <div className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium flex items-center gap-1">
                    <Circle className="w-2 h-2 fill-current animate-pulse" />
                    REC
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col text-white">
                    <h3 className="font-semibold text-lg">{currentStream?.title}</h3>
                    <p className="text-sm opacity-75">{currentStream?.category}</p>
                  </div>
                  
                  {/* Quick stats */}
                  <div className="flex gap-3 text-white text-sm">
                    {analytics && (
                      <>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {analytics.totalViewers}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${analytics.totalTips}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {analytics.averageViewTime}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Stream Controls */}
      <EnhancedCard variant="elevated">
        <EnhancedCardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* Video Toggle */}
            <EnhancedButton
              variant={isVideoEnabled ? "primary" : "destructive"}
              size="lg"
              onClick={handleToggleVideo}
              className="flex-1 min-w-[120px]"
            >
              {isVideoEnabled ? <Video className="w-5 h-5 mr-2" /> : <VideoOff className="w-5 h-5 mr-2" />}
              {isVideoEnabled ? 'Video On' : 'Video Off'}
            </EnhancedButton>

            {/* Audio Toggle */}
            <EnhancedButton
              variant={isAudioEnabled ? "primary" : "destructive"}
              size="lg"
              onClick={handleToggleAudio}
              className="flex-1 min-w-[120px]"
            >
              {isAudioEnabled ? <Mic className="w-5 h-5 mr-2" /> : <MicOff className="w-5 h-5 mr-2" />}
              {isAudioEnabled ? 'Mic On' : 'Mic Off'}
            </EnhancedButton>

            {/* Screen Share */}
            <EnhancedButton
              variant={isSharingScreen ? "secondary" : "ghost"}
              size="lg"
              onClick={handleShareScreen}
              className="flex-1 min-w-[140px]"
            >
              {isSharingScreen ? <MonitorOff className="w-5 h-5 mr-2" /> : <Monitor className="w-5 h-5 mr-2" />}
              {isSharingScreen ? 'Stop Share' : 'Share Screen'}
            </EnhancedButton>

            {/* Switch Camera */}
            <EnhancedButton
              variant="ghost"
              size="lg"
              onClick={switchCamera}
              className="flex-1 min-w-[120px]"
            >
              <Camera className="w-5 h-5 mr-2" />
              Switch Camera
            </EnhancedButton>

            {/* Recording */}
            <EnhancedButton
              variant={isRecording ? "destructive" : "secondary"}
              size="lg"
              onClick={isRecording ? stopRecording : startRecording}
              className="flex-1 min-w-[120px]"
            >
              {isRecording ? <Square className="w-5 h-5 mr-2" /> : <Circle className="w-5 h-5 mr-2" />}
              {isRecording ? 'Stop Rec' : 'Start Rec'}
            </EnhancedButton>

            {/* Settings */}
            <EnhancedButton
              variant="ghost"
              size="lg"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-5 h-5" />
            </EnhancedButton>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Stream Stats */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EnhancedCard variant="elevated">
            <EnhancedCardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">{analytics.totalViewers}</div>
              <div className="text-sm text-gray-600">Total Viewers</div>
            </EnhancedCardContent>
          </EnhancedCard>
          
          <EnhancedCard variant="elevated">
            <EnhancedCardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">{analytics.peakViewers}</div>
              <div className="text-sm text-gray-600">Peak Viewers</div>
            </EnhancedCardContent>
          </EnhancedCard>
          
          <EnhancedCard variant="elevated">
            <EnhancedCardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">${analytics.totalTips}</div>
              <div className="text-sm text-gray-600">Tips Earned</div>
            </EnhancedCardContent>
          </EnhancedCard>
          
          <EnhancedCard variant="elevated">
            <EnhancedCardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">{analytics.newFollowers}</div>
              <div className="text-sm text-gray-600">New Followers</div>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>
      )}

      {/* End Stream */}
      <EnhancedCard variant="elevated" className="border-red-200 bg-red-50">
        <EnhancedCardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">End Live Stream</h3>
              <p className="text-sm text-gray-600">This will stop your live stream and disconnect all viewers</p>
            </div>
            <EnhancedButton
              variant="destructive"
              size="lg"
              onClick={handleEndStream}
            >
              End Stream
            </EnhancedButton>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>
    </div>
  );
}