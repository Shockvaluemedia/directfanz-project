'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Download,
  Share2,
} from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title: string;
  artist?: string;
  artwork?: string;
  contentId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  className?: string;
}

export function AudioPlayer({
  src,
  title,
  artist,
  artwork,
  contentId,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  // Audio context for visualization
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedData = () => {
      setLoading(false);
      setDuration(audio.duration);
      setupAudioVisualization();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
      trackView();
      startVisualization();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      }
    };

    const handleVolumeChange = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('volumechange', handleVolumeChange);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [onTimeUpdate, onPlay, onPause, onEnded, contentId, isRepeat]);

  // Setup audio visualization
  const setupAudioVisualization = () => {
    const audio = audioRef.current;
    if (!audio || audioContext) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      const analyserNode = ctx.createAnalyser();

      source.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      analyserNode.fftSize = 256;
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArrayBuffer = new Uint8Array(bufferLength);

      setAudioContext(ctx);
      setAnalyser(analyserNode);
      setDataArray(dataArrayBuffer);
    } catch (error) {
      console.error('Failed to setup audio visualization:', error);
    }
  };

  // Visualization animation
  const startVisualization = () => {
    if (!analyser || !dataArray || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const draw = () => {
      if (!isPlaying) return;

      requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgb(15, 23, 42)'; // bg-slate-900
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        const gradient = canvasCtx.createLinearGradient(
          0,
          canvas.height - barHeight,
          0,
          canvas.height
        );
        gradient.addColorStop(0, '#8b5cf6'); // purple-500
        gradient.addColorStop(1, '#3b82f6'); // blue-500

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  // Track view analytics
  const trackView = async () => {
    try {
      await fetch('/api/content/analytics/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0] / 100;
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, currentTime - 10);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, currentTime + 10);
  };

  const toggleRepeat = () => {
    setIsRepeat(!isRepeat);
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <audio ref={audioRef} preload='metadata'>
        <source src={src} />
        Your browser does not support the audio element.
      </audio>

      <CardContent className='p-6'>
        <div className='flex items-center space-x-4 mb-6'>
          {/* Artwork */}
          <div className='flex-shrink-0'>
            {artwork ? (
              <img
                src={artwork}
                alt={title}
                className='w-16 h-16 rounded-lg object-cover shadow-lg'
              />
            ) : (
              <div className='w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg'>
                <Play className='h-6 w-6 text-white' />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className='flex-grow min-w-0'>
            <h3 className='font-semibold text-lg truncate'>{title}</h3>
            {artist && <p className='text-muted-foreground truncate'>{artist}</p>}
          </div>

          {/* Action Buttons */}
          <div className='flex items-center space-x-2'>
            <Button variant='ghost' size='sm'>
              <Share2 className='h-4 w-4' />
            </Button>
            <Button variant='ghost' size='sm'>
              <Download className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {/* Waveform Visualization */}
        <div className='mb-6'>
          <canvas
            ref={canvasRef}
            className='w-full h-20 rounded-lg bg-slate-900'
            width={800}
            height={80}
          />
        </div>

        {/* Progress Bar */}
        <div className='mb-4'>
          <Slider
            value={[duration ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className='w-full'
          />
          <div className='flex justify-between text-sm text-muted-foreground mt-2'>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className='flex items-center justify-center space-x-4 mb-4'>
          <Button
            variant='ghost'
            size='sm'
            onClick={toggleShuffle}
            className={isShuffle ? 'text-primary' : 'text-muted-foreground'}
          >
            <Shuffle className='h-4 w-4' />
          </Button>

          <Button variant='ghost' size='sm' onClick={skipBackward}>
            <SkipBack className='h-5 w-5' />
          </Button>

          <Button
            size='lg'
            onClick={togglePlay}
            className='rounded-full w-12 h-12'
            disabled={loading}
          >
            {isPlaying ? <Pause className='h-6 w-6' /> : <Play className='h-6 w-6 ml-0.5' />}
          </Button>

          <Button variant='ghost' size='sm' onClick={skipForward}>
            <SkipForward className='h-5 w-5' />
          </Button>

          <Button
            variant='ghost'
            size='sm'
            onClick={toggleRepeat}
            className={isRepeat ? 'text-primary' : 'text-muted-foreground'}
          >
            <Repeat className='h-4 w-4' />
          </Button>
        </div>

        {/* Volume Control */}
        <div className='flex items-center space-x-2'>
          <Button variant='ghost' size='sm' onClick={toggleMute}>
            {isMuted || volume === 0 ? (
              <VolumeX className='h-4 w-4' />
            ) : (
              <Volume2 className='h-4 w-4' />
            )}
          </Button>
          <div className='flex-grow max-w-32'>
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
            />
          </div>
          <span className='text-xs text-muted-foreground min-w-8'>
            {Math.round(isMuted ? 0 : volume * 100)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
