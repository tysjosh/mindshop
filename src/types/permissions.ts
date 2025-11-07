/**
 * API Key Permissions System
 * 
 * This file defines all available permissions for API keys.
 * Permissions follow a resource:action pattern (e.g., "chat:read", "documents:write")
 */

/**
 * Permission type - follows the pattern "resource:action"
 */
export type Permission = 
  // Chat permissions
  | 'chat:read'
  | 'chat:write'
  // Document permissions
  | 'documents:read'
  | 'documents:write'
  | 'documents:delete'
  // Session permissions
  | 'sessions:read'
  | 'sessions:write'
  // Analytics permissions
  | 'analytics:read'
  // Webhook permissions
  | 'webhooks:read'
  | 'webhooks:write'
  // Product sync permissions
  | 'sync:read'
  | 'sync:write'
  // Wildcard permission (grants all permissions)
  | '*';

/**
 * Permission metadata including description and category
 */
export interface PermissionMetadata {
  permission: Permission;
  category: PermissionCategory;
  description: string;
  requiredFor: string[]; // List of endpoints that require this permission
}

/**
 * Permission categories for grouping in UI
 */
export type PermissionCategory = 
  | 'chat'
  | 'documents'
  | 'sessions'
  | 'analytics'
  | 'webhooks'
  | 'sync'
  | 'admin';

/**
 * Complete list of all available permissions with metadata
 */
export const PERMISSIONS: Record<Permission, PermissionMetadata> = {
  // Chat permissions
  'chat:read': {
    permission: 'chat:read',
    category: 'chat',
    description: 'Read chat history and conversation data',
    requiredFor: [
      'GET /api/chat/history',
      'GET /api/chat/sessions/:sessionId/messages',
    ],
  },
  'chat:write': {
    permission: 'chat:write',
    category: 'chat',
    description: 'Send chat messages and create conversations',
    requiredFor: [
      'POST /api/chat',
      'POST /api/chat/sessions/:sessionId/messages',
    ],
  },

  // Document permissions
  'documents:read': {
    permission: 'documents:read',
    category: 'documents',
    description: 'Read and search documents',
    requiredFor: [
      'GET /api/documents',
      'GET /api/documents/:id',
      'POST /api/documents/search',
    ],
  },
  'documents:write': {
    permission: 'documents:write',
    category: 'documents',
    description: 'Create and update documents',
    requiredFor: [
      'POST /api/documents',
      'PUT /api/documents/:id',
      'POST /api/documents/batch',
    ],
  },
  'documents:delete': {
    permission: 'documents:delete',
    category: 'documents',
    description: 'Delete documents',
    requiredFor: [
      'DELETE /api/documents/:id',
      'DELETE /api/documents/batch',
    ],
  },

  // Session permissions
  'sessions:read': {
    permission: 'sessions:read',
    category: 'sessions',
    description: 'Read session data and history',
    requiredFor: [
      'GET /api/chat/sessions',
      'GET /api/chat/sessions/:sessionId',
    ],
  },
  'sessions:write': {
    permission: 'sessions:write',
    category: 'sessions',
    description: 'Create and manage sessions',
    requiredFor: [
      'POST /api/chat/sessions',
      'PUT /api/chat/sessions/:sessionId',
      'DELETE /api/chat/sessions/:sessionId',
    ],
  },

  // Analytics permissions
  'analytics:read': {
    permission: 'analytics:read',
    category: 'analytics',
    description: 'View analytics and usage statistics',
    requiredFor: [
      'GET /api/analytics/overview',
      'GET /api/analytics/performance',
      'GET /api/analytics/top-queries',
      'GET /api/usage',
    ],
  },

  // Webhook permissions
  'webhooks:read': {
    permission: 'webhooks:read',
    category: 'webhooks',
    description: 'View webhook configurations and delivery history',
    requiredFor: [
      'GET /api/webhooks',
      'GET /api/webhooks/:id',
      'GET /api/webhooks/:id/deliveries',
    ],
  },
  'webhooks:write': {
    permission: 'webhooks:write',
    category: 'webhooks',
    description: 'Create, update, and delete webhooks',
    requiredFor: [
      'POST /api/webhooks',
      'PUT /api/webhooks/:id',
      'DELETE /api/webhooks/:id',
      'POST /api/webhooks/:id/test',
    ],
  },

  // Product sync permissions
  'sync:read': {
    permission: 'sync:read',
    category: 'sync',
    description: 'View product sync status and history',
    requiredFor: [
      'GET /api/merchants/:merchantId/sync/configure',
      'GET /api/merchants/:merchantId/sync/status',
      'GET /api/merchants/:merchantId/sync/history',
    ],
  },
  'sync:write': {
    permission: 'sync:write',
    category: 'sync',
    description: 'Configure and trigger product syncs',
    requiredFor: [
      'POST /api/merchants/:merchantId/sync/configure',
      'PUT /api/merchants/:merchantId/sync/configure',
      'POST /api/merchants/:merchantId/sync/trigger',
      'POST /api/merchants/:merchantId/sync/upload',
    ],
  },

  // Wildcard permission
  '*': {
    permission: '*',
    category: 'admin',
    description: 'Full access to all API endpoints (use with caution)',
    requiredFor: ['All endpoints'],
  },
};

/**
 * Get all permissions in a specific category
 */
export function getPermissionsByCategory(category: PermissionCategory): PermissionMetadata[] {
  return Object.values(PERMISSIONS).filter(p => p.category === category);
}

/**
 * Get permission metadata by permission string
 */
export function getPermissionMetadata(permission: Permission): PermissionMetadata | undefined {
  return PERMISSIONS[permission];
}

/**
 * Check if a permission string is valid
 */
export function isValidPermission(permission: string): permission is Permission {
  return permission in PERMISSIONS;
}

/**
 * Get all available permissions as an array
 */
export function getAllPermissions(): Permission[] {
  return Object.keys(PERMISSIONS) as Permission[];
}

/**
 * Get all permission categories
 */
export function getAllCategories(): PermissionCategory[] {
  return ['chat', 'documents', 'sessions', 'analytics', 'webhooks', 'sync', 'admin'];
}

/**
 * Default permissions for new API keys (read-only access)
 */
export const DEFAULT_PERMISSIONS: Permission[] = [
  'chat:read',
  'documents:read',
  'sessions:read',
  'analytics:read',
];

/**
 * Recommended permissions for production API keys
 */
export const PRODUCTION_RECOMMENDED_PERMISSIONS: Permission[] = [
  'chat:read',
  'chat:write',
  'documents:read',
  'sessions:read',
  'sessions:write',
];

/**
 * Recommended permissions for development API keys
 */
export const DEVELOPMENT_RECOMMENDED_PERMISSIONS: Permission[] = [
  '*', // Full access for development
];

/**
 * Check if a set of permissions includes a specific permission
 * Handles wildcard permission
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: Permission
): boolean {
  // Check for wildcard permission
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check for exact permission match
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a set of permissions includes all required permissions
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: Permission[]
): boolean {
  // Check for wildcard permission
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check if all required permissions are present
  return requiredPermissions.every(required => 
    userPermissions.includes(required)
  );
}

/**
 * Validate an array of permission strings
 * Returns valid permissions and invalid ones separately
 */
export function validatePermissions(permissions: string[]): {
  valid: Permission[];
  invalid: string[];
} {
  const valid: Permission[] = [];
  const invalid: string[] = [];

  for (const permission of permissions) {
    if (isValidPermission(permission)) {
      valid.push(permission);
    } else {
      invalid.push(permission);
    }
  }

  return { valid, invalid };
}

/**
 * Get human-readable description for a permission
 */
export function getPermissionDescription(permission: Permission): string {
  return PERMISSIONS[permission]?.description || 'Unknown permission';
}

/**
 * Get endpoints that require a specific permission
 */
export function getEndpointsForPermission(permission: Permission): string[] {
  return PERMISSIONS[permission]?.requiredFor || [];
}
