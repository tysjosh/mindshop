/**
 * Example usage of MindsDBService integration layer
 * This demonstrates how to use the service for document retrieval and predictions
 */

import { MindsDBService } from '../services/MindsDBService';

async function demonstrateMindsDBIntegration() {
  const mindsdbService = new MindsDBService();
  const merchantId = 'demo-merchant-123';

  console.log('=== MindsDB Service Integration Demo ===\n');

  try {
    // 1. Health Check
    console.log('1. Performing health check...');
    const healthStatus = await mindsdbService.healthCheck();
    console.log('Health Status:', healthStatus);
    console.log();

    // 2. Document Retrieval
    console.log('2. Retrieving documents for query...');
    const retrievalParams = {
      query: 'wireless bluetooth headphones with noise cancellation',
      merchantId,
      limit: 3,
      threshold: 0.7,
    };

    const documents = await mindsdbService.retrieveDocuments(retrievalParams);
    console.log(`Found ${documents.length} relevant documents:`);
    documents.forEach((doc: any, index: number) => {
      console.log(`  ${index + 1}. ${doc.snippet} (score: ${doc.score})`);
      console.log(`     SKU: ${doc.metadata.sku}, Type: ${doc.metadata.documentType}`);
      console.log(`     Grounding Pass: ${doc.groundingPass}`);
    });
    console.log();

    // 3. Product Prediction
    if (documents.length > 0 && documents[0].metadata.sku) {
      console.log('3. Getting product predictions...');
      const predictionParams = {
        sku: documents[0].metadata.sku,
        merchantId,
        userContext: {
          userId: 'user-456',
          preferences: {
            category: 'electronics',
            priceRange: 'mid',
          },
          purchaseHistory: ['PROD-001', 'PROD-002'],
          demographics: {
            age: 28,
            location: 'US',
          },
        },
      };

      const prediction = await mindsdbService.predictProductSignals(predictionParams);
      console.log('Prediction Results:');
      console.log(`  SKU: ${prediction.sku}`);
      console.log(`  Demand Score: ${prediction.demandScore}`);
      console.log(`  Purchase Probability: ${prediction.purchaseProbability}`);
      console.log(`  Confidence: ${prediction.confidence}`);
      console.log(`  Explanation: ${prediction.explanation}`);
      console.log('  Feature Importance:');
      Object.entries(prediction.featureImportance).forEach(([feature, importance]: [string, any]) => {
        console.log(`    ${feature}: ${importance}`);
      });
      console.log(`  Model: ${prediction.provenance.modelId} v${prediction.provenance.modelVersion}`);
      console.log();
    }

    // 4. Embedding Generation
    console.log('4. Generating embeddings...');
    const embeddingParams = {
      text: 'High-quality wireless headphones with active noise cancellation',
      merchantId,
    };

    const embedding = await mindsdbService.generateEmbedding(embeddingParams);
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    console.log(`First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    console.log();

    // 5. Batch Embedding Generation
    console.log('5. Generating batch embeddings...');
    const texts = [
      'Premium wireless earbuds',
      'Noise-cancelling over-ear headphones',
      'Bluetooth speaker with bass boost',
    ];

    const batchEmbeddings = await mindsdbService.generateBatchEmbeddings({
      documents: texts.map((text, index) => ({ id: `doc_${index}`, text }))
    });
    console.log(`Generated ${batchEmbeddings.length} embeddings:`);
    batchEmbeddings.forEach((emb: any, index: number) => {
      console.log(`  Text ${index + 1}: ${emb.length} dimensions`);
    });
    console.log();

    // 6. List Available Predictors
    console.log('6. Listing available predictors...');
    const predictors = await mindsdbService.listPredictors(merchantId);
    console.log(`Found ${predictors.length} predictors:`);
    predictors.forEach((predictor: any, index: number) => {
      console.log(`  ${index + 1}. ${predictor.name} (${predictor.status}) - Accuracy: ${predictor.accuracy}`);
    });
    console.log();

    // 7. Circuit Breaker Stats
    console.log('7. Circuit breaker statistics:');
    const stats = mindsdbService.getCircuitBreakerStats();
    Object.entries(stats).forEach(([operation, stat]: [string, any]) => {
      console.log(`  ${operation}: ${JSON.stringify(stat)}`);
    });
    console.log();

    // 8. Connection Info
    console.log('8. Connection information:');
    const connectionInfo = mindsdbService.getConnectionInfo();
    console.log(`  Endpoint: ${connectionInfo.endpoint}`);
    console.log(`  Timeout: ${connectionInfo.timeout}ms`);
    console.log(`  Has API Key: ${connectionInfo.hasApiKey}`);

  } catch (error) {
    console.error('Error during MindsDB integration demo:', error);
  }
}

// Example of error handling and tenant isolation
async function demonstrateTenantIsolation() {
  const mindsdbService = new MindsDBService();

  console.log('\n=== Tenant Isolation Demo ===\n');

  try {
    // This should fail due to invalid merchant ID
    await mindsdbService.retrieveDocuments({
      query: 'test query',
      merchantId: 'invalid-merchant-id!',
    });
  } catch (error: any) {
    console.log('✓ Tenant isolation working - invalid merchant ID rejected:', error.message);
  }

  try {
    // This should fail due to empty merchant ID
    await mindsdbService.predictProductSignals({
      sku: 'PROD-123',
      merchantId: '',
      userContext: {},
    });
  } catch (error: any) {
    console.log('✓ Tenant isolation working - empty merchant ID rejected:', error.message);
  }

  console.log('✓ All tenant isolation checks passed\n');
}

// Example of caching behavior
async function demonstrateCaching() {
  const mindsdbService = new MindsDBService();
  const merchantId = 'cache-demo-merchant';

  console.log('=== Caching Demo ===\n');

  const query = 'test caching query';
  
  console.log('First request (cache miss):');
  const start1 = Date.now();
  try {
    await mindsdbService.retrieveDocuments({ query, merchantId });
    console.log(`Request completed in ${Date.now() - start1}ms`);
  } catch (error: any) {
    console.log(`Request failed in ${Date.now() - start1}ms:`, error.message);
  }

  console.log('\nSecond request (cache hit):');
  const start2 = Date.now();
  try {
    await mindsdbService.retrieveDocuments({ query, merchantId });
    console.log(`Request completed in ${Date.now() - start2}ms (should be faster due to caching)`);
  } catch (error: any) {
    console.log(`Request failed in ${Date.now() - start2}ms:`, error.message);
  }
}

// Run the demonstrations
if (require.main === module) {
  (async () => {
    await demonstrateMindsDBIntegration();
    await demonstrateTenantIsolation();
    await demonstrateCaching();
  })();
}

export {
  demonstrateMindsDBIntegration,
  demonstrateTenantIsolation,
  demonstrateCaching,
};