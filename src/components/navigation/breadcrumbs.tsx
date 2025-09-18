"use client"

import React from 'react'
import Link from 'next/link'
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline'
import { useBreadcrumbs } from '@/hooks/use-navigation'

export default function Breadcrumbs() {
  const { breadcrumbs } = useBreadcrumbs()

  if (breadcrumbs.length <= 1) {
    return null // Don't show breadcrumbs on the home page
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1
        const isHome = index === 0

        return (
          <React.Fragment key={crumb.href}>
            {index > 0 && (
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            )}
            
            {isLast ? (
              <span className="font-medium text-gray-900 flex items-center">
                {isHome && <HomeIcon className="w-4 h-4 mr-1" />}
                {crumb.name}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-indigo-600 transition-colors flex items-center"
              >
                {isHome && <HomeIcon className="w-4 h-4 mr-1" />}
                {crumb.name}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}