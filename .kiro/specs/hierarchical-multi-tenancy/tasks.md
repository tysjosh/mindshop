# Implementation Plan: Hierarchical Multi-Tenancy for MindShop

## Overview

This implementation plan breaks down the hierarchical multi-tenancy feature into discrete, manageable coding tasks. Each task builds incrementally on previous tasks, ensuring the system remains functional throughout development.

## Task List

- [ ] 1. Database schema extensions
  - Create migration file for new tables and columns
  - Add account_type enum and column to merchants table
  - Create stores table with proper indexes and constraints
  - Add platform_id and store_id columns to all data tables (documents, user_sessions, audit_logs, cost_tracking, transactions)
  - Add composite indexes for (platform_id, store_id) on all data tables
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 2. Update Drizzle schema definitions
  - [ ] 2.1 Extend merchants table schema with account_type and parent_merchant_id
    - Add accountType enum field with 'direct' and 'platform' values
    - Add parentMerchantId field with foreign key reference
    - Add indexes for account_type
    - _Requirements: 1.1, 2.1, 2.2_
  
  - [ ] 2.2 Create stores table schema
    - Define stores table with all required fields (id, storeId, platformId, storeName, etc.)
    - Add foreign key constraint to merchants table
    - Add unique constraint on (platform_id, store_id)
    - Add indexes for platform_id, store_id, and status
    - Define Store TypeScript types
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 2.3 Extend existing data table schemas
    - Add platformId and storeId fields to documents table
    - Add platformId and storeId fields to userSessions table
    - Add platformId and storeId fields to auditLogs table
    - Add platformId and storeId fields to costTracking table
    - Add platformId and storeId fields to transactions table
    - Add composite indexes for (platform_id, store_id) on all tables
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 13.1, 13.2, 13.3, 14.1, 14.2_

- [ ] 3. Create database context management service
  - [ ] 3.1 Implement DatabaseContextManager class
    - Create setContext method to set PostgreSQL session variables
    - Create clearContext method to reset session variables
    - Support both single-level (merchant_id) and two-level (platform_id + store_id) context
    - _Requirements: 1.2, 1.3, 4.1, 4.2_
  
  - [ ] 3.2 Add context management to database connection pool
    - Integrate context manager with database transaction lifecycle
    - Ensure context is set at the start of each request
    - Ensure context is cleared after request completion
    - _Requirements: 1.2, 1.3_

- [ ] 4. Enhance authentication middleware
  - [ ] 4.1 Create AuthContext interface
    - Define interface with accountType, merchantId, platformId, storeId, and apiKey fields
    - Export type definitions
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2_
  
  - [ ] 4.2 Update authenticateRequest middleware
    - Extract and validate API key
    - Determine account type from merchant record
    - For direct merchants: set single-level context (merchant_id only)
    - For platform merchants: extract platformId and storeId from request body
    - Validate platformId matches API key owner
    - Validate storeId exists and belongs to platform
    - Set appropriate database context based on account type
    - Attach authContext to request object
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ] 4.3 Add platform-specific error handling
    - Create PlatformNotFoundError class
    - Create StoreNotFoundError class
    - Create PlatformMismatchError class
    - Create InvalidAccountTypeError class
    - Handle errors in middleware with appropriate HTTP status codes
    - _Requirements: 5.5, 5.6_

- [ ] 5. Create base repository with dual-mode support
  - [ ] 5.1 Implement BaseRepository abstract class
    - Create buildWhereClause method that handles both account types
    - For direct merchants: filter by merchant_id only
    - For platform merchants: filter by platform_id AND store_id
    - Create query method that applies appropriate filtering
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3_
  
  - [ ] 5.2 Update DocumentRepository to extend BaseRepository
    - Override create method to include platform/store context
    - Update findByMerchant to use buildWhereClause
    - Update semanticSearch to apply two-level filtering
    - Ensure backward compatibility for direct merchants
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ] 5.3 Update UserSessionRepository to extend BaseRepository
    - Update create method to include platform/store context
    - Update findBySessionId to apply appropriate filtering
    - Update findByMerchant to use buildWhereClause
    - _Requirements: 4.5, 4.6, 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ] 5.4 Update other repositories (AuditLog, CostTracking, Transaction)
    - Apply same pattern to AuditLogRepository
    - Apply same pattern to CostTrackingRepository
    - Apply same pattern to TransactionRepository
    - _Requirements: 4.7, 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 6. Implement store management service
  - [ ] 6.1 Create StoreManagementService class
    - Implement createStore method with platform validation
    - Implement getStore method with platform/store lookup
    - Implement listStores method with filtering support
    - Implement updateStore method
    - Implement deactivateStore method
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ] 6.2 Add bulk store operations
    - Implement bulkCreateStores method
    - Handle partial failures gracefully
    - Return success and error arrays
    - Support up to 10,000 stores per operation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. Implement platform analytics service
  - [ ] 7.1 Create PlatformAnalyticsService class
    - Implement getPlatformOverview method (total stores, active stores, conversations, queries)
    - Implement getTopPerformingStores method with ranking by queries, conversions, revenue
    - Implement getStoreAnalytics method with detailed metrics per store
    - Support date range filtering
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 7.2 Add cost allocation analytics
    - Implement getCostBreakdown method showing costs per store
    - Aggregate platform-level costs
    - Support filtering by date range and operation type
    - _Requirements: 8.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 8. Create platform API routes and controllers
  - [ ] 8.1 Create PlatformController class
    - Implement createStore endpoint handler
    - Implement bulkCreateStores endpoint handler
    - Implement listStores endpoint handler
    - Implement getStore endpoint handler
    - Implement updateStore endpoint handler
    - Implement deactivateStore endpoint handler
    - Add platform ownership validation
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [ ] 8.2 Add analytics endpoints
    - Implement getPlatformAnalytics endpoint handler
    - Implement getStoreAnalytics endpoint handler
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 12.7_
  
  - [ ] 8.3 Add document management endpoints for stores
    - Implement uploadStoreDocuments endpoint handler
    - Implement getStoreDocuments endpoint handler
    - Apply two-level context for document operations
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ] 8.4 Create platform routes file
    - Define POST /api/platforms/:platformId/stores route
    - Define POST /api/platforms/:platformId/stores/bulk route
    - Define GET /api/platforms/:platformId/stores route
    - Define GET /api/platforms/:platformId/stores/:storeId route
    - Define PUT /api/platforms/:platformId/stores/:storeId route
    - Define DELETE /api/platforms/:platformId/stores/:storeId route
    - Define GET /api/platforms/:platformId/analytics route
    - Define GET /api/platforms/:platformId/analytics/stores/:storeId route
    - Define POST /api/platforms/:platformId/stores/:storeId/documents route
    - Apply authenticateRequest middleware to all routes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  
  - [ ] 8.5 Register platform routes in main app
    - Import platform routes in src/api/app.ts
    - Mount routes at /api path
    - _Requirements: 12.1_

- [ ] 9. Update existing API endpoints for dual-mode support
  - [ ] 9.1 Update chat endpoint
    - Extract platformId and storeId from request body when present
    - Pass authContext to RAG service
    - Apply appropriate data filtering based on account type
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 9.2 Update documents endpoint
    - Support both direct merchant and platform store document uploads
    - Apply authContext to document creation
    - Filter document retrieval by account type
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ] 9.3 Update checkout endpoint
    - Include platform/store context in transaction records
    - Apply authContext to transaction creation
    - _Requirements: 4.7_

- [ ] 10. Update widget for platform support
  - [ ] 10.1 Extend WidgetConfig interface
    - Add platformId optional field
    - Add storeId optional field
    - Add storeName optional field
    - Keep merchantId for backward compatibility
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 10.2 Update widget initialization
    - Add validation for platform API keys (check pk_platform_ prefix)
    - Require platformId and storeId when using platform API key
    - Allow optional merchantId for direct merchant keys
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 10.3 Update API client to include platform context
    - Modify chat method to include platformId and storeId in request body
    - Modify document upload to include platform context
    - Update all API calls to pass platform/store context when available
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 10.4 Add store-specific customization support
    - Support per-store theme customization
    - Support per-store greeting messages
    - Load store settings from API if needed
    - _Requirements: 6.5_

- [ ] 11. Update API key generation for platform merchants
  - [ ] 11.1 Modify API key generation logic
    - Detect account_type when generating keys
    - Use 'pk_platform_' prefix for platform merchant keys
    - Use existing 'pk_live_' or 'pk_test_' prefix for direct merchant keys
    - Store key scope in api_keys table metadata
    - _Requirements: 2.2, 2.3, 5.1, 5.2_
  
  - [ ] 11.2 Update API key validation
    - Validate key prefix matches account type
    - Extract account type from key prefix
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 12. Implement billing service updates
  - [ ] 12.1 Update usage tracking for platform stores
    - Track usage per store within platform
    - Aggregate usage at platform level
    - Store platform_id and store_id in usage records
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 12.2 Create platform billing aggregation
    - Calculate platform-level costs from all stores
    - Generate per-store cost breakdown
    - Support platform fee + per-store fee + usage-based pricing
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 13. Add migration support and backward compatibility
  - [ ] 13.1 Create database migration script
    - Write SQL migration to add new columns and tables
    - Set default values for existing records (account_type = 'direct', platform_id = NULL, store_id = NULL)
    - Add indexes and constraints
    - Test migration on copy of production data
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 13.2 Add rollback migration script
    - Create down migration to revert changes if needed
    - Test rollback procedure
    - _Requirements: 11.1_
  
  - [ ] 13.3 Verify backward compatibility
    - Test all existing direct merchant endpoints
    - Verify existing API keys continue to work
    - Verify existing widgets continue to function
    - Ensure no breaking changes to existing functionality
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 14. Create integration tests
  - [ ] 14.1 Test platform store isolation
    - Create test for data isolation between stores on same platform
    - Create test for session isolation between stores
    - Verify store cannot access another store's data
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ] 14.2 Test backward compatibility
    - Test direct merchant document upload and retrieval
    - Test direct merchant chat functionality
    - Test direct merchant checkout flow
    - Verify no regression in existing features
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 14.3 Test platform merchant workflows
    - Test platform registration
    - Test store creation and management
    - Test bulk store import
    - Test document upload for stores
    - Test chat with platform context
    - Test analytics retrieval
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 7.1, 7.2, 7.3, 8.1, 8.2, 12.1, 12.2, 13.1_

- [ ] 15. Update API documentation
  - [ ] 15.1 Document platform API endpoints
    - Document store management endpoints with request/response examples
    - Document analytics endpoints
    - Document bulk operations
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  
  - [ ] 15.2 Document widget platform configuration
    - Document platformId and storeId parameters
    - Provide integration examples for marketplace platforms
    - Document platform API key usage
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 15.3 Create platform integration guide
    - Write step-by-step guide for platform merchants
    - Include code examples for DoorDash-style integration
    - Document best practices for store onboarding
    - _Requirements: 2.1, 2.2, 3.1, 7.1_

- [ ] 16. Performance optimization
  - [ ] 16.1 Add caching for store metadata
    - Implement in-memory cache for frequently accessed stores
    - Add cache invalidation on store updates
    - _Requirements: 3.3_
  
  - [ ] 16.2 Optimize platform analytics queries
    - Add database indexes for common analytics queries
    - Implement query result caching for analytics
    - Use prepared statements for frequently executed queries
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 17. Add monitoring and observability
  - [ ] 17.1 Add platform-specific metrics
    - Track store creation rate
    - Track platform-level API usage
    - Track data isolation violations (should be zero)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 17.2 Add platform-specific logging
    - Log all platform/store context switches
    - Log store creation and management operations
    - Log platform API key usage
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

## Implementation Notes

- All tasks should maintain backward compatibility with existing direct merchant functionality
- Database migrations should be tested on a copy of production data before deployment
- Each task should include appropriate error handling and validation
- Security is critical - always validate platform/store ownership before operations
- Performance should be monitored, especially for platforms with many stores
- All new code should follow existing code style and patterns in the codebase
