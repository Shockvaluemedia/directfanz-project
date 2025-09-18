'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { X, Plus, Save, AlertCircle } from 'lucide-react';

interface Content {
  id: string;
  title: string;
  description?: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
  visibility: 'PUBLIC' | 'TIER_LOCKED' | 'PRIVATE';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  totalViews: number;
  uniqueViews: number;
  lastViewedAt?: string;
  tiers: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface Tier {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface ContentEditorProps {
  content: Content;
  onSave: () => void;
  onCancel: () => void;
}

export function ContentEditor({ content, onSave, onCancel }: ContentEditorProps) {
  const [formData, setFormData] = useState({
    title: content.title,
    description: content.description || '',
    visibility: content.visibility,
    tags: content.tags,
    tierIds: content.tiers.map(t => t.id)
  });
  const [newTag, setNewTag] = useState('');
  const [availableTiers, setAvailableTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableTiers();
  }, []);

  const fetchAvailableTiers = async () => {
    try {
      const response = await fetch('/api/tiers');
      if (response.ok) {
        const data = await response.json();
        setAvailableTiers(data.tiers);
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const handleVisibilityChange = (visibility: string) => {
    setFormData(prev => ({
      ...prev,
      visibility: visibility as 'PUBLIC' | 'TIER_LOCKED' | 'PRIVATE',
      tierIds: visibility === 'TIER_LOCKED' ? prev.tierIds : []
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim().toLowerCase()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTierChange = (tierId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tierIds: checked 
        ? [...prev.tierIds, tierId]
        : prev.tierIds.filter(id => id !== tierId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      setLoading(false);
      return;
    }

    if (formData.visibility === 'TIER_LOCKED' && formData.tierIds.length === 0) {
      setError('Please select at least one tier for tier-locked content');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/content/${content.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          visibility: formData.visibility,
          tags: formData.tags,
          tierIds: formData.tierIds
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update content');
      }

      onSave();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update content');
    } finally {
      setLoading(false);
    }
  };

  const getPreviewUrl = () => {
    if (content.thumbnailUrl) {
      return content.thumbnailUrl;
    }
    return content.fileUrl;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Content Preview */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {content.type.startsWith('image') || content.thumbnailUrl ? (
                <img 
                  src={getPreviewUrl()} 
                  alt={content.title}
                  className="w-24 h-24 rounded object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium capitalize">
                    {content.type}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-grow">
              <div className="flex items-center space-x-2 mb-2">
                <Badge variant="outline" className="capitalize">
                  {content.type}
                </Badge>
                <Badge variant="secondary">
                  {content.totalViews} views
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Created {new Date(content.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Last viewed {content.lastViewedAt ? new Date(content.lastViewedAt).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Enter content title"
            maxLength={100}
          />
          <p className="text-sm text-muted-foreground mt-1">
            {formData.title.length}/100 characters
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Enter content description"
            rows={3}
            maxLength={500}
          />
          <p className="text-sm text-muted-foreground mt-1">
            {formData.description.length}/500 characters
          </p>
        </div>
      </div>

      {/* Visibility Settings */}
      <div className="space-y-4">
        <Label>Visibility</Label>
        <Select value={formData.visibility} onValueChange={handleVisibilityChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PUBLIC">
              Public - Visible to everyone
            </SelectItem>
            <SelectItem value="TIER_LOCKED">
              Tier Locked - Only for subscribers
            </SelectItem>
            <SelectItem value="PRIVATE">
              Private - Only visible to you
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Tier Selection for Tier-Locked Content */}
        {formData.visibility === 'TIER_LOCKED' && (
          <div className="space-y-3">
            <Label>Required Subscription Tiers</Label>
            <div className="space-y-2">
              {availableTiers.map((tier) => (
                <div key={tier.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tier-${tier.id}`}
                    checked={formData.tierIds.includes(tier.id)}
                    onCheckedChange={(checked) => handleTierChange(tier.id, checked as boolean)}
                  />
                  <label htmlFor={`tier-${tier.id}`} className="text-sm font-medium">
                    {tier.name} - ${tier.price}/month
                  </label>
                  {tier.description && (
                    <span className="text-xs text-muted-foreground">
                      ({tier.description})
                    </span>
                  )}
                </div>
              ))}
            </div>
            {formData.tierIds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Select at least one tier that can access this content.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Tags help users discover your content. Press Enter or click + to add.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}