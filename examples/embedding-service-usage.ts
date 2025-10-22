/**
 * Example usage of the EmbeddingService with PII protection and batch processing
 */

import { getEmbeddingService } from '../src/services/EmbeddingService';
import { DocumentRepository } from '../src/repositories/DocumentRepository';
import { Document } from '../src/models/Document';

async function demonstrateEmbeddingService() {
  const embeddingService = getEmbeddingService();
  const documentRepository = new DocumentRepository();

  console.log('=== EmbeddingService Demo ===\n');

  // 1. Generate single embedding with PII protection
  console.log('1. Generating embedding with PII protection...');
  try {
    const result = await embeddingService.generateEmbedding({
      text: 'Contact our support team at support@example.com or call 555-123-4567 for assistance.',
      merchantId: 'demo-merchant-123',
    });

    console.log('✓ Original text:', result.originalText);
    console.log('✓ Sanitized text:', result.sanitizedText);
    console.log('✓ Embedding dimensions:', result.embedding.length);
    console.log('✓ Processing time:', result.processingTime, 'ms');
    console.log('✓ PII tokens found:', result.tokenMap?.size || 0);
    console.log();
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // 2. Generate batch embeddings
  console.log('2. Generating batch embeddings...');
  try {
    const batchResult = await embeddingService.generateBatchEmbeddings({
      texts: [
        'Product description for SKU-001: High-quality wireless headphones',
        'FAQ: How to return items? Contact us at returns@store.com',
        'Policy: We protect your privacy and never share your email address',
      ],
      merchantId: 'demo-merchant-123',
      batchSize: 2,
    });

    console.log('✓ Total texts processed:', batchResult.results.length);
    console.log('✓ Success count:', batchResult.successCount);
    console.log('✓ Failure count:', batchResult.failureCount);
    console.log('✓ Total processing time:', batchResult.totalProcessingTime, 'ms');
    console.log();
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // 3. Update document embedding
  console.log('3. Updating document embedding...');
  try {
    // Create a sample document
    const sampleDocument = new Document({
      id: '550e8400-e29b-41d4-a716-446655440000',
      merchantId: 'demo-merchant-123',
      title: 'Wireless Bluetooth Headphones',
      body: 'Premium quality wireless headphones with noise cancellation. Perfect for music lovers and professionals.',
      sku: 'WBH-001',
      documentType: 'product',
    });

    // This would normally be saved to the database first
    // await documentRepository.create(sampleDocument);

    // Update the document's embedding
    await embeddingService.updateDocumentEmbedding({
      documentId: sampleDocument.id,
      merchantId: sampleDocument.merchantId,
      forceRegenerate: true,
    });

    console.log('✓ Document embedding updated successfully');
    console.log();
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // 4. Get embedding statistics
  console.log('4. Getting embedding statistics...');
  try {
    const stats = await embeddingService.getEmbeddingStats('demo-merchant-123');
    
    console.log('✓ Total documents:', stats.totalDocuments);
    console.log('✓ Documents with embeddings:', stats.documentsWithEmbeddings);
    console.log('✓ Documents without embeddings:', stats.documentsWithoutEmbeddings);
    console.log('✓ Embedding coverage:', stats.embeddingCoverage.toFixed(2) + '%');
    console.log('✓ Average embedding dimensions:', stats.averageEmbeddingDimensions);
    console.log();
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // 5. Health check
  console.log('5. Performing health check...');
  try {
    const health = await embeddingService.healthCheck();
    
    console.log('✓ MindsDB service:', health.mindsdb ? '✓ Healthy' : '✗ Unhealthy');
    console.log('✓ PII Redactor:', health.piiRedactor ? '✓ Healthy' : '✗ Unhealthy');
    console.log('✓ Document Repository:', health.documentRepository ? '✓ Healthy' : '✗ Unhealthy');
    console.log('✓ Cache Service:', health.cache ? '✓ Healthy' : '✗ Unhealthy');
    console.log();
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // 6. Available models
  console.log('6. Available embedding models:');
  const models = embeddingService.getAvailableModels();
  models.forEach((model, index) => {
    console.log(`   ${index + 1}. ${model}`);
  });
  console.log();

  console.log('=== Demo Complete ===');
}

// Example of batch processing documents for a merchant
async function batchProcessMerchantDocuments() {
  const embeddingService = getEmbeddingService();

  console.log('=== Batch Processing Demo ===\n');

  try {
    const result = await embeddingService.processDocumentsForMerchant(
      'demo-merchant-123',
      {
        forceRegenerate: false, // Only process documents without embeddings
        batchSize: 5,
        concurrency: 3,
        documentType: 'product', // Only process product documents
      }
    );

    console.log('✓ Documents processed:', result.processedCount);
    console.log('✓ Successful updates:', result.successCount);
    console.log('✓ Failed updates:', result.failureCount);
    
    if (result.errors.length > 0) {
      console.log('✗ Errors:');
      result.errors.forEach(error => {
        console.log(`   - Document ${error.documentId}: ${error.error}`);
      });
    }
  } catch (error) {
    console.error('✗ Error:', error);
  }

  console.log('\n=== Batch Processing Complete ===');
}

// Export functions for use in other examples
export {
  demonstrateEmbeddingService,
  batchProcessMerchantDocuments,
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateEmbeddingService()
    .then(() => batchProcessMerchantDocuments())
    .catch(console.error);
}