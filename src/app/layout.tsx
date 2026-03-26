import type { Viewport } from 'next';
import './globals.css';
import AuthSessionProvider from '@/components/providers/session-provider';
import { WebSocketClientProvider } from '@/components/providers/WebSocketClientProvider';
import { ToastProvider } from '@/components/ui/toast';
import GDPRConsent from '@/components/ui/gdpr-consent';
import StaticHeader from '@/components/navigation/StaticHeader';
import StaticBreadcrumbs from '@/components/navigation/StaticBreadcrumbs';
import ErrorBoundary from '@/components/ErrorBoundary';
import { generateMetadata as generateSEO } from '@/lib/seo';

export const metadata = generateSEO({
  title: undefined, // Uses default: "Direct Fan - Connect Creators with Fans"
  description: 'The ultimate creator platform for building meaningful fan connections and monetizing your content. Join thousands of creators earning directly from their audience.',
  url: '/',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body className="font-sans">
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
            <GDPRConsent />
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
