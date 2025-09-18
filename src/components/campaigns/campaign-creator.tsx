'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CampaignData {
  title: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  targetMetric: string;
  targetValue: number;
}

const campaignTypes = [
  'PROMOTIONAL',
  'CHALLENGE', 
  'ENGAGEMENT',
  'LAUNCH',
  'COMMUNITY',
  'SEASONAL'
] as const;

export default function CampaignCreator() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [campaignData, setCampaignData] = useState<CampaignData>({
    title: '',
    description: '',
    type: '',
    startDate: '',
    endDate: '',
    targetMetric: 'PARTICIPANTS',
    targetValue: 100
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.id) {
      toast.error('You must be logged in to create campaigns');
      return;
    }
    
    if (!campaignData.title || !campaignData.description || !campaignData.type) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create campaign');
      }

      const campaign = await response.json();
      toast.success('Campaign created successfully!');
      router.push(`/dashboard/campaigns/${campaign.id}`);
      
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="title">Campaign Title *</Label>
              <Input
                id="title"
                value={campaignData.title}
                onChange={(e) => setCampaignData({ ...campaignData, title: e.target.value })}
                placeholder="Enter campaign title"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={campaignData.description}
                onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
                placeholder="Describe your campaign"
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Campaign Type *</Label>
              <select
                id="type"
                value={campaignData.type}
                onChange={(e) => setCampaignData({ ...campaignData, type: e.target.value })}
                className="w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2"
                required
              >
                <option value="">Select a type</option>
                {campaignTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={campaignData.startDate}
                  onChange={(e) => setCampaignData({ ...campaignData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={campaignData.endDate}
                  onChange={(e) => setCampaignData({ ...campaignData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="targetMetric">Target Metric</Label>
              <select
                id="targetMetric"
                value={campaignData.targetMetric}
                onChange={(e) => setCampaignData({ ...campaignData, targetMetric: e.target.value })}
                className="w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2"
              >
                <option value="PARTICIPANTS">Participants</option>
                <option value="SUBMISSIONS">Submissions</option>
                <option value="ENGAGEMENT">Engagement</option>
                <option value="VIEWS">Views</option>
                <option value="SHARES">Shares</option>
              </select>
            </div>

            <div>
              <Label htmlFor="targetValue">Target Value</Label>
              <Input
                id="targetValue"
                type="number"
                min="1"
                value={campaignData.targetValue}
                onChange={(e) => setCampaignData({ ...campaignData, targetValue: parseInt(e.target.value) || 0 })}
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}