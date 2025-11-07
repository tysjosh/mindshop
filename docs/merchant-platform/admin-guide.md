# Admin Guide
## Platform Administration & Management

## Overview

This guide covers the administrative features of the RAG Assistant Merchant Platform. As a platform administrator, you have access to powerful tools for managing merchants, monitoring system health, and maintaining platform operations.

**Target Audience:** Platform administrators, DevOps engineers, and support staff with admin privileges.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Merchant Management](#merchant-management)
3. [System Health Monitoring](#system-health-monitoring)
4. [System Metrics](#system-metrics)
5. [Error Logs & Audit Trail](#error-logs--audit-trail)
6. [Impersonation Mode](#impersonation-mode)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Admin Panel

The admin panel is available at `/admin` and requires admin role privileges.

**Prerequisites:**
- Admin role assigned in AWS Cognito
- Valid JWT token with admin permissions
- Access to the developer portal

**Login:**
```
URL: https://portal.rag-assistant.com/admin
Role Required: admin
```

### Admin Dashboard Overview

The admin dashboard provides:
- **Merchant Overview**: Total merchants, active/suspended counts
- **System Health**: Real-time status of all services
- **Recent Activity**: Latest merchant registrations and activities
- **Quick Actions**: Common administrative tasks

---

## Merchant Management

### Viewing All Merchants

**Endpoint:** `GET /api/admin/merchants`

**UI Location:** Admin Panel → Merchants

**Features:**
- Search merchants by name, email, or merchant ID
- Filter by status (active, suspended, pending_verification, deleted)
- Filter by plan (starter, professional, enterprise)
- Sort by registration date, last activity, or usage
- Pagination support

**Example Request:**
```bash
curl -X GET "https://api.rag-assistant.com/api/admin/merchants?status=active&plan=professional&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "merchantId": "acme_electronics_2024",
        "email": "admin@acme.com",
        "companyName": "ACME Electronics",
        "status": "active",
        "plan": "professional",
        "createdAt": "2025-10-01T10:00:00Z",
        "lastActivityAt": "2025-11-05T14:30:00Z",
        "usage": {
          "queries": 8543,
          "documents": 234,
          "apiCalls": 45231
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

### Viewing Merchant Details

**Endpoint:** `GET /api/admin/merchants/:merchantId`

**UI Location:** Admin Panel → Merchants → [Select Merchant]

**Information Displayed:**
- **Profile**: Company name, email, website, industry
- **Account Status**: Active, suspended, verification status
- **Subscription**: Current plan, billing status, next renewal
- **Usage Statistics**: Queries, documents, API calls, storage
- **API Keys**: List of active/revoked keys
- **Recent Activity**: Latest queries, document uploads, API calls
- **Audit Logs**: Account changes, status updates

**Example Request:**
```bash
curl -X GET "https://api.rag-assistant.com/api/admin/merchants/acme_electronics_2024" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "merchantId": "acme_electronics_2024",
      "email": "admin@acme.com",
      "companyName": "ACME Electronics",
      "website": "https://acme.com",
      "industry": "Electronics",
      "status": "active",
      "plan": "professional",
      "createdAt": "2025-10-01T10:00:00Z",
      "verifiedAt": "2025-10-01T10:15:00Z"
    },
    "billing": {
      "stripeCustomerId": "cus_abc123",
      "subscriptionStatus": "active",
      "currentPeriodEnd": "2025-12-01T00:00:00Z",
      "cancelAtPeriodEnd": false
    },
    "usage": {
      "currentMonth": {
        "queries": 8543,
        "documents": 234,
        "apiCalls": 45231,
        "storageGb": 2.3
      },
      "limits": {
        "queriesPerMonth": 10000,
        "documentsMax": 1000,
        "apiCallsPerDay": 50000,
        "storageGbMax": 10
      }
    },
    "apiKeys": [
      {
        "keyId": "key_abc123",
        "name": "Production API Key",
        "environment": "production",
        "status": "active",
        "lastUsedAt": "2025-11-05T14:30:00Z",
        "createdAt": "2025-10-01T11:00:00Z"
      }
    ],
    "recentActivity": [
      {
        "type": "chat_query",
        "timestamp": "2025-11-05T14:30:00Z",
        "details": "Query processed successfully"
      }
    ]
  }
}
```

### Updating Merchant Status

**Endpoint:** `PUT /api/admin/merchants/:merchantId/status`

**UI Location:** Admin Panel → Merchants → [Select Merchant] → Actions → Update Status

**Available Status Values:**
- `active`: Merchant can use all features
- `suspended`: Merchant access is temporarily disabled
- `pending_verification`: Awaiting email verification
- `deleted`: Soft-deleted (can be restored)

**Use Cases:**
- **Suspend**: Violation of terms, payment failure, security concerns
- **Activate**: Restore suspended account, complete verification
- **Delete**: Permanent account closure (soft delete)

**Example Request:**
```bash
curl -X PUT "https://api.rag-assistant.com/api/admin/merchants/acme_electronics_2024/status" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended",
    "reason": "Payment failure - subscription past due"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "status": "suspended",
    "updatedAt": "2025-11-05T15:00:00Z",
    "updatedBy": "admin@platform.com"
  },
  "message": "Merchant status updated successfully"
}
```

**Important Notes:**
- Status changes are logged in the audit trail
- Suspended merchants cannot make API calls
- Email notifications are sent to merchants on status changes
- Deleted merchants can be restored within 30 days

---

## System Health Monitoring

**Endpoint:** `GET /api/admin/system/health`

**UI Location:** Admin Panel → System Health

**Purpose:** Monitor the health and availability of all platform services in real-time.

### Health Check Components

The system health endpoint checks:

1. **API Gateway**: Response time, error rate
2. **Database (PostgreSQL)**: Connection status, query performance
3. **Cache (Redis)**: Connection status, memory usage
4. **MindsDB**: Service availability, predictor status
5. **AWS Bedrock**: API availability, quota status
6. **External Services**: Cognito, Stripe, S3

**Example Request:**
```bash
curl -X GET "https://api.rag-assistant.com/api/admin/system/health" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-05T15:00:00Z",
    "services": {
      "api": {
        "status": "healthy",
        "responseTime": 45,
        "uptime": 99.98
      },
      "database": {
        "status": "healthy",
        "connections": 23,
        "maxConnections": 100,
        "avgQueryTime": 12
      },
      "redis": {
        "status": "healthy",
        "memoryUsage": 45.2,
        "maxMemory": 100,
        "hitRate": 94.5
      },
      "mindsdb": {
        "status": "healthy",
        "predictors": 156,
        "avgPredictionTime": 234
      },
      "bedrock": {
        "status": "healthy",
        "quotaRemaining": 95.3
      },
      "cognito": {
        "status": "healthy"
      },
      "stripe": {
        "status": "healthy"
      }
    },
    "alerts": []
  }
}
```

### Health Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| `healthy` | Green | All systems operational |
| `degraded` | Yellow | Some services experiencing issues |
| `unhealthy` | Red | Critical services down |

### Setting Up Alerts

Configure alerts for health issues:

**CloudWatch Alarms:**
```bash
# Database connection failures
aws cloudwatch put-metric-alarm \
  --alarm-name "RAG-DB-Connection-Failures" \
  --alarm-description "Alert when database connections fail" \
  --metric-name DatabaseConnectionFailures \
  --namespace RAGAssistant \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

**PagerDuty Integration:**
```javascript
// Configure in environment variables
PAGERDUTY_API_KEY=your_api_key
PAGERDUTY_SERVICE_ID=your_service_id
```

---

## System Metrics

**Endpoint:** `GET /api/admin/system/metrics`

**UI Location:** Admin Panel → System Metrics

**Purpose:** View aggregated platform metrics and performance statistics.

### Available Metrics

**Application Metrics:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (%)
- Cache hit rate (%)

**Business Metrics:**
- Total merchants
- Active merchants
- Total queries (today, week, month)
- Revenue (MRR, ARR)

**Infrastructure Metrics:**
- CPU utilization (%)
- Memory utilization (%)
- Database connections
- Redis memory usage

**Example Request:**
```bash
curl -X GET "https://api.rag-assistant.com/api/admin/system/metrics?period=24h" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "timestamp": "2025-11-05T15:00:00Z",
    "application": {
      "requestRate": 1234.5,
      "responseTime": {
        "p50": 123,
        "p95": 456,
        "p99": 789
      },
      "errorRate": 0.23,
      "cacheHitRate": 94.5
    },
    "business": {
      "totalMerchants": 156,
      "activeMerchants": 142,
      "queries": {
        "today": 45231,
        "week": 312456,
        "month": 1234567
      },
      "revenue": {
        "mrr": 78900,
        "arr": 946800
      }
    },
    "infrastructure": {
      "cpu": {
        "average": 45.2,
        "peak": 78.3
      },
      "memory": {
        "average": 62.1,
        "peak": 85.4
      },
      "database": {
        "connections": 23,
        "maxConnections": 100
      },
      "redis": {
        "memoryUsage": 45.2,
        "maxMemory": 100
      }
    }
  }
}
```

### Metrics Dashboard

The admin UI provides interactive charts for:
- **Request Volume**: Time series of API requests
- **Response Time**: Latency distribution over time
- **Error Rate**: Error trends and spikes
- **Merchant Growth**: New registrations over time
- **Revenue Trends**: MRR/ARR growth

---

## Error Logs & Audit Trail

**Endpoint:** `GET /api/admin/errors`

**UI Location:** Admin Panel → Error Logs

**Purpose:** View and analyze system errors and audit logs for troubleshooting and compliance.

### Error Logs

**Features:**
- Filter by severity (error, warning, info)
- Filter by service (api, database, mindsdb, bedrock)
- Filter by merchant ID
- Search by error message
- Date range filtering
- Export to CSV

**Example Request:**
```bash
curl -X GET "https://api.rag-assistant.com/api/admin/errors?severity=error&service=api&startDate=2025-11-01&endDate=2025-11-05" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "id": "err_abc123",
        "timestamp": "2025-11-05T14:30:00Z",
        "severity": "error",
        "service": "api",
        "merchantId": "acme_electronics_2024",
        "endpoint": "/api/chat",
        "errorCode": "RATE_LIMIT_EXCEEDED",
        "message": "Rate limit exceeded for merchant",
        "stackTrace": "...",
        "requestId": "req_xyz789"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 234
    }
  }
}
```

### Audit Trail

**Tracked Events:**
- Merchant registration
- Status changes (active, suspended, deleted)
- API key creation/revocation
- Subscription changes
- Admin actions (impersonation, manual overrides)
- Configuration changes

**Example Audit Log Entry:**
```json
{
  "id": "audit_abc123",
  "timestamp": "2025-11-05T15:00:00Z",
  "action": "merchant_status_updated",
  "actor": {
    "userId": "admin_user_123",
    "email": "admin@platform.com",
    "role": "admin"
  },
  "target": {
    "merchantId": "acme_electronics_2024",
    "email": "admin@acme.com"
  },
  "changes": {
    "status": {
      "from": "active",
      "to": "suspended"
    }
  },
  "reason": "Payment failure - subscription past due",
  "ipAddress": "203.0.113.42"
}
```

### Compliance & Retention

- **Retention Period**: 90 days for error logs, 1 year for audit logs
- **GDPR Compliance**: PII is redacted from logs
- **Export**: Logs can be exported for compliance audits
- **Encryption**: Logs are encrypted at rest

---

## Impersonation Mode

**Endpoint:** `POST /api/admin/merchants/:merchantId/impersonate`

**UI Location:** Admin Panel → Merchants → [Select Merchant] → Actions → Impersonate

**Purpose:** Temporarily access the platform as a specific merchant for debugging and support purposes.

### How Impersonation Works

1. Admin initiates impersonation from admin panel
2. System generates a temporary impersonation token
3. Admin is redirected to merchant dashboard
4. Banner displays "Impersonating [Merchant Name]"
5. All actions are logged in audit trail
6. Session expires after 1 hour or manual exit

### Starting Impersonation

**Example Request:**
```bash
curl -X POST "https://api.rag-assistant.com/api/admin/merchants/acme_electronics_2024/impersonate" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Debugging API key issue reported in ticket #1234"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "impersonationToken": "imp_abc123xyz...",
    "merchantId": "acme_electronics_2024",
    "expiresAt": "2025-11-05T16:00:00Z",
    "redirectUrl": "/dashboard?impersonation=imp_abc123xyz..."
  }
}
```

### Impersonation Banner

When impersonating, a prominent banner is displayed:

```
⚠️ IMPERSONATION MODE
You are viewing the dashboard as: ACME Electronics (acme_electronics_2024)
Reason: Debugging API key issue reported in ticket #1234
[Exit Impersonation]
```

### Security Considerations

- **Audit Logging**: All actions during impersonation are logged
- **Time Limit**: Sessions expire after 1 hour
- **Reason Required**: Must provide reason for impersonation
- **Notifications**: Merchants are notified of impersonation (optional)
- **Restrictions**: Cannot change passwords or delete accounts while impersonating

### Exiting Impersonation

**UI:** Click "Exit Impersonation" button in banner

**API:** Session automatically expires or can be manually terminated

---

## Best Practices

### Merchant Management

1. **Regular Audits**: Review merchant list monthly for inactive accounts
2. **Status Changes**: Always provide clear reasons when suspending accounts
3. **Communication**: Notify merchants before taking action when possible
4. **Documentation**: Document all manual interventions in support tickets

### System Monitoring

1. **Daily Health Checks**: Review system health dashboard daily
2. **Alert Configuration**: Set up alerts for critical metrics
3. **Performance Baselines**: Establish baseline metrics for comparison
4. **Capacity Planning**: Monitor growth trends for infrastructure scaling

### Security

1. **Access Control**: Limit admin access to authorized personnel only
2. **Audit Reviews**: Regularly review audit logs for suspicious activity
3. **Impersonation**: Use impersonation sparingly and document reasons
4. **Password Rotation**: Rotate admin credentials regularly

### Incident Response

1. **Escalation Path**: Define clear escalation procedures
2. **Communication**: Keep merchants informed during incidents
3. **Post-Mortems**: Conduct post-incident reviews
4. **Documentation**: Maintain runbooks for common issues

---

## Troubleshooting

### Common Issues

#### Merchant Cannot Login

**Symptoms:**
- Merchant reports login failures
- "Invalid credentials" error

**Diagnosis:**
1. Check merchant status in admin panel
2. Verify email is verified in Cognito
3. Check for account suspension

**Resolution:**
```bash
# Check merchant status
curl -X GET "https://api.rag-assistant.com/api/admin/merchants/MERCHANT_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# If suspended, reactivate
curl -X PUT "https://api.rag-assistant.com/api/admin/merchants/MERCHANT_ID/status" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "reason": "Issue resolved"}'
```

#### High Error Rate

**Symptoms:**
- Error rate > 1% in metrics dashboard
- Multiple merchants reporting issues

**Diagnosis:**
1. Check system health dashboard
2. Review error logs for patterns
3. Check external service status (Bedrock, MindsDB)

**Resolution:**
1. Identify failing service
2. Check service-specific logs
3. Restart service if needed
4. Scale infrastructure if capacity issue

#### API Key Not Working

**Symptoms:**
- Merchant reports 401 errors
- "Invalid API key" message

**Diagnosis:**
1. Impersonate merchant to test
2. Check API key status (active/revoked)
3. Verify key hasn't expired
4. Check rate limits

**Resolution:**
```bash
# View merchant's API keys
curl -X GET "https://api.rag-assistant.com/api/admin/merchants/MERCHANT_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# If revoked, merchant needs to create new key
# If rate limited, check usage limits
```

#### Database Connection Issues

**Symptoms:**
- "Database connection failed" errors
- Slow response times

**Diagnosis:**
1. Check system health dashboard
2. Review database metrics (connections, CPU)
3. Check for long-running queries

**Resolution:**
```bash
# Check database connections
psql -h DB_HOST -U DB_USER -d DB_NAME -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries if needed
psql -h DB_HOST -U DB_USER -d DB_NAME -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"
```

### Getting Help

**Internal Support:**
- Slack: #platform-admin
- Email: platform-ops@company.com
- On-call: PagerDuty escalation

**External Resources:**
- AWS Support: For infrastructure issues
- Stripe Support: For billing issues
- MindsDB Support: For ML/RAG issues

---

## Appendix

### Admin API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/merchants` | GET | List all merchants |
| `/api/admin/merchants/:merchantId` | GET | Get merchant details |
| `/api/admin/merchants/:merchantId/status` | PUT | Update merchant status |
| `/api/admin/merchants/:merchantId/impersonate` | POST | Impersonate merchant |
| `/api/admin/system/health` | GET | Get system health |
| `/api/admin/system/metrics` | GET | Get system metrics |
| `/api/admin/errors` | GET | Get error logs |

### Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid admin token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Merchant not found |
| 500 | Internal Server Error | Server error |

### Glossary

- **Merchant**: A business using the RAG Assistant platform
- **Impersonation**: Temporarily accessing platform as a merchant
- **Audit Log**: Record of all administrative actions
- **MRR**: Monthly Recurring Revenue
- **ARR**: Annual Recurring Revenue
- **p50/p95/p99**: Percentile response times

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-05 | Initial admin guide release |

---

## Support

For questions or issues with this guide:
- **Documentation**: https://docs.rag-assistant.com
- **Support Email**: support@rag-assistant.com
- **Slack**: #admin-support

---

**Last Updated:** November 5, 2025
**Version:** 1.0.0
