'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  targetMetric: string;
  targetValue: number;
}

interface CampaignEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  onSave: (updatedCampaign: Campaign) => void;
}

const campaignTypes = [
  'PROMOTIONAL',
  'CHALLENGE',
  'ENGAGEMENT',
  'LAUNCH',
  'COMMUNITY',
  'SEASONAL',
] as const;

const targetMetrics = ['PARTICIPANTS', 'SUBMISSIONS', 'ENGAGEMENT', 'VIEWS', 'SHARES'] as const;

export default function CampaignEditModal({
  isOpen,
  onClose,
  campaign,
  onSave,
}: CampaignEditModalProps) {
  const [formData, setFormData] = useState({
    title: campaign.title,
    description: campaign.description,
    type: campaign.type,
    startDate: new Date(campaign.startDate).toISOString().slice(0, 16),
    endDate: new Date(campaign.endDate).toISOString().slice(0, 16),
    targetMetric: campaign.targetMetric,
    targetValue: campaign.targetValue,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when campaign changes
  useEffect(() => {
    setFormData({
      title: campaign.title,
      description: campaign.description,
      type: campaign.type,
      startDate: new Date(campaign.startDate).toISOString().slice(0, 16),
      endDate: new Date(campaign.endDate).toISOString().slice(0, 16),
      targetMetric: campaign.targetMetric,
      targetValue: campaign.targetValue,
    });
    setErrors({});
  }, [campaign]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Campaign title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Campaign title must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Campaign description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Campaign description must be at least 10 characters';
    }

    if (!formData.type) {
      newErrors.type = 'Campaign type is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (endDate <= startDate) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (!formData.targetMetric) {
      newErrors.targetMetric = 'Target metric is required';
    }

    if (!formData.targetValue || formData.targetValue <= 0) {
      newErrors.targetValue = 'Target value must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          type: formData.type,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          targetMetric: formData.targetMetric,
          targetValue: formData.targetValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update campaign');
      }

      const updatedCampaign = await response.json();
      toast.success('Campaign updated successfully!');
      onSave(updatedCampaign);
      onClose();
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      toast.error(error.message || 'Failed to update campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const canEditDates = campaign.status === 'DRAFT';
  const canEditType = campaign.status === 'DRAFT';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <Label htmlFor='title'>Campaign Title *</Label>
            <Input
              id='title'
              value={formData.title}
              onChange={e => handleFieldChange('title', e.target.value)}
              placeholder='Enter campaign title'
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className='text-red-500 text-sm mt-1'>{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor='description'>Description *</Label>
            <Textarea
              id='description'
              value={formData.description}
              onChange={e => handleFieldChange('description', e.target.value)}
              placeholder='Describe your campaign'
              rows={4}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className='text-red-500 text-sm mt-1'>{errors.description}</p>
            )}
          </div>

          <div>
            <Label htmlFor='type'>Campaign Type *</Label>
            <select
              id='type'
              value={formData.type}
              onChange={e => handleFieldChange('type', e.target.value)}
              disabled={!canEditType}
              className={`w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 ${errors.type ? 'border-red-500' : ''} ${!canEditType ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value=''>Select a type</option>
              {campaignTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.type && <p className='text-red-500 text-sm mt-1'>{errors.type}</p>}
            {!canEditType && (
              <p className='text-gray-500 text-sm mt-1'>
                Campaign type cannot be changed once launched
              </p>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='startDate'>Start Date *</Label>
              <Input
                id='startDate'
                type='datetime-local'
                value={formData.startDate}
                onChange={e => handleFieldChange('startDate', e.target.value)}
                disabled={!canEditDates}
                className={`${errors.startDate ? 'border-red-500' : ''} ${!canEditDates ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              {errors.startDate && <p className='text-red-500 text-sm mt-1'>{errors.startDate}</p>}
              {!canEditDates && (
                <p className='text-gray-500 text-sm mt-1'>Dates cannot be changed once launched</p>
              )}
            </div>

            <div>
              <Label htmlFor='endDate'>End Date *</Label>
              <Input
                id='endDate'
                type='datetime-local'
                value={formData.endDate}
                onChange={e => handleFieldChange('endDate', e.target.value)}
                disabled={!canEditDates}
                className={`${errors.endDate ? 'border-red-500' : ''} ${!canEditDates ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              {errors.endDate && <p className='text-red-500 text-sm mt-1'>{errors.endDate}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor='targetMetric'>Target Metric *</Label>
            <select
              id='targetMetric'
              value={formData.targetMetric}
              onChange={e => handleFieldChange('targetMetric', e.target.value)}
              className={`w-full mt-1 block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 ${errors.targetMetric ? 'border-red-500' : ''}`}
            >
              <option value=''>Select target metric</option>
              {targetMetrics.map(metric => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>
            {errors.targetMetric && (
              <p className='text-red-500 text-sm mt-1'>{errors.targetMetric}</p>
            )}
          </div>

          <div>
            <Label htmlFor='targetValue'>Target Value *</Label>
            <Input
              id='targetValue'
              type='number'
              min='1'
              value={formData.targetValue}
              onChange={e => handleFieldChange('targetValue', parseInt(e.target.value) || 0)}
              placeholder='Enter target value'
              className={errors.targetValue ? 'border-red-500' : ''}
            />
            {errors.targetValue && (
              <p className='text-red-500 text-sm mt-1'>{errors.targetValue}</p>
            )}
          </div>

          <div className='flex justify-end space-x-2 pt-4'>
            <Button type='button' variant='outline' onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting} className='min-w-[120px]'>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
