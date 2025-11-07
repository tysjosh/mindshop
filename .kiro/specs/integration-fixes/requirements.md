# Integration Fixes - Requirements

## Overview

Fix critical integration inconsistencies between API backend, developer portal, and widget that block merchant onboarding.

## Business Context

**Problem:** Beta merchants cannot successfully onboard due to:
- Non-functional product sync feature
- Broken widget integration documentation
- CORS blocking widget on merchant websites
- Missing/incomplete API endpoints

**Impact:** 
- 100% of merchants will fail product sync setup
- Widget won't work on any production merchant site
- Documentation leads merchants to broken implementations

**Goal:** Enable successful merchant onboarding by fixing all critical integration issues.

## Stakeholders

- **Beta Merchants:** Need working product sync and widget
- **Support Team:** Need accurate documentation
- **Development Team:** Need consistent API contracts

## Success Criteria

1. Product sync feature fully functional end-to-end
2. Widget works on external merchant domains
3. Documentation matches actual implementation
4. All API endpoints return consistent response formats
5. CORS properly configured for widget usage

## Functional Requirements

### FR1: Product Sync Routes
**Priority:** P0 (Critical)

- Create product sync route file with all endpoints
- Mount routes in API application
- Verify all controller methods are accessible
- Test end-to-end product sync flow

**Endpoints Required:**
- `POST /api/merchants/:merchantId/sync/configure` - Create sync config
- `PUT /api/merchants/:merchantId/sync/configure` - Update sync config
- `GET /api/merchants/:merchantId/sync/configure` - Get sync config
- `POST /api/merchants/:merchantId/sync/trigger` - Trigger manual sync
- `GET /api/merchants/:merchantId/sync/status` - Get sync status
- `GET /api/merchants/:merchantId/sync/history` - Get sync history
- `POST /api/merchants/:merchantId/sync/upload` - Upload product file
- `POST /api/merchants/:merchantId/sync/webhook` - Receive webhook events

### FR2: Widget Integration Documentation
**Priority:** P0 (Critical)

- Fix widget initialization code in documentation
- Provide correct CDN script tag
- Show proper configuration examples
- Add troubleshooting section

**Correct Pattern:**
```javascript
<script src="https://cdn.example.com/widget.js"></script>
<script>
  const assistant = new RAGAssistant({
    merchantId: 'merchant_xxx',
    apiKey: 'pk_live_xxx',
    theme: { primaryColor: '#007bff' }
  });
</script>
```

### FR3: CORS Configuration
**Priority:** P0 (Critical)

- Configure CORS to allow widget on merchant domains
- Support dynamic origin validation
- Allow credentials for authenticated requests
- Expose required headers

**Requirements:**
- Widget endpoints must accept requests from any origin
- Or validate against merchant's registered domains
- Expose rate limit and impersonation headers
- Support preflight OPTIONS requests

### FR4: Product Sync Service Methods
**Priority:** P0 (Critical)

- Verify all methods exist in ProductSyncService
- Fix typo: `configureSyncSync` → `configureSync`
- Implement missing methods if needed
- Add error handling for all operations

**Methods Required:**
- `configureSync(config)` - Save sync configuration
- `getSyncStatus(merchantId)` - Get current sync status
- `triggerSync(merchantId)` - Start manual sync
- `getSyncHistory(merchantId, limit)` - Get sync history
- `processWebhookEvent(merchantId, payload, signature)` - Handle webhooks
- `processCsvUpload(merchantId, content, mapping)` - Process CSV
- `processJsonUpload(merchantId, content, mapping)` - Process JSON

### FR5: API Response Format Standardization
**Priority:** P1 (High)

- All endpoints return consistent format
- Widget ApiClient handles unwrapping reliably
- Error responses follow same pattern

**Standard Format:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_xxx"
}
```

**Error Format:**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_xxx"
}
```

### FR6: Webhook Documentation
**Priority:** P1 (High)

- Document all available webhook events
- Provide payload schemas for each event
- Explain HMAC signature verification
- Document retry policy

**Events to Document:**
- `chat.completed` - Chat query processed
- `chat.failed` - Chat query failed
- `document.created` - Document added
- `document.updated` - Document modified
- `document.deleted` - Document removed
- `session.created` - New session started
- `session.ended` - Session closed
- `sync.started` - Product sync started
- `sync.completed` - Product sync finished
- `sync.failed` - Product sync failed

### FR7: API Key Permissions
**Priority:** P2 (Medium)

- Define available permissions
- Implement permission checking in middleware
- Add UI for permission selection
- Document permission model

**Permissions:**
- `chat:read` - Read chat history
- `chat:write` - Send chat messages
- `documents:read` - Read documents
- `documents:write` - Create/update documents
- `documents:delete` - Delete documents
- `sessions:read` - Read session data
- `sessions:write` - Create/manage sessions
- `analytics:read` - View analytics
- `webhooks:read` - View webhooks
- `webhooks:write` - Manage webhooks
- `sync:read` - View sync status
- `sync:write` - Trigger syncs

### FR8: Rate Limit Headers
**Priority:** P2 (Medium)

- Add rate limit headers to all responses
- Update CORS to expose headers
- Document rate limits per endpoint

**Headers:**
- `X-RateLimit-Limit` - Max requests per window
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Window reset timestamp

### FR9: Session Endpoint Consolidation
**Priority:** P2 (Medium)

- Choose single session creation endpoint
- Deprecate duplicate endpoint
- Update documentation
- Add migration guide if needed

**Recommendation:** Use `/api/chat/sessions` (more specific)

### FR10: OpenAPI Specification
**Priority:** P3 (Low)

- Generate OpenAPI 3.0 spec from routes
- Add endpoint for spec download
- Include request/response schemas
- Add authentication documentation

## Non-Functional Requirements

### NFR1: Performance
- API response time < 200ms for sync status checks
- Widget loads in < 2 seconds
- Product sync processes 1000 products/minute

### NFR2: Reliability
- Product sync has automatic retry on failure
- Widget gracefully handles API errors
- CORS configuration doesn't break existing functionality

### NFR3: Security
- CORS doesn't expose sensitive endpoints
- API key permissions properly enforced
- Webhook signatures validated

### NFR4: Maintainability
- Consistent code patterns across all routes
- Comprehensive error handling
- Clear documentation for all endpoints

### NFR5: Testability
- Integration tests for all critical flows
- Widget can be tested in isolation
- Mock API responses for testing

## Constraints

- Must maintain backward compatibility with existing API clients
- Cannot break existing merchant integrations
- Must work with current infrastructure
- Changes must be deployable incrementally

## Assumptions

- Merchants will update widget code after documentation fix
- Product sync service implementation exists or can be created
- CDN infrastructure can be set up for widget hosting
- Merchant domain whitelist can be managed

## Dependencies

- Stripe integration (for billing)
- PostgreSQL database (for sync history)
- Redis (for rate limiting)
- S3 or similar (for file uploads)
- CDN service (for widget hosting)

## Out of Scope

- Redesigning API architecture
- Changing database schema
- Implementing new features beyond fixes
- Performance optimization beyond requirements
- Mobile SDK development

## Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| CORS changes break existing clients | High | Low | Test thoroughly, use feature flags |
| Product sync service doesn't exist | High | Medium | Implement minimal version first |
| Widget CDN setup delayed | Medium | Medium | Use temporary hosting solution |
| Breaking changes required | High | Low | Version API, provide migration path |
| Merchant domains unknown | Medium | High | Support wildcard initially |

## Acceptance Criteria

### AC1: Product Sync Works End-to-End
- Merchant can configure sync in portal
- Manual sync triggers successfully
- File upload processes products
- Sync history displays correctly
- Status updates in real-time

### AC2: Widget Works on External Sites
- Widget loads from CDN
- Creates session successfully
- Sends/receives messages
- Handles CORS properly
- Callbacks fire correctly

### AC3: Documentation is Accurate
- All code examples work as-is
- Endpoint URLs are correct
- Response formats match reality
- No broken links

### AC4: API is Consistent
- All endpoints use standard format
- Error handling is uniform
- Rate limits are enforced
- Headers are properly set

### AC5: Integration Tests Pass
- Widget integration test suite passes
- Portal integration tests pass
- API endpoint tests pass
- End-to-end flows work

## Validation Plan

1. **Unit Tests:** Test each fixed component in isolation
2. **Integration Tests:** Test API ↔ Portal ↔ Widget flows
3. **Manual Testing:** Follow merchant onboarding flow
4. **Beta Testing:** Have 2-3 merchants test before rollout
5. **Monitoring:** Track errors and usage after deployment

## Timeline Estimate

- **Priority 0 (Critical):** 2-3 days
- **Priority 1 (High):** 2-3 days
- **Priority 2 (Medium):** 3-4 days
- **Priority 3 (Low):** 2-3 days

**Total:** 9-13 days for all fixes

**Minimum Viable Fix:** 2-3 days (P0 only)
