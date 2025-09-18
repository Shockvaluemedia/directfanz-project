"use client"

import { useState } from "react"
import { CheckIcon, StarIcon } from "@heroicons/react/24/solid"
import { ArrowRightIcon } from "@heroicons/react/24/outline"
import Link from "next/link"

const pricingInfo = {
  artists: {
    name: "For Artists",
    price: "Free",
    subtitle: "to Join",
    description: "Start earning immediately with no upfront costs",
    features: [
      "No subscription or setup fees",
      "Unlimited content uploads",
      "Choose your pricing model:",
      "• Fixed price per release",
      "• Pay-what-you-want (min + suggested)",
      "You keep 80% of all revenue",
      "Daily payouts via Stripe",
      "Advanced analytics & fan insights",
      "Direct fan messaging"
    ],
    cta: "Start Creating",
    color: "from-indigo-500 to-purple-600",
    bgColor: "bg-gradient-to-br from-indigo-50 to-purple-50"
  },
  fans: {
    name: "How Fans Pay",
    price: "Simple",
    subtitle: "& Fair",
    description: "Only pay for content you actually want",
    features: [
      "No membership or subscription fees",
      "No sign-up costs",
      "Artists set either:",
      "• Fixed price (e.g. $5 per song)",
      "• Pay-what-you-want with minimum",
      "100% transparent checkout",
      "See exactly what goes to artist",
      "Secure payments via Stripe",
      "Instant download access"
    ],
    cta: "Browse Artists",
    color: "from-pink-500 to-rose-600",
    bgColor: "bg-gradient-to-br from-pink-50 to-rose-50"
  }
}

const revenueComparisons = {
  weekend: {
    scenario: "Weekend Warrior",
    description: "Side hustle that pays your rent",
    fanCount: "200 true fans",
    avgSpend: "$8/month each",
    monthlyRevenue: "$1,280",
    spotifyEquivalent: "384K Spotify streams",
    youtubeEquivalent: "640K YouTube views", 
    streamingEarnings: "$1,200-1,600 total",
    timeToEarn: "2-3 YEARS of grinding",
    payoutSpeed: "Tomorrow",
    gradient: "from-green-400 to-emerald-500"
  },
  fulltime: {
    scenario: "Full-Time Creator", 
    description: "Living the dream, paying all bills",
    fanCount: "800 dedicated fans",
    avgSpend: "$15/month each",
    monthlyRevenue: "$9,600",
    spotifyEquivalent: "2.9M Spotify streams",
    youtubeEquivalent: "4.8M YouTube views",
    streamingEarnings: "$8,700-14,400 total",
    timeToEarn: "NEVER achievable for most",
    payoutSpeed: "Every single day",
    gradient: "from-indigo-500 to-purple-600"
  },
  superstar: {
    scenario: "Top 1% Creator",
    description: "Financial freedom achieved",
    fanCount: "3,000 superfans",
    avgSpend: "$25/month each",
    monthlyRevenue: "$60,000",
    spotifyEquivalent: "18M Spotify streams",
    youtubeEquivalent: "30M YouTube views",
    streamingEarnings: "$54,000-90,000 total",
    timeToEarn: "Literally impossible for 99.9% of creators",
    payoutSpeed: "Daily deposits in your account",
    gradient: "from-yellow-400 to-orange-500"
  }
}

export default function PricingSection() {
  const [selectedView, setSelectedView] = useState("artists")
  const [showRevenue, setShowRevenue] = useState(true)

  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-indigo-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 left-10 w-32 h-32 bg-indigo-200 rounded-full opacity-10 animate-float"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-200 rounded-full opacity-10 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-pink-200 rounded-full opacity-10 animate-float animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Simple, Transparent
            <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Pricing for Everyone
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Free to join for artists and fans. You only pay when you earn, with daily payouts and no hidden fees.
          </p>
        </div>


        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16 max-w-5xl mx-auto">
          {Object.entries(pricingInfo).map(([key, info]) => (
            <div
              key={key}
              className={`relative rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-2 border-gray-200 hover:border-indigo-200 ${info.bgColor}`}
            >
              {/* Popular badge for artists */}
              {key === 'artists' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center">
                    <StarIcon className="w-4 h-4 mr-1" />
                    Start Here
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{info.name}</h3>
                <div className="flex items-center justify-center mb-4">
                  <span className={`text-5xl font-bold bg-gradient-to-r ${info.color} bg-clip-text text-transparent`}>
                    {info.price}
                  </span>
                  <span className="text-gray-600 text-lg ml-2">{info.subtitle}</span>
                </div>
                <p className="text-gray-600 leading-relaxed">{info.description}</p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8">
                {info.features.map((feature, featureIndex) => {
                  // Handle bullet points and main features differently
                  const isSubPoint = feature.startsWith('•')
                  const isHeader = feature.endsWith(':')
                  
                  return (
                    <div key={featureIndex} className={`flex items-start ${
                      isSubPoint ? 'ml-6' : ''
                    }`}>
                      {!isHeader && !isSubPoint && (
                        <CheckIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      )}
                      {isSubPoint && (
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                      )}
                      <span className={`text-gray-700 ${
                        isHeader ? 'font-semibold text-gray-900' : ''
                      }`}>{feature}</span>
                    </div>
                  )
                })}
              </div>

              {/* CTA Button */}
              <Link
                href={key === 'artists' ? '/auth/signup' : '/discover'}
                className={`w-full inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold transition-all duration-300 bg-gradient-to-r ${info.color} text-white hover:shadow-lg hover:scale-105 group`}
              >
                {info.cta}
                <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ))}
        </div>

        {/* Powerful Earnings Comparison */}
        <div className="mb-16">
          {/* Shocking Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-6 py-3 bg-red-100 border-2 border-red-200 rounded-full text-red-700 font-bold mb-6">
              🚨 SPOTIFY & YOUTUBE ARE ROBBERY
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why 200 True Fans > 2 Million YouTube Views
            </h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stop grinding for millions of views and streams for pennies. Your content is worth more than $0.003 per play.
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            {Object.entries(revenueComparisons).map(([tier, data]) => (
              <div
                key={tier}
                className="relative bg-white rounded-2xl p-8 shadow-xl border-2 border-gray-200 hover:border-indigo-200 transition-all duration-300 hover:-translate-y-2"
              >
                {/* Tier Badge */}
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className={`bg-gradient-to-r ${data.gradient} text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg`}>
                    {data.scenario}
                  </div>
                </div>

                <div className="text-center mb-6 pt-4">
                  <p className="text-gray-600 mb-4">{data.description}</p>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {data.monthlyRevenue}
                    <span className="text-lg text-gray-600">/month</span>
                  </div>
                  <div className="text-sm text-green-600 font-semibold">
                    You keep ${(parseInt(data.monthlyRevenue.replace(/[^0-9]/g, '')) * 0.8).toLocaleString()}
                  </div>
                </div>

                {/* The Math */}
                <div className="space-y-3 mb-6">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-sm font-semibold text-green-800 mb-1">🎆 On Our Platform:</div>
                    <div className="text-sm text-green-700">{data.fanCount} paying {data.avgSpend}</div>
                    <div className="text-xs text-green-600 mt-1">Paid {data.payoutSpeed}</div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-sm font-semibold text-red-800 mb-1">💸 On Streaming/Video:</div>
                    <div className="text-xs text-red-700 mb-1">🎵 {data.spotifyEquivalent}</div>
                    <div className="text-xs text-red-700 mb-1">📺 {data.youtubeEquivalent}</div>
                    <div className="text-xs text-red-600 mt-1">{data.timeToEarn}</div>
                  </div>
                </div>

                {/* Bottom Stats */}
                <div className="border-t pt-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Same money requires:</div>
                    <div className="text-xs font-semibold text-gray-900">{data.spotifyEquivalent}</div>
                    <div className="text-xs text-gray-600">OR {data.youtubeEquivalent}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progression Timeline */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 mb-8">
            <h4 className="text-2xl font-bold text-center text-gray-900 mb-8">
              🚀 Typical Creator Journey
            </h4>
            
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { month: "Month 1", fans: "25 fans", earnings: "$160", note: "First releases" },
                { month: "Month 3", fans: "75 fans", earnings: "$600", note: "Building momentum" },
                { month: "Month 6", fans: "200 fans", earnings: "$1,280", note: "Sustainable income" },
                { month: "Year 1", fans: "500+ fans", earnings: "$4,000+", note: "Life changing money" }
              ].map((stage, i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                    {i + 1}
                  </div>
                  <div className="font-bold text-gray-900 mb-1">{stage.month}</div>
                  <div className="text-sm text-gray-600 mb-1">{stage.fans}</div>
                  <div className="text-2xl font-bold text-green-600 mb-1">{stage.earnings}</div>
                  <div className="text-xs text-gray-500">{stage.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-8 text-white text-center">
            <h4 className="text-2xl font-bold mb-4">
              🔥 Stop Getting Robbed by Big Tech Platforms
            </h4>
            <p className="text-lg mb-6 opacity-90">
              While YouTube pays $0.003 per view and Spotify pays $0.003 per stream, your fans are willing to pay $10-25 for your content.
              <br />You just need a platform that doesn't steal 50-70% of your earnings.
            </p>
            <div className="text-center">
              <div className="text-sm opacity-75 mb-2">Daily payouts • 80% revenue share • No algorithm games</div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to start earning from your content?
          </h3>
          <p className="text-gray-600 mb-6">Join thousands of creators already building their income on our platform.</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-lg hover:scale-105 transition-all duration-300 group"
          >
            Start Your Creator Journey
            <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}