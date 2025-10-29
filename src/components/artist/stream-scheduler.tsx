'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  CalendarIcon,
  ClockIcon,
  VideoCameraIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  UsersIcon,
  PlayIcon,
  StopIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import WebRTCBroadcaster from '@/components/livestream/webrtc-broadcaster';

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  isRecorded: boolean;
  isPublic: boolean;
  requiresPayment: boolean;
  paymentAmount?: number;
  maxViewers: number;
  tierIds: string[];
  totalViewers: number;
  totalMessages: number;
  totalTips: number;
  peakViewers: number;
  streamKey?: string;
  createdAt: string;
}

interface Tier {
  id: string;
  name: string;
  minimumPrice: number;
}

interface StreamFormData {
  title: string;
  description: string;
  scheduledAt: string;
  isRecorded: boolean;
  tierIds: string[];
  isPublic: boolean;
  requiresPayment: boolean;
  paymentAmount: number;
  maxViewers: number;
}

export default function StreamScheduler() {
  const { data: session } = useSession();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState<LiveStream | null>(null);
  const [streamingModal, setStreamingModal] = useState<{ show: boolean; stream: LiveStream | null }>({ show: false, stream: null });
  const [viewerCount, setViewerCount] = useState(0);
  const [formData, setFormData] = useState<StreamFormData>({
    title: '',
    description: '',
    scheduledAt: '',
    isRecorded: false,
    tierIds: [],
    isPublic: true,
    requiresPayment: false,
    paymentAmount: 0,
    maxViewers: 1000,
  });

  useEffect(() => {
    if (session?.user) {
      fetchStreams();
      fetchTiers();
    }
  }, [session]);

  const fetchStreams = async () => {
    try {
      const response = await fetch('/api/livestream');
      if (response.ok) {
        const data = await response.json();
        setStreams(data.data.streams);
      }
    } catch (error) {
      console.error('Failed to fetch streams:', error);
      toast.error('Failed to load streams');
    } finally {
      setLoading(false);
    }
  };

  const fetchTiers = async () => {
    try {
      const response = await fetch('/api/artist/tiers');
      if (response.ok) {
        const data = await response.json();
        setTiers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    const submitData = {
      ...formData,
      scheduledAt: formData.scheduledAt || undefined,
      paymentAmount: formData.requiresPayment ? formData.paymentAmount : undefined,
    };

    try {
      const url = editingStream ? `/api/livestream/${editingStream.id}` : '/api/livestream';

      const method = editingStream ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        toast.success(
          editingStream ? 'Stream updated successfully' : 'Stream scheduled successfully'
        );
        resetForm();
        fetchStreams();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to save stream');
      }
    } catch (error) {
      console.error('Failed to save stream:', error);
      toast.error('Failed to save stream');
    }
  };

  const handleStartStream = (stream: LiveStream) => {
    setStreamingModal({ show: true, stream });
  };

  const handleStreamStart = () => {
    if (streamingModal.stream) {
      updateStreamStatus(streamingModal.stream.id, 'LIVE');
      toast.success('Stream started! You are now live.');
    }
  };

  const handleStreamEnd = () => {
    if (streamingModal.stream) {
      updateStreamStatus(streamingModal.stream.id, 'ENDED');
      setStreamingModal({ show: false, stream: null });
      toast.success('Stream ended');
    }
  };

  const updateStreamStatus = async (streamId: string, status: string) => {
    try {
      const response = await fetch(`/api/livestream/${streamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchStreams();
      }
    } catch (error) {
      console.error('Failed to update stream status:', error);
    }
  };

  const handleEndStreamButton = async (streamId: string) => {
    if (confirm('Are you sure you want to end this stream?')) {
      updateStreamStatus(streamId, 'ENDED');
      toast.success('Stream ended');
    }
  };

  const handleDeleteStream = async (streamId: string) => {
    if (!confirm('Are you sure you want to delete this stream? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/livestream/${streamId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Stream deleted');
        fetchStreams();
      } else {
        toast.error('Failed to delete stream');
      }
    } catch (error) {
      console.error('Failed to delete stream:', error);
      toast.error('Failed to delete stream');
    }
  };

  const startEdit = (stream: LiveStream) => {
    setEditingStream(stream);
    setFormData({
      title: stream.title,
      description: stream.description || '',
      scheduledAt: stream.scheduledAt
        ? new Date(stream.scheduledAt).toISOString().slice(0, 16)
        : '',
      isRecorded: stream.isRecorded,
      tierIds: stream.tierIds,
      isPublic: stream.isPublic,
      requiresPayment: stream.requiresPayment,
      paymentAmount: stream.paymentAmount || 0,
      maxViewers: stream.maxViewers,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduledAt: '',
      isRecorded: false,
      tierIds: [],
      isPublic: true,
      requiresPayment: false,
      paymentAmount: 0,
      maxViewers: 1000,
    });
    setEditingStream(null);
    setShowForm(false);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      SCHEDULED: 'bg-blue-100 text-blue-800',
      LIVE: 'bg-red-100 text-red-800 animate-pulse',
      ENDED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };

    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>Live Streams</h2>
          <p className='text-gray-600'>Schedule and manage your live streaming sessions</p>
        </div>
        <Button onClick={() => setShowForm(true)} className='flex items-center space-x-2'>
          <PlusIcon className='h-5 w-5' />
          <span>Schedule Stream</span>
        </Button>
      </div>

      {/* Stream Form Modal */}
      {showForm && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-6'>
              <h3 className='text-xl font-semibold'>
                {editingStream ? 'Edit Stream' : 'Schedule New Stream'}
              </h3>
              <button onClick={resetForm} className='text-gray-400 hover:text-gray-600'>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
              {/* Title */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Stream Title *
                </label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  placeholder='Enter stream title...'
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  placeholder='What will you be streaming about?'
                />
              </div>

              {/* Scheduled Time */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Scheduled Time (optional)
                </label>
                <input
                  type='datetime-local'
                  value={formData.scheduledAt}
                  onChange={e => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className='text-xs text-gray-500 mt-1'>
                  Leave empty to go live immediately after creation
                </p>
              </div>

              {/* Access Control */}
              <div className='space-y-3'>
                <div className='flex items-center'>
                  <input
                    type='checkbox'
                    id='isPublic'
                    checked={formData.isPublic}
                    onChange={e => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className='mr-2'
                  />
                  <label htmlFor='isPublic' className='text-sm font-medium text-gray-700'>
                    Public Stream (anyone can watch)
                  </label>
                </div>

                {!formData.isPublic && (
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Required Subscription Tiers
                    </label>
                    <div className='space-y-2 max-h-32 overflow-y-auto'>
                      {tiers.map(tier => (
                        <label key={tier.id} className='flex items-center'>
                          <input
                            type='checkbox'
                            checked={formData.tierIds.includes(tier.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  tierIds: [...prev.tierIds, tier.id],
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  tierIds: prev.tierIds.filter(id => id !== tier.id),
                                }));
                              }
                            }}
                            className='mr-2'
                          />
                          <span className='text-sm'>
                            {tier.name} (${tier.minimumPrice}/month)
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recording */}
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='isRecorded'
                  checked={formData.isRecorded}
                  onChange={e => setFormData(prev => ({ ...prev, isRecorded: e.target.checked }))}
                  className='mr-2'
                />
                <label htmlFor='isRecorded' className='text-sm font-medium text-gray-700'>
                  Record this stream
                </label>
              </div>

              {/* Max Viewers */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Maximum Viewers
                </label>
                <input
                  type='number'
                  min='1'
                  max='10000'
                  value={formData.maxViewers}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, maxViewers: parseInt(e.target.value) }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              {/* Payment */}
              <div className='space-y-3'>
                <div className='flex items-center'>
                  <input
                    type='checkbox'
                    id='requiresPayment'
                    checked={formData.requiresPayment}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, requiresPayment: e.target.checked }))
                    }
                    className='mr-2'
                  />
                  <label htmlFor='requiresPayment' className='text-sm font-medium text-gray-700'>
                    Require payment to access
                  </label>
                </div>

                {formData.requiresPayment && (
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Access Price ($)
                    </label>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={formData.paymentAmount}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          paymentAmount: parseFloat(e.target.value),
                        }))
                      }
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className='flex justify-end space-x-3 pt-6'>
                <Button type='button' variant='outline' onClick={resetForm}>
                  Cancel
                </Button>
                <Button type='submit'>{editingStream ? 'Update Stream' : 'Schedule Stream'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Streams List */}
      <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
        {streams.map(stream => (
          <Card key={stream.id} className='overflow-hidden'>
            <CardHeader className='pb-3'>
              <div className='flex justify-between items-start'>
                <CardTitle className='text-lg line-clamp-2'>{stream.title}</CardTitle>
                <Badge className={getStatusBadge(stream.status)}>{stream.status}</Badge>
              </div>
              {stream.description && (
                <p className='text-sm text-gray-600 line-clamp-2'>{stream.description}</p>
              )}
            </CardHeader>

            <CardContent className='space-y-4'>
              {/* Schedule Info */}
              <div className='flex items-center text-sm text-gray-600'>
                {stream.scheduledAt && (
                  <>
                    <CalendarIcon className='h-4 w-4 mr-1' />
                    <span>Scheduled: {formatDateTime(stream.scheduledAt)}</span>
                  </>
                )}
                {stream.startedAt && (
                  <>
                    <ClockIcon className='h-4 w-4 mr-1' />
                    <span>Started: {formatDateTime(stream.startedAt)}</span>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div className='flex items-center'>
                  <UsersIcon className='h-4 w-4 mr-1 text-gray-400' />
                  <span>{stream.totalViewers} viewers</span>
                </div>
                <div className='flex items-center'>
                  <EyeIcon className='h-4 w-4 mr-1 text-gray-400' />
                  <span>Peak: {stream.peakViewers}</span>
                </div>
              </div>

              {/* Access Type */}
              <div className='flex flex-wrap gap-2'>
                {stream.isPublic ? (
                  <Badge variant='outline'>Public</Badge>
                ) : (
                  <Badge variant='outline'>Private</Badge>
                )}
                {stream.isRecorded && <Badge variant='outline'>Recorded</Badge>}
                {stream.requiresPayment && <Badge variant='outline'>${stream.paymentAmount}</Badge>}
              </div>

              {/* Actions */}
              <div className='flex justify-between items-center pt-2'>
                <div className='flex space-x-2'>
                  <button
                    onClick={() => startEdit(stream)}
                    className='p-1 text-gray-400 hover:text-blue-600'
                    disabled={stream.status === 'LIVE'}
                  >
                    <PencilIcon className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => handleDeleteStream(stream.id)}
                    className='p-1 text-gray-400 hover:text-red-600'
                    disabled={stream.status === 'LIVE'}
                  >
                    <TrashIcon className='h-4 w-4' />
                  </button>
                </div>

                <div className='flex space-x-2'>
                  {stream.status === 'SCHEDULED' && (
                    <Button
                      size='sm'
                      onClick={() => handleStartStream(stream)}
                      className='flex items-center space-x-1'
                    >
                      <PlayIcon className='h-4 w-4' />
                      <span>Go Live</span>
                    </Button>
                  )}
                  {stream.status === 'LIVE' && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleEndStreamButton(stream.id)}
                      className='flex items-center space-x-1 border-red-300 text-red-600 hover:bg-red-50'
                    >
                      <StopIcon className='h-4 w-4' />
                      <span>End</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {streams.length === 0 && (
        <div className='text-center py-12'>
          <VideoCameraIcon className='mx-auto h-16 w-16 text-gray-300' />
          <h3 className='mt-4 text-lg font-medium text-gray-900'>No streams scheduled</h3>
          <p className='mt-2 text-gray-500'>
            Schedule your first live stream to engage with your fans in real-time.
          </p>
          <Button onClick={() => setShowForm(true)} className='mt-4'>
            <PlusIcon className='h-5 w-5 mr-2' />
            Schedule Your First Stream
          </Button>
        </div>
      )}
      
      {/* WebRTC Streaming Modal */}
      {streamingModal.show && streamingModal.stream && (
        <div className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col'>
            {/* Modal Header */}
            <div className='flex justify-between items-center p-6 border-b'>
              <div>
                <h2 className='text-2xl font-bold text-gray-900 flex items-center'>
                  <VideoCameraIcon className='h-6 w-6 mr-2 text-red-600' />
                  {streamingModal.stream.title}
                </h2>
                <p className='text-gray-600 mt-1'>Live Streaming Control Panel</p>
              </div>
              <div className='flex items-center space-x-4'>
                <div className='flex items-center space-x-2 text-sm text-gray-600'>
                  <UsersIcon className='h-4 w-4' />
                  <span>{viewerCount} viewers</span>
                </div>
                <button
                  onClick={() => setStreamingModal({ show: false, stream: null })}
                  className='text-gray-400 hover:text-gray-600 p-2'
                >
                  <XMarkIcon className='h-6 w-6' />
                </button>
              </div>
            </div>
            
            {/* WebRTC Broadcaster */}
            <div className='flex-1 p-6 overflow-auto'>
              <WebRTCBroadcaster
                streamId={streamingModal.stream.id}
                streamKey={streamingModal.stream.streamKey || ''}
                onStreamStart={handleStreamStart}
                onStreamEnd={handleStreamEnd}
                onViewerCountChange={setViewerCount}
              />
            </div>
            
            {/* Stream Info Panel */}
            <div className='bg-gray-50 p-4 border-t'>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                <div>
                  <span className='font-medium text-gray-700'>Stream ID:</span>
                  <p className='text-gray-600 font-mono text-xs'>{streamingModal.stream.id}</p>
                </div>
                <div>
                  <span className='font-medium text-gray-700'>Status:</span>
                  <Badge className={getStatusBadge(streamingModal.stream.status)}>
                    {streamingModal.stream.status}
                  </Badge>
                </div>
                <div>
                  <span className='font-medium text-gray-700'>Max Viewers:</span>
                  <p className='text-gray-600'>{streamingModal.stream.maxViewers}</p>
                </div>
                <div>
                  <span className='font-medium text-gray-700'>Access:</span>
                  <p className='text-gray-600'>
                    {streamingModal.stream.isPublic ? 'Public' : 'Private'}
                    {streamingModal.stream.requiresPayment && ` • $${streamingModal.stream.paymentAmount}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
