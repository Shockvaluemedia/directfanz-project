'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ConsentOption {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

interface GDPRConsentProps {
  onConsentChange?: (consents: Record<string, boolean>) => void;
  showRequired?: boolean;
}

const defaultConsentOptions: ConsentOption[] = [
  {
    id: 'essential',
    name: 'Essential Cookies',
    description: 'These cookies are necessary for the website to function and cannot be switched off.',
    required: true,
  },
  {
    id: 'functional',
    name: 'Functional Cookies',
    description: 'These cookies enable personalized features and functionality.',
    required: false,
  },
  {
    id: 'analytics',
    name: 'Analytics Cookies',
    description: 'These cookies help us improve our website by collecting anonymous information.',
    required: false,
  },
  {
    id: 'marketing',
    name: 'Marketing Cookies',
    description: 'These cookies are used to track visitors across websites to display relevant advertisements.',
    required: false,
  },
];

export const GDPRConsent: React.FC<GDPRConsentProps> = ({
  onConsentChange,
  showRequired = true,
}) => {
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [showBanner, setShowBanner] = useState(false);
  const router = useRouter();

  // Initialize consents from localStorage or defaults
  useEffect(() => {
    const storedConsents = localStorage.getItem('gdpr_consents');
    
    if (storedConsents) {
      try {
        const parsedConsents = JSON.parse(storedConsents);
        setConsents(parsedConsents);
      } catch (error) {
        console.error('Failed to parse stored consents', error);
        initializeDefaultConsents();
      }
    } else {
      // No stored consents, show the banner
      setShowBanner(true);
      initializeDefaultConsents();
    }
  }, []);

  const initializeDefaultConsents = () => {
    const defaults = defaultConsentOptions.reduce((acc, option) => {
      acc[option.id] = option.required;
      return acc;
    }, {} as Record<string, boolean>);
    
    setConsents(defaults);
  };

  const handleConsentChange = (id: string, value: boolean) => {
    const updatedConsents = {
      ...consents,
      [id]: value,
    };
    
    setConsents(updatedConsents);
    
    if (onConsentChange) {
      onConsentChange(updatedConsents);
    }
  };

  const saveConsents = () => {
    localStorage.setItem('gdpr_consents', JSON.stringify(consents));
    setShowBanner(false);
  };

  const acceptAll = () => {
    const allConsents = defaultConsentOptions.reduce((acc, option) => {
      acc[option.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    
    setConsents(allConsents);
    localStorage.setItem('gdpr_consents', JSON.stringify(allConsents));
    
    if (onConsentChange) {
      onConsentChange(allConsents);
    }
    
    setShowBanner(false);
  };

  const acceptRequired = () => {
    const requiredConsents = defaultConsentOptions.reduce((acc, option) => {
      acc[option.id] = option.required;
      return acc;
    }, {} as Record<string, boolean>);
    
    setConsents(requiredConsents);
    localStorage.setItem('gdpr_consents', JSON.stringify(requiredConsents));
    
    if (onConsentChange) {
      onConsentChange(requiredConsents);
    }
    
    setShowBanner(false);
  };

  const handleDataRequest = async (type: 'export' | 'delete') => {
    try {
      const response = await fetch(`/api/user/gdpr/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to request data ${type}`);
      }
      
      if (type === 'export') {
        // For export, we'll download the data
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'my-data-export.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // For delete, show confirmation and redirect to home
        alert('Your data deletion request has been received. Your account will be processed for deletion.');
        router.push('/');
      }
    } catch (error) {
      console.error(`Error during data ${type} request:`, error);
      alert(`There was an error processing your ${type} request. Please try again later.`);
    }
  };

  if (!showBanner && !showRequired) {
    return null;
  }

  // Handle keyboard navigation for the consent banner
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showBanner) {
      setShowBanner(false);
    }
  };

  // Create a ref for focus management
  const bannerRef = React.useRef<HTMLDivElement>(null);
  const firstButtonRef = React.useRef<HTMLButtonElement>(null);

  // Focus management for when the banner appears
  React.useEffect(() => {
    if (showBanner && firstButtonRef.current) {
      // Set focus to the first button when banner appears
      firstButtonRef.current.focus();
    }
  }, [showBanner]);

  return (
    <>
      {/* Consent Banner */}
      {showBanner && (
        <div 
          ref={bannerRef}
          className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 z-50 border-t border-gray-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-description"
          onKeyDown={handleKeyDown}
        >
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h3 id="cookie-consent-title" className="text-lg font-medium text-gray-900">Cookie Consent</h3>
                <p id="cookie-consent-description" className="mt-1 text-sm text-gray-600">
                  We use cookies to enhance your experience. By continuing to visit this site, you agree to our use of cookies.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  ref={firstButtonRef}
                  onClick={acceptRequired}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Accept Required
                </button>
                <button
                  onClick={acceptAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Accept All
                </button>
                <button
                  onClick={() => setShowBanner(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Customize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consent Management UI */}
      {(showBanner || showRequired) && (
        <div 
          className={`${showBanner ? 'mt-4' : ''} bg-white rounded-lg shadow p-6`}
          role="region"
          aria-labelledby="privacy-preferences-title"
        >
          <h3 id="privacy-preferences-title" className="text-lg font-medium text-gray-900 mb-4">Privacy Preferences</h3>
          
          <div className="space-y-4">
            {defaultConsentOptions.map((option) => (
              <div key={option.id} className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id={`consent-${option.id}`}
                    name={`consent-${option.id}`}
                    type="checkbox"
                    checked={consents[option.id] || false}
                    onChange={(e) => handleConsentChange(option.id, e.target.checked)}
                    disabled={option.required}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    aria-describedby={`consent-desc-${option.id}`}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor={`consent-${option.id}`} className="font-medium text-gray-700">
                    {option.name} 
                    {option.required && (
                      <>
                        <span aria-hidden="true" className="text-red-500 ml-1">*</span>
                        <span className="sr-only"> (required)</span>
                      </>
                    )}
                  </label>
                  <p id={`consent-desc-${option.id}`} className="text-gray-500">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          {showBanner && (
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={saveConsents}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Save Preferences
              </button>
            </div>
          )}
          
          {/* Data Subject Rights */}
          <div 
            className="mt-8 pt-6 border-t border-gray-200"
            role="region"
            aria-labelledby="data-rights-title"
          >
            <h4 id="data-rights-title" className="text-md font-medium text-gray-900 mb-2">Your Data Rights</h4>
            <p className="text-sm text-gray-600 mb-4">
              Under GDPR, you have the right to access and delete your personal data.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleDataRequest('export')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Export my personal data"
              >
                Export My Data
              </button>
              <button
                onClick={() => handleDataRequest('delete')}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Request account deletion"
              >
                Request Account Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessibility announcement for screen readers */}
      <div className="sr-only" aria-live="polite">
        {showBanner ? 'Cookie consent banner opened' : ''}
      </div>
    </>
  );
};

export default GDPRConsent;