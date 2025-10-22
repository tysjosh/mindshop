/**
 * MindsDB API Integration Example
 * Demonstrates how to use the MindsDBService with the actual MindsDB REST API
 */

import { MindsDBService } from '../src/services/MindsDBService';
import { config } from '../src/config';

async function demonstrateMindsDBIntegration() {
  console.log('🚀 MindsDB API Integration Example');
  console.log('=====================================');

  // Initialize MindsDB service (works with both cloud and self-hosted)
  const mindsdbService = new MindsDBService({
    endpoint: config.mindsdb.endpoint,   // e.g., 'http://localhost:47334'
    apiKey: config.mindsdb.apiKey,       // Your API key (optional for self-hosted)
    username: config.mindsdb.username,   // Username (for self-hosted with auth)
    password: config.mindsdb.password,   // Password (for self-hosted with auth)
    timeout: 30000,
  });

  const merchantId = 'demo-merchant-123';
  const projectName = 'mindsdb'; // Default project

  try {
    // 1. Test basic connectivity and health
    console.log('\n📡 Testing MindsDB connectivity...');
    const healthStatus = await mindsdbService.healthCheck();
    console.log(`✅ Health Status: ${healthStatus.status} (${healthStatus.responseTime}ms)`);
    
    if (healthStatus.status === 'unhealthy') {
      console.log('❌ MindsDB is not healthy:', healthStatus.errors);
      return;
    }

    const databases = await mindsdbService.listDatabases();
    console.log(`✅ Connected! Found ${databases.length} databases`);

    // 2. List available projects
    console.log('\n📋 Listing projects...');
    const projects = await mindsdbService.listProjects();
    console.log(`✅ Found ${projects.length} projects:`, projects.map(p => p.name));

    // 3. Execute a simple SQL query
    console.log('\n🔍 Executing SQL query...');
    const queryResult = await mindsdbService.executeQuery(
      "SELECT 1 as test_column, 'Hello MindsDB' as message"
    );
    console.log('✅ Query result:', queryResult);

    // 4. Set up knowledge base for the merchant
    console.log(`\n📚 Setting up knowledge base for merchant: ${merchantId}...`);
    const knowledgeBase = await mindsdbService.ensureKnowledgeBase(merchantId, projectName);
    console.log('✅ Knowledge base ready:', knowledgeBase.name);

    // 5. Insert sample documents
    console.log('\n📄 Inserting sample documents...');
    const sampleDocuments = [
      {
        content: 'Our premium wireless headphones offer exceptional sound quality with noise cancellation technology.',
        metadata: {
          title: 'Premium Wireless Headphones',
          source: 'product_catalog',
          category: 'electronics',
          price: 299.99,
          created_at: new Date().toISOString(),
        },
      },
      {
        content: 'Comfortable running shoes designed for long-distance runners with advanced cushioning system.',
        metadata: {
          title: 'Professional Running Shoes',
          source: 'product_catalog',
          category: 'sports',
          price: 149.99,
          created_at: new Date().toISOString(),
        },
      },
      {
        content: 'Organic cotton t-shirts made from sustainable materials, perfect for everyday wear.',
        metadata: {
          title: 'Organic Cotton T-Shirt',
          source: 'product_catalog',
          category: 'clothing',
          price: 29.99,
          created_at: new Date().toISOString(),
        },
      },
    ];

    await mindsdbService.insertIntoKnowledgeBase(merchantId, sampleDocuments, projectName);
    console.log('✅ Sample documents inserted successfully');

    // 6. Test semantic retrieval
    console.log('\n🔎 Testing semantic retrieval...');
    const retrievalQueries = [
      'wireless audio devices',
      'athletic footwear',
      'sustainable clothing',
    ];

    for (const query of retrievalQueries) {
      console.log(`\n  Query: "${query}"`);
      const results = await mindsdbService.retrieveDocuments({
        query,
        merchantId,
        limit: 2,
        threshold: 0.5,
      });

      results.forEach((result, index) => {
        console.log(`    ${index + 1}. ${result.metadata.title} (score: ${result.score.toFixed(3)})`);
        console.log(`       ${result.snippet.substring(0, 80)}...`);
        console.log(`       Grounding: ${result.groundingPass ? '✅ Pass' : '❌ Fail'}`);
      });
    }

    // 7. Test agent interaction (if agents are available)
    console.log('\n🤖 Testing agent interaction...');
    try {
      const agentResponse = await mindsdbService.queryAgent(
        'default_agent', // Replace with your agent name
        [
          { role: 'user', content: 'What products do you recommend for running?' }
        ],
        projectName
      );
      console.log('✅ Agent response:', agentResponse);
    } catch (error) {
      console.log('ℹ️  Agent not available or not configured:', (error as Error).message);
    }

    // 8. Advanced SQL queries
    console.log('\n🔧 Testing advanced SQL queries...');
    
    // Query to get database information
    const dbInfoQuery = await mindsdbService.executeQuery(
      "SELECT name, engine, type FROM information_schema.databases WHERE type = 'data'"
    );
    console.log('✅ Database info:', dbInfoQuery.data);

    // Query to check available models/predictors
    const modelsQuery = await mindsdbService.executeQuery(
      "SELECT name, status, training_options FROM mindsdb.models LIMIT 5"
    );
    console.log('✅ Available models:', modelsQuery.data);

    console.log('\n🎉 MindsDB integration example completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - ✅ Connected to MindsDB API');
    console.log('   - ✅ Created/verified knowledge base');
    console.log('   - ✅ Inserted sample documents');
    console.log('   - ✅ Performed semantic retrieval');
    console.log('   - ✅ Executed SQL queries');

  } catch (error) {
    console.error('❌ Error during MindsDB integration:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication failed')) {
        console.log('\n💡 Troubleshooting tips:');
        console.log('   1. Check your MindsDB API key in .env file');
        console.log('   2. Verify your MindsDB endpoint URL');
        console.log('   3. Ensure your MindsDB account is active');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 Connection troubleshooting:');
        console.log('   1. Check if MindsDB endpoint is accessible');
        console.log('   2. Verify network connectivity');
        console.log('   3. Check firewall settings');
      }
    }
  }
}

// Additional utility functions for testing

/**
 * Test MindsDB health and connectivity
 */
export async function testMindsDBHealth(): Promise<boolean> {
  try {
    const mindsdbService = new MindsDBService();
    const databases = await mindsdbService.listDatabases();
    return databases !== null;
  } catch (error) {
    console.error('MindsDB health check failed:', error);
    return false;
  }
}

/**
 * Set up a complete knowledge base with sample data
 */
export async function setupSampleKnowledgeBase(merchantId: string): Promise<void> {
  const mindsdbService = new MindsDBService();
  
  // Create knowledge base
  await mindsdbService.ensureKnowledgeBase(merchantId);
  
  // Sample e-commerce product data
  const products = [
    {
      content: 'High-performance laptop with Intel i7 processor, 16GB RAM, and 512GB SSD. Perfect for professional work and gaming.',
      metadata: {
        title: 'Professional Gaming Laptop',
        source: 'product_catalog',
        category: 'computers',
        sku: 'LAPTOP-001',
        price: 1299.99,
        in_stock: true,
      },
    },
    {
      content: 'Wireless Bluetooth earbuds with active noise cancellation and 24-hour battery life. Ideal for music and calls.',
      metadata: {
        title: 'Premium Wireless Earbuds',
        source: 'product_catalog',
        category: 'audio',
        sku: 'AUDIO-001',
        price: 199.99,
        in_stock: true,
      },
    },
    {
      content: 'Smart fitness tracker with heart rate monitoring, GPS, and sleep tracking. Water-resistant design for active lifestyles.',
      metadata: {
        title: 'Smart Fitness Tracker',
        source: 'product_catalog',
        category: 'fitness',
        sku: 'FITNESS-001',
        price: 149.99,
        in_stock: false,
      },
    },
  ];
  
  await mindsdbService.insertIntoKnowledgeBase(merchantId, products);
  console.log(`✅ Sample knowledge base set up for merchant: ${merchantId}`);
}

/**
 * Benchmark semantic retrieval performance
 */
export async function benchmarkSemanticRetrieval(merchantId: string): Promise<void> {
  const mindsdbService = new MindsDBService();
  
  const testQueries = [
    'high performance computer',
    'wireless audio device',
    'fitness tracking device',
    'gaming equipment',
    'bluetooth accessories',
  ];
  
  console.log('\n⏱️  Benchmarking semantic retrieval performance...');
  
  for (const query of testQueries) {
    const startTime = Date.now();
    
    try {
      const results = await mindsdbService.retrieveDocuments({
        query,
        merchantId,
        limit: 3,
      });
      
      const duration = Date.now() - startTime;
      console.log(`   "${query}": ${duration}ms (${results.length} results)`);
      
    } catch (error) {
      console.log(`   "${query}": ERROR - ${(error as Error).message}`);
    }
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateMindsDBIntegration().catch(console.error);
}

export { demonstrateMindsDBIntegration };