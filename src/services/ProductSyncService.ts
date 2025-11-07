import * as crypto from 'crypto';
import axios from 'axios';
import { getDocumentRepository } from '../repositories/DocumentRepository';
import { getMerchantRepository } from '../repositories/MerchantRepository';
import { getCacheService } from './CacheService';
import { getDocumentIngestionService } from './DocumentIngestionService';
import { Document } from '../models';
import type { Document as DocumentSchema } from '../database/schema';

export interface SyncConfiguration {
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  schedule?: 'hourly' | 'daily' | 'weekly';
  source?: {
    type: 'api' | 'ftp' | 's3' | 'upload';
    url?: string;
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
    };
  };
  fieldMapping: {
    sku: string;
    title: string;
    description: string;
    price?: string;
    imageUrl?: string;
    category?: string;
    [key: string]: string | undefined;
  };
  incrementalSync: boolean;
  webhookSecret?: string;
}

export interface SyncResult {
  syncId: string;
  merchantId: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: Date;
  completedAt: Date;
  stats: {
    totalProducts: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  errors?: Array<{
    sku?: string;
    error: string;
  }>;
}

export interface ProductData {
  sku: string;
  title: string;
  description: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface SyncStatus {
  merchantId: string;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  status: 'idle' | 'syncing' | 'error';
  lastSyncResult?: SyncResult;
  configuration?: SyncConfiguration;
}

/**
 * ProductSyncService handles automated product synchronization from various sources
 * including scheduled syncs, webhook listeners, and manual uploads
 */
export class ProductSyncService {
  private documentRepository = getDocumentRepository();
  private merchantRepository = getMerchantRepository();
  private cacheService = getCacheService();
  private documentIngestionService = getDocumentIngestionService();

  // Cache TTL for sync status (5 minutes)
  private readonly SYNC_STATUS_TTL = 300;

  // Maximum products to process in a single batch
  private readonly BATCH_SIZE = 100;

  /**
   * Configure product sync for a merchant
   */
  async configureSync(config: SyncConfiguration): Promise<void> {
    // Validate configuration
    this.validateSyncConfiguration(config);

    // Store configuration in merchant settings
    const cacheKey = `sync:config:${config.merchantId}`;
    await this.cacheService.set(cacheKey, config, 0); // No expiration

    // If scheduled sync, set up next sync time
    if (config.syncType === 'scheduled' && config.schedule) {
      const nextSyncAt = this.calculateNextSyncTime(config.schedule);
      await this.cacheService.set(
        `sync:next:${config.merchantId}`,
        nextSyncAt.toISOString(),
        0
      );
    }

    console.log(`Product sync configured for merchant ${config.merchantId}`);
  }

  /**
   * Get sync configuration for a merchant
   */
  async getSyncConfiguration(merchantId: string): Promise<SyncConfiguration | null> {
    const cacheKey = `sync:config:${merchantId}`;
    return await this.cacheService.get<SyncConfiguration>(cacheKey);
  }

  /**
   * Get sync status for a merchant
   */
  async getSyncStatus(merchantId: string): Promise<SyncStatus> {
    const config = await this.getSyncConfiguration(merchantId);
    const lastSyncResult = await this.getLastSyncResult(merchantId);
    const nextSyncAt = await this.getNextSyncTime(merchantId);
    const currentStatus = await this.getCurrentSyncStatus(merchantId);

    return {
      merchantId,
      lastSyncAt: lastSyncResult?.completedAt,
      nextSyncAt,
      status: currentStatus,
      lastSyncResult: lastSyncResult || undefined,
      configuration: config || undefined,
    };
  }

  /**
   * Trigger a manual sync
   */
  async triggerSync(merchantId: string): Promise<SyncResult> {
    const config = await this.getSyncConfiguration(merchantId);
    if (!config) {
      throw new Error('Sync configuration not found for merchant');
    }

    // Check if sync is already in progress
    const currentStatus = await this.getCurrentSyncStatus(merchantId);
    if (currentStatus === 'syncing') {
      throw new Error('Sync already in progress');
    }

    // Mark sync as in progress
    await this.setCurrentSyncStatus(merchantId, 'syncing');

    try {
      // Fetch products from source
      const products = await this.fetchProductsFromSource(config);

      // Process products
      const result = await this.processProducts(merchantId, products, config);

      // Store sync result
      await this.storeSyncResult(merchantId, result);

      // Update next sync time if scheduled
      if (config.syncType === 'scheduled' && config.schedule) {
        const nextSyncAt = this.calculateNextSyncTime(config.schedule);
        await this.cacheService.set(
          `sync:next:${merchantId}`,
          nextSyncAt.toISOString(),
          0
        );
      }

      // Mark sync as complete
      await this.setCurrentSyncStatus(merchantId, 'idle');

      return result;
    } catch (error: any) {
      // Mark sync as error
      await this.setCurrentSyncStatus(merchantId, 'error');

      const errorResult: SyncResult = {
        syncId: this.generateSyncId(),
        merchantId,
        status: 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
        stats: {
          totalProducts: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        },
        errors: [{ error: error.message }],
      };

      await this.storeSyncResult(merchantId, errorResult);
      throw error;
    }
  }

  /**
   * Process webhook event from merchant's e-commerce platform
   */
  async processWebhookEvent(
    merchantId: string,
    payload: any,
    signature?: string
  ): Promise<void> {
    const config = await this.getSyncConfiguration(merchantId);
    if (!config) {
      throw new Error('Sync configuration not found for merchant');
    }

    // Verify webhook signature if configured
    if (config.webhookSecret && signature) {
      const isValid = this.verifyWebhookSignature(payload, signature, config.webhookSecret);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Extract product data from webhook payload
    const productData = this.extractProductDataFromWebhook(payload, config.fieldMapping);

    // Process single product update
    await this.processSingleProduct(merchantId, productData, config);

    console.log(`Webhook processed for merchant ${merchantId}, SKU: ${productData.sku}`);
  }

  /**
   * Process CSV file upload
   */
  async processCsvUpload(
    merchantId: string,
    csvContent: string,
    fieldMapping: SyncConfiguration['fieldMapping']
  ): Promise<SyncResult> {
    const syncId = this.generateSyncId();
    const startedAt = new Date();

    try {
      // Parse CSV manually (simple implementation)
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const records = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        return record;
      });

      // Map CSV fields to product data
      const products: ProductData[] = records.map((record: any) => ({
        sku: record[fieldMapping.sku],
        title: record[fieldMapping.title],
        description: record[fieldMapping.description],
        price: fieldMapping.price ? parseFloat(record[fieldMapping.price]) : undefined,
        imageUrl: fieldMapping.imageUrl ? record[fieldMapping.imageUrl] : undefined,
        category: fieldMapping.category ? record[fieldMapping.category] : undefined,
        metadata: record,
      }));

      // Process products
      const config: SyncConfiguration = {
        merchantId,
        syncType: 'manual',
        fieldMapping,
        incrementalSync: false,
      };

      const result = await this.processProducts(merchantId, products, config);
      await this.storeSyncResult(merchantId, result);

      return result;
    } catch (error: any) {
      const errorResult: SyncResult = {
        syncId,
        merchantId,
        status: 'failed',
        startedAt,
        completedAt: new Date(),
        stats: {
          totalProducts: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        },
        errors: [{ error: error.message }],
      };

      await this.storeSyncResult(merchantId, errorResult);
      throw error;
    }
  }

  /**
   * Process JSON file upload
   */
  async processJsonUpload(
    merchantId: string,
    jsonContent: string,
    fieldMapping: SyncConfiguration['fieldMapping']
  ): Promise<SyncResult> {
    const syncId = this.generateSyncId();
    const startedAt = new Date();

    try {
      // Parse JSON
      const data = JSON.parse(jsonContent);
      const records = Array.isArray(data) ? data : [data];

      // Map JSON fields to product data
      const products: ProductData[] = records.map((record: any) => ({
        sku: this.getNestedValue(record, fieldMapping.sku),
        title: this.getNestedValue(record, fieldMapping.title),
        description: this.getNestedValue(record, fieldMapping.description),
        price: fieldMapping.price
          ? parseFloat(this.getNestedValue(record, fieldMapping.price))
          : undefined,
        imageUrl: fieldMapping.imageUrl
          ? this.getNestedValue(record, fieldMapping.imageUrl)
          : undefined,
        category: fieldMapping.category
          ? this.getNestedValue(record, fieldMapping.category)
          : undefined,
        metadata: record,
      }));

      // Process products
      const config: SyncConfiguration = {
        merchantId,
        syncType: 'manual',
        fieldMapping,
        incrementalSync: false,
      };

      const result = await this.processProducts(merchantId, products, config);
      await this.storeSyncResult(merchantId, result);

      return result;
    } catch (error: any) {
      const errorResult: SyncResult = {
        syncId,
        merchantId,
        status: 'failed',
        startedAt,
        completedAt: new Date(),
        stats: {
          totalProducts: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        },
        errors: [{ error: error.message }],
      };

      await this.storeSyncResult(merchantId, errorResult);
      throw error;
    }
  }

  /**
   * Get sync history for a merchant
   */
  async getSyncHistory(
    merchantId: string,
    limit: number = 10
  ): Promise<SyncResult[]> {
    const cacheKey = `sync:history:${merchantId}`;
    const history = await this.cacheService.get<SyncResult[]>(cacheKey);
    
    if (!history) {
      return [];
    }

    return history.slice(0, limit);
  }

  /**
   * Fetch products from configured source
   */
  private async fetchProductsFromSource(
    config: SyncConfiguration
  ): Promise<ProductData[]> {
    if (!config.source) {
      throw new Error('No source configured for sync');
    }

    switch (config.source.type) {
      case 'api':
        return await this.fetchFromApi(config);
      case 's3':
        return await this.fetchFromS3(config);
      case 'ftp':
        throw new Error('FTP sync not yet implemented');
      default:
        throw new Error(`Unsupported source type: ${config.source.type}`);
    }
  }

  /**
   * Fetch products from API endpoint
   */
  private async fetchFromApi(config: SyncConfiguration): Promise<ProductData[]> {
    if (!config.source?.url) {
      throw new Error('API URL not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication if configured
    if (config.source.credentials?.apiKey) {
      headers['Authorization'] = `Bearer ${config.source.credentials.apiKey}`;
    } else if (config.source.credentials?.username && config.source.credentials?.password) {
      const auth = Buffer.from(
        `${config.source.credentials.username}:${config.source.credentials.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await axios.get(config.source.url, {
      headers,
      timeout: 30000, // 30 seconds
    });

    const data = response.data;
    const records = Array.isArray(data) ? data : data.products || data.items || [data];

    // Map API response to product data
    return records.map((record: any) => ({
      sku: this.getNestedValue(record, config.fieldMapping.sku),
      title: this.getNestedValue(record, config.fieldMapping.title),
      description: this.getNestedValue(record, config.fieldMapping.description),
      price: config.fieldMapping.price
        ? parseFloat(this.getNestedValue(record, config.fieldMapping.price))
        : undefined,
      imageUrl: config.fieldMapping.imageUrl
        ? this.getNestedValue(record, config.fieldMapping.imageUrl)
        : undefined,
      category: config.fieldMapping.category
        ? this.getNestedValue(record, config.fieldMapping.category)
        : undefined,
      metadata: record,
    }));
  }

  /**
   * Fetch products from S3
   */
  private async fetchFromS3(config: SyncConfiguration): Promise<ProductData[]> {
    // This would integrate with S3 to fetch product files
    // For now, throw not implemented
    throw new Error('S3 sync not yet implemented');
  }

  /**
   * Process multiple products
   */
  private async processProducts(
    merchantId: string,
    products: ProductData[],
    config: SyncConfiguration
  ): Promise<SyncResult> {
    const syncId = this.generateSyncId();
    const startedAt = new Date();
    const stats = {
      totalProducts: products.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    const errors: Array<{ sku?: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < products.length; i += this.BATCH_SIZE) {
      const batch = products.slice(i, i + this.BATCH_SIZE);

      for (const product of batch) {
        try {
          const result = await this.processSingleProduct(merchantId, product, config);
          
          if (result === 'created') {
            stats.created++;
          } else if (result === 'updated') {
            stats.updated++;
          } else if (result === 'skipped') {
            stats.skipped++;
          }
        } catch (error: any) {
          stats.failed++;
          errors.push({
            sku: product.sku,
            error: error.message,
          });
          console.error(`Failed to process product ${product.sku}:`, error);
        }
      }
    }

    const status: SyncResult['status'] =
      stats.failed === 0 ? 'success' : stats.failed < stats.totalProducts ? 'partial' : 'failed';

    return {
      syncId,
      merchantId,
      status,
      startedAt,
      completedAt: new Date(),
      stats,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Process a single product
   */
  private async processSingleProduct(
    merchantId: string,
    product: ProductData,
    config: SyncConfiguration
  ): Promise<'created' | 'updated' | 'skipped'> {
    // Validate product data
    if (!product.sku || !product.title || !product.description) {
      throw new Error('Missing required product fields: sku, title, or description');
    }

    // Check if product already exists (findBySku returns an array)
    const existingDocs = await this.documentRepository.findBySku(product.sku, merchantId);
    const existingDoc = existingDocs.length > 0 ? existingDocs[0] : null;

    if (existingDoc) {
      // Incremental sync: check if product has changed
      if (config.incrementalSync) {
        const hasChanged = this.hasProductChanged(existingDoc, product);
        if (!hasChanged) {
          return 'skipped';
        }
      }

      // Update existing document - create new Document instance
      const updatedDoc = new Document({
        id: existingDoc.id,
        merchantId: existingDoc.merchantId,
        sku: existingDoc.sku,
        title: product.title,
        body: product.description,
        documentType: existingDoc.documentType,
        embedding: existingDoc.embedding,
        metadata: {
          ...existingDoc.metadata,
          price: product.price,
          imageUrl: product.imageUrl,
          category: product.category,
          lastSyncedAt: new Date().toISOString(),
          ...product.metadata,
        },
        createdAt: existingDoc.createdAt,
        updatedAt: new Date(),
      });

      await this.documentRepository.update(updatedDoc);

      return 'updated';
    } else {
      // Create new document
      const { v4: uuidv4 } = require('uuid');
      
      const newDoc = new Document({
        id: uuidv4(),
        merchantId,
        sku: product.sku || '',
        title: product.title,
        body: product.description,
        documentType: 'product',
        metadata: {
          price: product.price,
          imageUrl: product.imageUrl,
          category: product.category,
          lastSyncedAt: new Date().toISOString(),
          ...product.metadata,
        },
        embedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.documentRepository.create(newDoc);

      return 'created';
    }
  }

  /**
   * Check if product has changed (for incremental sync)
   */
  private hasProductChanged(existingDoc: Document, newProduct: ProductData): boolean {
    // Compare key fields
    if (existingDoc.title !== newProduct.title) return true;
    if (existingDoc.body !== newProduct.description) return true;

    // Compare metadata fields
    const metadata = existingDoc.metadata as any;
    const existingPrice = metadata?.price;
    const existingImageUrl = metadata?.imageUrl;
    const existingCategory = metadata?.category;

    if (existingPrice !== newProduct.price) return true;
    if (existingImageUrl !== newProduct.imageUrl) return true;
    if (existingCategory !== newProduct.category) return true;

    return false;
  }

  /**
   * Extract product data from webhook payload
   */
  private extractProductDataFromWebhook(
    payload: any,
    fieldMapping: SyncConfiguration['fieldMapping']
  ): ProductData {
    return {
      sku: this.getNestedValue(payload, fieldMapping.sku),
      title: this.getNestedValue(payload, fieldMapping.title),
      description: this.getNestedValue(payload, fieldMapping.description),
      price: fieldMapping.price
        ? parseFloat(this.getNestedValue(payload, fieldMapping.price))
        : undefined,
      imageUrl: fieldMapping.imageUrl
        ? this.getNestedValue(payload, fieldMapping.imageUrl)
        : undefined,
      category: fieldMapping.category
        ? this.getNestedValue(payload, fieldMapping.category)
        : undefined,
      metadata: payload,
    };
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(
    payload: any,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Validate sync configuration
   */
  private validateSyncConfiguration(config: SyncConfiguration): void {
    if (!config.merchantId) {
      throw new Error('merchantId is required');
    }

    if (!config.syncType) {
      throw new Error('syncType is required');
    }

    if (config.syncType === 'scheduled' && !config.schedule) {
      throw new Error('schedule is required for scheduled sync');
    }

    if (config.syncType === 'webhook' && !config.webhookSecret) {
      throw new Error('webhookSecret is required for webhook sync');
    }

    if (!config.fieldMapping) {
      throw new Error('fieldMapping is required');
    }

    if (!config.fieldMapping.sku || !config.fieldMapping.title || !config.fieldMapping.description) {
      throw new Error('fieldMapping must include sku, title, and description');
    }
  }

  /**
   * Calculate next sync time based on schedule
   */
  private calculateNextSyncTime(schedule: 'hourly' | 'daily' | 'weekly'): Date {
    const now = new Date();

    switch (schedule) {
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to daily
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `sync_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get current sync status
   */
  private async getCurrentSyncStatus(
    merchantId: string
  ): Promise<'idle' | 'syncing' | 'error'> {
    const cacheKey = `sync:status:${merchantId}`;
    const status = await this.cacheService.get<string>(cacheKey);
    return (status as 'idle' | 'syncing' | 'error') || 'idle';
  }

  /**
   * Set current sync status
   */
  private async setCurrentSyncStatus(
    merchantId: string,
    status: 'idle' | 'syncing' | 'error'
  ): Promise<void> {
    const cacheKey = `sync:status:${merchantId}`;
    await this.cacheService.set(cacheKey, status, this.SYNC_STATUS_TTL);
  }

  /**
   * Get last sync result
   */
  private async getLastSyncResult(merchantId: string): Promise<SyncResult | null> {
    const cacheKey = `sync:last:${merchantId}`;
    return await this.cacheService.get<SyncResult>(cacheKey);
  }

  /**
   * Store sync result
   */
  private async storeSyncResult(merchantId: string, result: SyncResult): Promise<void> {
    // Store last sync result
    const lastSyncKey = `sync:last:${merchantId}`;
    await this.cacheService.set(lastSyncKey, result, 0); // No expiration

    // Add to sync history
    const historyKey = `sync:history:${merchantId}`;
    const history = (await this.cacheService.get<SyncResult[]>(historyKey)) || [];
    history.unshift(result);

    // Keep only last 100 sync results
    if (history.length > 100) {
      history.splice(100);
    }

    await this.cacheService.set(historyKey, history, 0); // No expiration
  }

  /**
   * Get next sync time
   */
  private async getNextSyncTime(merchantId: string): Promise<Date | undefined> {
    const cacheKey = `sync:next:${merchantId}`;
    const nextSyncStr = await this.cacheService.get<string>(cacheKey);
    return nextSyncStr ? new Date(nextSyncStr) : undefined;
  }

  /**
   * Process scheduled syncs (to be called by a background job)
   */
  async processScheduledSyncs(): Promise<void> {
    // This would be called by a cron job or background worker
    // to process all merchants with scheduled syncs that are due
    console.log('Processing scheduled syncs...');
    
    // Implementation would:
    // 1. Query all merchants with scheduled sync enabled
    // 2. Check if next sync time has passed
    // 3. Trigger sync for each merchant
    // 4. Update next sync time
  }
}

// Export singleton instance
let productSyncServiceInstance: ProductSyncService | null = null;

export const getProductSyncService = (): ProductSyncService => {
  if (!productSyncServiceInstance) {
    productSyncServiceInstance = new ProductSyncService();
  }
  return productSyncServiceInstance;
};
