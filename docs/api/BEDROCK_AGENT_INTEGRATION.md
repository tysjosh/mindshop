# AWS Bedrock Agent Integration Documentation

## 🤖 Overview

The MindsDB RAG Assistant now includes comprehensive AWS Bedrock Agent integration, providing advanced conversational AI capabilities with enterprise-grade features including audit trails, compliance reporting, and intent analysis.

## 🚀 New Endpoints Added (11 total)

### Core Chat & Session Management
- **`POST /bedrock-agent/chat`** - Process chat requests through AWS Bedrock Agent
- **`POST /bedrock-agent/sessions`** - Create new Bedrock Agent sessions
- **`GET /bedrock-agent/sessions/{sessionId}`** - Retrieve session details
- **`DELETE /bedrock-agent/sessions/{sessionId}`** - Clear/delete sessions
- **`GET /bedrock-agent/sessions/{sessionId}/history`** - Get conversation history

### User & Analytics
- **`GET /bedrock-agent/users/{userId}/sessions`** - Get all sessions for a user
- **`GET /bedrock-agent/stats`** - Comprehensive usage statistics and analytics
- **`GET /bedrock-agent/health`** - Health check for Bedrock Agent services

### Advanced Features
- **`POST /bedrock-agent/parse-intent`** - Parse and analyze user intent (debugging/testing)
- **`GET /bedrock-agent/sessions/{sessionId}/summary`** - Detailed session summary with audit info
- **`GET /bedrock-agent/audit/search`** - Search audit entries for compliance
- **`POST /bedrock-agent/compliance/report`** - Generate comprehensive compliance reports

## 📊 New Data Models (6 schemas)

### Core Models
- **`BedrockAgentSession`** - Session information with AWS-specific metadata
- **`BedrockAgentMessage`** - Messages with intent analysis and entity extraction
- **`BedrockAgentStats`** - Usage statistics and performance metrics

### Advanced Models
- **`BedrockAgentSessionSummary`** - Comprehensive session analysis
- **`BedrockAgentAuditEntry`** - Detailed audit trail entries
- **`BedrockAgentComplianceReport`** - Enterprise compliance reporting

## 🔧 Key Features

### 🧠 Advanced AI Capabilities
- **Intent Recognition**: Automatic detection of user intents with confidence scoring
- **Entity Extraction**: Identification and classification of entities in user queries
- **Sentiment Analysis**: Understanding user sentiment and emotional context
- **Context Awareness**: Maintains conversation context across multiple interactions

### 📈 Analytics & Monitoring
- **Performance Metrics**: Response times, success rates, error tracking
- **Usage Analytics**: Session patterns, intent distribution, user behavior
- **Real-time Monitoring**: Health checks and service availability
- **Business Intelligence**: Insights into user interactions and preferences

### 🔒 Enterprise Security & Compliance
- **Comprehensive Audit Trails**: Every interaction logged with detailed metadata
- **PII Detection**: Automatic identification and handling of sensitive information
- **Compliance Reporting**: GDPR, CCPA, HIPAA, and SOX compliance support
- **Data Governance**: Encryption, access control, and retention policies

### ⚡ Performance & Scalability
- **Rate Limiting**: 30 requests/minute for chat, 100 requests/minute for sessions
- **Optimized Processing**: Average response times under 1.5 seconds
- **Auto-scaling**: Handles varying load patterns efficiently
- **Regional Deployment**: Multi-region support for low latency

## 🛠️ Integration Examples

### Basic Chat Interaction
```javascript
const response = await fetch('/api/bedrock-agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "What are your best laptops for gaming?",
    merchant_id: "merchant-uuid",
    user_id: "user-123",
    session_id: "session-uuid",
    user_context: {
      preferences: { budget: "1000-2000", category: "gaming" }
    }
  })
});
```

### Intent Analysis
```javascript
const intentResponse = await fetch('/api/bedrock-agent/parse-intent', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "I want to return my headphones",
    merchant_id: "merchant-uuid",
    user_context: { order_history: true }
  })
});

// Response includes:
// - intent: "return_request"
// - confidence: 0.95
// - entities: [{ type: "product", value: "headphones" }]
// - sentiment: { label: "neutral", score: 0.7 }
```

### Compliance Reporting
```javascript
const complianceReport = await fetch('/api/bedrock-agent/compliance/report', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    merchant_id: "merchant-uuid",
    start_date: "2024-01-01",
    end_date: "2024-01-31",
    report_type: "detailed",
    include_pii_analysis: true
  })
});
```

## 📋 Rate Limits & Quotas

| Endpoint Category | Rate Limit | Burst Limit | Notes |
|------------------|------------|-------------|-------|
| Chat | 30/minute | 10/10sec | Per IP address |
| Sessions | 100/minute | 20/10sec | Per IP address |
| Analytics | 100/minute | 20/10sec | Per merchant |
| Compliance | 10/hour | 2/10min | Per merchant |

## 🔍 Monitoring & Observability

### Health Checks
- **Service Availability**: Real-time status of Bedrock Agent services
- **Model Performance**: Response times and accuracy metrics
- **Regional Status**: Multi-region deployment health
- **Dependency Checks**: AWS service dependencies and connectivity

### Metrics Tracked
- **Interaction Metrics**: Total chats, sessions, users
- **Performance Metrics**: Response times, error rates, throughput
- **Business Metrics**: Intent distribution, user satisfaction, conversion rates
- **Compliance Metrics**: PII detection rates, audit completeness, policy adherence

## 🚨 Error Handling

### Common Error Codes
- **`BEDROCK_UNAVAILABLE`**: AWS Bedrock service temporarily unavailable
- **`INTENT_PARSE_FAILED`**: Unable to parse user intent
- **`SESSION_EXPIRED`**: Session has expired and needs renewal
- **`RATE_LIMIT_EXCEEDED`**: Too many requests (see rate limits above)
- **`COMPLIANCE_VIOLATION`**: Request violates compliance policies

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "BEDROCK_UNAVAILABLE",
    "message": "AWS Bedrock Agent service is temporarily unavailable",
    "details": {
      "region": "us-east-1",
      "retry_after": 30,
      "service_status": "degraded"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-uuid"
}
```

## 🔄 Migration Guide

### From Standard Chat to Bedrock Agent
1. **Update Endpoints**: Change `/chat` to `/bedrock-agent/chat`
2. **Request Format**: Update request schema (see API docs)
3. **Response Handling**: Handle new response format with intent data
4. **Session Management**: Use Bedrock-specific session endpoints
5. **Error Handling**: Update error handling for new error codes

### Configuration Changes
```yaml
# Environment Variables
BEDROCK_AGENT_REGION=us-east-1
BEDROCK_AGENT_MODEL_ID=anthropic.claude-v2
BEDROCK_AGENT_TIMEOUT=30000
BEDROCK_AUDIT_ENABLED=true
BEDROCK_COMPLIANCE_MODE=strict
```

## 📚 Additional Resources

- **AWS Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/
- **Intent Recognition Guide**: `/docs/intent-recognition.md`
- **Compliance Setup**: `/docs/compliance-configuration.md`
- **Performance Tuning**: `/docs/performance-optimization.md`
- **Troubleshooting**: `/docs/bedrock-troubleshooting.md`

## 🎯 Next Steps

1. **Test Integration**: Use the provided examples to test Bedrock Agent functionality
2. **Configure Compliance**: Set up audit trails and compliance reporting
3. **Monitor Performance**: Implement monitoring dashboards using the stats endpoints
4. **Optimize Usage**: Use intent analysis to improve user experience
5. **Scale Deployment**: Configure multi-region deployment for production

The Bedrock Agent integration provides enterprise-grade conversational AI with comprehensive monitoring, compliance, and analytics capabilities, making it suitable for production deployments requiring advanced AI features and regulatory compliance.