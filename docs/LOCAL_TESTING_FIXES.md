# Local Testing Issues & Fixes

## Issues Identified

### 1. SessionManager Using DynamoDB Instead of Postgres
**Location:** `src/services/SessionManager.ts`

**Problem:** The SessionManager is configured to use AWS DynamoDB, which causes timeouts in local development.

**Evidence:**
```typescript
// SessionManager.ts line 60
this.dynamoClient = new DynamoDBClient({ region: config.region });
```

**Impact:** All session endpoints timeout (POST /api/sessions, GET /api/sessions/:id, etc.)

**Fix Options:**

#### Option A: Create a Postgres-based SessionManager (Recommended for Local Dev)
Create `src/services/PostgresSessionManager.ts` that uses the local Postgres database instead of DynamoDB.

#### Option B: Mock DynamoDB for Local Development
Use DynamoDB Local or mock the DynamoDB client for development.

#### Option C: Use Existing Database Tables
The `user_sessions` table already exists in Postgres. Create a repository that uses it directly.

---

### 2. DocumentController Requires MindsDB Knowledge Base Setup
**Location:** `src/api/controllers/DocumentController.ts`

**Problem:** Document ingestion tries to insert into MindsDB knowledge base that doesn't exist.

**Evidence:**
```bash
curl http://localhost:47334/api/sql/query -d '{"query": "SHOW KNOWLEDGE_BASES"}'
# Returns: empty array []
```

**Impact:** Document creation endpoint times out (POST /api/documents)

**Fix Options:**

#### Option A: Initialize Knowledge Base First
Before using document endpoints, initialize the RAG system:
```bash
POST /api/merchants/{merchantId}/rag/initialize
{
  "openaiApiKey": "your-key-here"
}
```

#### Option B: Use Direct Database Insert (Recommended for Testing)
Modify DocumentController to insert directly into Postgres `documents` table for basic CRUD, only use MindsDB for semantic search.

#### Option C: Make MindsDB Optional
Add a flag to bypass MindsDB ingestion in development mode.

---

## Quick Fixes for Local Testing

### Fix 1: Use Postgres for Sessions

Create `src/repositories/SessionRepository.ts`:
```typescript
import { db } from '../db';
import { userSessions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class SessionRepository {
  async createSession(data: {
    merchantId: string;
    userId: string;
    context?: any;
  }) {
    const sessionId = uuidv4();
    const result = await db.insert(userSessions).values({
      sessionId,
      userId: data.userId,
      merchantId: data.merchantId,
      context: data.context || {},
      conversationHistory: [],
    }).returning();
    
    return result[0];
  }
  
  async getSession(sessionId: string, merchantId: string) {
    const result = await db.select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionId, sessionId),
          eq(userSessions.merchantId, merchantId)
        )
      )
      .limit(1);
    
    return result[0] || null;
  }
}
```

Update `SessionController` to use `SessionRepository` instead of `SessionManager` in development.

### Fix 2: Use Postgres for Documents

Create `src/repositories/DocumentRepository.ts` (if it doesn't exist or update it):
```typescript
import { db } from '../db';
import { documents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class DocumentRepository {
  async createDocument(data: {
    merchantId: string;
    title: string;
    body: string;
    documentType: string;
    sku?: string;
    metadata?: any;
  }) {
    const documentId = uuidv4();
    const result = await db.insert(documents).values({
      id: documentId,
      merchantId: data.merchantId,
      title: data.title,
      content: data.body,
      documentType: data.documentType,
      sku: data.sku,
      metadata: data.metadata || {},
    }).returning();
    
    return result[0];
  }
  
  async getDocument(documentId: string, merchantId: string) {
    const result = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.merchantId, merchantId)
        )
      )
      .limit(1);
    
    return result[0] || null;
  }
  
  async searchDocuments(merchantId: string, filters: any) {
    return await db.select()
      .from(documents)
      .where(eq(documents.merchantId, merchantId))
      .limit(filters.limit || 10);
  }
}
```

Update `DocumentController` to use `DocumentRepository` for basic CRUD operations.

---

## Environment Variable Configuration

Add to `.env`:
```bash
# Session Management
USE_POSTGRES_SESSIONS=true  # Use Postgres instead of DynamoDB for local dev

# Document Management  
USE_POSTGRES_DOCUMENTS=true  # Use Postgres instead of MindsDB for basic CRUD
MINDSDB_OPTIONAL=true  # Make MindsDB optional for local testing
```

---

## Testing After Fixes

Once fixes are applied, these endpoints should work:

```bash
# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer dev_user_123:test_merchant_456" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "test_merchant_456",
    "userId": "dev_user_123"
  }'

# Create a document
curl -X POST http://localhost:3000/api/documents \
  -H "Authorization: Bearer dev_user_123:test_merchant_456" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "test_merchant_456",
    "title": "Test Product",
    "body": "Test description",
    "documentType": "product",
    "sku": "TEST-001"
  }'
```

---

## Current Working Endpoints

These endpoints work without any fixes:

✅ Health checks:
- GET /health
- GET /ready
- GET /live

✅ API info (with auth):
- GET /api
- GET /api/docs

✅ Service health:
- GET /api/semantic-retrieval/health
- GET /api/bedrock-agent/health (partially - shows unhealthy for missing config)

---

## Recommended Approach

1. **Short-term (for immediate testing):**
   - Create Postgres-based repositories for sessions and documents
   - Add environment flags to switch between Postgres and DynamoDB/MindsDB
   - Use Postgres for local development, DynamoDB/MindsDB for production

2. **Long-term (for production):**
   - Keep DynamoDB for sessions (better for serverless/Lambda)
   - Keep MindsDB for semantic search and ML features
   - Use Postgres for basic CRUD operations
   - Implement proper service abstraction layer

---

## Next Steps

Would you like me to:
1. Create the Postgres-based SessionRepository?
2. Update DocumentController to use Postgres for basic CRUD?
3. Add environment variable switches?
4. All of the above?
