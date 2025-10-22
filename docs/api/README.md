# MindsDB RAG Assistant API Documentation

This directory contains the complete OpenAPI 3.0 specification for the MindsDB RAG Assistant API.

## 📁 Structure

```
docs/api/
├── openapi.yaml              # Main OpenAPI specification file
├── components/
│   └── schemas.yaml          # Reusable data schemas and models
├── paths/
│   ├── health.yaml          # Health check endpoints
│   ├── documents.yaml       # Document management endpoints
│   ├── chat.yaml           # Chat and conversation endpoints
│   ├── sessions.yaml       # Session management endpoints
│   ├── search.yaml         # Semantic search endpoints
│   └── checkout.yaml       # E-commerce checkout endpoints
└── README.md               # This file
```

## 🚀 Quick Start

### Viewing the Documentation

1. **Swagger UI**: Open `openapi.yaml` in [Swagger Editor](https://editor.swagger.io/)
2. **Redoc**: Use [Redoc CLI](https://github.com/Redocly/redoc-cli) to generate HTML docs
3. **Postman**: Import `openapi.yaml` into Postman for API testing

### Generating Client SDKs

Use [OpenAPI Generator](https://openapi-generator.tech/) to create client libraries:

```bash
# JavaScript/TypeScript
openapi-generator-cli generate -i openapi.yaml -g typescript-axios -o ./clients/typescript

# Python
openapi-generator-cli generate -i openapi.yaml -g python -o ./clients/python

# Java
openapi-generator-cli generate -i openapi.yaml -g java -o ./clients/java
```

## 🔧 API Overview

### Base URLs

- **Production**: `https://api.mindsdb-rag.com/v1`
- **Staging**: `https://staging-api.mindsdb-rag.com/v1`
- **Local**: `http://localhost:3000/api/v1`

### Authentication

All endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer your-api-key" \
     https://api.mindsdb-rag.com/v1/health
```

### Core Endpoints

| Endpoint | Purpose | Key Features |
|----------|---------|--------------|
| `/health` | System status | Health checks, component status |
| `/documents` | Document management | Upload, search, manage documents |
| `/chat` | AI conversations | RAG-enhanced chat responses |
| `/sessions` | Session management | User session tracking |
| `/search` | Semantic search | Vector-based document search |
| `/checkout` | E-commerce | Payment processing, order management |
| `/bedrock-agent` | AI Agent | AWS Bedrock Agent integration, advanced AI |

## 📊 Key Features

### 🧠 RAG (Retrieval-Augmented Generation)
- Semantic document search using vector embeddings
- Context-aware AI responses
- Multi-document knowledge synthesis

### 🔮 ML Predictions
- MindsDB integration for demand forecasting
- Product recommendations
- User behavior predictions

### 🏢 Multi-tenant Architecture
- Isolated data per merchant
- Tenant-specific configurations
- Secure data boundaries

### 🔒 PII Protection
- Automatic PII detection
- Secure tokenization
- GDPR/CCPA compliance

### 💳 E-commerce Integration
- Complete checkout flow
- Payment processing
- Order management
- Inventory tracking

## 🔍 Example Usage

### Document Upload

```bash
curl -X POST https://api.mindsdb-rag.com/v1/documents \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "title": "Premium Headphones",
    "body": "High-quality wireless headphones with noise cancellation...",
    "documentType": "product",
    "metadata": {
      "sku": "HEADPHONES-001",
      "price": 199.99,
      "category": "electronics"
    }
  }'
```

### Chat Interaction

```bash
curl -X POST https://api.mindsdb-rag.com/v1/chat \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "sessionId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "What are your best wireless headphones under $200?",
    "options": {
      "includeRecommendations": true,
      "maxDocuments": 5
    }
  }'
```

### Semantic Search

```bash
curl -X POST https://api.mindsdb-rag.com/v1/search/semantic \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "query": "wireless headphones with noise cancellation",
    "limit": 10,
    "threshold": 0.7
  }'
```

### Checkout Process

```bash
curl -X POST https://api.mindsdb-rag.com/v1/checkout \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "userId": "user_456",
    "sessionId": "123e4567-e89b-12d3-a456-426614174000",
    "items": [
      {
        "sku": "HEADPHONES-001",
        "quantity": 1,
        "price": 199.99
      }
    ],
    "paymentMethod": "stripe",
    "shippingAddress": {
      "address_line_1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "US"
    }
  }'
```

### Bedrock Agent Chat

```bash
curl -X POST https://api.mindsdb-rag.com/v1/bedrock-agent/chat \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I need help finding the best laptop for programming",
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user_456",
    "session_id": "456e7890-e89b-12d3-a456-426614174001",
    "user_context": {
      "preferences": {
        "budget": "1000-2000",
        "use_case": "programming"
      },
      "location": "US"
    }
  }'
```

## 📈 Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "123e4567-e89b-12d3-a456-426614174000"
}
```

Error responses include detailed information:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "merchantId",
        "message": "merchantId is required"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "123e4567-e89b-12d3-a456-426614174000"
}
```

## 🔄 Rate Limits

| Tier | Requests/Hour | Burst Limit |
|------|---------------|-------------|
| Standard | 1,000 | 100/minute |
| Premium | 5,000 | 500/minute |
| Enterprise | Custom | Custom |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per hour
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## 🛠️ Development

### Validating the Spec

```bash
# Using Swagger CLI
swagger-codegen validate -i openapi.yaml

# Using OpenAPI CLI
openapi validate openapi.yaml
```

### Testing Endpoints

```bash
# Using Newman (Postman CLI)
newman run postman-collection.json

# Using curl with test scripts
./scripts/test-api.sh
```

## 📚 Additional Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [MindsDB Documentation](https://docs.mindsdb.com/)
- [API Best Practices](https://docs.mindsdb-rag.com/best-practices)
- [SDK Documentation](https://docs.mindsdb-rag.com/sdks)

## 🤝 Contributing

1. Follow OpenAPI 3.0 standards
2. Include comprehensive examples
3. Document all parameters and responses
4. Validate changes before committing
5. Update this README when adding new endpoints

## 📞 Support

- **Documentation**: https://docs.mindsdb-rag.com
- **Support Email**: support@mindsdb-rag.com
- **GitHub Issues**: https://github.com/your-org/mindsdb-rag-assistant/issues