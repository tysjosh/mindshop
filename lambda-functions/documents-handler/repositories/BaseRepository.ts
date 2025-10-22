import { db } from '../database/connection';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../database/schema';

export abstract class BaseRepository {
  protected db: PostgresJsDatabase<typeof schema>;

  constructor() {
    this.db = db;
  }

  protected validateMerchantId(merchantId: string): void {
    if (!merchantId || typeof merchantId !== 'string') {
      throw new Error('Invalid merchant ID provided');
    }
  }

  protected validateUUID(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new Error('Invalid UUID format');
    }
  }
}