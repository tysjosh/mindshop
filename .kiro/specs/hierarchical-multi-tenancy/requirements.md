# Requirements Document: Hierarchical Multi-Tenancy for MindShop

## Introduction

This document outlines the requirements for adding hierarchical multi-tenancy support to MindShop, enabling marketplace platforms (like DoorDash, Shopify, Uber Eats) to integrate once and provide MindShop's AI shopping assistant to all their stores automatically. This extends the current flat multi-tenancy model (independent merchants) with a parent-child relationship model (platform → stores → customers) while maintaining backward compatibility.

## Glossary

- **MindShop Platform**: The AI-powered shopping assistant system that provides conversational product recommendations and checkout capabilities
- **Direct Merchant**: An independent business that signs up directly with MindShop and manages their own account (current flat multi-tenancy model)
- **Platform Merchant**: A marketplace or SaaS platform (e.g., DoorDash, Shopify) that integrates MindShop once and provides it to multiple stores
- **Store**: A sub-merchant that belongs to a Platform Merchant (e.g., Joe's Pizza on DoorDash)
- **Account Type**: A classification indicating whether a merchant account is 'direct' or 'platform'
- **Platform ID**: A unique identifier for a Platform Merchant
- **Store ID**: A unique identifier for a Store within a Platform Merchant
- **Two-Level Isolation**: Data access control that filters by both platform_id AND store_id to ensure stores only access their own data
- **Widget**: The embeddable JavaScript component that merchants integrate into their websites to provide the MindShop assistant
- **API Key Scope**: The level at which an API key operates - either merchant-level (direct) or platform-level (hierarchical)

## Requirements

### Requirement 1: Support Both Account Types

**User Story:** As a MindShop administrator, I want the system to support both direct merchants and platform merchants simultaneously, so that we can serve independent businesses and marketplace platforms with the same infrastructure.

#### Acceptance Criteria

1. WHEN a merchant account is created, THE MindShop Platform SHALL assign an account_type of either 'direct' or 'platform'
2. WHEN a direct merchant account is accessed, THE MindShop Platform SHALL apply single-level data isolation using merchant_id
3. WHEN a platform merchant account is accessed, THE MindShop Platform SHALL apply two-level data isolation using platform_id and store_id
4. THE MindShop Platform SHALL maintain backward compatibility with all existing direct merchant accounts
5. THE MindShop Platform SHALL store account_type in the merchants table with a default value of 'direct'

### Requirement 2: Platform Merchant Registration

**User Story:** As a marketplace platform administrator, I want to register my platform with MindShop as a platform merchant, so that I can integrate MindShop once for all my stores.

#### Acceptance Criteria

1. WHEN a platform merchant registers, THE MindShop Platform SHALL create a merchant account with account_type set to 'platform'
2. WHEN a platform merchant account is created, THE MindShop Platform SHALL generate a platform-level API key with prefix 'pk_platform_'
3. THE MindShop Platform SHALL store the platform's name, website, and industry in the merchants table
4. THE MindShop Platform SHALL assign the platform merchant a unique platform_id equal to their merchant_id
5. WHEN a platform merchant is created, THE MindShop Platform SHALL initialize their account with platform-specific settings

### Requirement 3: Store Management

**User Story:** As a platform merchant, I want to register and manage multiple stores under my platform account, so that each store can have isolated data and settings.

#### Acceptance Criteria

1. WHEN a platform merchant creates a store, THE MindShop Platform SHALL generate a unique store_id for that store
2. THE MindShop Platform SHALL store the store's name, owner information, and URL in the stores table
3. WHEN a store is created, THE MindShop Platform SHALL link it to the parent platform using platform_id
4. THE MindShop Platform SHALL enforce uniqueness of store_id within each platform_id
5. WHEN a store is created, THE MindShop Platform SHALL set its status to 'active' by default
6. THE MindShop Platform SHALL allow platform merchants to update store settings including name, URL, and custom configuration
7. WHEN a platform merchant deletes a store, THE MindShop Platform SHALL set the store status to 'inactive' and prevent new data access

### Requirement 4: Two-Level Data Isolation

**User Story:** As a store owner on a marketplace platform, I want my product data and customer conversations to be completely isolated from other stores, so that my business data remains private and secure.

#### Acceptance Criteria

1. WHEN a document is created for a platform store, THE MindShop Platform SHALL store both platform_id and store_id with the document
2. WHEN a query retrieves documents for a platform store, THE MindShop Platform SHALL filter by both platform_id AND store_id
3. THE MindShop Platform SHALL prevent any store from accessing documents belonging to another store on the same platform
4. THE MindShop Platform SHALL prevent any store from accessing documents belonging to stores on different platforms
5. WHEN a user session is created for a platform store, THE MindShop Platform SHALL associate it with both platform_id and store_id
6. WHEN conversation history is retrieved, THE MindShop Platform SHALL filter by both platform_id and store_id
7. THE MindShop Platform SHALL apply two-level isolation to all data tables including documents, user_sessions, audit_logs, cost_tracking, and transactions

### Requirement 5: Platform-Level API Authentication

**User Story:** As a platform merchant, I want to use a single API key for all my stores, so that I can integrate MindShop once without managing separate keys for each store.

#### Acceptance Criteria

1. WHEN a platform merchant generates an API key, THE MindShop Platform SHALL create a key with prefix 'pk_platform_' to distinguish it from direct merchant keys
2. WHEN an API request includes a platform API key, THE MindShop Platform SHALL validate the key against the platform merchant's account
3. WHEN an API request includes platform_id and store_id in the request body, THE MindShop Platform SHALL verify that the platform_id matches the API key owner
4. WHEN an API request includes a store_id, THE MindShop Platform SHALL verify that the store belongs to the platform
5. IF the platform_id in the request does not match the API key owner, THEN THE MindShop Platform SHALL return a 403 Forbidden error
6. IF the store_id does not exist or does not belong to the platform, THEN THE MindShop Platform SHALL return a 404 Not Found error

### Requirement 6: Widget Support for Platform Context

**User Story:** As a platform merchant, I want to embed the MindShop widget on each store's page with automatic store context, so that customers see recommendations specific to that store.

#### Acceptance Criteria

1. WHEN the MindShop widget is initialized with platformId and storeId parameters, THE Widget SHALL include these values in all API requests
2. THE Widget SHALL validate that both platformId and storeId are provided when using a platform API key
3. WHEN the widget sends a chat request, THE Widget SHALL include platformId and storeId in the request body
4. WHEN the widget sends a document upload request, THE Widget SHALL include platformId and storeId in the request body
5. THE Widget SHALL allow platform merchants to customize widget appearance per store using store-specific settings

### Requirement 7: Bulk Store Onboarding

**User Story:** As a platform merchant, I want to bulk import all my stores into MindShop, so that I can onboard hundreds or thousands of stores efficiently.

#### Acceptance Criteria

1. WHEN a platform merchant uploads a CSV or JSON file with store data, THE MindShop Platform SHALL create store records for all valid entries
2. THE MindShop Platform SHALL validate each store entry for required fields (store_id, store_name)
3. IF a store entry is invalid, THEN THE MindShop Platform SHALL skip that entry and include it in an error report
4. WHEN bulk import completes, THE MindShop Platform SHALL return a summary showing successful imports, skipped entries, and errors
5. THE MindShop Platform SHALL support bulk import of up to 10,000 stores in a single operation

### Requirement 8: Platform-Level Analytics

**User Story:** As a platform merchant, I want to view aggregated analytics across all my stores, so that I can understand overall platform performance and identify top-performing stores.

#### Acceptance Criteria

1. WHEN a platform merchant requests analytics, THE MindShop Platform SHALL aggregate metrics across all stores belonging to that platform
2. THE MindShop Platform SHALL provide per-store breakdowns showing queries, conversions, and revenue for each store
3. THE MindShop Platform SHALL calculate and display top-performing stores ranked by query volume, conversion rate, and revenue
4. THE MindShop Platform SHALL allow platform merchants to filter analytics by date range and store
5. WHEN a platform merchant views cost tracking, THE MindShop Platform SHALL show aggregated costs across all stores

### Requirement 9: Store-Level Access Control (Optional)

**User Story:** As a store owner on a marketplace platform, I want limited access to view my store's analytics and customize my widget, so that I can optimize my store's performance without accessing other stores' data.

#### Acceptance Criteria

1. WHEN a store owner logs into the MindShop portal, THE MindShop Platform SHALL authenticate them and associate them with their specific store
2. WHEN a store owner views analytics, THE MindShop Platform SHALL show only data for their store
3. THE MindShop Platform SHALL allow store owners to customize widget appearance for their store only
4. THE MindShop Platform SHALL prevent store owners from viewing or modifying other stores' data
5. THE MindShop Platform SHALL allow platform merchants to enable or disable store owner access

### Requirement 10: Platform Billing Model

**User Story:** As a platform merchant, I want to receive a single consolidated invoice for all my stores, so that I can manage billing centrally and allocate costs internally.

#### Acceptance Criteria

1. WHEN a billing cycle completes, THE MindShop Platform SHALL generate a single invoice for the platform merchant covering all stores
2. THE MindShop Platform SHALL include a platform fee, per-store fees, and usage-based charges in the invoice
3. THE MindShop Platform SHALL provide a detailed breakdown showing costs per store in the invoice
4. WHEN usage is tracked, THE MindShop Platform SHALL associate costs with both platform_id and store_id
5. THE MindShop Platform SHALL allow platform merchants to view cost allocation by store in the billing dashboard

### Requirement 11: Migration Path for Existing Merchants

**User Story:** As a MindShop administrator, I want existing direct merchants to continue working without any changes, so that we can add platform support without disrupting current customers.

#### Acceptance Criteria

1. WHEN the hierarchical multi-tenancy feature is deployed, THE MindShop Platform SHALL maintain all existing direct merchant accounts with account_type 'direct'
2. THE MindShop Platform SHALL continue to support existing API keys for direct merchants without modification
3. THE MindShop Platform SHALL apply single-level isolation (merchant_id only) for all direct merchant data access
4. THE MindShop Platform SHALL set platform_id and store_id to NULL for all existing direct merchant data
5. WHEN a direct merchant makes API requests, THE MindShop Platform SHALL not require platform_id or store_id parameters

### Requirement 12: Platform API Endpoints

**User Story:** As a platform merchant, I want dedicated API endpoints to manage my stores programmatically, so that I can automate store onboarding and management.

#### Acceptance Criteria

1. THE MindShop Platform SHALL provide a POST /api/platforms/{platformId}/stores endpoint to create stores
2. THE MindShop Platform SHALL provide a GET /api/platforms/{platformId}/stores endpoint to list all stores
3. THE MindShop Platform SHALL provide a GET /api/platforms/{platformId}/stores/{storeId} endpoint to retrieve store details
4. THE MindShop Platform SHALL provide a PUT /api/platforms/{platformId}/stores/{storeId} endpoint to update store settings
5. THE MindShop Platform SHALL provide a DELETE /api/platforms/{platformId}/stores/{storeId} endpoint to deactivate stores
6. THE MindShop Platform SHALL provide a POST /api/platforms/{platformId}/stores/bulk endpoint for bulk store import
7. THE MindShop Platform SHALL provide a GET /api/platforms/{platformId}/analytics endpoint for platform-level analytics

### Requirement 13: Document Management for Platform Stores

**User Story:** As a platform merchant, I want to upload product catalogs for each store separately, so that each store has its own unique product inventory.

#### Acceptance Criteria

1. WHEN a platform merchant uploads documents for a store, THE MindShop Platform SHALL associate the documents with both platform_id and store_id
2. THE MindShop Platform SHALL provide a POST /api/platforms/{platformId}/stores/{storeId}/documents endpoint for document upload
3. WHEN documents are uploaded for a store, THE MindShop Platform SHALL generate embeddings and store them with platform and store context
4. THE MindShop Platform SHALL allow bulk document upload for multiple stores simultaneously
5. WHEN a store's documents are queried, THE MindShop Platform SHALL return only documents matching both platform_id and store_id

### Requirement 14: Session Management for Platform Stores

**User Story:** As an end customer shopping on a platform store, I want my conversation history to be maintained within that store's context, so that the assistant remembers my preferences during my shopping session.

#### Acceptance Criteria

1. WHEN a customer starts a conversation on a platform store, THE MindShop Platform SHALL create a session associated with platform_id and store_id
2. THE MindShop Platform SHALL store conversation history with platform and store context
3. WHEN a customer's session is retrieved, THE MindShop Platform SHALL filter by platform_id, store_id, and session_id
4. THE MindShop Platform SHALL prevent sessions from one store being accessed by another store
5. WHEN a session expires, THE MindShop Platform SHALL clean up session data while maintaining audit logs

### Requirement 15: Audit Logging for Platform Operations

**User Story:** As a MindShop administrator, I want comprehensive audit logs for all platform and store operations, so that I can track usage, debug issues, and ensure compliance.

#### Acceptance Criteria

1. WHEN a platform merchant performs any operation, THE MindShop Platform SHALL log the operation with platform_id
2. WHEN a store-specific operation occurs, THE MindShop Platform SHALL log the operation with both platform_id and store_id
3. THE MindShop Platform SHALL log store creation, updates, and deletion operations
4. THE MindShop Platform SHALL log all API requests with platform and store context
5. WHEN audit logs are queried, THE MindShop Platform SHALL support filtering by platform_id and store_id
