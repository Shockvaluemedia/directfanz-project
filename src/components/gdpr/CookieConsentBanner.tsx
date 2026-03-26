'use client';
import { useState, useEffect, useCallback } from 'react';

interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CONSENT_COOKIE_NAME = 'cookie-consent';
const CONSENT_VERSION = '1'; // bump when policy changes to re-prompt

function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_COOKIE_NAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return null; // policy changed
    return parsed.consent as CookieConsent;
  } catch {
    return null;
  }
}

function writeConsent(consent: CookieConsent) {
  localStorage.setItem(
    CONSENT_COOKIE_NAME,
    JSON.stringify({ consent, version: CONSENT_VERSION, timestamp: new Date().toISOString() })
  );
  // Also set a simple cookie so the server can read consent status
  document.cookie = `cookie-consent=${encodeURIComponent(JSON.stringify(consent))};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const saved = readConsent();
    if (!saved) {
      setShowBanner(true);
    } else {
      setConsent(saved);
    }
  }, []);

  const persistConsent = useCallback(
    (consentData: CookieConsent) => {
      writeConsent(consentData);
      setConsent(consentData);
      setShowBanner(false);

      // Record consent server-side for GDPR audit trail
      fetch('/api/gdpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cookie_consent',
          consent: consentData,
          version: CONSENT_VERSION,
          source: 'banner',
        }),
      }).catch(() => {
        // Non-critical — consent is stored locally regardless
      });
    },
    []
  );

  const handleAcceptAll = () => {
    persistConsent({ necessary: true, analytics: true, marketing: true });
  };

  const handleRejectNonEssential = () => {
    persistConsent({ necessary: true, analytics: false, marketing: false });
  };

  const handleSavePreferences = () => {
    persistConsent(consent);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-2">Cookie Preferences</h3>
        <p className="text-sm text-gray-600 mb-4">
          We use cookies to enhance your experience. Necessary cookies are always enabled.
          You can choose which optional cookies to allow.
        </p>

        {showDetails && (
          <div className="mb-4 space-y-3 border rounded-lg p-4 bg-gray-50">
            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">Necessary</span>
                <p className="text-xs text-gray-500">Required for the site to function. Cannot be disabled.</p>
              </div>
              <input type="checkbox" checked disabled className="h-4 w-4" />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="font-medium text-sm">Analytics</span>
                <p className="text-xs text-gray-500">Help us understand how visitors use the site.</p>
              </div>
              <input
                type="checkbox"
                checked={consent.analytics}
                onChange={e => setConsent(prev => ({ ...prev, analytics: e.target.checked }))}
                className="h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="font-medium text-sm">Marketing</span>
                <p className="text-xs text-gray-500">Used to deliver relevant advertisements.</p>
              </div>
              <input
                type="checkbox"
                checked={consent.marketing}
                onChange={e => setConsent(prev => ({ ...prev, marketing: e.target.checked }))}
                className="h-4 w-4"
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAcceptAll}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={handleRejectNonEssential}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Reject Non-Essential
          </button>
          {showDetails ? (
            <button
              onClick={handleSavePreferences}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Save Preferences
            </button>
          ) : (
            <button
              onClick={() => setShowDetails(true)}
              className="text-blue-600 hover:text-blue-700 px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Customize
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
