// Console filter to suppress browser extension noise in development
export function setupConsoleFilter() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  const originalError = console.error;
  const originalWarn = console.warn;

  // Filter out known browser extension errors
  const extensionErrorPatterns = [
    'Failed to load resource',
    'extensionState.js',
    'heuristicsRedefinitions.js',
    'utils.js:1',
    'net::ERR_FILE_NOT_FOUND',
    'ERR_BLOCKED_BY_CLIENT', // Ad blocker errors
    'ERR_NETWORK_CHANGED',
    'chrome-extension://',
    'moz-extension://',
    'Unchecked runtime.lastError: The message port closed before a response was received',
  ];

  console.error = (...args) => {
    const message = args[0]?.toString() || '';

    // Check if this is a browser extension error
    if (extensionErrorPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress these errors
    }

    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args[0]?.toString() || '';

    // Check if this is a browser extension warning
    if (extensionErrorPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress these warnings
    }

    originalWarn.apply(console, args);
  };

  console.log('🔇 Console filter enabled - browser extension noise suppressed');
}
