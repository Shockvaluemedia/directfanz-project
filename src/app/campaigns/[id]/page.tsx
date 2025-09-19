'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  Star,
  Share2,
  Heart,
  MessageCircle,
  Upload,
  Play,
  Music,
  Video,
  Camera,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: 'MUSIC_PROMOTION' | 'CONTEST' | 'COLLABORATION' | 'EXCLUSIVE_ACCESS';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  startDate: string;
  endDate: string;
  targetAudience: string;
  targetMetrics: {
    participants: number;
    engagement: number;
    submissions: number;
  };
  currentMetrics: {
    participants: number;
    engagement: number;
    submissions: number;
  };
  artist: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
  };
  requirements: string[];
  rewards: string[];
  isParticipating: boolean;
  userSubmissions: any[];
}

interface ParticipationSubmission {
  type: 'text' | 'image' | 'video' | 'audio';
  content: string;
  file?: File;
}

export default function CampaignDetailsPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [participating, setParticipating] = useState(false);
  const [showParticipationModal, setShowParticipationModal] = useState(false);
  const [submission, setSubmission] = useState<ParticipationSubmission>({
    type: 'text',
    content: '',
  });

  useEffect(() => {
    fetchCampaign();
  }, [params.id]);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setCampaign(null);
          return;
        }
        throw new Error('Failed to fetch campaign');
      }

      const data = await response.json();

      // Transform API response to match component expectations
      const transformedCampaign: Campaign = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        type: data.type,
        status: data.status,
        startDate: new Date(data.startDate).toISOString().split('T')[0],
        endDate: new Date(data.endDate).toISOString().split('T')[0],
        targetAudience: 'All fans', // This could come from campaign data
        targetMetrics: {
          participants: data.targetValue || 1000,
          engagement: data.targetValue || 1000,
          submissions: Math.floor((data.targetValue || 1000) * 0.5),
        },
        currentMetrics: {
          participants: data.totalParticipants || 0,
          engagement: data.totalParticipants || 0, // This could be calculated from actual engagement
          submissions:
            data.challenges?.reduce(
              (sum: number, challenge: any) => sum + (challenge.submissionCount || 0),
              0
            ) || 0,
        },
        artist: {
          id: data.artist.id,
          name: data.artist.displayName,
          avatar: data.artist.avatar || '',
          verified: true, // This could come from artist profile
        },
        requirements: [
          'Follow the artist',
          'Submit your entry following the campaign guidelines',
          'Engage with the community',
        ],
        rewards: data.rewards?.map(
          (reward: any) => `${reward.title}: ${reward.description || 'Exclusive prize'}`
        ) || ['Participate for exclusive rewards and recognition'],
        isParticipating: data.userParticipation?.isParticipating || false,
        userSubmissions: data.userParticipation?.submissions || [],
      };

      setCampaign(transformedCampaign);
      setParticipating(transformedCampaign.isParticipating);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast.error('Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join campaign');
      }

      toast.success('Successfully joined the campaign!');
      setParticipating(true);
      setCampaign(prev =>
        prev
          ? {
              ...prev,
              isParticipating: true,
              currentMetrics: {
                ...prev.currentMetrics,
                participants: prev.currentMetrics.participants + 1,
              },
            }
          : null
      );
    } catch (error) {
      console.error('Error joining campaign:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to join campaign');
    }
  };

  const handleSubmission = async () => {
    try {
      const formData = new FormData();
      formData.append('type', submission.type);
      formData.append('content', submission.content);
      formData.append('title', submission.content.slice(0, 100) || 'Campaign Submission');

      if (submission.file) {
        formData.append('file', submission.file);
      }

      const response = await fetch(`/api/campaigns/${params.id}/submissions`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit entry');
      }

      const submissionData = await response.json();

      toast.success('Submission sent successfully!');
      setShowParticipationModal(false);
      setSubmission({ type: 'text', content: '' });

      setCampaign(prev =>
        prev
          ? {
              ...prev,
              userSubmissions: [
                ...prev.userSubmissions,
                {
                  id: submissionData.id,
                  type: submission.type,
                  content: submission.content,
                  timestamp: new Date().toISOString(),
                  status: 'pending',
                },
              ],
              currentMetrics: {
                ...prev.currentMetrics,
                submissions: prev.currentMetrics.submissions + 1,
              },
            }
          : null
      );
    } catch (error) {
      console.error('Error submitting entry:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit entry');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500';
      case 'DRAFT':
        return 'bg-gray-500';
      case 'PAUSED':
        return 'bg-yellow-500';
      case 'COMPLETED':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MUSIC_PROMOTION':
        return <Music className='w-4 h-4' />;
      case 'CONTEST':
        return <Trophy className='w-4 h-4' />;
      case 'COLLABORATION':
        return <Users className='w-4 h-4' />;
      case 'EXCLUSIVE_ACCESS':
        return <Star className='w-4 h-4' />;
      default:
        return <Star className='w-4 h-4' />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600'></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center'>
        <Card className='w-full max-w-md'>
          <CardContent className='pt-6 text-center'>
            <h2 className='text-xl font-semibold mb-2'>Campaign Not Found</h2>
            <p className='text-gray-600 mb-4'>
              The campaign you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => window.history.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = Math.round(
    (campaign.currentMetrics.participants / campaign.targetMetrics.participants) * 100
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-purple-50 to-pink-50'>
      <div className='container mx-auto px-4 py-8 max-w-6xl'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-start justify-between mb-4'>
            <div>
              <div className='flex items-center gap-3 mb-2'>
                <Badge variant='secondary' className='flex items-center gap-1'>
                  {getTypeIcon(campaign.type)}
                  {campaign.type.replace('_', ' ')}
                </Badge>
                <Badge className={`text-white ${getStatusColor(campaign.status)}`}>
                  {campaign.status}
                </Badge>
              </div>
              <h1 className='text-4xl font-bold text-gray-900 mb-2'>{campaign.title}</h1>
              <div className='flex items-center gap-4 text-sm text-gray-600'>
                <div className='flex items-center gap-1'>
                  <Calendar className='w-4 h-4' />
                  {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                </div>
                <div className='flex items-center gap-1'>
                  <Users className='w-4 h-4' />
                  {campaign.currentMetrics.participants} participants
                </div>
              </div>
            </div>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm'>
                <Share2 className='w-4 h-4 mr-1' />
                Share
              </Button>
              <Button variant='outline' size='sm'>
                <Heart className='w-4 h-4 mr-1' />
                Save
              </Button>
            </div>
          </div>

          {/* Artist Info */}
          <Card className='mb-6'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <Avatar className='w-16 h-16'>
                    <AvatarImage src={campaign.artist.avatar} alt={campaign.artist.name} />
                    <AvatarFallback>
                      {campaign.artist.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h3 className='text-xl font-semibold'>{campaign.artist.name}</h3>
                      {campaign.artist.verified && (
                        <Badge variant='secondary' className='text-xs'>
                          <Check className='w-3 h-3 mr-1' />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className='text-gray-600'>Campaign Creator</p>
                  </div>
                </div>
                <Button variant='outline'>Follow Artist</Button>
              </div>
            </CardContent>
          </Card>

          {/* Participation Status & Actions */}
          {campaign.status === 'ACTIVE' && (
            <div className='mb-6'>
              {!participating ? (
                <Card className='bg-gradient-to-r from-purple-500 to-pink-500 text-white'>
                  <CardContent className='pt-6'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-xl font-semibold mb-1'>Ready to participate?</h3>
                        <p className='opacity-90'>
                          Join {campaign.currentMetrics.participants} other fans in this campaign!
                        </p>
                      </div>
                      <Button variant='secondary' size='lg' onClick={handleJoinCampaign}>
                        Join Campaign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className='bg-green-50 border-green-200'>
                  <CardContent className='pt-6'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-green-500 rounded-full flex items-center justify-center'>
                          <Check className='w-4 h-4 text-white' />
                        </div>
                        <div>
                          <h3 className='text-lg font-semibold text-green-800'>
                            You're participating!
                          </h3>
                          <p className='text-green-700'>
                            You have {campaign.userSubmissions.length} submissions
                          </p>
                        </div>
                      </div>
                      <Dialog
                        open={showParticipationModal}
                        onOpenChange={setShowParticipationModal}
                      >
                        <DialogTrigger asChild>
                          <Button className='bg-green-600 hover:bg-green-700'>
                            <Upload className='w-4 h-4 mr-1' />
                            Submit Entry
                          </Button>
                        </DialogTrigger>
                        <DialogContent className='max-w-2xl'>
                          <DialogHeader>
                            <DialogTitle>Submit Your Entry</DialogTitle>
                            <DialogDescription>
                              Share your content for "{campaign.title}"
                            </DialogDescription>
                          </DialogHeader>
                          <div className='space-y-4'>
                            <div>
                              <Label htmlFor='submission-type'>Submission Type</Label>
                              <select
                                id='submission-type'
                                className='w-full p-2 border rounded-md mt-1'
                                value={submission.type}
                                onChange={e =>
                                  setSubmission(prev => ({ ...prev, type: e.target.value as any }))
                                }
                              >
                                <option value='text'>Text Story</option>
                                <option value='image'>Photo</option>
                                <option value='video'>Video</option>
                                <option value='audio'>Audio</option>
                              </select>
                            </div>
                            <div>
                              <Label htmlFor='submission-content'>Content</Label>
                              <Textarea
                                id='submission-content'
                                placeholder='Share your summer memory and favorite songs...'
                                value={submission.content}
                                onChange={e =>
                                  setSubmission(prev => ({ ...prev, content: e.target.value }))
                                }
                                className='mt-1'
                                rows={6}
                              />
                            </div>
                            {submission.type !== 'text' && (
                              <div>
                                <Label htmlFor='submission-file'>Upload File</Label>
                                <Input
                                  id='submission-file'
                                  type='file'
                                  className='mt-1'
                                  accept={
                                    submission.type === 'image'
                                      ? 'image/*'
                                      : submission.type === 'video'
                                        ? 'video/*'
                                        : submission.type === 'audio'
                                          ? 'audio/*'
                                          : '*/*'
                                  }
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setSubmission(prev => ({ ...prev, file }));
                                    }
                                  }}
                                />
                              </div>
                            )}
                            <div className='flex justify-end gap-2'>
                              <Button
                                variant='outline'
                                onClick={() => setShowParticipationModal(false)}
                              >
                                Cancel
                              </Button>
                              <Button onClick={handleSubmission} disabled={!submission.content}>
                                Submit Entry
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left Column - Campaign Details */}
          <div className='lg:col-span-2 space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>About This Campaign</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-gray-700 leading-relaxed'>{campaign.description}</p>
              </CardContent>
            </Card>

            <Tabs defaultValue='requirements' className='w-full'>
              <TabsList className='grid w-full grid-cols-3'>
                <TabsTrigger value='requirements'>Requirements</TabsTrigger>
                <TabsTrigger value='rewards'>Rewards</TabsTrigger>
                <TabsTrigger value='submissions'>Submissions</TabsTrigger>
              </TabsList>

              <TabsContent value='requirements' className='mt-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-lg'>How to Participate</CardTitle>
                    <CardDescription>
                      Complete these requirements to join the campaign
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className='space-y-3'>
                      {campaign.requirements.map((req, index) => (
                        <li key={index} className='flex items-start gap-3'>
                          <div className='w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5'>
                            {index + 1}
                          </div>
                          <span className='text-gray-700'>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='rewards' className='mt-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-lg'>Prizes & Rewards</CardTitle>
                    <CardDescription>What you can win by participating</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className='space-y-4'>
                      {campaign.rewards.map((reward, index) => (
                        <li
                          key={index}
                          className='flex items-start gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg'
                        >
                          <Trophy className='w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                          <span className='text-gray-700'>{reward}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='submissions' className='mt-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-lg'>Recent Submissions</CardTitle>
                    <CardDescription>See what other fans are sharing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='text-center py-8 text-gray-500'>
                      <MessageCircle className='w-12 h-12 mx-auto mb-3 opacity-50' />
                      <p>Submissions will appear here once the campaign is active</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Stats & Progress */}
          <div className='space-y-6'>
            {/* Progress Card */}
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Campaign Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div>
                    <div className='flex justify-between text-sm mb-1'>
                      <span>Participants</span>
                      <span>
                        {campaign.currentMetrics.participants} /{' '}
                        {campaign.targetMetrics.participants}
                      </span>
                    </div>
                    <div className='w-full bg-gray-200 rounded-full h-2'>
                      <div
                        className='bg-purple-600 h-2 rounded-full transition-all duration-300'
                        style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                      ></div>
                    </div>
                    <p className='text-xs text-gray-600 mt-1'>{progressPercentage}% complete</p>
                  </div>

                  <div className='grid grid-cols-2 gap-4 pt-4 border-t'>
                    <div className='text-center'>
                      <div className='text-2xl font-bold text-purple-600'>
                        {campaign.currentMetrics.submissions}
                      </div>
                      <div className='text-xs text-gray-600'>Submissions</div>
                    </div>
                    <div className='text-center'>
                      <div className='text-2xl font-bold text-pink-600'>
                        {campaign.currentMetrics.engagement}
                      </div>
                      <div className='text-xs text-gray-600'>Engagement</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex items-start gap-3'>
                    <div className='w-2 h-2 bg-green-500 rounded-full mt-2'></div>
                    <div>
                      <p className='font-medium text-sm'>Campaign Started</p>
                      <p className='text-xs text-gray-600'>{formatDate(campaign.startDate)}</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <div className='w-2 h-2 bg-gray-300 rounded-full mt-2'></div>
                    <div>
                      <p className='font-medium text-sm'>Campaign Ends</p>
                      <p className='text-xs text-gray-600'>{formatDate(campaign.endDate)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <Button variant='outline' className='w-full justify-start'>
                    <Share2 className='w-4 h-4 mr-2' />
                    Share Campaign
                  </Button>
                  <Button variant='outline' className='w-full justify-start'>
                    <Heart className='w-4 h-4 mr-2' />
                    Save for Later
                  </Button>
                  <Button variant='outline' className='w-full justify-start'>
                    <MessageCircle className='w-4 h-4 mr-2' />
                    Ask Question
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
