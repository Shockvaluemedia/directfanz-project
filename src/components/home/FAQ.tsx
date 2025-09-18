'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, DollarSign, Users, Settings, Zap, Heart } from 'lucide-react';

const FAQ = () => {
  const [openItems, setOpenItems] = useState<number[]>([0]); // First item open by default

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const faqCategories = [
    {
      category: "Payouts & Earnings",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      questions: [
        {
          question: "How much does Direct Fan Platform take from my earnings?",
          answer: "We only take a 5% platform fee - one of the lowest in the industry. Unlike other platforms that charge 20% or more, we believe creators should keep more of what they earn. There are no hidden fees, setup costs, or monthly charges."
        },
        {
          question: "How often can I get paid?",
          answer: "You can request payouts daily once you reach the minimum threshold of $10. Most creators receive their payments within 1-2 business days. We support multiple payment methods including bank transfers, PayPal, and cryptocurrency."
        },
        {
          question: "What's the minimum payout amount?",
          answer: "The minimum payout is just $10, much lower than competitors. This means you can access your earnings faster and more frequently. There are no penalties for frequent payouts."
        },
        {
          question: "Are there any payout fees?",
          answer: "Standard bank transfers and PayPal payments are free. Express payments (same-day) have a small fee of $2.99. Cryptocurrency payouts are free and typically process within minutes."
        }
      ]
    },
    {
      category: "Content Protection & Security",
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      questions: [
        {
          question: "How does AI content protection work?",
          answer: "Our advanced AI system creates unique fingerprints for your content and continuously scans the internet for unauthorized use. If pirated content is detected, we automatically send takedown notices and can help with legal action if needed."
        },
        {
          question: "What happens if my content gets stolen?",
          answer: "We provide free DMCA takedown services and have partnerships with legal firms specializing in content protection. Our AI system detects stolen content 95% faster than manual monitoring, and we handle the entire takedown process for you."
        },
        {
          question: "Can fans screenshot or record my content?",
          answer: "We use advanced DRM technology that prevents screenshots and recording on most devices. While no system is 100% foolproof, our protection is significantly more robust than other platforms. Violations are tracked and repeat offenders are banned."
        },
        {
          question: "How secure is my personal information?",
          answer: "We use bank-level encryption and are SOC 2 Type II certified. Your personal data is never sold to third parties. We also offer two-factor authentication and regular security audits by independent firms."
        }
      ]
    },
    {
      category: "Platform Features & Tools",
      icon: Settings,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      questions: [
        {
          question: "Can I customize my creator page?",
          answer: "Absolutely! You get full branding control with custom colors, logos, banners, and layout options. You can also add custom CSS for advanced styling. Your page can truly reflect your unique brand and personality."
        },
        {
          question: "What analytics do you provide?",
          answer: "We provide comprehensive analytics including subscriber growth, engagement rates, revenue trends, content performance, geographic data, and peak activity times. Our AI also provides personalized recommendations to grow your audience."
        },
        {
          question: "Do you support live streaming?",
          answer: "Yes! We have integrated live streaming with features like multi-camera support, screen sharing, interactive chat, viewer polls, and tip notifications during streams. You can also schedule streams and send notifications to subscribers."
        },
        {
          question: "Can I offer different subscription tiers?",
          answer: "Yes, you can create unlimited subscription tiers with different pricing and benefits. You can also offer limited-time promotions, free trials, and bundle deals. Our system handles all billing automatically."
        }
      ]
    },
    {
      category: "Fan Engagement & Community",
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      questions: [
        {
          question: "How do fans interact with my content?",
          answer: "Fans can like, comment, share, and tip on your posts. We also have advanced features like polls, Q&A sessions, exclusive messaging, and community forums. The platform encourages meaningful engagement over vanity metrics."
        },
        {
          question: "Can I send direct messages to fans?",
          answer: "Yes, you can send direct messages, mass messages to specific tiers, and set up automated welcome messages. We also have a smart inbox that prioritizes high-value fans and filters spam."
        },
        {
          question: "What tools help me grow my audience?",
          answer: "We provide referral programs, cross-promotion opportunities with other creators, SEO optimization for your page, social media integration, and AI-powered content suggestions based on trending topics in your niche."
        },
        {
          question: "How do I handle difficult fans or harassment?",
          answer: "We have robust moderation tools including keyword filters, automatic spam detection, and a 24/7 support team. You can easily block, mute, or report users. We take harassment seriously and act quickly on violations."
        }
      ]
    },
    {
      category: "Getting Started & Support",
      icon: Zap,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      questions: [
        {
          question: "How long does it take to get approved?",
          answer: "Most creators are approved within 24 hours. Our streamlined verification process only requires basic identity verification and age confirmation. Once approved, you can start earning immediately."
        },
        {
          question: "Is there a free trial?",
          answer: "Yes! You can use the platform free for your first 30 days with no platform fees. This lets you explore all features and start building your audience before any fees apply."
        },
        {
          question: "What support do you provide?",
          answer: "We offer 24/7 live chat support, detailed video tutorials, weekly webinars for creators, a comprehensive knowledge base, and a dedicated success manager for top-tier creators."
        },
        {
          question: "Can I migrate my existing audience from other platforms?",
          answer: "Yes! We provide migration tools and strategies to help you move your audience. Our team can help you plan the transition, create announcement content, and track your migration progress."
        }
      ]
    }
  ];

  return (
    <section className="py-16 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to know about payouts, content protection, and building your creator business
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Category Header */}
              <div className={`${category.bgColor} p-6`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 bg-white rounded-xl ${category.color}`}>
                    <category.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{category.category}</h3>
                </div>
              </div>

              {/* Questions */}
              <div className="divide-y divide-gray-100">
                {category.questions.map((faq, questionIndex) => {
                  const globalIndex = categoryIndex * 10 + questionIndex;
                  const isOpen = openItems.includes(globalIndex);
                  
                  return (
                    <div key={questionIndex} className="p-6">
                      <button
                        onClick={() => toggleItem(globalIndex)}
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors pr-4">
                          {faq.question}
                        </h4>
                        <div className={`p-2 rounded-full transition-all duration-200 ${isOpen ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </button>
                      
                      {isOpen && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-gray-700 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <Heart className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Still Have Questions?</h4>
            <p className="text-gray-600 text-sm mb-4">Our support team is here to help 24/7</p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Contact Support
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Join Creator Community</h4>
            <p className="text-gray-600 text-sm mb-4">Connect with other creators and share tips</p>
            <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Join Discord
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
            <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Ready to Start?</h4>
            <p className="text-gray-600 text-sm mb-4">Get your creator account set up in minutes</p>
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all">
              Start Free Trial
            </button>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">Join 50,000+ Happy Creators</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
            <div>
              <p className="text-3xl font-bold text-blue-200">98%</p>
              <p className="text-blue-100">Creator Satisfaction</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-200">$2.5M+</p>
              <p className="text-blue-100">Paid to Creators</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-200">24/7</p>
              <p className="text-blue-100">Expert Support</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-200">5%</p>
              <p className="text-blue-100">Platform Fee Only</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;