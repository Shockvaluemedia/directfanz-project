// Features parked for the drops, presales and listening parties launch.
//
// Parked code stays in the repo but is switched off: its pages and API routes
// answer 404 (see middleware.ts) and links to it are hidden. Less surface to
// secure and test before launch. Nothing is deleted.
//
// To switch a group back on, list it in NEXT_PUBLIC_UNPARK_FEATURES, for
// example NEXT_PUBLIC_UNPARK_FEATURES=campaigns,playlists. The NEXT_PUBLIC_
// prefix lets the same setting hide or show links in the browser; it is read
// at build time.

export const PARKED_FEATURES = {
  // Fan campaigns and challenges, with their submissions and leaderboards.
  campaigns: {
    pages: ['/campaigns', '/dashboard/artist/campaigns', '/dashboard/fan/campaigns'],
    api: ['/api/campaigns', '/api/challenges', '/api/fan/campaigns', '/api/fan/submissions'],
  },
  // AI agents, AI admin insights and AI revenue/price optimisation.
  ai: {
    pages: [],
    api: ['/api/ai'],
  },
  // Media optimisation pipeline (the regular upload flow does not use it).
  optimization: {
    pages: [],
    api: ['/api/content/optimize'],
  },
  playlists: {
    pages: ['/playlists'],
    api: ['/api/playlists'],
  },
} as const;

export type ParkedFeature = keyof typeof PARKED_FEATURES;

function unparkedFeatures(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map(name => name.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Reads the env var by its full literal name so Next.js can inline it in
// client bundles.
function currentSetting(): string | undefined {
  return process.env.NEXT_PUBLIC_UNPARK_FEATURES;
}

export function isFeatureParked(feature: ParkedFeature, setting = currentSetting()): boolean {
  return !unparkedFeatures(setting).has(feature);
}

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/');
}

// The parked feature a request path belongs to, or null when it is not parked.
export function parkedFeatureForPath(
  path: string,
  setting = currentSetting()
): ParkedFeature | null {
  const unparked = unparkedFeatures(setting);
  for (const [feature, { pages, api }] of Object.entries(PARKED_FEATURES)) {
    if (unparked.has(feature)) continue;
    if ([...pages, ...api].some(prefix => matchesPrefix(path, prefix))) {
      return feature as ParkedFeature;
    }
  }
  return null;
}
