'use client';

import React, { useState, useRef, useEffect } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle, EnhancedCardDescription } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { useStreaming, StreamSettings } from '@/contexts/streaming-context';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Monitor,
  Settings,
  Play,
  DollarSign,
  Eye,
  EyeOff,
  Clock,
  Tag,
  Users,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamSetupProps {
  onStreamStarted?: () => void;
  className?: string;
}

const streamCategories = [
  'Just Chatting',
  'Music',
  'Art & Creativity',
  'Gaming',
  'Fitness',
  'Cooking',
  'Fashion',
  'Education',
  'Technology',
  'Travel',
  'Comedy',
  'Other'
];

const popularTags = [
  'interactive', 'chill', 'educational', 'music', 'creative', 'gaming',
  'fitness', 'cooking', 'fashion', 'comedy', 'travel', 'tech'
];

export function StreamSetup({ onStreamStarted, className }: StreamSetupProps) {
  const { startStream, isConnected } = useStreaming();
  
  const [settings, setSettings] = useState<StreamSettings>({
    title: '',
    description: '',
    category: 'Just Chatting',
    tags: [],
    isPrivate: false,
    price: undefined,
    allowRecording: true,
    chatEnabled: true,
    slowModeEnabled: false,
    followersOnly: false
  });

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize preview stream
  useEffect(() => {
    const initializePreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: isAudioEnabled
        });
        
        setPreviewStream(stream);
        
        if (videoRef.current && isVideoEnabled) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Failed to get media devices:', error);
      }
    };

    initializePreview();

    return () => {
      previewStream?.getTracks().forEach(track => track.stop());
    };
  }, [isVideoEnabled, isAudioEnabled]);

  // Update preview when settings change
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const toggleVideo = async () => {
    const newVideoEnabled = !isVideoEnabled;
    setIsVideoEnabled(newVideoEnabled);
    
    if (previewStream) {
      const videoTrack = previewStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = newVideoEnabled;
      }
    }
  };

  const toggleAudio = async () => {
    const newAudioEnabled = !isAudioEnabled;
    setIsAudioEnabled(newAudioEnabled);
    
    if (previewStream) {
      const audioTrack = previewStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = newAudioEnabled;
      }
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !settings.tags.includes(tag.trim()) && settings.tags.length < 5) {
      setSettings(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
    }
  };

  const handleStartStream = async () => {
    if (!settings.title.trim()) {
      return;
    }

    setIsLoading(true);
    
    try {
      await startStream(settings);
      onStreamStarted?.();
    } catch (error) {
      console.error('Failed to start stream:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Start Your Live Stream</h1>
        <p className="text-gray-600">Set up your stream and go live to connect with your audience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Live Preview
            </EnhancedCardTitle>
          </EnhancedCardHeader>
          <EnhancedCardContent>
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Preview overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20">
                <div className="absolute top-4 left-4">
                  <div className="px-2 py-1 bg-gray-800/80 text-white text-xs rounded backdrop-blur-sm">
                    Preview
                  </div>
                </div>
                
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-white">
                    <h3 className="font-semibold text-lg truncate">
                      {settings.title || 'Your Stream Title'}
                    </h3>
                    <p className="text-sm opacity-75 truncate">
                      {settings.description || 'Add a description...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Media Controls */}
            <div className="flex justify-center gap-3">
              <EnhancedButton
                variant={isVideoEnabled ? "primary" : "destructive"}
                size="lg"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </EnhancedButton>
              
              <EnhancedButton
                variant={isAudioEnabled ? "primary" : "destructive"}
                size="lg"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </EnhancedButton>
            </div>

            {/* Connection Status */}
            <div className="mt-4 p-3 rounded-lg bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600">Connection Status:</span>
              <span className={cn(
                "text-sm font-medium",
                isConnected ? "text-green-600" : "text-red-600"
              )}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </EnhancedCardContent>
        </EnhancedCard>

        {/* Stream Settings */}
        <EnhancedCard variant="elevated">
          <EnhancedCardHeader>
            <EnhancedCardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Stream Settings
            </EnhancedCardTitle>
          </EnhancedCardHeader>
          <EnhancedCardContent className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stream Title *
              </label>
              <input
                type="text"
                value={settings.title}
                onChange={(e) => setSettings(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What's your stream about?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={100}
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {settings.title.length}/100
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={settings.description}
                onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tell viewers what to expect..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                maxLength={500}
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {settings.description.length}/500
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={settings.category}
                onChange={(e) => setSettings(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {streamCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags ({settings.tags.length}/5)
              </label>
              
              {/* Current Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                {settings.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-indigo-500 hover:text-indigo-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Tag Input */}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                placeholder="Add tags... (Press Enter)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={settings.tags.length >= 5}
              />

              {/* Popular Tags */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">Popular tags:</p>
                <div className="flex flex-wrap gap-1">
                  {popularTags.filter(tag => !settings.tags.includes(tag)).slice(0, 6).map(tag => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                      disabled={settings.tags.length >= 5}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy & Monetization */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={settings.isPrivate}
                    onChange={(e) => setSettings(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isPrivate" className="text-sm font-medium text-gray-700">
                    Private Stream
                  </label>
                </div>
                {settings.isPrivate ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
              </div>

              {settings.isPrivate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    value={settings.price || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, price: parseFloat(e.target.value) || undefined }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-left text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Allow Recording
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.allowRecording}
                    onChange={(e) => setSettings(prev => ({ ...prev, allowRecording: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Enable Chat
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.chatEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, chatEnabled: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Slow Mode
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.slowModeEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, slowModeEnabled: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Followers Only
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.followersOnly}
                    onChange={(e) => setSettings(prev => ({ ...prev, followersOnly: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Start Stream Button */}
            <EnhancedButton
              variant="primary"
              size="lg"
              onClick={handleStartStream}
              disabled={!settings.title.trim() || !isConnected || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Starting Stream...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Live Stream
                </>
              )}
            </EnhancedButton>

            {/* Tips */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Make sure you have good lighting and audio quality</p>
              <p>• Choose engaging tags to help viewers find your stream</p>
              <p>• Interact with your chat to keep viewers engaged</p>
            </div>
          </EnhancedCardContent>
        </EnhancedCard>
      </div>
    </div>
  );
}