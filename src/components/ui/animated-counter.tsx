"use client"

import { useEffect, useState } from "react"
import { useInView } from "framer-motion"
import { useRef } from "react"

interface AnimatedCounterProps {
  end: number
  duration?: number
  suffix?: string
  prefix?: string
  decimals?: number
  className?: string
}

export default function AnimatedCounter({ 
  end, 
  duration = 2, 
  suffix = "", 
  prefix = "", 
  decimals = 0,
  className = ""
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      let startTime: number | null = null
      let animationId: number

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4)
        const currentCount = end * easeOutQuart

        setCount(currentCount)

        if (progress < 1) {
          animationId = requestAnimationFrame(animate)
        } else {
          setCount(end)
        }
      }
      
      animationId = requestAnimationFrame(animate)
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId)
        }
      }
    }
  }, [isInView, end, duration])

  const formatNumber = (num: number): string => {
    if (decimals === 0) {
      return Math.floor(num).toLocaleString()
    }
    return num.toFixed(decimals)
  }

  return (
    <span ref={ref} className={className} data-counter="true">
      {prefix}{formatNumber(count)}{suffix}
    </span>
  )
}