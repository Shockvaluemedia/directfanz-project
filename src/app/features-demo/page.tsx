'use client'

import Link from 'next/link'
import { useState } from 'react'
import { 
  ArrowRightIcon, 
  PlayIcon, 
  UserGroupIcon, 
  CreditCardIcon 
} from '@heroicons/react/24/outline'

interface FeatureSection {
  title: string
  description: string
  icon: string
  color: string
  features: FeatureItem[]
}

interface FeatureItem {
  name: string
  description: string
  link: string
  status: 'live' | 'demo' | 'docs'
  testable: boolean
}

const featureSections: FeatureSection[] = [
  {
    title: "Authentication & User Management",
    description: "Complete user authentication system with role-based access control",
    icon: "👥",
    color: "from-blue-500 to-cyan-500",
    features: [
      {
        name: "Authentication Test",
        description: "Test signin, signout, and session management",
        link: "/test-auth-simple",
        status: "live",
        testable: true
      },
      {
        name: "Role-based Access",
        description: "Artist vs Fan dashboard access",
        link: "/dashboard/artist",
        status: "live", 
        testable: true
      },
      {
        name: "Profile Management",
        description: "User profile settings and customization",
        link: "/profile/settings",
        status: "live",
        testable: true
      }
    ]
  },
  {
    title: "Content Management",
    description: "Upload, organize, and manage multimedia content",
    icon: "🎵",
    color: "from-purple-500 to-pink-500",
    features: [
      {
        name: "Content Upload",
        description: "Upload audio, video, images and documents",
        link: "/upload",
        status: "live",
        testable: true
      },
      {
        name: "Content Library",
        description: "Browse and organize uploaded content",
        link: "/dashboard/artist/content",
        status: "live",
        testable: true
      },
      {
        name: "Content Viewer", 
        description: "View content with access controls",
        link: "/content",
        status: "live",
        testable: true
      }
    ]
  },
  {
    title: "Live Streaming",
    description: "WebRTC-powered live streaming with interactive features",
    icon: "📹",
    color: "from-red-500 to-orange-500",
    features: [
      {
        name: "Live Stream Player",
        description: "Watch live streams with interactive chat",
        link: "/stream/demo-stream",
        status: "demo",
        testable: true
      },
      {
        name: "Stream Management",
        description: "Schedule and manage live streams",
        link: "/dashboard/artist/livestreams",
        status: "live",
        testable: true
      },
      {
        name: "Stream Analytics",
        description: "Viewer metrics and engagement data",
        link: "/dashboard/artist/analytics",
        status: "live",
        testable: true
      }
    ]
  },
  {
    title: "Campaigns & Challenges", 
    description: "Marketing campaigns and fan engagement challenges",
    icon: "🎯",
    color: "from-green-500 to-teal-500",
    features: [
      {
        name: "Campaign Browser",
        description: "Browse active marketing campaigns",
        link: "/campaigns",
        status: "live",
        testable: true
      },
      {
        name: "Campaign Creation",
        description: "Create new campaigns and challenges",
        link: "/dashboard/artist/campaigns/create",
        status: "live",
        testable: true
      },
      {
        name: "Campaign Analytics",
        description: "Track campaign performance and ROI",
        link: "/dashboard/artist/campaigns",
        status: "live",
        testable: true
      }
    ]
  },
  {
    title: "Payment & Billing",
    description: "Stripe-powered payment processing and subscription management",
    icon: "💳",
    color: "from-yellow-500 to-orange-500",
    features: [
      {
        name: "Subscription Management",
        description: "Fan subscription tiers and billing",
        link: "/dashboard/fan/subscriptions",
        status: "live",
        testable: true
      },
      {
        name: "Artist Payouts",
        description: "Revenue tracking and payout management",
        link: "/dashboard/artist/analytics",
        status: "live",
        testable: true
      },
      {
        name: "Payment Portal",
        description: "Customer billing portal powered by Stripe",
        link: "/api/payments/portal",
        status: "live",
        testable: false
      }
    ]
  },
  {
    title: "Analytics & Monitoring",
    description: "Comprehensive analytics dashboard with real-time metrics",
    icon: "📈",
    color: "from-indigo-500 to-purple-500",
    features: [
      {
        name: "Artist Analytics",
        description: "Revenue, audience, and content performance",
        link: "/dashboard/artist/analytics",
        status: "live",
        testable: true
      },
      {
        name: "System Monitoring",
        description: "Platform health and performance metrics",
        link: "/admin/monitoring",
        status: "live",
        testable: true
      },
      {
        name: "API Observability",
        description: "Real-time API performance monitoring",
        link: "/api/observability",
        status: "live",
        testable: false
      }
    ]
  },
  {
    title: "Communication & Social",
    description: "Real-time messaging and social features",
    icon: "💬",
    color: "from-pink-500 to-rose-500",
    features: [
      {
        name: "Direct Messaging",
        description: "Private artist-fan communication",
        link: "/messages",
        status: "live",
        testable: true
      },
      {
        name: "Comment System",
        description: "Engage with content through comments",
        link: "/content",
        status: "live",
        testable: true
      },
      {
        name: "Live Chat",
        description: "Real-time chat during streams",
        link: "/chat/demo-user",
        status: "demo",
        testable: true
      }
    ]
  }
]

export default function FeaturesDemoPage() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Platform Features
            <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Interactive Demo
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Explore all the features and capabilities of the Direct Fan Platform. Click on any feature to test it live.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link 
              href="/PLATFORM_FEATURES_OVERVIEW.md" 
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              📋 Full Features Documentation
              <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Feature Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureSections.map((section, sectionIndex) => (
            <div
              key={sectionIndex}
              className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-gray-200"
            >
              {/* Gradient Background on Hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`}></div>
              
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${section.color} mb-6 transform group-hover:scale-110 transition-transform duration-300`}>
                <span className="text-3xl">{section.icon}</span>
              </div>
              
              {/* Content */}
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-gray-800 transition-colors">
                  {section.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed group-hover:text-gray-700 transition-colors">
                  {section.description}
                </p>
                
                {/* Features List */}
                <div className="space-y-3">
                  {section.features.map((feature, featureIndex) => (
                    <div
                      key={featureIndex}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group/feature"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 group-hover/feature:text-indigo-600 transition-colors">
                            {feature.name}
                          </h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            feature.status === 'live' 
                              ? 'bg-green-100 text-green-800'
                              : feature.status === 'demo'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {feature.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 group-hover/feature:text-gray-700 transition-colors">
                          {feature.description}
                        </p>
                      </div>
                      
                      {feature.testable ? (
                        <Link
                          href={feature.link}
                          className="ml-4 inline-flex items-center px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors opacity-0 group-hover/feature:opacity-100 transform translate-x-2 group-hover/feature:translate-x-0 transition-all duration-200"
                        >
                          Test
                          <ArrowRightIcon className="ml-1 w-4 h-4" />
                        </Link>
                      ) : (
                        <div className="ml-4 px-3 py-2 bg-gray-100 text-gray-500 text-sm rounded-lg">
                          API Only
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Hover Effect Border */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10 blur-xl`}></div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
          <h2 className="text-3xl font-bold mb-6 text-center">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Homepage", link: "/", icon: "🏠" },
              { name: "Sign Up", link: "/auth/signup", icon: "✨" },
              { name: "Artist Dashboard", link: "/dashboard/artist", icon: "🎨" },
              { name: "Fan Dashboard", link: "/dashboard/fan", icon: "👥" },
              { name: "Content Library", link: "/content", icon: "📚" },
              { name: "Live Streams", link: "/stream", icon: "📺" },
              { name: "Campaigns", link: "/campaigns", icon: "🎯" },
              { name: "Admin Panel", link: "/admin", icon: "⚙️" },
            ].map((link, index) => (
              <Link
                key={index}
                href={link.link}
                className="flex flex-col items-center p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <span className="text-2xl mb-2">{link.icon}</span>
                <span className="text-sm font-medium text-center">{link.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Documentation Links */}
        <div className="mt-12 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Documentation & Resources</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/api" className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              📖 API Documentation
            </Link>
            <Link href="/test-auth-simple" className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              🔐 Authentication Test
            </Link>
            <Link href="/ui-showcase" className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              🎨 UI Components
            </Link>
            <a href="https://github.com" className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              💻 Source Code
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}