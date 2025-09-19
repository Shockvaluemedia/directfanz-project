'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UsersIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ShareIcon,
  DocumentIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  CameraIcon,
  ArrowUpTrayIcon,
  HandRaisedIcon,
  EyeIcon,
  HeartIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  role: 'creator' | 'viewer' | 'contributor';
  status: 'online' | 'away' | 'offline';
  isActivelyContributing: boolean;
  cursor?: { x: number; y: number };
}

interface StudioElement {
  id: string;
  type: 'audio' | 'video' | 'image' | 'text' | 'drawing';
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdBy: string;
  timestamp: Date;
  version: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'reaction';
}

interface CollaborationStudioProps {
  studioId: string;
  currentUser: {
    id: string;
    name: string;
    avatar: string;
  };
  onSave?: (elements: StudioElement[]) => void;
  className?: string;
}

export default function CollaborationStudio({
  studioId,
  currentUser,
  onSave,
  className = '',
}: CollaborationStudioProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [studioElements, setStudioElements] = useState<StudioElement[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedTool, setSelectedTool] = useState<
    'select' | 'audio' | 'video' | 'image' | 'text' | 'draw'
  >('select');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [audienceCount, setAudienceCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<{ isDrawing: boolean; lastPoint: { x: number; y: number } | null }>({
    isDrawing: false,
    lastPoint: null,
  });

  // Mock real-time collaboration data
  useEffect(() => {
    // Simulate collaborators joining
    const mockCollaborators: Collaborator[] = [
      {
        id: '1',
        name: 'Alex Rivera',
        avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
        role: 'creator',
        status: 'online',
        isActivelyContributing: true,
      },
      {
        id: '2',
        name: 'Jamie Chen',
        avatar: 'https://ui-avatars.com/api/?name=Jamie+Chen&background=8b5cf6&color=fff',
        role: 'contributor',
        status: 'online',
        isActivelyContributing: false,
      },
      {
        id: '3',
        name: 'Morgan Taylor',
        avatar: 'https://ui-avatars.com/api/?name=Morgan+Taylor&background=ec4899&color=fff',
        role: 'viewer',
        status: 'online',
        isActivelyContributing: false,
      },
    ];

    setCollaborators(mockCollaborators);
    setAudienceCount(Math.floor(Math.random() * 100) + 20);

    // Simulate chat messages
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        userId: '1',
        message: 'Hey everyone! Ready to create something amazing together?',
        timestamp: new Date(Date.now() - 300000),
        type: 'text',
      },
      {
        id: '2',
        userId: 'system',
        message: 'Jamie Chen joined the studio',
        timestamp: new Date(Date.now() - 240000),
        type: 'system',
      },
      {
        id: '3',
        userId: '2',
        message: 'This real-time collaboration is incredible! 🎵',
        timestamp: new Date(Date.now() - 180000),
        type: 'text',
      },
    ];

    setChatMessages(mockMessages);

    // Simulate live audience updates
    const audienceInterval = setInterval(() => {
      if (isLiveMode) {
        setAudienceCount(prev => prev + Math.floor(Math.random() * 5) - 2);
      }
    }, 5000);

    return () => clearInterval(audienceInterval);
  }, [isLiveMode]);

  // Handle canvas drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'draw') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawingRef.current = { isDrawing: true, lastPoint: { x, y } };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.isDrawing || selectedTool !== 'draw') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (drawingRef.current.lastPoint) {
      ctx.moveTo(drawingRef.current.lastPoint.x, drawingRef.current.lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    drawingRef.current.lastPoint = { x, y };
  };

  const stopDrawing = () => {
    if (drawingRef.current.isDrawing) {
      // Save drawing as studio element
      const canvas = canvasRef.current;
      if (canvas) {
        const dataURL = canvas.toDataURL();
        const newElement: StudioElement = {
          id: `drawing-${Date.now()}`,
          type: 'drawing',
          content: dataURL,
          position: { x: 0, y: 0 },
          size: { width: canvas.width, height: canvas.height },
          createdBy: currentUser.id,
          timestamp: new Date(),
          version: 1,
        };
        setStudioElements(prev => [...prev, newElement]);
      }
    }
    drawingRef.current = { isDrawing: false, lastPoint: null };
  };

  // Handle chat
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: currentUser.id,
      message: chatInput,
      timestamp: new Date(),
      type: 'text',
    };

    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  // Toggle live streaming
  const toggleLiveMode = () => {
    setIsLiveMode(!isLiveMode);
    if (!isLiveMode) {
      const systemMessage: ChatMessage = {
        id: `live-${Date.now()}`,
        userId: 'system',
        message: 'Started live streaming to audience',
        timestamp: new Date(),
        type: 'system',
      };
      setChatMessages(prev => [...prev, systemMessage]);
    }
  };

  // Simulate recording
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    const action = isRecording ? 'stopped' : 'started';
    const systemMessage: ChatMessage = {
      id: `rec-${Date.now()}`,
      userId: 'system',
      message: `Recording ${action}`,
      timestamp: new Date(),
      type: 'system',
    };
    setChatMessages(prev => [...prev, systemMessage]);
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'audio':
        return MicrophoneIcon;
      case 'video':
        return VideoCameraIcon;
      case 'image':
        return CameraIcon;
      case 'text':
        return DocumentIcon;
      case 'draw':
        return PaintBrushIcon;
      default:
        return UsersIcon;
    }
  };

  return (
    <div className={`flex h-screen bg-gray-50 ${className}`}>
      {/* Main Studio Area */}
      <div className='flex-1 flex flex-col'>
        {/* Header */}
        <div className='bg-white border-b border-gray-200 px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <h1 className='text-xl font-semibold text-gray-900'>Collaboration Studio</h1>
              <div className='flex items-center space-x-2'>
                {isLiveMode && (
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className='flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm'
                  >
                    <div className='w-2 h-2 bg-red-500 rounded-full'></div>
                    <span>LIVE</span>
                    <EyeIcon className='w-4 h-4 ml-1' />
                    <span>{audienceCount}</span>
                  </motion.div>
                )}
                {isRecording && (
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className='flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm'
                  >
                    <div className='w-2 h-2 bg-red-500 rounded-full'></div>
                    <span>REC</span>
                  </motion.div>
                )}
              </div>
            </div>

            <div className='flex items-center space-x-2'>
              {/* Collaborator Avatars */}
              <div className='flex items-center space-x-1'>
                {collaborators.slice(0, 4).map((collaborator, index) => (
                  <div key={collaborator.id} className='relative'>
                    <img
                      src={collaborator.avatar}
                      alt={collaborator.name}
                      className='w-8 h-8 rounded-full border-2 border-white shadow-sm'
                      style={{ zIndex: collaborators.length - index }}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        collaborator.status === 'online'
                          ? 'bg-green-400'
                          : collaborator.status === 'away'
                            ? 'bg-yellow-400'
                            : 'bg-gray-400'
                      }`}
                    ></div>
                  </div>
                ))}
                {collaborators.length > 4 && (
                  <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600'>
                    +{collaborators.length - 4}
                  </div>
                )}
              </div>

              <button
                onClick={toggleLiveMode}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isLiveMode
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {isLiveMode ? 'Stop Live' : 'Go Live'}
              </button>

              <button
                onClick={toggleRecording}
                className={`p-2 rounded-lg transition-colors ${
                  isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isRecording ? (
                  <StopIcon className='w-5 h-5' />
                ) : (
                  <div className='w-5 h-5 bg-current rounded-full'></div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className='bg-white border-b border-gray-200 px-6 py-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-1'>
              {[
                { id: 'select', icon: UsersIcon, label: 'Select' },
                { id: 'audio', icon: MicrophoneIcon, label: 'Audio' },
                { id: 'video', icon: VideoCameraIcon, label: 'Video' },
                { id: 'image', icon: CameraIcon, label: 'Image' },
                { id: 'text', icon: DocumentIcon, label: 'Text' },
                { id: 'draw', icon: PaintBrushIcon, label: 'Draw' },
              ].map(tool => {
                const IconComponent = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id as any)}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedTool === tool.id
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={tool.label}
                  >
                    <IconComponent className='w-5 h-5' />
                  </button>
                );
              })}
            </div>

            <div className='flex items-center space-x-2'>
              <button className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'>
                Undo
              </button>
              <button className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'>
                Redo
              </button>
              <button
                onClick={() => onSave?.(studioElements)}
                className='px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors'
              >
                Save Project
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className='flex-1 relative overflow-hidden'>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className='absolute inset-0 w-full h-full cursor-crosshair bg-white'
            style={{ cursor: selectedTool === 'draw' ? 'crosshair' : 'default' }}
          />

          {/* Studio Elements */}
          {studioElements.map(element => (
            <motion.div
              key={element.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: 'absolute',
                left: element.position.x,
                top: element.position.y,
                width: element.size.width,
                height: element.size.height,
              }}
              className='border-2 border-transparent hover:border-indigo-300 rounded-lg'
            >
              {element.type === 'drawing' && (
                <img src={element.content} alt='Drawing' className='w-full h-full object-contain' />
              )}
              {element.type === 'text' && (
                <div className='p-2 bg-yellow-100 rounded-lg'>
                  <p className='text-sm'>{element.content}</p>
                </div>
              )}
            </motion.div>
          ))}

          {/* Collaboration Cursors */}
          {collaborators
            .filter(c => c.cursor && c.isActivelyContributing)
            .map(collaborator => (
              <motion.div
                key={`cursor-${collaborator.id}`}
                style={{
                  position: 'absolute',
                  left: collaborator.cursor!.x,
                  top: collaborator.cursor!.y,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='pointer-events-none'
              >
                <div className='flex items-center space-x-1'>
                  <div className='w-4 h-4 bg-indigo-500 rounded-full'></div>
                  <span className='px-2 py-1 text-xs font-medium text-white bg-indigo-500 rounded'>
                    {collaborator.name}
                  </span>
                </div>
              </motion.div>
            ))}
        </div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className='bg-white border-l border-gray-200 flex flex-col'
          >
            {/* Chat Header */}
            <div className='px-4 py-3 border-b border-gray-200 flex items-center justify-between'>
              <h3 className='font-medium text-gray-900'>Studio Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className='p-1 text-gray-400 hover:text-gray-600 rounded'
              >
                <ChatBubbleLeftRightIcon className='w-5 h-5' />
              </button>
            </div>

            {/* Chat Messages */}
            <div className='flex-1 overflow-y-auto p-4 space-y-3'>
              {chatMessages.map(message => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${
                    message.type === 'system'
                      ? 'text-center text-sm text-gray-500 italic'
                      : message.userId === currentUser.id
                        ? 'text-right'
                        : 'text-left'
                  }`}
                >
                  {message.type === 'system' ? (
                    <p>{message.message}</p>
                  ) : (
                    <div
                      className={`inline-block max-w-xs px-3 py-2 rounded-lg ${
                        message.userId === currentUser.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.userId !== currentUser.id && (
                        <p className='text-xs font-medium mb-1'>
                          {collaborators.find(c => c.id === message.userId)?.name || 'Unknown'}
                        </p>
                      )}
                      <p className='text-sm'>{message.message}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Chat Input */}
            <div className='p-4 border-t border-gray-200'>
              <div className='flex space-x-2'>
                <input
                  type='text'
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder='Type a message...'
                  className='flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className='px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Toggle Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className='fixed bottom-6 right-20 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center'
        >
          <ChatBubbleLeftRightIcon className='w-6 h-6' />
        </button>
      )}
    </div>
  );
}
