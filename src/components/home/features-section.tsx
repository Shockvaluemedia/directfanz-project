"use client"

import { motion } from "framer-motion"
import { 
  CurrencyDollarIcon, 
  UserGroupIcon, 
  ShieldCheckIcon, 
  ChartBarIcon,
  HeartIcon,
  StarIcon,
  LockClosedIcon,
  BoltIcon
} from "@heroicons/react/24/outline"

const features = [
  {
    icon: CurrencyDollarIcon,
    title: "Flexible Monetization",
    description: "Set your own subscription prices with daily payouts through Stripe. Multiple tiers, pay-per-view, and tip options.",
    gradient: "from-green-400 to-blue-500"
  },
  {
    icon: UserGroupIcon,
    title: "Superfan Communities",
    description: "Build exclusive communities around your content. Engage with your most dedicated fans through private messaging and comments.",
    gradient: "from-purple-400 to-pink-500"
  },
  {
    icon: ShieldCheckIcon,
    title: "Secure & Private",
    description: "Enterprise-grade security with end-to-end encryption. Your content is protected with advanced DRM and watermarking.",
    gradient: "from-blue-400 to-indigo-500"
  },
  {
    icon: ChartBarIcon,
    title: "Advanced Analytics",
    description: "Deep insights into your audience, revenue trends, and content performance. Make data-driven decisions to grow your fanbase.",
    gradient: "from-yellow-400 to-orange-500"
  },
  {
    icon: HeartIcon,
    title: "Fan Engagement",
    description: "Direct messaging, live streaming, polls, and exclusive behind-the-scenes content to keep your fans engaged and coming back.",
    gradient: "from-red-400 to-pink-500"
  },
  {
    icon: StarIcon,
    title: "Premium Experience",
    description: "High-quality video streaming, crystal-clear audio, and lightning-fast uploads. Your content deserves the best platform.",
    gradient: "from-indigo-400 to-purple-500"
  },
  {
    icon: LockClosedIcon,
    title: "Content Protection",
    description: "Advanced content protection with screenshot blocking, download prevention, and automatic watermarking on all media.",
    gradient: "from-gray-400 to-gray-600"
  },
  {
    icon: BoltIcon,
    title: "Lightning Fast",
    description: "Global CDN ensures your content loads instantly worldwide. Real-time notifications and seamless mobile experience.",
    gradient: "from-cyan-400 to-blue-500"
  }
]

export default function FeaturesSection() {
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

  const cardVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  }

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Everything You Need to
            <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Succeed as a Creator
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Our platform provides all the tools and features you need to build, engage, and monetize your fanbase like never before.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ 
                y: -10,
                transition: { duration: 0.2 }
              }}
              className="group relative"
            >
              <div className="relative h-full bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-gray-200">
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`}></div>
                
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-6 transform group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                
                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-gray-800 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">
                    {feature.description}
                  </p>
                </div>

                {/* Hover effect border */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10 blur-xl`}></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-20"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-white">
            <h3 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Transform Your Creative Journey?
            </h3>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Join thousands of creators who have already discovered the power of direct fan connections.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="inline-flex items-center px-8 py-4 text-lg font-semibold text-indigo-600 bg-white rounded-full hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl">
                Start Your Journey
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="ml-2"
                >
                  →
                </motion.div>
              </button>
              <button className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-full hover:border-white/50 hover:bg-white/10 transition-all backdrop-blur-sm">
                Learn More
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}