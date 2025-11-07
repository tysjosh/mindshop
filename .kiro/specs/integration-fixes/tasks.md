# Integration Fixes - Implementation Tasks

## Overview

Tasks to fix critical integration inconsistencies blocking merchant onboarding.

**Total Estimated Time:** 9-13 days  
**Minimum Viable Fix:** 2-3 days (Priority 0 only)

---

## PHASE 1: CRITICAL FIXES (Priority 0)

**Goal:** Enable basic merchant onboarding  
**Timeline:** 2-3 days

### Task 1.1: Create Product Sync Routes

**Priority:** P0 | **Effort:** 4 hours | **Owner:** Backend

**Tasks:**
- [x] Create `src/api/routes/productSync.ts`
- [x] Add all 8 required endpoints
- [x] Add validation schemas with Joi
- [x] Add rate limiting middleware
- [x] Add authentication middleware
- [x] Add multer for file uploads
- [x] Export router

**Files:** `src/api/routes/productSync.ts`

**Acceptance Criteria:**
- All 8 endpoints defined
- Validation works for all inputs
- Rate limiting applied
- Authentication required
- File upload configured

---

### Task 1.2: Mount Product Sync Routes

**Priority:** P0 | **Effort:** 1 hour | **Owner:** Backend

**Tasks:**
- [x] Import productSync routes in `src/api/app.ts`
- [x] Mount at `/api/merchants`
- [x] Verify route order (before wildcards)
- [x] Test route accessibility

**Files:** `src/api/app.ts`

**Acceptance Criteria:**
- Routes accessible at correct paths
- No route conflicts
- Middleware chain works

---

### Task 1.3: Fix Product Sync Controller

**Priority:** P0 | **Effort:** 6 hours | **Owner:** Backend

**Tasks:**
- [x] Fix typo: `configureSyncSync` → `configureSync`
- [x] Consolidate POST/PUT to single method
- [x] Add `getSyncConfig` method
- [x] Update `uploadFile` to handle both CSV and JSON
- [x] Add proper error handling
- [x] Standardize response format
- [x] Add merchant access validation

**Files:** `src/api/controllers/ProductSyncController.ts`

**Acceptance Criteria:**
- No typos in method names
- All methods return standard format
- Error handling comprehensive
- Access control enforced

---

### Task 1.4: Verify/Implement Product Sync Service

**Priority:** P0 | **Effort:** 8 hours | **Owner:** Backend

**Tasks:**
- [x] Check if `ProductSyncService` exists
- [x] Implement `createSyncConfig()`
- [x] Implement `updateSyncConfig()`
- [x] Implement `getSyncConfig()`
- [x] Implement `getSyncStatus()`
- [x] Implement `triggerSync()`
- [x] Implement `getSyncHistory()`
- [x] Implement `processCsvUpload()`
- [x] Implement `processJsonUpload()`
- [x] Implement `processWebhookEvent()`
- [x] Add database operations
- [x] Add error handling

**Files:** `src/services/ProductSyncService.ts`

**Acceptance Criteria:**
- All methods implemented
- Database operations work
- CSV/JSON parsing works
- Error handling robust

---

### Task 1.5: Update CORS Configuration

**Priority:** P0 | **Effort:** 3 hours | **Owner:** Backend

**Tasks:**
- [x] Update CORS middleware in `src/api/app.ts`
- [x] Allow all origins for widget endpoints
- [x] Keep whitelist for admin endpoints
- [x] Add origin validation function
- [x] Update exposed headers
- [x] Test from external domain

**Files:** `src/api/app.ts`

**Acceptance Criteria:**
- Widget works from external domains
- Admin endpoints still protected
- All required headers exposed
- No CORS errors in browser

---

### Task 1.6: Fix Documentation Widget Code

**Priority:** P0 | **Effort:** 2 hours | **Owner:** Frontend

**Tasks:**
- [x] Update widget initialization code
- [x] Remove incorrect `ra()` pattern
- [x] Add correct `new RAGAssistant()` example
- [x] Add configuration options
- [x] Add troubleshooting section
- [x] Update all code examples
- [x] Test code examples work

**Files:** `developer-portal/app/(dashboard)/documentation/page.tsx`

**Acceptance Criteria:**
- Code examples are correct
- Copy-paste works without modification
- Troubleshooting section helpful
- All examples tested

---

### Task 1.7: Integration Testing - Phase 1

**Priority:** P0 | **Effort:** 4 hours | **Owner:** QA/Backend

**Tasks:**
- [x] Test product sync configuration
- [x] Test manual sync trigger
- [x] Test file upload (CSV)
- [x] Test file upload (JSON)
- [x] Test sync history
- [x] Test widget from external domain
- [x] Test documentation examples
- [x] Fix any issues found

**Acceptance Criteria:**
- All critical flows work
- No CORS errors
- Documentation examples work
- Ready for beta testing

---

## PHASE 2: HIGH PRIORITY FIXES (Priority 1)

**Goal:** Improve reliability and consistency  
**Timeline:** 2-3 days

### Task 2.1: Standardize API Response Format

**Priority:** P1 | **Effort:** 6 hours | **Owner:** Backend

**Tasks:**
- [x] Audit all endpoints for response format
- [x] Update inconsistent endpoints
- [x] Ensure all return `{ success, data, timestamp, requestId }`
- [x] Update error responses
- [x] Test widget ApiClient unwrapping
- [x] Update developer portal API client

**Files:** Multiple controller files

**Acceptance Criteria:**
- All endpoints use standard format
- Widget handles responses correctly
- Portal handles responses correctly
- No breaking changes

---

### Task 2.2: Add Rate Limit Headers

**Priority:** P1 | **Effort:** 3 hours | **Owner:** Backend

**Tasks:**
- [x] Update rate limit middleware
- [x] Add `X-RateLimit-Limit` header
- [x] Add `X-RateLimit-Remaining` header
- [x] Add `X-RateLimit-Reset` header
- [x] Update CORS exposed headers
- [x] Test headers are set correctly

**Files:** `src/api/middleware/rateLimit.ts`, `src/api/app.ts`

**Acceptance Criteria:**
- Headers set on all rate-limited endpoints
- Headers exposed via CORS
- Values are accurate

---

### Task 2.3: Create Webhook Documentation

**Priority:** P1 | **Effort:** 4 hours | **Owner:** Technical Writer

**Tasks:**
- [ ] Create `docs/WEBHOOK_INTEGRATION.md`
- [ ] Document all available events
- [ ] Provide payload schemas
- [ ] Add HMAC verification guide
- [ ] Document retry policy
- [ ] Add code examples (Node.js, Python, PHP)
- [ ] Add troubleshooting section

**Files:** `docs/WEBHOOK_INTEGRATION.md`

**Acceptance Criteria:**
- All events documented
- Schemas are accurate
- Verification code works
- Examples tested

---

### Task 2.4: Implement API Key Permissions

**Priority:** P1 | **Effort:** 6 hours | **Owner:** Backend

**Tasks:**
- [x] Define permission list
- [x] Create `requirePermissions()` middleware
- [x] Update `apiKeyAuth` to load permissions
- [x] Apply to sensitive endpoints
- [x] Add permission validation
- [x] Test permission enforcement

**Files:** `src/api/middleware/apiKeyAuth.ts`, various route files

**Acceptance Criteria:**
- Permissions enforced
- Unauthorized requests blocked
- Error messages clear
- No false positives

---

### Task 2.5: Add Permission UI to Developer Portal

**Priority:** P1 | **Effort:** 4 hours | **Owner:** Frontend

**Tasks:**
- [x] Add permission checkboxes to API key creation
- [x] Show permissions on API key list
- [x] Add permission descriptions
- [x] Update API client
- [x] Test permission selection

**Files:** `developer-portal/app/(dashboard)/api-keys/page.tsx`

**Acceptance Criteria:**
- UI allows selecting permissions
- Permissions saved correctly
- Permissions displayed clearly
- Help text explains each permission

---

### Task 2.6: Integration Testing - Phase 2

**Priority:** P1 | **Effort:** 4 hours | **Owner:** QA

**Tasks:**
- [x] Test API response formats
- [x] Test rate limit headers
- [ ] Test webhook documentation examples
- [ ] Test permission enforcement
- [x] Test permission UI
- [ ] Fix any issues found

**Acceptance Criteria:**
- All high priority features work
- No regressions
- Documentation accurate

---

## PHASE 3: MEDIUM PRIORITY FIXES (Priority 2)

**Goal:** Polish and improve developer experience  
**Timeline:** 3-4 days

### Task 3.1: Consolidate Session Endpoints

**Priority:** P2 | **Effort:** 3 hours | **Owner:** Backend

**Tasks:**
- [ ] Choose primary endpoint (`/api/chat/sessions`)
- [ ] Deprecate duplicate endpoint
- [ ] Add deprecation warning
- [ ] Update documentation
- [ ] Create migration guide
- [ ] Update widget to use primary endpoint

**Files:** `src/api/routes/sessions.ts`, `src/api/routes/chat.ts`

**Acceptance Criteria:**
- Single endpoint for session creation
- Deprecation warning logged
- Migration guide available
- Widget updated

---

### Task 3.2: Create OpenAPI Specification

**Priority:** P2 | **Effort:** 8 hours | **Owner:** Backend

**Tasks:**
- [ ] Install OpenAPI generator
- [ ] Add OpenAPI decorators to routes
- [ ] Generate spec from code
- [ ] Add endpoint for spec download
- [ ] Validate spec
- [ ] Test with Swagger UI

**Files:** `src/api/openapi.ts`, various route files

**Acceptance Criteria:**
- Valid OpenAPI 3.0 spec
- All endpoints documented
- Schemas included
- Downloadable from `/api/openapi.yaml`

---

### Task 3.3: Add Widget CDN Deployment Scripts

**Priority:** P2 | **Effort:** 4 hours | **Owner:** DevOps

**Tasks:**
- [ ] Create S3 bucket for widget hosting
- [ ] Configure CloudFront distribution
- [ ] Add deployment script for dev
- [ ] Add deployment script for staging
- [ ] Add deployment script for production
- [ ] Update package.json scripts
- [ ] Test deployment

**Files:** `widget/package.json`, `widget/deploy-cdn.sh`

**Acceptance Criteria:**
- Scripts work for all environments
- Widget accessible via CDN
- Versioning works
- Cache invalidation works

---

### Task 3.4: Update Widget README

**Priority:** P2 | **Effort:** 2 hours | **Owner:** Technical Writer

**Tasks:**
- [ ] Update CDN URLs to actual URLs
- [ ] Fix deployment script references
- [ ] Add CORS troubleshooting
- [ ] Update API base URL examples
- [ ] Add production setup guide

**Files:** `widget/README.md`

**Acceptance Criteria:**
- All URLs correct
- Instructions accurate
- Examples work
- Troubleshooting helpful

---

### Task 3.5: Add Merchant Domain Management

**Priority:** P2 | **Effort:** 6 hours | **Owner:** Full Stack

**Tasks:**
- [ ] Add `allowedDomains` to merchant settings
- [ ] Create UI for domain management
- [ ] Add domain validation
- [ ] Update CORS to check domains
- [ ] Test domain whitelisting

**Files:** `src/api/app.ts`, `developer-portal/app/(dashboard)/settings/page.tsx`

**Acceptance Criteria:**
- Merchants can add domains
- CORS validates domains
- Invalid domains rejected
- UI is intuitive

---

### Task 3.6: Integration Testing - Phase 3

**Priority:** P2 | **Effort:** 4 hours | **Owner:** QA

**Tasks:**
- [ ] Test session endpoint consolidation
- [ ] Test OpenAPI spec download
- [ ] Test widget CDN deployment
- [ ] Test domain management
- [ ] Fix any issues found

**Acceptance Criteria:**
- All medium priority features work
- No regressions
- Ready for production

---

## PHASE 4: LOW PRIORITY FIXES (Priority 3)

**Goal:** Nice-to-have improvements  
**Timeline:** 2-3 days

### Task 4.1: Add Analytics Event Tracking

**Priority:** P3 | **Effort:** 4 hours | **Owner:** Backend

**Tasks:**
- [ ] Track widget initialization
- [ ] Track session creation
- [ ] Track message sending
- [ ] Track errors
- [ ] Add analytics dashboard

**Files:** `src/services/AnalyticsService.ts`

---

### Task 4.2: Add Widget Performance Monitoring

**Priority:** P3 | **Effort:** 4 hours | **Owner:** Frontend

**Tasks:**
- [ ] Add load time tracking
- [ ] Add API response time tracking
- [ ] Add error tracking
- [ ] Send metrics to backend
- [ ] Create performance dashboard

**Files:** `widget/src/services/Analytics.ts`

---

### Task 4.3: Create Integration Test Suite

**Priority:** P3 | **Effort:** 8 hours | **Owner:** QA

**Tasks:**
- [ ] Set up test framework
- [ ] Write widget integration tests
- [ ] Write portal integration tests
- [ ] Write API integration tests
- [ ] Add to CI/CD pipeline

**Files:** `tests/integration/`

---

### Task 4.4: Add Webhook Event Simulator

**Priority:** P3 | **Effort:** 4 hours | **Owner:** Backend

**Tasks:**
- [ ] Create webhook testing endpoint
- [ ] Add UI to trigger test events
- [ ] Show delivery results
- [ ] Add to developer portal

**Files:** `developer-portal/app/(dashboard)/webhooks/page.tsx`

---

### Task 4.5: Create Video Tutorials

**Priority:** P3 | **Effort:** 8 hours | **Owner:** Technical Writer

**Tasks:**
- [ ] Record widget integration tutorial
- [ ] Record product sync tutorial
- [ ] Record webhook setup tutorial
- [ ] Upload to documentation
- [ ] Add to onboarding flow

**Files:** `docs/tutorials/`

---

## TESTING CHECKLIST

### Pre-Deployment Testing

**Product Sync:**
- [ ] Configure sync via portal
- [ ] Trigger manual sync
- [ ] Upload CSV file
- [ ] Upload JSON file
- [ ] View sync history
- [ ] Check error handling
- [ ] Verify data in database

**Widget Integration:**
- [ ] Load widget from CDN
- [ ] Initialize on external domain
- [ ] Create session
- [ ] Send message
- [ ] Receive response
- [ ] Test callbacks
- [ ] Check CORS headers

**Developer Portal:**
- [ ] Create API key with permissions
- [ ] View usage statistics
- [ ] Configure webhooks
- [ ] Test webhook delivery
- [ ] View analytics
- [ ] Manage billing

**API:**
- [ ] All endpoints return standard format
- [ ] Rate limit headers present
- [ ] CORS works correctly
- [ ] Authentication works
- [ ] Permissions enforced
- [ ] Error handling consistent

### Post-Deployment Monitoring

**Metrics to Watch:**
- [ ] Product sync success rate
- [ ] Widget load time
- [ ] API response times
- [ ] CORS rejection rate
- [ ] Error rates
- [ ] Webhook delivery rate

**Alerts to Configure:**
- [ ] Product sync failures > 10%
- [ ] Widget load failures > 5%
- [ ] API errors > 1%
- [ ] CORS rejections > 100/hour
- [ ] Webhook failures > 20%

---

## ROLLBACK PLAN

If critical issues occur:

1. **Immediate Actions:**
   - [ ] Revert CORS changes
   - [ ] Disable product sync routes
   - [ ] Restore old documentation
   - [ ] Notify affected merchants

2. **Investigation:**
   - [ ] Check error logs
   - [ ] Review metrics
   - [ ] Identify root cause
   - [ ] Create fix plan

3. **Fix and Redeploy:**
   - [ ] Fix issues in staging
   - [ ] Test thoroughly
   - [ ] Deploy to production
   - [ ] Monitor closely

---

## DEPENDENCIES

### External Services
- S3 for file uploads
- CloudFront for CDN
- Redis for rate limiting
- PostgreSQL for data storage

### Internal Services
- Authentication service
- Billing service
- Analytics service
- Webhook delivery service

### Third-Party Libraries
- multer (file uploads)
- joi (validation)
- cors (CORS handling)
- openapi-generator (API docs)

---

## RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| CORS breaks existing clients | Test thoroughly, use feature flags |
| Product sync service incomplete | Implement minimal version first |
| Widget CDN setup delayed | Use temporary hosting |
| Breaking API changes | Version endpoints, provide migration |
| Merchant domains unknown | Support wildcard initially |
| Performance degradation | Load test before deployment |
| Data loss during sync | Add transaction rollback |
| Security vulnerabilities | Security review before deploy |

---

## SUCCESS METRICS

### Phase 1 (Critical)
- [ ] Product sync works end-to-end
- [ ] Widget loads on external domains
- [ ] Documentation examples work
- [ ] 0 critical bugs

### Phase 2 (High Priority)
- [ ] API responses consistent
- [ ] Rate limits visible
- [ ] Webhooks documented
- [ ] Permissions enforced

### Phase 3 (Medium Priority)
- [ ] OpenAPI spec available
- [ ] Widget on CDN
- [ ] Domain management works
- [ ] Single session endpoint

### Overall Success
- [ ] Beta merchants onboard successfully
- [ ] < 5% error rate
- [ ] < 2s widget load time
- [ ] > 95% webhook delivery rate
- [ ] Positive merchant feedback

---

## TIMELINE

```
Week 1:
Mon-Tue: Phase 1 (Critical fixes)
Wed-Thu: Phase 2 (High priority)
Fri: Testing and fixes

Week 2:
Mon-Tue: Phase 3 (Medium priority)
Wed: Phase 4 (Low priority)
Thu-Fri: Final testing and deployment

Week 3:
Mon: Production deployment
Tue-Fri: Monitoring and bug fixes
```

---

## NOTES

- Prioritize P0 tasks for beta merchant onboarding
- P1-P3 can be done incrementally after beta launch
- Get merchant feedback early and often
- Monitor metrics closely after each phase
- Be ready to rollback if issues occur
- Document all changes for future reference
