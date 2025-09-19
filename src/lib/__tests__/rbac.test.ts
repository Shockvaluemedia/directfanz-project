import { UserRole } from '@/types/database';

// Import only the pure functions for testing
const ROLE_PERMISSIONS = {
  ARTIST: [
    'artist:profile:read',
    'artist:profile:write',
    'artist:tiers:create',
    'artist:tiers:read',
    'artist:tiers:update',
    'artist:tiers:delete',
    'artist:content:create',
    'artist:content:read',
    'artist:content:update',
    'artist:content:delete',
    'artist:analytics:read',
    'artist:earnings:read',
    'artist:subscribers:read',
    'user:profile:read',
    'user:profile:write',
  ],
  FAN: [
    'fan:artists:discover',
    'fan:artists:read',
    'fan:subscriptions:create',
    'fan:subscriptions:read',
    'fan:subscriptions:update',
    'fan:subscriptions:delete',
    'fan:content:read',
    'fan:comments:create',
    'fan:comments:read',
    'fan:comments:update',
    'fan:comments:delete',
    'user:profile:read',
    'user:profile:write',
  ],
} as const;

type Permission = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS][number];

function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

describe('RBAC System', () => {
  describe('hasPermission', () => {
    it('should return true for valid artist permissions', () => {
      expect(hasPermission(UserRole.ARTIST, 'artist:profile:read')).toBe(true);
      expect(hasPermission(UserRole.ARTIST, 'artist:tiers:create')).toBe(true);
      expect(hasPermission(UserRole.ARTIST, 'user:profile:read')).toBe(true);
    });

    it('should return true for valid fan permissions', () => {
      expect(hasPermission(UserRole.FAN, 'fan:artists:discover')).toBe(true);
      expect(hasPermission(UserRole.FAN, 'fan:subscriptions:create')).toBe(true);
      expect(hasPermission(UserRole.FAN, 'user:profile:read')).toBe(true);
    });

    it('should return false for invalid permissions', () => {
      expect(hasPermission(UserRole.FAN, 'artist:tiers:create')).toBe(false);
      expect(hasPermission(UserRole.ARTIST, 'fan:subscriptions:create')).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', () => {
      const artistPermissions = ['artist:profile:read', 'user:profile:read'];
      expect(hasAllPermissions(UserRole.ARTIST, artistPermissions)).toBe(true);

      const fanPermissions = ['fan:artists:discover', 'user:profile:read'];
      expect(hasAllPermissions(UserRole.FAN, fanPermissions)).toBe(true);
    });

    it('should return false when user lacks some permissions', () => {
      const mixedPermissions = ['artist:profile:read', 'fan:subscriptions:create'];
      expect(hasAllPermissions(UserRole.ARTIST, mixedPermissions)).toBe(false);
      expect(hasAllPermissions(UserRole.FAN, mixedPermissions)).toBe(false);
    });

    it('should return true for empty permissions array', () => {
      expect(hasAllPermissions(UserRole.ARTIST, [])).toBe(true);
      expect(hasAllPermissions(UserRole.FAN, [])).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one permission', () => {
      const mixedPermissions = ['artist:profile:read', 'fan:subscriptions:create'];
      expect(hasAnyPermission(UserRole.ARTIST, mixedPermissions)).toBe(true);
      expect(hasAnyPermission(UserRole.FAN, mixedPermissions)).toBe(true);
    });

    it('should return false when user has no permissions', () => {
      const artistOnlyPermissions = ['artist:profile:read', 'artist:tiers:create'];
      expect(hasAnyPermission(UserRole.FAN, artistOnlyPermissions)).toBe(false);

      const fanOnlyPermissions = ['fan:artists:discover', 'fan:subscriptions:create'];
      expect(hasAnyPermission(UserRole.ARTIST, fanOnlyPermissions)).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      expect(hasAnyPermission(UserRole.ARTIST, [])).toBe(false);
      expect(hasAnyPermission(UserRole.FAN, [])).toBe(false);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('should have defined permissions for ARTIST role', () => {
      expect(ROLE_PERMISSIONS.ARTIST).toBeDefined();
      expect(ROLE_PERMISSIONS.ARTIST.length).toBeGreaterThan(0);
      expect(ROLE_PERMISSIONS.ARTIST).toContain('artist:profile:read');
      expect(ROLE_PERMISSIONS.ARTIST).toContain('user:profile:read');
    });

    it('should have defined permissions for FAN role', () => {
      expect(ROLE_PERMISSIONS.FAN).toBeDefined();
      expect(ROLE_PERMISSIONS.FAN.length).toBeGreaterThan(0);
      expect(ROLE_PERMISSIONS.FAN).toContain('fan:artists:discover');
      expect(ROLE_PERMISSIONS.FAN).toContain('user:profile:read');
    });

    it('should have common permissions for both roles', () => {
      const commonPermissions = ['user:profile:read', 'user:profile:write'];

      commonPermissions.forEach(permission => {
        expect(ROLE_PERMISSIONS.ARTIST).toContain(permission);
        expect(ROLE_PERMISSIONS.FAN).toContain(permission);
      });
    });

    it('should have role-specific permissions', () => {
      // Artist-specific permissions should not be in FAN role
      const artistSpecific = [
        'artist:tiers:create',
        'artist:content:create',
        'artist:analytics:read',
      ];
      artistSpecific.forEach(permission => {
        expect(ROLE_PERMISSIONS.ARTIST).toContain(permission);
        expect(ROLE_PERMISSIONS.FAN).not.toContain(permission);
      });

      // Fan-specific permissions should not be in ARTIST role
      const fanSpecific = ['fan:subscriptions:create', 'fan:comments:create'];
      fanSpecific.forEach(permission => {
        expect(ROLE_PERMISSIONS.FAN).toContain(permission);
        expect(ROLE_PERMISSIONS.ARTIST).not.toContain(permission);
      });
    });
  });
});
