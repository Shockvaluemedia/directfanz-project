import { isFeatureParked, parkedFeatureForPath } from '@/lib/parked-features';

describe('parked features', () => {
  it('parks campaigns, AI, media optimisation and playlists by default', () => {
    expect(parkedFeatureForPath('/campaigns', '')).toBe('campaigns');
    expect(parkedFeatureForPath('/campaigns/abc', '')).toBe('campaigns');
    expect(parkedFeatureForPath('/dashboard/artist/campaigns/create', '')).toBe('campaigns');
    expect(parkedFeatureForPath('/api/challenges/c-1/leaderboard', '')).toBe('campaigns');
    expect(parkedFeatureForPath('/api/fan/campaigns', '')).toBe('campaigns');
    expect(parkedFeatureForPath('/api/fan/submissions', '')).toBe('campaigns');
    expect(parkedFeatureForPath('/api/ai/revenue', '')).toBe('ai');
    expect(parkedFeatureForPath('/api/content/optimize', '')).toBe('optimization');
    expect(parkedFeatureForPath('/playlists', '')).toBe('playlists');
  });

  it('leaves the launch paths alone', () => {
    for (const path of [
      '/',
      '/community',
      '/api/community',
      '/api/drops/d-1',
      '/api/parties',
      '/api/fan/subscriptions',
      '/api/content/upload',
      '/dashboard/artist',
      '/dashboard/fan',
      // Same start, different path: must not match a parked prefix.
      '/campaignsx',
      '/api/aircraft',
    ]) {
      expect(parkedFeatureForPath(path, '')).toBeNull();
    }
  });

  it('switches a group back on through the setting', () => {
    expect(parkedFeatureForPath('/campaigns', 'campaigns')).toBeNull();
    expect(parkedFeatureForPath('/api/challenges', ' Campaigns , playlists')).toBeNull();
    expect(parkedFeatureForPath('/playlists', 'campaigns,playlists')).toBeNull();
    expect(parkedFeatureForPath('/api/ai', 'campaigns,playlists')).toBe('ai');

    expect(isFeatureParked('campaigns', undefined)).toBe(true);
    expect(isFeatureParked('campaigns', 'campaigns')).toBe(false);
    expect(isFeatureParked('ai', 'campaigns')).toBe(true);
  });
});
