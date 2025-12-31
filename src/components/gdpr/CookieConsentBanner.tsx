'use client';
import { useState, useEffect } from 'react';

interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const savedConsent = localStorage.getItem('cookie-consent');
    if (!savedConsent) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const fullConsent = { necessary: true, analytics: true, marketing: true };
    saveConsent(fullConsent);
    setShowBanner(false);
  };

  const saveConsent = (consentData: CookieConsent) => {
    localStorage.setItem('cookie-consent', JSON.stringify(consentData));
    fetch('/api/cookie-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consentData),
    });
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
      <div className="max-w-6xl mx-auto">
        <h3 className="text-lg font-semibold mb-2">Cookie Preferences</h3>
        <p className="text-sm text-gray-600 mb-4">
          We use cookies to enhance your experience.
        </p>
        
        <div className="flex gap-2">
          <button
            onClick={handleAcceptAll}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Accept All
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="bg-gray-600 text-white px-4 py-2 rounded text-sm"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}