'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Home, ArrowRight, Star, Users, Zap } from 'lucide-react';

export default function SimplePageDemo() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to DirectFanz
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Connect with your favorite creators and access exclusive content like never before.
          Join our growing community of artists and superfans.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Star className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Exclusive Content</h3>
              <p className="text-gray-600">
                Access premium content from your favorite creators that you can't find anywhere else.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Direct Connection</h3>
              <p className="text-gray-600">
                Chat directly with creators and be part of an exclusive community of superfans.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Early Access</h3>
              <p className="text-gray-600">
                Get first access to new releases, behind-the-scenes content, and special events.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <CardContent className="p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-purple-100 mb-6">
              Join thousands of fans already connected to their favorite creators.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => router.push('/auth/signup')}
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                Sign Up Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                onClick={() => router.push('/discover')}
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-purple-600"
              >
                Discover Creators
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Links */}
      <div className="mt-12 text-center">
        <div className="grid md:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard')}
            className="w-full"
          >
            Dashboard
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/profile')}
            className="w-full"
          >
            My Profile
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/settings')}
            className="w-full"
          >
            Settings
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/')}
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}