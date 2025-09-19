import '@testing-library/jest-dom';

// Override jsdom HTMLMediaElement prototype methods BEFORE creating mock class
if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  // Create Jest spies that will be shared across all instances
  const mockLoad = jest.fn();
  const mockPlay = jest.fn();
  const mockPause = jest.fn();

  // Store original methods
  const originalProto = window.HTMLMediaElement.prototype;

  // Override methods that jsdom doesn't implement or throws errors on
  window.HTMLMediaElement.prototype.load = function () {
    mockLoad.call(this);

    // Initialize private state if not exists
    if (!this._mockState) {
      this._mockState = {
        readyState: 0,
        duration: 0,
        paused: true,
        volume: 1,
        currentTime: 0,
      };
    }

    // Simulate loading events with proper timing
    setTimeout(() => {
      this._mockState.readyState = 1; // HAVE_METADATA
      this.dispatchEvent(new Event('loadstart'));
      this.dispatchEvent(new Event('loadedmetadata'));

      if (!this._mockState.duration) {
        this._mockState.duration = 180;
        // Override duration getter
        Object.defineProperty(this, 'duration', {
          get: () => this._mockState.duration,
          configurable: true,
        });
      }

      setTimeout(() => {
        this._mockState.readyState = 4; // HAVE_ENOUGH_DATA
        this.dispatchEvent(new Event('loadeddata'));
        this.dispatchEvent(new Event('canplay'));
        this.dispatchEvent(new Event('canplaythrough'));
      }, 10);
    }, 0);
  };

  window.HTMLMediaElement.prototype.play = function () {
    mockPlay.call(this);

    if (!this._mockState) {
      this._mockState = { readyState: 0, duration: 0, paused: true, volume: 1, currentTime: 0 };
    }

    if (this._mockState.readyState < 3) {
      return Promise.reject(new DOMException('Not enough data available', 'NotSupportedError'));
    }

    this._mockState.paused = false;
    Object.defineProperty(this, 'paused', {
      get: () => this._mockState.paused,
      configurable: true,
    });

    this.dispatchEvent(new Event('play'));

    setTimeout(() => {
      if (!this._mockState.paused) {
        this.dispatchEvent(new Event('playing'));
      }
    }, 0);

    return Promise.resolve();
  };

  window.HTMLMediaElement.prototype.pause = function () {
    mockPause.call(this);

    if (!this._mockState) {
      this._mockState = { readyState: 0, duration: 0, paused: true, volume: 1, currentTime: 0 };
    }

    this._mockState.paused = true;
    Object.defineProperty(this, 'paused', {
      get: () => this._mockState.paused,
      configurable: true,
    });

    this.dispatchEvent(new Event('pause'));
  };

  // Store the spies globally so tests can access them
  if (typeof global !== 'undefined') {
    global._mediaElementSpies = {
      load: mockLoad,
      play: mockPlay,
      pause: mockPause,
    };

    // Also store global state that all instances can share
    global._mediaElementState = {
      volume: 1,
      currentTime: 0,
      duration: 0,
    };
  }

  // Add volume property to prototype
  Object.defineProperty(window.HTMLMediaElement.prototype, 'volume', {
    get: function () {
      return global._mediaElementState?.volume ?? this._mockState?.volume ?? 1;
    },
    set: function (value) {
      const newVolume = Math.max(0, Math.min(1, value));
      if (global._mediaElementState) {
        global._mediaElementState.volume = newVolume;
      }
      if (this._mockState) {
        this._mockState.volume = newVolume;
      }
      this.dispatchEvent(new Event('volumechange'));
    },
    configurable: true,
  });

  // Add currentTime property to prototype
  Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
    get: function () {
      return global._mediaElementState?.currentTime ?? this._mockState?.currentTime ?? 0;
    },
    set: function (value) {
      console.log('currentTime setter called with:', value);
      const duration = global._mediaElementState?.duration ?? this._mockState?.duration ?? 0;
      console.log('Available duration:', duration);
      const newTime = Math.max(0, Math.min(duration, value));
      console.log('Setting currentTime to:', newTime);
      if (global._mediaElementState) {
        global._mediaElementState.currentTime = newTime;
      }
      if (this._mockState) {
        this._mockState.currentTime = newTime;
      }
      this.dispatchEvent(new Event('timeupdate'));
    },
    configurable: true,
  });
}

// Comprehensive HTMLMediaElement mock for JSDOM
class MockHTMLMediaElement {
  constructor() {
    this.src = '';
    this._currentTime = 0;
    this.duration = 0;
    this._volume = 1;
    this.muted = false;
    this.paused = true;
    this.ended = false;
    this.readyState = 0; // Start with HAVE_NOTHING
    this.networkState = 0;
    this.preload = 'metadata';
    this.autoplay = false;
    this.loop = false;
    this.controls = false;
    this.crossOrigin = null;
    this.defaultMuted = false;
    this.defaultPlaybackRate = 1;
    this.playbackRate = 1;
    this.seeking = false;
    this.buffered = { length: 0, start: () => 0, end: () => 0 };
    this.played = { length: 0, start: () => 0, end: () => 0 };
    this.seekable = { length: 0, start: () => 0, end: () => 0 };
    this.eventHandlers = {};
    this.error = null;

    // Property setters with validation and side effects
    Object.defineProperty(this, 'volume', {
      get: () => this._volume,
      set: value => {
        const newVolume = Math.max(0, Math.min(1, value));
        if (newVolume !== this._volume) {
          this._volume = newVolume;
          this.dispatchEvent('volumechange');
        }
      },
    });

    Object.defineProperty(this, 'currentTime', {
      get: () => this._currentTime,
      set: value => {
        const newTime = Math.max(0, Math.min(this.duration || 0, value));
        if (newTime !== this._currentTime) {
          this._currentTime = newTime;
          this.dispatchEvent('seeked');
          this.dispatchEvent('timeupdate');
        }
      },
    });

    // Use the shared spies from global if available, otherwise create new ones
    const spies = global._mediaElementSpies || {
      load: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
    };

    // Mock methods using shared spies
    this.play = spies.play.mockImplementation(() => {
      if (this.readyState < 3) {
        return Promise.reject(new DOMException('Not enough data available', 'NotSupportedError'));
      }

      this.paused = false;
      this.dispatchEvent('play');

      // Start playing and time updates
      setTimeout(() => {
        if (!this.paused) {
          this.dispatchEvent('playing');
          this._startTimeUpdates();
        }
      }, 0);

      return Promise.resolve();
    });

    this.pause = spies.pause.mockImplementation(() => {
      this.paused = true;
      this._stopTimeUpdates();
      this.dispatchEvent('pause');
    });

    // Time update simulation
    this._timeUpdateInterval = null;
    this._startTimeUpdates = jest.fn().mockImplementation(() => {
      this._stopTimeUpdates();
      this._timeUpdateInterval = setInterval(() => {
        if (!this.paused && this._currentTime < this.duration) {
          this._currentTime += 0.25; // Update every 250ms
          this.dispatchEvent('timeupdate');

          // Check if we've reached the end
          if (this._currentTime >= this.duration) {
            this._currentTime = this.duration;
            this.paused = true;
            this._stopTimeUpdates();
            this.dispatchEvent('ended');
          }
        }
      }, 250);
    });

    this._stopTimeUpdates = jest.fn().mockImplementation(() => {
      if (this._timeUpdateInterval) {
        clearInterval(this._timeUpdateInterval);
        this._timeUpdateInterval = null;
      }
    });

    this.load = spies.load.mockImplementation(() => {
      // Simulate realistic loading sequence
      setTimeout(() => {
        this.readyState = 1; // HAVE_METADATA
        this.dispatchEvent('loadstart');
        this.dispatchEvent('loadedmetadata');

        // Set default duration if not set
        if (!this.duration) {
          this.duration = 180; // Default 3 minutes
        }

        setTimeout(() => {
          this.readyState = 4; // HAVE_ENOUGH_DATA
          this.dispatchEvent('loadeddata');
          this.dispatchEvent('canplay');
          this.dispatchEvent('canplaythrough');
        }, 10);
      }, 0);
    });

    this.canPlayType = jest.fn().mockImplementation(type => {
      if (type.includes('audio/mpeg') || type.includes('audio/mp3')) return 'probably';
      if (type.includes('audio/wav') || type.includes('audio/ogg')) return 'maybe';
      return '';
    });

    this.addEventListener = jest.fn().mockImplementation((type, handler) => {
      if (!this.eventHandlers[type]) {
        this.eventHandlers[type] = [];
      }
      this.eventHandlers[type].push(handler);
    });

    this.removeEventListener = jest.fn().mockImplementation((type, handler) => {
      if (this.eventHandlers[type]) {
        const index = this.eventHandlers[type].indexOf(handler);
        if (index !== -1) {
          this.eventHandlers[type].splice(index, 1);
        }
      }
    });

    this.dispatchEvent = jest.fn().mockImplementation(eventOrType => {
      const eventType = typeof eventOrType === 'string' ? eventOrType : eventOrType.type;
      if (this.eventHandlers[eventType]) {
        this.eventHandlers[eventType].forEach(handler => {
          try {
            handler(eventOrType);
          } catch (error) {
            // Silently handle errors in event handlers during tests
          }
        });
      }
      return true;
    });

    // Helper methods for tests
    this.triggerEvent = (eventType, eventData = {}) => {
      const event = new Event(eventType);
      Object.assign(event, eventData);
      this.dispatchEvent(event);
    };

    this.simulateError = (errorCode = 3, message = 'MEDIA_ERR_DECODE') => {
      this.error = {
        code: errorCode,
        message: message,
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      };
      this.dispatchEvent('error');
    };

    this.simulateTimeUpdate = currentTime => {
      this._currentTime = currentTime;
      this.triggerEvent('timeupdate');
    };

    this.simulateLoadedData = (duration = 180) => {
      this.duration = duration;
      // Also update global state for duration
      if (global._mediaElementState) {
        global._mediaElementState.duration = duration;
      }
      this.readyState = 4;
      this.triggerEvent('loadeddata');
    };

    this.simulateEnded = () => {
      this.ended = true;
      this.paused = true;
      this.triggerEvent('ended');
    };
  }
}

// Default mock state
const defaultMockState = {
  currentTime: 0,
  duration: 0,
  volume: 1,
  paused: true,
  ended: false,
  readyState: 0,
};

// Function to enhance an existing audio element with our mock behavior
function enhanceAudioElement(element) {
  // Initialize mock state
  element._mockState = { ...defaultMockState };

  // Store original methods if they exist
  const originalMethods = {
    load: element.load,
    play: element.play,
    pause: element.pause,
  };

  // Override read-only properties with getters/setters
  Object.defineProperty(element, 'readyState', {
    get: function () {
      return this._mockState?.readyState ?? 0;
    },
    set: function (value) {
      if (this._mockState) {
        this._mockState.readyState = value;
      }
    },
    configurable: true,
  });

  Object.defineProperty(element, 'paused', {
    get: function () {
      return this._mockState?.paused ?? true;
    },
    set: function (value) {
      if (this._mockState) {
        this._mockState.paused = value;
      }
    },
    configurable: true,
  });

  Object.defineProperty(element, 'ended', {
    get: function () {
      return this._mockState?.ended ?? false;
    },
    set: function (value) {
      if (this._mockState) {
        this._mockState.ended = value;
      }
    },
    configurable: true,
  });

  Object.defineProperty(element, 'duration', {
    get: function () {
      return global._mediaElementState?.duration ?? this._mockState?.duration ?? 0;
    },
    set: function (value) {
      if (global._mediaElementState) {
        global._mediaElementState.duration = value;
      }
      if (this._mockState) {
        this._mockState.duration = value;
      }
    },
    configurable: true,
  });

  // Ensure global spies exist
  if (!global._mediaElementSpies) {
    global._mediaElementSpies = {
      load: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
    };
  }

  // Create and replace methods with mock versions that also call global spies
  element.load = jest.fn().mockImplementation(() => {
    global._mediaElementSpies.load();
    element.readyState = 2; // HAVE_CURRENT_DATA
    element.dispatchEvent(new Event('loadstart'));
    element.dispatchEvent(new Event('loadedmetadata'));
  });

  element.play = jest.fn().mockImplementation(() => {
    global._mediaElementSpies.play();
    element.paused = false;
    element.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });

  element.pause = jest.fn().mockImplementation(() => {
    global._mediaElementSpies.pause();
    element.paused = true;
    element.dispatchEvent(new Event('pause'));
  });

  // Override currentTime property
  Object.defineProperty(element, 'currentTime', {
    get: function () {
      return global._mediaElementState?.currentTime ?? this._mockState?.currentTime ?? 0;
    },
    set: function (value) {
      const duration = global._mediaElementState?.duration ?? this._mockState?.duration ?? 0;
      const newTime = Math.max(0, Math.min(duration, value));
      if (global._mediaElementState) {
        global._mediaElementState.currentTime = newTime;
      }
      if (this._mockState) {
        this._mockState.currentTime = newTime;
      }
      this.dispatchEvent(new Event('timeupdate'));
    },
    configurable: true,
  });

  // Add volume sync
  Object.defineProperty(element, 'volume', {
    get: function () {
      return global._mediaElementState?.volume ?? this._mockState?.volume ?? 1;
    },
    set: function (value) {
      const newVolume = Math.max(0, Math.min(1, value));
      if (global._mediaElementState) {
        global._mediaElementState.volume = newVolume;
      }
      if (this._mockState) {
        this._mockState.volume = newVolume;
      }
    },
    configurable: true,
  });

  // Add helper methods for tests
  element.simulateLoadedData = function (duration = 180) {
    this.duration = duration;
    if (global._mediaElementState) {
      global._mediaElementState.duration = duration;
    }
    if (this._mockState) {
      this._mockState.duration = duration;
    }
    this.readyState = 4;
    this.dispatchEvent(new Event('loadeddata'));
  };

  element.simulateError = function () {
    this.dispatchEvent(new Event('error'));
  };

  element.simulateEnded = function () {
    this.ended = true;
    this.paused = true;
    this.dispatchEvent(new Event('ended'));
  };
}

// Check if we have a window object (browser-like environment)
if (typeof window !== 'undefined') {
  // Override jsdom's HTMLMediaElement implementation completely
  Object.defineProperty(window, 'HTMLMediaElement', {
    writable: true,
    configurable: true,
    value: MockHTMLMediaElement,
  });

  // Override document.createElement for audio and video elements to enhance them with our mock behavior
  const originalCreateElement = document.createElement;
  document.createElement = function (tagName, options) {
    const element = originalCreateElement.call(this, tagName, options);
    if (tagName.toLowerCase() === 'audio') {
      // Enhance the existing audio element with our mock behavior
      enhanceAudioElement(element);
    } else if (tagName.toLowerCase() === 'video') {
      // Enhance the existing video element with our mock behavior (same as audio)
      enhanceAudioElement(element);
    }
    return element;
  };

  // Override Audio constructor as well
  Object.defineProperty(window, 'Audio', {
    writable: true,
    configurable: true,
    value: MockHTMLMediaElement,
  });
}

// Also set global versions for Node.js environment
if (typeof global !== 'undefined') {
  global.HTMLMediaElement = MockHTMLMediaElement;
  global.HTMLAudioElement = MockHTMLMediaElement;
  global.HTMLVideoElement = MockHTMLMediaElement;
  global.Audio = MockHTMLMediaElement;
}

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPrefetch = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: mockPrefetch,
  })),
  useSearchParams: jest.fn(() => ({
    get: mockGet,
  })),
  usePathname: jest.fn(() => ''),
}));

// Export mocks for test usage
global.__mockNavigationPush = mockPush;
global.__mockNavigationReplace = mockReplace;
global.__mockNavigationPrefetch = mockPrefetch;
global.__mockNavigationGet = mockGet;

// Mock next-auth/react
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockUseSession = jest.fn(() => ({
  data: null,
  status: 'unauthenticated',
}));

jest.mock('next-auth/react', () => ({
  signIn: mockSignIn,
  signOut: mockSignOut,
  getSession: mockGetSession,
  useSession: mockUseSession,
}));

// Mock custom auth hooks
const mockUseRoleAuth = jest.fn(() => ({
  session: null,
  user: null,
  userRole: null,
  isLoading: false,
  isAuthenticated: false,
  hasRequiredRole: false,
  isArtist: false,
  isFan: false,
}));

jest.mock('@/hooks/use-role-auth', () => ({
  useRoleAuth: mockUseRoleAuth,
  useArtistAuth: jest.fn(() => mockUseRoleAuth()),
  useFanAuth: jest.fn(() => mockUseRoleAuth()),
  useRoleCheck: jest.fn(() => mockUseRoleAuth()),
  useConditionalRender: jest.fn(() => ({
    renderForRole: jest.fn(),
    renderForArtist: jest.fn(),
    renderForFan: jest.fn(),
    renderForAuthenticated: jest.fn(),
  })),
}));

// Export mocks for test usage
global.__mockSignIn = mockSignIn;
global.__mockSignOut = mockSignOut;
global.__mockGetSession = mockGetSession;
global.__mockUseSession = mockUseSession;
global.__mockUseRoleAuth = mockUseRoleAuth;

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
process.env.SENDGRID_API_KEY = 'sg_test_key';
process.env.FROM_EMAIL = 'test@example.com';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock fetch with default behavior that can be overridden in tests
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  );
}

// Mock IntersectionObserver for lazy loading
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.elements = [];
    }

    observe(element) {
      this.elements.push(element);
      // Immediately trigger callback as if element is intersecting
      this.callback([
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRect: element.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        },
      ]);
    }

    unobserve(element) {
      this.elements = this.elements.filter(el => el !== element);
    }

    disconnect() {
      this.elements = [];
    }
  };
}

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock NextAuth config
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock Next.js Request/Response
global.Request = class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.body = options.body;
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }

  async text() {
    return this.body || '';
  }
};

global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map(Object.entries(options.headers || {}));
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }

  static json(data, options = {}) {
    return new Response(JSON.stringify(data), {
      status: options.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
};

// Mock NextRequest and NextResponse
class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.body = options.body;
  }

  async json() {
    if (!this.body) return {};
    if (typeof this.body === 'object') return this.body;
    if (typeof this.body === 'string') {
      try {
        return JSON.parse(this.body);
      } catch (error) {
        throw new Error(`Invalid JSON: ${this.body}`);
      }
    }
    return {};
  }

  async text() {
    if (typeof this.body === 'object') {
      return JSON.stringify(this.body);
    }
    return this.body || '';
  }
}

jest.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: {
    json: (data, options = {}) => {
      return new Response(JSON.stringify(data), {
        status: options.status || 200,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    },
  },
}));

// Mock Prisma Client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    content: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    tier: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    artist: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentFailure: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(callback =>
      callback({
        user: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        subscription: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        content: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        tier: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        artist: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          aggregate: jest.fn(),
        },
        invoice: {
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          aggregate: jest.fn(),
        },
        comment: {
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        message: {
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        report: {
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        paymentFailure: {
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(1),
      })
    ),
  },
}));

// Notification functions will be tested with individual mocks
// Mock SendGrid directly for notification tests
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

// Mock notification functions for API route tests
jest.mock('@/lib/notifications', () => ({
  sendEmail: jest.fn(),
  getUserNotificationPreferences: jest.fn(),
  updateUserNotificationPreferences: jest.fn(),
  notifyNewContent: jest.fn(),
  notifyContentComment: jest.fn(),
  sendNotification: jest.fn(),
  DEFAULT_NOTIFICATION_PREFERENCES: {
    newContent: true,
    comments: true,
    subscriptionUpdates: true,
  },
}));

// Mock RBAC functions for permission checking
jest.mock('@/lib/rbac', () => ({
  checkPermission: jest.fn().mockResolvedValue(true),
  hasPermission: jest.fn(),
  hasAnyPermission: jest.fn(),
  hasAllPermissions: jest.fn(),
  checkRoleAccess: jest.fn(),
  withRoleAuth: jest.fn(),
  withArtistAuth: jest.fn(),
  withFanAuth: jest.fn(),
  ROLE_PERMISSIONS: {
    ARTIST: [],
    FAN: [],
  },
}));

// Mock database functions for comments and other operations
jest.mock('@/lib/database', () => {
  const actualModule = jest.requireActual('@/lib/database');
  return {
    ...actualModule,
    // Only override the functions that tests specifically need mocked
    createComment: jest.fn(),
    getCommentsByContentId: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
  };
});

// Mock billing functions that need special handling
jest.mock('@/lib/billing', () => {
  const actualModule = jest.requireActual('@/lib/billing');
  return {
    ...actualModule,
    generateInvoiceData: jest.fn().mockImplementation(invoiceId => {
      const baseInvoice = {
        id: invoiceId,
        subscriptionId: 'stripe_sub123',
        amount: 10.0,
        status: 'paid',
        dueDate: new Date('2022-01-01'),
        items: [],
      };

      if (invoiceId === 'in_test2') {
        return Promise.resolve({
          ...baseInvoice,
          id: 'in_test2',
          dueDate: new Date('2022-02-01'),
          paidAt: new Date('2022-02-01'),
        });
      }

      return Promise.resolve(baseInvoice);
    }),
  };
});

// Mock validation schemas
jest.mock('@/lib/validations', () => {
  const { z } = require('zod');
  return {
    createCommentSchema: {
      parse: jest.fn(data => {
        // Basic validation for comments
        if (!data.contentId)
          throw new z.ZodError([
            { path: ['contentId'], message: 'contentId is required', code: 'custom' },
          ]);
        if (!data.text || data.text.trim() === '') {
          throw new z.ZodError([
            { path: ['text'], message: 'Comment cannot be empty', code: 'too_small' },
          ]);
        }
        return data;
      }),
    },
    updateCommentSchema: {
      parse: jest.fn(data => data),
    },
    userUpdateSchema: {
      parse: jest.fn(data => data),
    },
    createTierSchema: {
      parse: jest.fn(data => data),
      safeParse: jest.fn(data => ({ success: true, data })),
    },
    updateTierSchema: {
      parse: jest.fn(data => data),
      safeParse: jest.fn(data => ({ success: true, data })),
    },
  };
});

// Content access functions will be tested directly
// Individual tests can mock specific functions as needed

// Mock business metrics
jest.mock('@/lib/business-metrics', () => ({
  businessMetrics: {
    track: jest.fn(),
    trackUserRegistration: jest.fn(),
    trackUserLogin: jest.fn(),
    trackPayment: jest.fn(),
    trackSubscription: jest.fn(),
    trackContent: jest.fn(),
    updateActiveUsers: jest.fn(),
    updateConversionRate: jest.fn(),
    updateARPU: jest.fn(),
    updateCustomerLTV: jest.fn(),
    getMetricsRegistry: jest.fn(),
    reset: jest.fn(),
  },
}));

// Mock payment monitoring
jest.mock('@/lib/payment-monitoring', () => ({
  paymentMonitor: {
    trackPaymentIntentCreated: jest.fn(),
    trackPaymentSuccess: jest.fn(),
    trackPaymentFailure: jest.fn(),
    trackSubscriptionCreated: jest.fn(),
    trackSubscriptionUpdated: jest.fn(),
    trackSubscriptionCancelled: jest.fn(),
    trackInvoicePaid: jest.fn(),
    trackInvoicePaymentFailed: jest.fn(),
    trackDispute: jest.fn(),
  },
}));

// Mock user engagement tracking
jest.mock('@/lib/user-engagement-tracking', () => ({
  userEngagementTracker: {
    trackUserRegistration: jest.fn(),
    trackUserAuthentication: jest.fn(),
    trackContentInteraction: jest.fn(),
    trackCreatorActivity: jest.fn(),
    trackDiscoveryEvent: jest.fn(),
    trackRetentionEvent: jest.fn(),
    updateActiveUserMetrics: jest.fn(),
  },
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
    },
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    },
    invoices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      pay: jest.fn(),
      list: jest.fn(),
      upcoming: jest.fn(),
    },
    prices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
    },
    products: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    webhookEndpoints: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Mock prom-client for business metrics
jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
    get: jest.fn(),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
    get: jest.fn(),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    get: jest.fn(),
  })),
  register: {
    metrics: jest.fn().mockResolvedValue('# Mock metrics'),
    resetMetrics: jest.fn(),
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
  },
}));
