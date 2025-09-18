"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useState, useEffect } from "react"

interface AnimatedCounterProps {
  end: number
  duration?: number
  suffix?: string
  prefix?: string
}

function AnimatedCounter({ end, duration = 2, suffix = "", prefix = "" }: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      let startTime: number | null = null
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const progress = (timestamp - startTime) / (duration * 1000)
        
        if (progress < 1) {
          setCount(Math.floor(end * progress))
          requestAnimationFrame(animate)
        } else {
          setCount(end)
        }
      }
      requestAnimationFrame(animate)
    }
  }, [isInView, end, duration])

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  )
}

const stats = [
  {
    value: 15000,
    suffix: "+",
    label: "Active Creators",
    description: "Artists, musicians, and content creators"
  },
  {
    value: 250000,
    suffix: "+",
    label: "Superfans",
    description: "Engaged subscribers worldwide"
  },
  {
    value: 5,
    suffix: "M+",
    prefix: "$",
    label: "Creator Earnings",
    description: "Total paid out to creators"
  },
  {
    value: 95,
    suffix: "%",
    label: "Satisfaction Rate",
    description: "Creator satisfaction score"
  }
]

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Music Artist",
    content: "This platform completely transformed how I connect with my fans. The direct messaging feature and exclusive content tiers have increased my monthly revenue by 400%.",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b830?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80",
    rating: 5
  },
  {
    name: "Marcus Rodriguez",
    role: "Digital Artist",
    content: "The analytics dashboard gives me incredible insights into my audience. I can see exactly what content resonates and optimize my strategy accordingly.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80",
    rating: 5
  },
  {
    name: "Luna Williams",
    role: "Content Creator",
    content: "The security features give me peace of mind. I can share exclusive content knowing it's protected, and the daily payouts help me manage my finances better.",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80",
    rating: 5
  }
]

export default function StatsTestimonials() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6
      }
    }
  }

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Trusted by Creators
            <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Worldwide
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join a thriving community of creators who are building sustainable income streams and deeper fan connections.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:shadow-lg transition-all duration-300"
            >
              <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
                <AnimatedCounter 
                  end={stat.value} 
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                />
              </div>
              <div className="text-xl font-semibold text-gray-800 mb-2">{stat.label}</div>
              <div className="text-gray-600 text-sm">{stat.description}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            What Creators Are Saying
          </h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real stories from creators who have transformed their creative careers with our platform.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -5 }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 relative"
            >
              {/* Quote mark */}
              <div className="absolute top-4 right-6 text-6xl text-indigo-100 font-serif">"</div>
              
              {/* Stars */}
              <div className="flex space-x-1 mb-6">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-yellow-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-700 leading-relaxed mb-6 relative z-10">
                {testimonial.content}
              </p>

              {/* Author */}
              <div className="flex items-center">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-gray-600 text-sm">{testimonial.role}</div>
                </div>
              </div>

              {/* Gradient border effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 hover:opacity-10 transition-opacity duration-300 -z-10"></div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-20"
        >
          <p className="text-gray-600 mb-8">Trusted by creators from</p>
          <div className="flex flex-wrap items-center justify-center space-x-8 opacity-60">
            {['Spotify', 'SoundCloud', 'Instagram', 'TikTok', 'YouTube', 'Twitch'].map((platform, index) => (
              <div
                key={index}
                className="text-2xl font-bold text-gray-400 hover:text-gray-600 transition-colors cursor-default"
              >
                {platform}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}