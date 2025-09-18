"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"

const testimonials = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Music Artist",
    content: "This platform completely transformed how I connect with my fans. The direct messaging feature and exclusive content tiers have increased my monthly revenue by 400%.",
    rating: 5,
    revenue: "$12K/month",
    gradient: "from-purple-400 to-pink-500"
  },
  {
    id: 2,
    name: "Marcus Rodriguez",
    role: "Digital Artist",
    content: "The analytics dashboard gives me incredible insights into my audience. I can see exactly what content resonates and optimize my strategy accordingly.",
    rating: 5,
    revenue: "$8.5K/month",
    gradient: "from-blue-400 to-indigo-500"
  },
  {
    id: 3,
    name: "Luna Williams",
    role: "Content Creator",
    content: "The security features give me peace of mind. I can share exclusive content knowing it's protected, and the daily payouts help me manage my finances better.",
    rating: 5,
    revenue: "$15K/month",
    gradient: "from-pink-400 to-purple-500"
  },
  {
    id: 4,
    name: "Alex Thompson",
    role: "Podcast Creator",
    content: "Building a sustainable income from podcasting seemed impossible until I found this platform. My listeners love the exclusive behind-the-scenes content.",
    rating: 5,
    revenue: "$6.2K/month",
    gradient: "from-green-400 to-emerald-500"
  },
  {
    id: 5,
    name: "Maya Patel",
    role: "Visual Artist",
    content: "The community features are amazing! My fans feel more connected to my creative process, and the tiered subscription model lets me offer different levels of access.",
    rating: 5,
    revenue: "$9.8K/month",
    gradient: "from-yellow-400 to-orange-500"
  }
]

export default function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => 
          prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
        )
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [isAutoPlaying])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 8000)
  }

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 8000)
  }

  const goToNext = () => {
    setCurrentIndex(currentIndex === testimonials.length - 1 ? 0 : currentIndex + 1)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 8000)
  }

  return (
    <section className="testimonial-carousel py-24 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 left-10 w-20 h-20 bg-indigo-200 rounded-full opacity-20 animate-float"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-purple-200 rounded-full opacity-20 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 right-20 w-16 h-16 bg-pink-200 rounded-full opacity-20 animate-float animation-delay-4000"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Success Stories from
            <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Real Creators
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join thousands of creators who have transformed their creative careers and built sustainable income streams.
          </p>
        </motion.div>

        {/* Carousel Container */}
        <div className="relative">
          <div className="overflow-hidden rounded-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 relative"
              >
                {/* Quote mark */}
                <div className="absolute top-4 right-8 text-8xl text-indigo-100 font-serif">"</div>
                
                <div className="grid md:grid-cols-3 gap-8 items-center">
                  {/* Testimonial Content */}
                  <div className="md:col-span-2">
                    {/* Stars */}
                    <div className="flex space-x-1 mb-6">
                      {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.1, duration: 0.3 }}
                        >
                          <svg
                            className="w-6 h-6 text-yellow-400 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                        </motion.div>
                      ))}
                    </div>

                    <blockquote className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6 relative z-10">
                      {testimonials[currentIndex].content}
                    </blockquote>

                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${testimonials[currentIndex].gradient} flex items-center justify-center text-white font-bold ring-4 ring-white shadow-lg`}>
                        {testimonials[currentIndex].name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-lg">
                          {testimonials[currentIndex].name}
                        </div>
                        <div className="text-gray-600">
                          {testimonials[currentIndex].role}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Display */}
                  <div className="text-center">
                    <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-6 text-white transform rotate-3 hover:rotate-0 transition-transform duration-300">
                      <div className="text-sm opacity-90 mb-2">Monthly Revenue</div>
                      <div className="text-3xl font-bold">
                        {testimonials[currentIndex].revenue}
                      </div>
                      <div className="text-sm opacity-90 mt-2">Average</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110 border border-gray-100"
          >
            <ChevronLeftIcon className="w-6 h-6 text-gray-600" />
          </button>
          
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110 border border-gray-100"
          >
            <ChevronRightIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 space-x-3">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-indigo-600 w-8' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        {/* Auto-play indicator */}
        <div className="flex items-center justify-center mt-4 text-sm text-gray-500">
          <div className={`w-2 h-2 rounded-full mr-2 ${isAutoPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
          {isAutoPlaying ? 'Auto-playing' : 'Paused'}
        </div>
      </div>
    </section>
  )
}