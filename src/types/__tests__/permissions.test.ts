import { describe, it, expect } from 'vitest';
import {
  Permission,
  PERMISSIONS,
  getAllPermissions,
  getAllCategories,
  getPermissionsByCategory,
  getPermissionMetadata,
  isValidPermission,
  hasPermission,
  hasAllPermissions,
  validatePermissions,
  getPermissionDescription,
  getEndpointsForPermission,
  DEFAULT_PERMISSIONS,
  PRODUCTION_RECOMMENDED_PERMISSIONS,
  DEVELOPMENT_RECOMMENDED_PERMISSIONS,
} from '../permissions';

describe('Permissions System', () => {
  describe('Permission Constants', () => {
    it('should have all 13 permissions defined', () => {
      const allPermissions = getAllPermissions();
      expect(allPermissions).toHaveLength(13);
    });

    it('should include all expected permissions', () => {
      const allPermissions = getAllPermissions();
      expect(allPermissions).toContain('chat:read');
      expect(allPermissions).toContain('chat:write');
      expect(allPermissions).toContain('documents:read');
      expect(allPermissions).toContain('documents:write');
      expect(allPermissions).toContain('documents:delete');
      expect(allPermissions).toContain('sessions:read');
      expect(allPermissions).toContain('sessions:write');
      expect(allPermissions).toContain('analytics:read');
      expect(allPermissions).toContain('webhooks:read');
      expect(allPermissions).toContain('webhooks:write');
      expect(allPermissions).toContain('sync:read');
      expect(allPermissions).toContain('sync:write');
      expect(allPermissions).toContain('*');
    });

    it('should have metadata for all permissions', () => {
      const allPermissions = getAllPermissions();
      allPermissions.forEach(permission => {
        const metadata = PERMISSIONS[permission];
        expect(metadata).toBeDefined();
        expect(metadata.permission).toBe(permission);
        expect(metadata.category).toBeDefined();
        expect(metadata.description).toBeDefined();
        expect(metadata.requiredFor).toBeDefined();
        expect(Array.isArray(metadata.requiredFor)).toBe(true);
      });
    });
  });

  describe('Permission Categories', () => {
    it('should have all 7 categories', () => {
      const categories = getAllCategories();
      expect(categories).toHaveLength(7);
      expect(categories).toContain('chat');
      expect(categories).toContain('documents');
      expect(categories).toContain('sessions');
      expect(categories).toContain('analytics');
      expect(categories).toContain('webhooks');
      expect(categories).toContain('sync');
      expect(categories).toContain('admin');
    });

    it('should group permissions by category correctly', () => {
      const chatPermissions = getPermissionsByCategory('chat');
      expect(chatPermissions).toHaveLength(2);
      expect(chatPermissions.every(p => p.category === 'chat')).toBe(true);

      const documentPermissions = getPermissionsByCategory('documents');
      expect(documentPermissions).toHaveLength(3);
      expect(documentPermissions.every(p => p.category === 'documents')).toBe(true);

      const adminPermissions = getPermissionsByCategory('admin');
      expect(adminPermissions).toHaveLength(1);
      expect(adminPermissions[0].permission).toBe('*');
    });
  });

  describe('Permission Validation', () => {
    it('should validate correct permissions', () => {
      expect(isValidPermission('chat:read')).toBe(true);
      expect(isValidPermission('documents:write')).toBe(true);
      expect(isValidPermission('*')).toBe(true);
    });

    it('should reject invalid permissions', () => {
      expect(isValidPermission('invalid:permission')).toBe(false);
      expect(isValidPermission('chat:invalid')).toBe(false);
      expect(isValidPermission('random')).toBe(false);
    });

    it('should validate permission arrays', () => {
      const result = validatePermissions([
        'chat:read',
        'invalid:permission',
        'documents:write',
        'another:invalid',
      ]);

      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain('chat:read');
      expect(result.valid).toContain('documents:write');

      expect(result.invalid).toHaveLength(2);
      expect(result.invalid).toContain('invalid:permission');
      expect(result.invalid).toContain('another:invalid');
    });
  });

  describe('Permission Checking', () => {
    it('should check single permission correctly', () => {
      const userPermissions = ['chat:read', 'documents:write'];
      
      expect(hasPermission(userPermissions, 'chat:read')).toBe(true);
      expect(hasPermission(userPermissions, 'documents:write')).toBe(true);
      expect(hasPermission(userPermissions, 'documents:delete')).toBe(false);
    });

    it('should handle wildcard permission', () => {
      const userPermissions = ['*'];
      
      expect(hasPermission(userPermissions, 'chat:read')).toBe(true);
      expect(hasPermission(userPermissions, 'documents:write')).toBe(true);
      expect(hasPermission(userPermissions, 'any:permission' as Permission)).toBe(true);
    });

    it('should check multiple permissions correctly', () => {
      const userPermissions = ['chat:read', 'chat:write', 'documents:read'];
      
      expect(hasAllPermissions(userPermissions, ['chat:read', 'chat:write'])).toBe(true);
      expect(hasAllPermissions(userPermissions, ['chat:read', 'documents:delete'])).toBe(false);
    });

    it('should handle wildcard in multiple permission check', () => {
      const userPermissions = ['*'];
      
      expect(hasAllPermissions(userPermissions, ['chat:read', 'documents:write', 'sync:write'])).toBe(true);
    });
  });

  describe('Permission Metadata', () => {
    it('should get permission metadata', () => {
      const metadata = getPermissionMetadata('documents:write');
      
      expect(metadata).toBeDefined();
      expect(metadata?.permission).toBe('documents:write');
      expect(metadata?.category).toBe('documents');
      expect(metadata?.description).toContain('Create and update documents');
      expect(metadata?.requiredFor.length).toBeGreaterThan(0);
    });

    it('should get permission description', () => {
      const description = getPermissionDescription('chat:read');
      expect(description).toBe('Read chat history and conversation data');
    });

    it('should get endpoints for permission', () => {
      const endpoints = getEndpointsForPermission('documents:write');
      expect(endpoints.length).toBeGreaterThan(0);
      expect(endpoints.some(e => e.includes('/api/documents'))).toBe(true);
    });

    it('should return empty array for unknown permission', () => {
      const endpoints = getEndpointsForPermission('unknown:permission' as Permission);
      expect(endpoints).toEqual([]);
    });
  });

  describe('Default Permissions', () => {
    it('should have read-only default permissions', () => {
      expect(DEFAULT_PERMISSIONS).toContain('chat:read');
      expect(DEFAULT_PERMISSIONS).toContain('documents:read');
      expect(DEFAULT_PERMISSIONS).toContain('sessions:read');
      expect(DEFAULT_PERMISSIONS).toContain('analytics:read');
      
      // Should not include write permissions
      expect(DEFAULT_PERMISSIONS).not.toContain('chat:write');
      expect(DEFAULT_PERMISSIONS).not.toContain('documents:write');
      expect(DEFAULT_PERMISSIONS).not.toContain('*');
    });

    it('should have safe production permissions', () => {
      expect(PRODUCTION_RECOMMENDED_PERMISSIONS).toContain('chat:read');
      expect(PRODUCTION_RECOMMENDED_PERMISSIONS).toContain('chat:write');
      expect(PRODUCTION_RECOMMENDED_PERMISSIONS).toContain('sessions:read');
      expect(PRODUCTION_RECOMMENDED_PERMISSIONS).toContain('sessions:write');
      
      // Should not include wildcard
      expect(PRODUCTION_RECOMMENDED_PERMISSIONS).not.toContain('*');
    });

    it('should have full access for development', () => {
      expect(DEVELOPMENT_RECOMMENDED_PERMISSIONS).toContain('*');
      expect(DEVELOPMENT_RECOMMENDED_PERMISSIONS).toHaveLength(1);
    });
  });

  describe('Permission Structure', () => {
    it('should follow resource:action pattern', () => {
      const allPermissions = getAllPermissions();
      const nonWildcard = allPermissions.filter(p => p !== '*');
      
      nonWildcard.forEach(permission => {
        expect(permission).toMatch(/^[a-z]+:(read|write|delete)$/);
      });
    });

    it('should have consistent categories', () => {
      const allPermissions = getAllPermissions();
      
      allPermissions.forEach(permission => {
        const metadata = getPermissionMetadata(permission);
        expect(metadata).toBeDefined();
        
        if (permission !== '*') {
          const resource = permission.split(':')[0];
          // Category should match resource (except for special cases)
          if (resource === 'chat' || resource === 'documents' || 
              resource === 'sessions' || resource === 'webhooks' || 
              resource === 'sync') {
            expect(metadata?.category).toBe(resource);
          }
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty permission arrays', () => {
      expect(hasPermission([], 'chat:read')).toBe(false);
      expect(hasAllPermissions([], ['chat:read'])).toBe(false);
    });

    it('should handle empty required permissions', () => {
      expect(hasAllPermissions(['chat:read'], [])).toBe(true);
    });

    it('should handle undefined metadata gracefully', () => {
      const metadata = getPermissionMetadata('invalid:permission' as Permission);
      expect(metadata).toBeUndefined();
      
      const description = getPermissionDescription('invalid:permission' as Permission);
      expect(description).toBe('Unknown permission');
    });

    it('should validate empty permission array', () => {
      const result = validatePermissions([]);
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });
  });
});
