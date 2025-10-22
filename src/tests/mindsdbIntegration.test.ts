import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MindsDBService } from '../services/MindsDBService';
import { SemanticRetrievalService } from '../services/SemanticRetrievalService';

describe('MindsDB RAG Integration Tests', () => {
  let mindsdbService: MindsDBService;
  let retrievalService: SemanticRetrievalService;
  const testMerchantId = 'test_merchant_' + Date.now();

  beforeAll(async () => {
    mindsdbService = new MindsDBService();
    retrievalService = new SemanticRetrievalService(mindsdbService);
    
    // Wait for MindsDB to be ready
    let retries = 0;
    const maxRetries = 10;
    
    while (retries < maxRetries) {
      try {
        const health = await mindsdbService.healthCheck();
        if (health.status === 'healthy') {
          break;
        }
      } catch (error) {
        console.log(`MindsDB not ready, retry ${retries + 1}/${maxRetries}`);
      }
      
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (retries === maxRetries) {
      throw new Error('MindsDB is not available for testing');
    }
  });

  afterAll(async () => {
    // Cleanup test resources
    try {
      await mindsdbService.dropKnowledgeBase(`rag_kb_${testMerchantId}`);
      await mindsdbService.dropAgent(`rag_agent_${testMerchantId}`);
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error);
    }
  });

  describe('MindsDBService', () => {
    it('should connect to MindsDB successfully', async () => {
      const isConnected = await mindsdbService.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should perform health check', async () => {
      const health = await mindsdbService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });

    it('should list databases', async () => {
      const databases = await mindsdbService.listDatabases();
      expect(Array.isArray(databases)).toBe(true);
    });

    it('should execute basic SQL queries', async () => {
      const result = await mindsdbService.query('SELECT 1 as test_value');
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].test_value).toBe(1);
    });
  });

  describe('Knowledge Base Operations', () => {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    it('should skip knowledge base tests if no OpenAI API key', () => {
      if (!openaiApiKey) {
        console.log('Skipping knowledge base tests - no OpenAI API key provided');
        expect(true).toBe(true);
        return;
      }
    });

    it('should create knowledge base if OpenAI key is available', async () => {
      if (!openaiApiKey) return;

      await expect(
        mindsdbService.createKnowledgeBase({
          name: `rag_kb_${testMerchantId}`,
          embedding_model: {
            provider: 'openai',
            model_name: 'text-embedding-3-large',
            api_key: openaiApiKey
          },
          metadata_columns: ['document_type', 'source'],
          content_columns: ['content'],
          id_column: 'document_id'
        })
      ).resolves.not.toThrow();
    });

    it('should list knowledge bases', async () => {
      const knowledgeBases = await mindsdbService.listKnowledgeBases();
      expect(Array.isArray(knowledgeBases)).toBe(true);
    });

    it('should ingest document if knowledge base exists', async () => {
      if (!openaiApiKey) return;

      const testDocument = {
        id: 'test_doc_1',
        content: 'This is a test document about MindsDB RAG capabilities.',
        metadata: {
          document_id: 'test_doc_1',
          document_type: 'test',
          source: 'unit_test',
          title: 'Test Document'
        }
      };

      await expect(
        mindsdbService.insertDocumentToKB(`rag_kb_${testMerchantId}`, testDocument)
      ).resolves.not.toThrow();
    });
  });

  describe('Agent Operations', () => {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    it('should create agent if OpenAI key is available', async () => {
      if (!openaiApiKey) return;

      await expect(
        mindsdbService.createAgent({
          name: `rag_agent_${testMerchantId}`,
          model: {
            provider: 'openai',
            model_name: 'gpt-4o',
            api_key: openaiApiKey
          },
          knowledge_bases: [`rag_kb_${testMerchantId}`],
          prompt_template: 'You are a helpful test assistant.',
          timeout: 30
        })
      ).resolves.not.toThrow();
    });

    it('should list agents', async () => {
      const agents = await mindsdbService.listAgents();
      expect(Array.isArray(agents)).toBe(true);
    });
  });

  describe('RAG System Integration', () => {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    it('should setup complete RAG system if OpenAI key is available', async () => {
      if (!openaiApiKey) return;

      await expect(
        mindsdbService.setupRAGSystem(testMerchantId, openaiApiKey)
      ).resolves.not.toThrow();
    });

    it('should ingest document into RAG system', async () => {
      if (!openaiApiKey) return;

      const testDocument = {
        id: 'rag_test_doc_1',
        content: 'This is a comprehensive test document for RAG functionality testing.',
        title: 'RAG Test Document',
        source: 'integration_test',
        document_type: 'test'
      };

      await expect(
        mindsdbService.ingestDocument(testMerchantId, testDocument)
      ).resolves.not.toThrow();
    });

    it('should search documents using semantic retrieval', async () => {
      if (!openaiApiKey) return;

      const results = await retrievalService.retrieveDocuments({
        query: 'test document',
        merchantId: testMerchantId,
        limit: 5,
        threshold: 0.5
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should answer questions using RAG agent', async () => {
      if (!openaiApiKey) return;

      const answer = await mindsdbService.askQuestion(
        testMerchantId,
        'What is this document about?'
      );

      expect(typeof answer).toBe('string');
      expect(answer.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid SQL queries gracefully', async () => {
      const result = await mindsdbService.query('INVALID SQL QUERY');
      expect(result.data).toBeDefined();
      // MindsDB should return an error in the result, not throw
    });

    it('should handle non-existent knowledge base queries', async () => {
      await expect(
        retrievalService.retrieveDocuments({
          query: 'test',
          merchantId: 'non_existent_merchant',
          limit: 5
        })
      ).rejects.toThrow();
    });

    it('should handle connection issues gracefully', async () => {
      const invalidService = new MindsDBService({
        host: 'invalid-host',
        port: 99999,
        username: '',
        password: ''
      });

      const health = await invalidService.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent queries', async () => {
      const queries = Array(5).fill(0).map((_, i) => 
        mindsdbService.query(`SELECT ${i} as query_number`)
      );

      const results = await Promise.all(queries);
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.data[0].query_number).toBe(i);
      });
    });

    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();
      await mindsdbService.healthCheck();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});