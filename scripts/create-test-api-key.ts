import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { apiKeys, merchants } from '../src/database/schema';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mindsdb_rag',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const db = drizzle(pool, { schema });

async function createTestApiKey() {
  try {
    console.log('Creating test merchant and API key...');

    const merchantId = 'demo_store_2024';
    
    // Check if merchant exists
    const existingMerchant = await db.select().from(merchants).where(eq(merchants.merchantId, merchantId)).limit(1);
    
    if (existingMerchant.length === 0) {
      // Create merchant
      console.log('Creating demo merchant...');
      await db.insert(merchants).values({
        merchantId,
        cognitoUserId: 'demo-cognito-user',
        email: 'demo@example.com',
        companyName: 'Demo Store',
        status: 'active',
      });
      console.log('✅ Demo merchant created');
    } else {
      console.log('✅ Demo merchant already exists');
    }

    const keyPrefix = 'pk_test_'; // Must be 8 characters to match validation logic
    const keySecret = randomBytes(32).toString('hex');
    const fullKey = `${keyPrefix}${keySecret}`;
    const keyId = `key_${randomBytes(16).toString('hex')}`;

    // Hash the API key
    console.log('Hashing API key...');
    const keyHash = await bcrypt.hash(fullKey, 10);

    // Create API key
    const [apiKey] = await db.insert(apiKeys).values({
      keyId,
      merchantId,
      name: 'Test Widget Key',
      keyHash,
      keyPrefix,
      environment: 'development',
      permissions: ['chat:read', 'chat:write', 'documents:read'],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      status: 'active',
    }).returning();

    console.log('\n✅ Test API key created successfully!');
    console.log('\n📋 API Key Details:');
    console.log('   Merchant ID:', merchantId);
    console.log('   API Key:', fullKey);
    console.log('   Environment:', apiKey.environment);
    console.log('   Permissions:', apiKey.permissions);
    console.log('\n💡 Update your widget configuration:');
    console.log(`   apiKey: '${fullKey}'`);
    console.log(`   merchantId: '${merchantId}'`);

    await pool.end();
  } catch (error) {
    console.error('Error creating test API key:', error);
    await pool.end();
    process.exit(1);
  }
}

createTestApiKey();
