import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-indigo-950 to-gray-900 text-white">
      {/* The global site header (with sign in / dashboard) is rendered by the
          root layout, so the homepage does not render its own nav. */}

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
          Connect with your
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            favorite artists
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Subscribe to exclusive content, join live streams, and support the
          creators you love — all in one platform.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup?role=fan"
            className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
          >
            Join as a Fan
          </Link>
          <Link
            href="/auth/signup?role=artist"
            className="border border-indigo-500 hover:bg-indigo-900/50 px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
          >
            Start Creating
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-16">
          Everything creators need to thrive
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
            <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Protected Content</h3>
            <p className="text-gray-400">
              Upload photos, audio, and video that only your paying subscribers
              can unlock — access is enforced on every request.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Tiered Subscriptions</h3>
            <p className="text-gray-400">
              Create multiple tiers with different pricing and exclusive content
              for each level.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Payouts</h3>
            <p className="text-gray-400">
              Get paid directly via Stripe Connect. Only 5% platform fee — you
              keep 95% of your earnings.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">
          Simple pricing for creators
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
          No upfront costs. No hidden fees. Just a 5% platform fee on your
          earnings.
        </p>
        <div className="max-w-md mx-auto bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
          <div className="text-5xl font-bold mb-2">
            5<span className="text-2xl text-gray-400">%</span>
          </div>
          <p className="text-gray-400 mb-6">platform fee on earnings</p>
          <ul className="text-left space-y-3 mb-8">
            {[
              'Unlimited content uploads',
              'Subscriber-only protected content',
              'Custom subscription tiers',
              'Analytics dashboard',
              'Direct Stripe payouts',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-gray-300">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/auth/signup?role=artist"
            className="block w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg font-semibold transition-colors"
          >
            Start Earning Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-xl font-bold">
              Direct<span className="text-indigo-400">Fanz</span>
            </div>
            <div className="flex gap-6 text-gray-400 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; 2025 DirectFanz. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
