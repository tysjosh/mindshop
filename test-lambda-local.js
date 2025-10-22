// Test the Lambda function locally to debug the timeout issue
const { handler } = require('./lambda-functions/chat-handler/index.js');

// Mock Lambda event
const testEvent = {
  httpMethod: 'POST',
  path: '/chat',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'Hello, how can you help me?',
    merchant_id: 'test_merchant_123'
  })
};

// Mock Lambda context
const testContext = {
  awsRequestId: 'test-request-123',
  getRemainingTimeInMillis: () => 30000
};

console.log('Testing Lambda function locally...');
console.log('Event:', JSON.stringify(testEvent, null, 2));

// Set environment variables for testing
process.env.MINDSDB_ENDPOINT = 'http://localhost:47334';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'mindsdb_rag';
process.env.DB_USERNAME = 'postgres';
process.env.DB_PASSWORD = 'password';

// Test with timeout
const testWithTimeout = async () => {
  try {
    const result = await Promise.race([
      handler(testEvent, testContext),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Local test timeout')), 10000)
      )
    ]);
    
    console.log('Success! Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
};

testWithTimeout();