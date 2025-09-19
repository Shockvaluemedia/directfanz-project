import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthSessionProvider from '@/components/providers/session-provider';
import { WebSocketClientProvider } from '@/components/providers/WebSocketClientProvider';
import { ToastProvider } from '@/components/ui/toast';
// Temporarily disabled for debugging
// import { generateCSP } from '@/lib/security'
import GDPRConsent from '@/components/ui/gdpr-consent';
import StaticHeader from '@/components/navigation/StaticHeader';
import StaticBreadcrumbs from '@/components/navigation/StaticBreadcrumbs';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

// Generate CSP directives - DISABLED FOR DEBUGGING
// const csp = generateCSP();

export const metadata: Metadata = {
  title: 'DirectFanz',
  description: 'Connect artists with their superfans through exclusive content',
  // Temporarily disabled security headers for debugging
  // other: {
  //   'Content-Security-Policy': csp,
  //   'X-Content-Type-Options': 'nosniff',
  //   'X-Frame-Options': 'DENY',
  //   'X-XSS-Protection': '1; mode=block',
  //   'Referrer-Policy': 'strict-origin-when-cross-origin',
  //   'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        <AuthSessionProvider>
          <ToastProvider>
            <WebSocketClientProvider>
              <ErrorBoundary>
                <div className='flex flex-col min-h-screen'>
                  <StaticHeader />
                  <main className='flex-1'>
                    <StaticBreadcrumbs />
                    {children}
                  </main>
                </div>
              </ErrorBoundary>
            </WebSocketClientProvider>
            {/* <GDPRConsent /> */}
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
