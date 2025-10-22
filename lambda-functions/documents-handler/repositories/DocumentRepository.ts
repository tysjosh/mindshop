import { BaseRepository } from "./BaseRepository";
import { Document } from "../models";
import { RetrievalResult } from "../types";
import { documents, type NewDocument } from "../database/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCacheService, CacheService } from "../services/CacheService";
import { createHash } from "crypto";

export class DocumentRepository extends BaseRepository {
  private cacheService: CacheService;

  constructor() {
    super();
    this.cacheService = getCacheService();
  }
  public async create(document: Document): Promise<Document> {
    this.validateMerchantId(document.merchantId);

    const newDocument: NewDocument = {
      id: document.id,
      merchantId: document.merchantId,
      sku: document.sku,
      title: document.title,
      body: document.body,
      metadata: document.metadata,
      embedding: document.embedding,
      documentType: document.documentType,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };

    const [result] = await this.db
      .insert(documents)
      .values(newDocument)
      .returning();
    return this.mapRowToDocument(result);
  }

  public async findById(
    id: string,
    merchantId: string,
    useCache: boolean = true
  ): Promise<Document | null> {
    this.validateMerchantId(merchantId);
    this.validateUUID(id);

    const cacheKey = `document:${merchantId}:${id}`;

    // Try cache first
    if (useCache) {
      const cached = await this.cacheService.get<Document>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.merchantId, merchantId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const document = this.mapRowToDocument(result[0]);

    // Cache for 1 hour
    if (useCache) {
      await this.cacheService.set(cacheKey, document, 3600);
    }

    return document;
  }

  public async findByMerchant(
    merchantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Document[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(documents)
      .where(eq(documents.merchantId, merchantId))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset);

    return result.map(this.mapRowToDocument);
  }

  public async findBySku(
    sku: string,
    merchantId: string,
    useCache: boolean = true
  ): Promise<Document[]> {
    this.validateMerchantId(merchantId);

    const cacheKey = `documents:sku:${merchantId}:${sku}`;

    // Try cache first
    if (useCache) {
      const cached = await this.cacheService.get<Document[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.sku, sku), eq(documents.merchantId, merchantId)))
      .orderBy(desc(documents.updatedAt));

    const documentList = result.map(this.mapRowToDocument);

    // Cache for 30 minutes
    if (useCache && documentList.length > 0) {
      await this.cacheService.set(cacheKey, documentList, 1800);
    }

    return documentList;
  }

  public async vectorSearch(
    embedding: number[],
    merchantId: string,
    limit: number = 5,
    threshold: number = 0.7,
    useCache: boolean = true
  ): Promise<RetrievalResult[]> {
    this.validateMerchantId(merchantId);

    // Generate cache key based on embedding, merchant, and parameters
    const cacheKey = this.generateVectorSearchCacheKey(
      embedding,
      merchantId,
      limit,
      threshold
    );

    // Try to get from cache first
    if (useCache) {
      const cachedResults =
        await this.cacheService.get<RetrievalResult[]>(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }
    }

    // Use the optimized PostgreSQL function for vector search
    const result = await this.db.execute(sql`
      SELECT id, title, body, sku, document_type, metadata, similarity_score, created_at
      FROM search_similar_documents(
        ${JSON.stringify(embedding)}::vector(1536),
        ${merchantId},
        ${threshold},
        ${limit}
      )
    `);

    const retrievalResults = result.map((row: any) => ({
      id: row.id,
      snippet: this.extractSnippet(row.body),
      score: parseFloat(row.similarity_score),
      metadata: {
        sku: row.sku,
        merchantId: merchantId,
        documentType: row.document_type,
        sourceUri: (row.metadata as any)?.source_uri,
      },
      groundingPass: parseFloat(row.similarity_score) > threshold,
    }));

    // Cache the results for 30 minutes (1800 seconds)
    if (useCache && retrievalResults.length > 0) {
      await this.cacheService.set(cacheKey, retrievalResults, 1800);
    }

    return retrievalResults;
  }

  /**
   * Enhanced vector search with stale-while-revalidate caching pattern
   */
  public async vectorSearchWithStaleCache(
    embedding: number[],
    merchantId: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<RetrievalResult[]> {
    this.validateMerchantId(merchantId);

    const cacheKey = this.generateVectorSearchCacheKey(
      embedding,
      merchantId,
      limit,
      threshold
    );

    // Use stale-while-revalidate pattern for sub-10ms response times
    const results = await this.cacheService.getWithStaleWhileRevalidate<
      RetrievalResult[]
    >(cacheKey, {
      staleTTL: 1800, // 30 minutes
      gracePeriod: 300, // 5 minutes grace period
      revalidateCallback: async () => {
        return this.vectorSearch(
          embedding,
          merchantId,
          limit,
          threshold,
          false
        );
      },
    });

    // If no cached results, perform fresh search
    if (!results) {
      return this.vectorSearch(embedding, merchantId, limit, threshold, true);
    }

    return results;
  }

  /**
   * Batch vector search for multiple queries
   */
  public async batchVectorSearch(
    queries: Array<{
      embedding: number[];
      merchantId: string;
      limit?: number;
      threshold?: number;
    }>
  ): Promise<RetrievalResult[][]> {
    const results = await Promise.all(
      queries.map((query) =>
        this.vectorSearchWithStaleCache(
          query.embedding,
          query.merchantId,
          query.limit || 5,
          query.threshold || 0.7
        )
      )
    );

    return results;
  }

  public async update(document: Document): Promise<Document> {
    this.validateMerchantId(document.merchantId);
    this.validateUUID(document.id);

    const [result] = await this.db
      .update(documents)
      .set({
        sku: document.sku,
        title: document.title,
        body: document.body,
        metadata: document.metadata,
        embedding: document.embedding,
        documentType: document.documentType,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.id, document.id),
          eq(documents.merchantId, document.merchantId)
        )
      )
      .returning();

    if (!result) {
      throw new Error("Document not found or access denied");
    }

    const updatedDocument = this.mapRowToDocument(result);

    // Invalidate related caches
    await this.invalidateDocumentCaches(
      document.id,
      document.merchantId,
      document.sku
    );

    return updatedDocument;
  }

  public async delete(id: string, merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);
    this.validateUUID(id);

    // Get document info before deletion for cache invalidation
    const existingDoc = await this.findById(id, merchantId, false);

    const result = await this.db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.merchantId, merchantId)));

    const deleted = result.count > 0;

    if (deleted && existingDoc) {
      // Invalidate related caches
      await this.invalidateDocumentCaches(id, merchantId, existingDoc.sku);
    }

    return deleted;
  }

  public async updateEmbedding(
    id: string,
    merchantId: string,
    embedding: number[]
  ): Promise<void> {
    this.validateMerchantId(merchantId);
    this.validateUUID(id);

    await this.db
      .update(documents)
      .set({
        embedding: embedding,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.merchantId, merchantId)));
  }

  public async batchUpdateEmbeddings(
    updates: Array<{ id: string; merchantId: string; embedding: number[] }>
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const update of updates) {
        this.validateMerchantId(update.merchantId);
        this.validateUUID(update.id);

        await tx
          .update(documents)
          .set({
            embedding: update.embedding,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(documents.id, update.id),
              eq(documents.merchantId, update.merchantId)
            )
          );
      }
    });
  }

  private mapRowToDocument(row: any): Document {
    return new Document({
      id: row.id,
      merchantId: row.merchantId,
      sku: row.sku,
      title: row.title,
      body: row.body,
      metadata: row.metadata || {},
      embedding: row.embedding || [],
      documentType: row.documentType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private extractSnippet(body: string, maxLength: number = 200): string {
    if (body.length <= maxLength) {
      return body;
    }

    const snippet = body.substring(0, maxLength);
    const lastSpace = snippet.lastIndexOf(" ");

    return lastSpace > 0
      ? snippet.substring(0, lastSpace) + "..."
      : snippet + "...";
  }

  /**
   * Generate cache key for vector search results
   */
  private generateVectorSearchCacheKey(
    embedding: number[],
    merchantId: string,
    limit: number,
    threshold: number
  ): string {
    const embeddingHash = createHash("sha256")
      .update(JSON.stringify(embedding))
      .digest("hex")
      .substring(0, 16); // Use first 16 chars for brevity

    return `vector_search:${merchantId}:${embeddingHash}:${limit}:${threshold}`;
  }

  /**
   * Invalidate all caches related to a document
   */
  private async invalidateDocumentCaches(
    documentId: string,
    merchantId: string,
    sku?: string
  ): Promise<void> {
    const invalidationPromises: Promise<any>[] = [];

    // Invalidate document by ID cache
    invalidationPromises.push(
      this.cacheService.invalidateByPattern(
        `document:${merchantId}:${documentId}`
      )
    );

    // Invalidate SKU-based caches if SKU exists
    if (sku) {
      invalidationPromises.push(
        this.cacheService.invalidateByPattern(
          `documents:sku:${merchantId}:${sku}`
        )
      );
    }

    // Invalidate vector search caches for this merchant
    invalidationPromises.push(
      this.cacheService.invalidateByPattern(`vector_search:${merchantId}:*`)
    );

    // Invalidate merchant document list caches
    invalidationPromises.push(
      this.cacheService.invalidateByPattern(
        `documents:merchant:${merchantId}:*`
      )
    );

    await Promise.all(invalidationPromises);
  }

  /**
   * Get document statistics with caching
   */
  public async getDocumentStats(merchantId: string): Promise<{
    totalDocuments: number;
    documentsByType: Record<string, number>;
    recentDocuments: number;
    avgWordCount: number;
  }> {
    this.validateMerchantId(merchantId);

    const cacheKey = `stats:${merchantId}`;

    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query the materialized view
    const result = await this.db.execute(sql`
      SELECT 
        SUM(document_count) as total_documents,
        json_object_agg(document_type, document_count) as documents_by_type,
        SUM(recent_documents) as recent_documents,
        AVG(avg_word_count) as avg_word_count
      FROM document_stats 
      WHERE merchant_id = ${merchantId}
    `);

    const stats = {
      totalDocuments: parseInt(String(result[0]?.total_documents || "0")),
      documentsByType: (result[0]?.documents_by_type as Record<string, number>) || {},
      recentDocuments: parseInt(String(result[0]?.recent_documents || "0")),
      avgWordCount: parseFloat(String(result[0]?.avg_word_count || "0")),
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, stats, 300);

    return stats;
  }

  /**
   * Batch operations with optimized caching
   */
  public async batchCreate(documentsToCreate: Document[]): Promise<Document[]> {
    if (documentsToCreate.length === 0) return [];

    // Validate all merchant IDs
    documentsToCreate.forEach((doc) => this.validateMerchantId(doc.merchantId));

    const newDocuments: NewDocument[] = documentsToCreate.map((doc) => ({
      id: doc.id,
      merchantId: doc.merchantId,
      sku: doc.sku,
      title: doc.title,
      body: doc.body,
      metadata: doc.metadata,
      embedding: doc.embedding,
      documentType: doc.documentType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    const results = await this.db
      .insert(documents)
      .values(newDocuments)
      .returning();
    const createdDocuments = results.map(this.mapRowToDocument);

    // Invalidate relevant caches for all affected merchants
    const merchantIds = [...new Set(documentsToCreate.map((doc) => doc.merchantId))];
    await Promise.all(
      merchantIds.map((merchantId) =>
        this.cacheService.invalidateByPattern(`*:${merchantId}:*`)
      )
    );

    return createdDocuments;
  }

  /**
   * Health check for the repository
   */
  public async healthCheck(): Promise<{
    database: boolean;
    cache: boolean;
    vectorIndex: boolean;
  }> {
    const health = {
      database: false,
      cache: false,
      vectorIndex: false,
    };

    try {
      // Test database connection
      await this.db.execute(sql`SELECT 1`);
      health.database = true;
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    try {
      // Test cache connection
      health.cache = await this.cacheService.healthCheck();
    } catch (error) {
      console.error("Cache health check failed:", error);
    }

    try {
      // Test vector index by running a simple query
      await this.db.execute(sql`
        SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL LIMIT 1
      `);
      health.vectorIndex = true;
    } catch (error) {
      console.error("Vector index health check failed:", error);
    }

    return health;
  }
}

// Export singleton instance
let documentRepositoryInstance: DocumentRepository | null = null;

export const getDocumentRepository = (): DocumentRepository => {
  if (!documentRepositoryInstance) {
    documentRepositoryInstance = new DocumentRepository();
  }
  return documentRepositoryInstance;
};