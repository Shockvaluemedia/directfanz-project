'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Component Test Page
        </h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This is a test to see if basic UI components are working.
            </p>
            
            <div className="flex gap-4 items-center">
              <Button>Primary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              
              <Badge>Active</Badge>
              <Badge variant="secondary">Secondary</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Data Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Summer Vibes Photo Contest 📢</h3>
                <p className="text-sm text-gray-600">by Test Artist</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>342/500</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '68%' }}></div>
                </div>
              </div>
              
              <div className="flex justify-between text-sm text-gray-600">
                <span>👥 342 participants</span>
                <span>14 days left</span>
              </div>
              
              <Button className="w-full">Join Campaign</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}