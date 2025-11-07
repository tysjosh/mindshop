import { BaseRepository } from "./BaseRepository";
import { merchantSettings, type MerchantSettings, type NewMerchantSettings } from "../database/schema";
import { eq } from "drizzle-orm";

export class MerchantSettingsRepository extends BaseRepository {
  async create(data: NewMerchantSettings): Promise<MerchantSettings> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(merchantSettings)
      .values(data)
      .returning();

    return result;
  }

  async findByMerchantId(merchantId: string): Promise<MerchantSettings | null> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(merchantSettings)
      .where(eq(merchantSettings.merchantId, merchantId))
      .limit(1);

    return result[0] || null;
  }

  async update(merchantId: string, settings: Record<string, any>): Promise<MerchantSettings> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchantSettings)
      .set({
        settings,
        updatedAt: new Date(),
      })
      .where(eq(merchantSettings.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant settings not found");
    }

    return result;
  }

  async updatePartial(merchantId: string, partialSettings: Record<string, any>): Promise<MerchantSettings> {
    this.validateMerchantId(merchantId);

    // Get current settings
    const current = await this.findByMerchantId(merchantId);
    if (!current) {
      throw new Error("Merchant settings not found");
    }

    // Merge with new settings
    const mergedSettings = this.deepMerge(
      current.settings as Record<string, any>,
      partialSettings
    );

    return this.update(merchantId, mergedSettings);
  }

  async delete(merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .delete(merchantSettings)
      .where(eq(merchantSettings.merchantId, merchantId));

    return result.count > 0;
  }

  /**
   * Upsert merchant settings (create if not exists, update if exists)
   */
  async upsert(merchantId: string, settings: Record<string, any>): Promise<MerchantSettings> {
    this.validateMerchantId(merchantId);

    // Check if settings exist
    const existing = await this.findByMerchantId(merchantId);

    if (existing) {
      // Update existing settings
      return this.update(merchantId, settings);
    } else {
      // Create new settings
      return this.create({
        merchantId,
        settings,
      });
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const output = { ...target };

    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }
}

// Export singleton instance
let merchantSettingsRepositoryInstance: MerchantSettingsRepository | null = null;

export const getMerchantSettingsRepository = (): MerchantSettingsRepository => {
  if (!merchantSettingsRepositoryInstance) {
    merchantSettingsRepositoryInstance = new MerchantSettingsRepository();
  }
  return merchantSettingsRepositoryInstance;
};
