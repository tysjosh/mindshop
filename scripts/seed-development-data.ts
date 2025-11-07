#!/usr/bin/env ts-node

/**
 * Seed Development Data Script
 * 
 * This script populates the database with realistic test data for development.
 * It creates merchants, API keys, documents, sessions, and usage data.
 * 
 * Usage:
 *   npm run seed:dev
 *   or
 *   ts-node scripts/seed-development-data.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple hash function for development (NOT for production use)
function mockHash(value: string): string {
  return `$2b$10$mock_hash_${value.substring(0, 20)}`;
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mindsdb_rag',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const db = drizzle(pool, { schema });

// Helper function to generate random date in the past
function randomPastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

// Helper function to generate random number in range
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedMerchants() {
  console.log('🏢 Seeding merchants...');

  const merchants = [
    {
      merchantId: 'acme_electronics_2024',
      cognitoUserId: 'cognito-user-acme-123',
      email: 'admin@acme-electronics.com',
      companyName: 'ACME Electronics',
      website: 'https://acme-electronics.com',
      industry: 'Electronics',
      status: 'active' as const,
      plan: 'starter' as const,
      verifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      merchantId: 'fashion_hub_2024',
      cognitoUserId: 'cognito-user-fashion-456',
      email: 'contact@fashionhub.com',
      companyName: 'Fashion Hub',
      website: 'https://fashionhub.com',
      industry: 'Fashion & Apparel',
      status: 'active' as const,
      plan: 'professional' as const,
      verifiedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      merchantId: 'tech_store_2024',
      cognitoUserId: 'cognito-user-tech-789',
      email: 'support@techstore.com',
      companyName: 'Tech Store Pro',
      website: 'https://techstore.com',
      industry: 'Technology',
      status: 'active' as const,
      plan: 'enterprise' as const,
      verifiedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      merchantId: 'new_shop_2024',
      cognitoUserId: 'cognito-user-newshop-101',
      email: 'hello@newshop.com',
      companyName: 'New Shop',
      website: 'https://newshop.com',
      industry: 'General Retail',
      status: 'pending_verification' as const,
      plan: 'starter' as const,
      verifiedAt: null,
    },
  ];

  for (const merchant of merchants) {
    try {
      await db.insert(schema.merchants).values(merchant).onConflictDoNothing();
      console.log(`  ✓ Created merchant: ${merchant.companyName}`);
    } catch (error) {
      console.error(`  ✗ Failed to create merchant ${merchant.companyName}:`, error);
    }
  }
}

async function seedMerchantSettings() {
  console.log('⚙️  Seeding merchant settings...');

  const settings = [
    {
      merchantId: 'acme_electronics_2024',
      settings: {
        widget: {
          theme: {
            primaryColor: '#007bff',
            position: 'bottom-right',
            borderRadius: '8px',
          },
          behavior: {
            autoOpen: false,
            greeting: 'Hi! How can I help you find the perfect electronics today?',
            maxRecommendations: 3,
            showProductImages: true,
          },
        },
        rag: {
          maxResults: 5,
          threshold: 0.7,
          enableSemanticSearch: true,
        },
        notifications: {
          email: true,
          webhook: false,
          usageAlerts: true,
        },
      },
    },
    {
      merchantId: 'fashion_hub_2024',
      settings: {
        widget: {
          theme: {
            primaryColor: '#ff6b9d',
            position: 'bottom-left',
            borderRadius: '12px',
          },
          behavior: {
            autoOpen: true,
            greeting: 'Welcome to Fashion Hub! Looking for something stylish?',
            maxRecommendations: 5,
            showProductImages: true,
          },
        },
        rag: {
          maxResults: 8,
          threshold: 0.65,
          enableSemanticSearch: true,
        },
        notifications: {
          email: true,
          webhook: true,
          usageAlerts: true,
        },
      },
    },
    {
      merchantId: 'tech_store_2024',
      settings: {
        widget: {
          theme: {
            primaryColor: '#00c853',
            position: 'bottom-right',
            borderRadius: '4px',
          },
          behavior: {
            autoOpen: false,
            greeting: 'Tech Store Pro - Your technology expert is here!',
            maxRecommendations: 4,
            showProductImages: true,
          },
        },
        rag: {
          maxResults: 10,
          threshold: 0.75,
          enableSemanticSearch: true,
        },
        notifications: {
          email: true,
          webhook: true,
          usageAlerts: true,
        },
      },
    },
  ];

  for (const setting of settings) {
    try {
      await db.insert(schema.merchantSettings).values(setting).onConflictDoNothing();
      console.log(`  ✓ Created settings for: ${setting.merchantId}`);
    } catch (error) {
      console.error(`  ✗ Failed to create settings for ${setting.merchantId}:`, error);
    }
  }
}

async function seedApiKeys() {
  console.log('🔑 Seeding API keys...');

  // Note: Using mock hashes for development. In production, use proper bcrypt hashing.
  const apiKeys = [
    {
      keyId: 'key_acme_dev_001',
      merchantId: 'acme_electronics_2024',
      name: 'Development Key',
      keyPrefix: 'pk_test_',
      keyHash: mockHash('test_key_acme_dev_12345'),
      environment: 'development' as const,
      permissions: ['chat:read', 'chat:write', 'documents:read', 'documents:write'],
      status: 'active' as const,
      lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    {
      keyId: 'key_acme_prod_001',
      merchantId: 'acme_electronics_2024',
      name: 'Production Key',
      keyPrefix: 'pk_live_',
      keyHash: mockHash('live_key_acme_prod_67890'),
      environment: 'production' as const,
      permissions: ['chat:read', 'chat:write', 'documents:read'],
      status: 'active' as const,
      lastUsedAt: new Date(Date.now() - 30 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    {
      keyId: 'key_fashion_dev_001',
      merchantId: 'fashion_hub_2024',
      name: 'Development Key',
      keyPrefix: 'pk_test_',
      keyHash: mockHash('test_key_fashion_dev_11111'),
      environment: 'development' as const,
      permissions: ['*'],
      status: 'active' as const,
      lastUsedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    {
      keyId: 'key_fashion_prod_001',
      merchantId: 'fashion_hub_2024',
      name: 'Production Key',
      keyPrefix: 'pk_live_',
      keyHash: mockHash('live_key_fashion_prod_22222'),
      environment: 'production' as const,
      permissions: ['*'],
      status: 'active' as const,
      lastUsedAt: new Date(Date.now() - 15 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    {
      keyId: 'key_tech_prod_001',
      merchantId: 'tech_store_2024',
      name: 'Production Key - Website',
      keyPrefix: 'pk_live_',
      keyHash: mockHash('live_key_tech_prod_33333'),
      environment: 'production' as const,
      permissions: ['*'],
      status: 'active' as const,
      lastUsedAt: new Date(Date.now() - 5 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const apiKey of apiKeys) {
    try {
      await db.insert(schema.apiKeys).values(apiKey).onConflictDoNothing();
      console.log(`  ✓ Created API key: ${apiKey.name} for ${apiKey.merchantId}`);
    } catch (error) {
      console.error(`  ✗ Failed to create API key ${apiKey.name}:`, error);
    }
  }
}

async function seedUsageLimits() {
  console.log('📊 Seeding usage limits...');

  const limits = [
    {
      merchantId: 'acme_electronics_2024',
      plan: 'starter' as const,
      queriesPerMonth: 1000,
      documentsMax: 100,
      apiCallsPerDay: 5000,
      storageGbMax: 1,
    },
    {
      merchantId: 'fashion_hub_2024',
      plan: 'professional' as const,
      queriesPerMonth: 10000,
      documentsMax: 1000,
      apiCallsPerDay: 50000,
      storageGbMax: 10,
    },
    {
      merchantId: 'tech_store_2024',
      plan: 'enterprise' as const,
      queriesPerMonth: 999999,
      documentsMax: 999999,
      apiCallsPerDay: 999999,
      storageGbMax: 1000,
    },
    {
      merchantId: 'new_shop_2024',
      plan: 'starter' as const,
      queriesPerMonth: 1000,
      documentsMax: 100,
      apiCallsPerDay: 5000,
      storageGbMax: 1,
    },
  ];

  for (const limit of limits) {
    try {
      await db.insert(schema.usageLimits).values(limit).onConflictDoNothing();
      console.log(`  ✓ Created usage limits for: ${limit.merchantId}`);
    } catch (error) {
      console.error(`  ✗ Failed to create usage limits for ${limit.merchantId}:`, error);
    }
  }
}

async function seedDocuments() {
  console.log('📄 Seeding documents...');

  const documents = [
    // ACME Electronics
    {
      merchantId: 'acme_electronics_2024',
      sku: 'ACME-LAPTOP-001',
      title: 'ACME Pro Laptop 15"',
      body: 'High-performance laptop with Intel i7 processor, 16GB RAM, 512GB SSD. Perfect for professionals and content creators. Features a stunning 15-inch 4K display, backlit keyboard, and all-day battery life.',
      documentType: 'product' as const,
      metadata: { price: 1299.99, category: 'Computers', inStock: true, rating: 4.5, reviews: 127 },
    },
    {
      merchantId: 'acme_electronics_2024',
      sku: 'ACME-PHONE-001',
      title: 'ACME Smartphone X',
      body: 'Latest flagship smartphone with 6.5" OLED display, 128GB storage, triple camera system. 5G enabled with fast charging and wireless charging support.',
      documentType: 'product' as const,
      metadata: { price: 899.99, category: 'Phones', inStock: true, rating: 4.7, reviews: 342 },
    },
    {
      merchantId: 'acme_electronics_2024',
      sku: 'ACME-HEADPHONE-001',
      title: 'ACME Wireless Headphones Pro',
      body: 'Premium noise-cancelling wireless headphones with 30-hour battery life. Superior sound quality with deep bass and crystal-clear highs. Comfortable over-ear design.',
      documentType: 'product' as const,
      metadata: { price: 299.99, category: 'Audio', inStock: true, rating: 4.6, reviews: 89 },
    },
    {
      merchantId: 'acme_electronics_2024',
      sku: null,
      title: 'Shipping Policy',
      body: 'Free shipping on all orders over $50. Standard delivery takes 3-5 business days. Express shipping available for $15 (1-2 business days).',
      documentType: 'policy' as const,
      metadata: { type: 'shipping' },
    },
    {
      merchantId: 'acme_electronics_2024',
      sku: null,
      title: 'Return Policy',
      body: 'We accept returns within 30 days of purchase. Items must be in original condition with all packaging and accessories.',
      documentType: 'policy' as const,
      metadata: { type: 'returns' },
    },
    // Fashion Hub
    {
      merchantId: 'fashion_hub_2024',
      sku: 'FH-DRESS-001',
      title: 'Summer Floral Dress',
      body: 'Beautiful floral print summer dress in lightweight cotton. Perfect for warm weather. Available in sizes XS-XL.',
      documentType: 'product' as const,
      metadata: { price: 79.99, category: 'Dresses', inStock: true, rating: 4.8, reviews: 156 },
    },
    {
      merchantId: 'fashion_hub_2024',
      sku: 'FH-JEANS-001',
      title: 'Classic Slim Fit Jeans',
      body: 'Timeless slim fit jeans in premium denim. Comfortable stretch fabric with classic 5-pocket design.',
      documentType: 'product' as const,
      metadata: { price: 89.99, category: 'Bottoms', inStock: true, rating: 4.5, reviews: 203 },
    },
    // Tech Store
    {
      merchantId: 'tech_store_2024',
      sku: 'TS-MONITOR-001',
      title: '32" 4K Gaming Monitor',
      body: 'Ultra-wide 32-inch 4K gaming monitor with 144Hz refresh rate and 1ms response time. HDR support and AMD FreeSync technology.',
      documentType: 'product' as const,
      metadata: { price: 599.99, category: 'Monitors', inStock: true, rating: 4.7, reviews: 234 },
    },
    {
      merchantId: 'tech_store_2024',
      sku: 'TS-KEYBOARD-001',
      title: 'Mechanical Gaming Keyboard RGB',
      body: 'Premium mechanical gaming keyboard with Cherry MX switches. Customizable RGB backlighting and programmable macro keys.',
      documentType: 'product' as const,
      metadata: { price: 149.99, category: 'Peripherals', inStock: true, rating: 4.6, reviews: 412 },
    },
  ];

  for (const doc of documents) {
    try {
      await db.insert(schema.documents).values(doc).onConflictDoNothing();
      console.log(`  ✓ Created document: ${doc.title}`);
    } catch (error) {
      console.error(`  ✗ Failed to create document ${doc.title}:`, error);
    }
  }
}

async function seedUserSessions() {
  console.log('💬 Seeding user sessions...');

  const sessions = [
    {
      userId: 'user_acme_001',
      merchantId: 'acme_electronics_2024',
      conversationHistory: [
        { role: 'user', content: 'I need a laptop for video editing' },
        { role: 'assistant', content: 'I recommend the ACME Pro Laptop 15" with its powerful i7 processor and 4K display!' },
      ],
      context: { last_query: 'laptop for video editing', intent: 'product_search' },
    },
    {
      userId: 'user_fashion_001',
      merchantId: 'fashion_hub_2024',
      conversationHistory: [
        { role: 'user', content: 'Show me summer dresses' },
        { role: 'assistant', content: 'Check out our Summer Floral Dress! Perfect for warm weather.' },
      ],
      context: { last_query: 'summer dresses', intent: 'product_search' },
    },
    {
      userId: 'user_tech_001',
      merchantId: 'tech_store_2024',
      conversationHistory: [
        { role: 'user', content: "What's the best gaming monitor?" },
        { role: 'assistant', content: 'Our 32" 4K Gaming Monitor with 144Hz refresh rate is perfect for gaming!' },
      ],
      context: { last_query: 'best gaming monitor', intent: 'product_search' },
    },
  ];

  for (const session of sessions) {
    try {
      await db.insert(schema.userSessions).values(session).onConflictDoNothing();
      console.log(`  ✓ Created session for: ${session.userId}`);
    } catch (error) {
      console.error(`  ✗ Failed to create session for ${session.userId}:`, error);
    }
  }
}

async function main() {
  console.log('🌱 Starting seed process...\n');

  try {
    await seedMerchants();
    await seedMerchantSettings();
    await seedApiKeys();
    await seedUsageLimits();
    await seedDocuments();
    await seedUserSessions();

    console.log('\n✅ Seed process completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Merchants: 4 (3 active, 1 pending)');
    console.log('  - API Keys: 5 active keys');
    console.log('  - Documents: 9 products and policies');
    console.log('  - User Sessions: 3 active sessions');
    console.log('\n🔐 Test Credentials:');
    console.log('  Merchant: acme_electronics_2024');
    console.log('  Email: admin@acme-electronics.com');
    console.log('  Plan: Starter\n');
  } catch (error) {
    console.error('\n❌ Seed process failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seed script
main();
