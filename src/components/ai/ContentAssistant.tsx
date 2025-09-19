'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  MicrophoneIcon,
  PhotoIcon,
  VideoCameraIcon,
  PaintBrushIcon,
  LightBulbIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';

interface ContentSuggestion {
  id: string;
  type: 'audio' | 'video' | 'image' | 'text';
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  trending: boolean;
}

interface AIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  themes: string[];
  suggestedImprovements: string[];
  targetAudience: string[];
  viralPotential: number;
  engagementScore: number;
}

interface ContentAssistantProps {
  userStyle?: string;
  recentContent?: any[];
  className?: string;
}

export default function ContentAssistant({
  userStyle = 'eclectic',
  recentContent = [],
  className = '',
}: ContentAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'analysis' | 'brainstorm'>(
    'suggestions'
  );
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [brainstormInput, setBrainstormInput] = useState('');
  const [brainstormResults, setBrainstormResults] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Mock AI suggestions based on user style and trends
  const generateSuggestions = async () => {
    setIsAnalyzing(true);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockSuggestions: ContentSuggestion[] = [
      {
        id: '1',
        type: 'audio',
        title: 'Lo-Fi Study Beats Collection',
        description: 'Create a series of calming lo-fi tracks perfect for studying and relaxation',
        prompt: 'Incorporate soft piano melodies with vinyl crackle and subtle rain sounds',
        tags: ['lo-fi', 'study-music', 'relaxation', 'piano'],
        estimatedDuration: 120,
        difficulty: 'intermediate',
        trending: true,
      },
      {
        id: '2',
        type: 'video',
        title: 'Behind-the-Scenes Studio Tour',
        description: 'Give fans an intimate look at your creative process and workspace',
        prompt: 'Show your instruments, explain your songwriting process, share personal stories',
        tags: ['behind-the-scenes', 'studio', 'personal', 'storytelling'],
        estimatedDuration: 15,
        difficulty: 'beginner',
        trending: false,
      },
      {
        id: '3',
        type: 'audio',
        title: 'Collaborative Track with Fan Vocals',
        description: 'Invite fans to submit vocal snippets for a collaborative track',
        prompt: 'Create a base track and ask fans to add their voice, create a community mashup',
        tags: ['collaboration', 'fan-engagement', 'community', 'interactive'],
        estimatedDuration: 180,
        difficulty: 'advanced',
        trending: true,
      },
      {
        id: '4',
        type: 'text',
        title: 'Weekly Creative Journal',
        description: 'Share your creative journey through weekly written reflections',
        prompt: 'Write about your inspirations, challenges, and breakthroughs in your art',
        tags: ['journal', 'personal-growth', 'creativity', 'inspiration'],
        estimatedDuration: 30,
        difficulty: 'beginner',
        trending: false,
      },
      {
        id: '5',
        type: 'video',
        title: 'Live Performance in Unique Location',
        description: 'Perform your music in an unexpected or beautiful location',
        prompt: 'Consider rooftops, forests, abandoned buildings, or underwater studios',
        tags: ['live-performance', 'unique-location', 'visual', 'adventure'],
        estimatedDuration: 45,
        difficulty: 'intermediate',
        trending: true,
      },
    ];

    setSuggestions(mockSuggestions);
    setIsAnalyzing(false);
  };

  // Mock content analysis
  const analyzeContent = async (content: string) => {
    setIsAnalyzing(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockAnalysis: AIAnalysis = {
      sentiment: 'positive',
      themes: ['creativity', 'innovation', 'community', 'authenticity'],
      suggestedImprovements: [
        'Consider adding more personal storytelling elements',
        'Include interactive elements to boost engagement',
        'Optimize for mobile viewing with vertical format',
        'Add captions for accessibility',
      ],
      targetAudience: ['Creative professionals', 'Music enthusiasts', 'Young adults 18-35'],
      viralPotential: 7.8,
      engagementScore: 8.5,
    };

    setAnalysis(mockAnalysis);
    setIsAnalyzing(false);
  };

  // Mock brainstorming
  const handleBrainstorm = async () => {
    if (!brainstormInput.trim()) return;

    setIsAnalyzing(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const ideas = [
      `Create a ${brainstormInput} remix with electronic elements`,
      `Develop a series of short tutorials about ${brainstormInput}`,
      `Host a live Q&A session discussing ${brainstormInput}`,
      `Collaborate with other artists on ${brainstormInput} theme`,
      `Write a blog post about your journey with ${brainstormInput}`,
      `Create exclusive behind-the-scenes content about ${brainstormInput}`,
    ];

    setBrainstormResults(ideas);
    setIsAnalyzing(false);
  };

  // Voice recording simulation
  const toggleVoiceRecording = () => {
    setIsListening(!isListening);

    if (!isListening) {
      // Start recording
      setTimeout(() => {
        setBrainstormInput('Acoustic guitar melodies');
        setIsListening(false);
      }, 3000);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'audio':
        return MicrophoneIcon;
      case 'video':
        return VideoCameraIcon;
      case 'image':
        return PhotoIcon;
      case 'text':
        return PaintBrushIcon;
      default:
        return LightBulbIcon;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'audio':
        return 'from-purple-500 to-pink-500';
      case 'video':
        return 'from-blue-500 to-indigo-500';
      case 'image':
        return 'from-green-500 to-emerald-500';
      case 'text':
        return 'from-orange-500 to-red-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-600 bg-green-100';
      case 'intermediate':
        return 'text-yellow-600 bg-yellow-100';
      case 'advanced':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Load suggestions on component mount
  useEffect(() => {
    if (isOpen && suggestions.length === 0) {
      generateSuggestions();
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      {/* Floating AI Assistant Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className='fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg flex items-center justify-center z-50 hover:shadow-xl transition-shadow'
      >
        <SparklesIcon className='w-6 h-6 text-white' />
        {isAnalyzing && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className='absolute inset-0 border-2 border-white border-t-transparent rounded-full'
          />
        )}
      </motion.button>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: 'spring', damping: 25 }}
            className='fixed top-0 right-0 w-96 h-full bg-white shadow-2xl z-40 overflow-hidden'
          >
            <div className='flex flex-col h-full'>
              {/* Header */}
              <div className='bg-gradient-to-r from-purple-600 to-pink-600 p-4 text-white'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center space-x-2'>
                    <SparklesIcon className='w-6 h-6' />
                    <h3 className='text-lg font-semibold'>AI Creative Assistant</h3>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className='p-1 hover:bg-white/20 rounded-full transition-colors'
                  >
                    <XMarkIcon className='w-5 h-5' />
                  </button>
                </div>

                {/* Tab Navigation */}
                <div className='flex mt-4 space-x-1'>
                  {[
                    { id: 'suggestions', label: 'Ideas', icon: LightBulbIcon },
                    { id: 'analysis', label: 'Analysis', icon: CheckIcon },
                    { id: 'brainstorm', label: 'Brainstorm', icon: SparklesIcon },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <tab.icon className='w-4 h-4' />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className='flex-1 overflow-y-auto'>
                {/* Suggestions Tab */}
                {activeTab === 'suggestions' && (
                  <div className='p-4'>
                    <div className='flex items-center justify-between mb-4'>
                      <h4 className='font-semibold text-gray-900'>Personalized Content Ideas</h4>
                      <button
                        onClick={generateSuggestions}
                        disabled={isAnalyzing}
                        className='p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50'
                      >
                        <ArrowPathIcon
                          className={`w-5 h-5 text-gray-600 ${isAnalyzing ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>

                    <div className='space-y-4'>
                      {suggestions.map(suggestion => {
                        const IconComponent = getTypeIcon(suggestion.type);
                        return (
                          <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className='border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow'
                          >
                            <div className='flex items-start space-x-3'>
                              <div
                                className={`w-10 h-10 rounded-lg bg-gradient-to-r ${getTypeColor(suggestion.type)} flex items-center justify-center flex-shrink-0`}
                              >
                                <IconComponent className='w-5 h-5 text-white' />
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='flex items-center space-x-2 mb-1'>
                                  <h5 className='font-medium text-gray-900 truncate'>
                                    {suggestion.title}
                                  </h5>
                                  {suggestion.trending && (
                                    <span className='px-1.5 py-0.5 text-xs font-medium text-orange-600 bg-orange-100 rounded'>
                                      🔥 Trending
                                    </span>
                                  )}
                                </div>
                                <p className='text-sm text-gray-600 mb-2'>
                                  {suggestion.description}
                                </p>
                                <p className='text-xs text-gray-500 italic mb-3'>
                                  "{suggestion.prompt}"
                                </p>

                                <div className='flex items-center justify-between'>
                                  <div className='flex items-center space-x-2'>
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(suggestion.difficulty)}`}
                                    >
                                      {suggestion.difficulty}
                                    </span>
                                    <span className='text-xs text-gray-500'>
                                      ~{suggestion.estimatedDuration} min
                                    </span>
                                  </div>
                                </div>

                                <div className='flex flex-wrap gap-1 mt-2'>
                                  {suggestion.tags.slice(0, 3).map(tag => (
                                    <span
                                      key={tag}
                                      className='px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded'
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Analysis Tab */}
                {activeTab === 'analysis' && (
                  <div className='p-4'>
                    <div className='mb-4'>
                      <h4 className='font-semibold text-gray-900 mb-2'>Content Analysis</h4>
                      <textarea
                        placeholder='Paste your content or description here for AI analysis...'
                        rows={4}
                        className='w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                        onBlur={e => {
                          if (e.target.value.trim()) {
                            analyzeContent(e.target.value);
                          }
                        }}
                      />
                    </div>

                    {analysis && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className='space-y-4'
                      >
                        {/* Scores */}
                        <div className='grid grid-cols-2 gap-4'>
                          <div className='bg-green-50 p-3 rounded-lg'>
                            <p className='text-sm text-green-600 font-medium'>Viral Potential</p>
                            <p className='text-2xl font-bold text-green-700'>
                              {analysis.viralPotential}/10
                            </p>
                          </div>
                          <div className='bg-blue-50 p-3 rounded-lg'>
                            <p className='text-sm text-blue-600 font-medium'>Engagement Score</p>
                            <p className='text-2xl font-bold text-blue-700'>
                              {analysis.engagementScore}/10
                            </p>
                          </div>
                        </div>

                        {/* Themes */}
                        <div>
                          <h5 className='font-medium text-gray-900 mb-2'>Detected Themes</h5>
                          <div className='flex flex-wrap gap-2'>
                            {analysis.themes.map(theme => (
                              <span
                                key={theme}
                                className='px-2 py-1 text-sm bg-purple-100 text-purple-700 rounded'
                              >
                                {theme}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Improvements */}
                        <div>
                          <h5 className='font-medium text-gray-900 mb-2'>Suggested Improvements</h5>
                          <ul className='space-y-2'>
                            {analysis.suggestedImprovements.map((improvement, index) => (
                              <li
                                key={index}
                                className='flex items-start space-x-2 text-sm text-gray-600'
                              >
                                <CheckIcon className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
                                <span>{improvement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Target Audience */}
                        <div>
                          <h5 className='font-medium text-gray-900 mb-2'>Target Audience</h5>
                          <div className='space-y-1'>
                            {analysis.targetAudience.map(audience => (
                              <span
                                key={audience}
                                className='inline-block px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded mr-2 mb-1'
                              >
                                {audience}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Brainstorm Tab */}
                {activeTab === 'brainstorm' && (
                  <div className='p-4'>
                    <div className='mb-4'>
                      <h4 className='font-semibold text-gray-900 mb-2'>Creative Brainstorm</h4>
                      <div className='flex space-x-2'>
                        <input
                          type='text'
                          placeholder='What do you want to create content about?'
                          value={brainstormInput}
                          onChange={e => setBrainstormInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleBrainstorm()}
                          className='flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                        />
                        <button
                          onClick={toggleVoiceRecording}
                          className={`p-3 rounded-lg transition-colors ${
                            isListening
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {isListening ? (
                            <StopIcon className='w-5 h-5' />
                          ) : (
                            <MicrophoneIcon className='w-5 h-5' />
                          )}
                        </button>
                      </div>
                      <button
                        onClick={handleBrainstorm}
                        disabled={!brainstormInput.trim() || isAnalyzing}
                        className='w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50'
                      >
                        {isAnalyzing ? 'Generating Ideas...' : 'Generate Ideas'}
                      </button>
                    </div>

                    {brainstormResults.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h5 className='font-medium text-gray-900 mb-3'>AI-Generated Ideas</h5>
                        <div className='space-y-2'>
                          {brainstormResults.map((idea, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className='p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg'
                            >
                              <p className='text-sm text-gray-700'>{idea}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
