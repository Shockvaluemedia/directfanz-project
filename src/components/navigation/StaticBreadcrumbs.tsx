'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function StaticBreadcrumbs() {
  const pathname = usePathname()
  
  // Only show breadcrumbs if not on homepage
  if (pathname === '/') {
    return null
  }

  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs = [{ name: 'Home', href: '/' }]

  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    let name = segment.charAt(0).toUpperCase() + segment.slice(1)
    breadcrumbs.push({ name, href: currentPath })
  }

  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm text-gray-500">
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center">
            {index > 0 && (
              <svg className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-gray-900">{crumb.name}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-gray-700">
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}