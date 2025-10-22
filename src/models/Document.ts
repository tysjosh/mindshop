import { Document as IDocument } from '../types';

export class Document implements IDocument {
  public id: string;
  public merchantId: string;
  public sku?: string;
  public title: string;
  public body: string;
  public metadata: Record<string, any>;
  public embedding: number[];
  public documentType: 'product' | 'faq' | 'policy' | 'review';
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<IDocument> & { id: string; merchantId: string; title: string; body: string }) {
    this.id = data.id;
    this.merchantId = data.merchantId;
    this.sku = data.sku;
    this.title = data.title;
    this.body = data.body;
    this.metadata = data.metadata || {};
    this.embedding = data.embedding || [];
    this.documentType = data.documentType || 'product';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  public validate(): boolean {
    return !!(
      this.id &&
      this.merchantId &&
      this.title &&
      this.body &&
      this.documentType
    );
  }

  public updateEmbedding(embedding: number[]): void {
    this.embedding = embedding;
    this.updatedAt = new Date();
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }

  public toJSON(): IDocument {
    return {
      id: this.id,
      merchantId: this.merchantId,
      sku: this.sku,
      title: this.title,
      body: this.body,
      metadata: this.metadata,
      embedding: this.embedding,
      documentType: this.documentType,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}