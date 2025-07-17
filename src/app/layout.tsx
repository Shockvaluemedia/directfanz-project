import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthSessionProvider from '@/components/providers/session-provider'
import { generateCSP } from '@/lib/security'
import GDPRConsent from '@/components/ui/gdpr-consent'

const inter = Inter({ subsets: ['latin'] })

// Generate CSP directives
const csp = generateCSP();

export const metadata: Metadata = {
  title: 'Direct Fan Platform',
  description: 'Connect artists with their superfans through exclusive content',
  // Add security headers
  other: {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider>
          {children}
          <GDPRConsent />
        </AuthSessionProvider>
      </body>
    </html>
  )
}