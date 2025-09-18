'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Upload, 
  BarChart3, 
  Users, 
  MessageSquare, 
  Settings, 
  CreditCard,
  Video,
  Calendar,
  Star,
  LogOut
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

const navigationItems = [
  {
    name: 'Overview',
    href: '/artist',
    icon: Home,
  },
  {
    name: 'Content',
    href: '/artist/content',
    icon: Upload,
  },
  {
    name: 'Analytics',
    href: '/artist/analytics',
    icon: BarChart3,
  },
  {
    name: 'Subscribers',
    href: '/artist/subscribers',
    icon: Users,
  },
  {
    name: 'Messages',
    href: '/artist/messages',
    icon: MessageSquare,
  },
  {
    name: 'Live Streaming',
    href: '/artist/streaming',
    icon: Video,
  },
  {
    name: 'Events',
    href: '/artist/events',
    icon: Calendar,
  },
  {
    name: 'Tiers & Pricing',
    href: '/artist/tiers',
    icon: Star,
  },
  {
    name: 'Earnings',
    href: '/artist/earnings',
    icon: CreditCard,
  },
  {
    name: 'Settings',
    href: '/artist/settings',
    icon: Settings,
  },
];

export function ArtistSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="flex flex-col w-64 bg-card border-r">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-semibold">
              {session?.user?.name?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
          <div>
            <h2 className="font-semibold text-sm">{session?.user?.name}</h2>
            <p className="text-xs text-muted-foreground">Artist Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-secondary"
                    )}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}