import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler as healthHandler } from '../lambda/healthHandler';
import { handler as chatHandler } from '../lambda/chatHandler';
import { handler as documentsHandler } from '../lambda/documentsHandler';
import { handler as bedrockHandler } from '../lambda/bedrockHandler';
import { handler as semanticRetrievalHandler } from '../lambda/semanticRetrievalHandler';

/**
 * Local Lambda Function Tester
 * Simulates AWS Lambda environment for local testing
 */
class LocalLambdaTester {
  private createMockContext(functionName: string): Context {
    return {
      callbackWaitsForEmptyEventLoop: false,
      functionName,
      functionVersion: '$LATEST',
      invokedFunctionArn: `arn:aws:lambda:us-east-2:123456789012:function:${functionName}`,
      memoryLimitInMB: '512',
      awsRequestId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      logGroupName: `/aws/lambda/${functionName}`,
      logStreamName: `2024/01/01/[$LATEST]${Math.random().toString(36).substr(2, 9)}`,
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };
  }

  private createMockEvent(options: {
    httpMethod: string;
    path: string;
    pathParameters?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
    headers?: Record<string, string>;
    body?: string;
    authorizer?: Record<string, any>;
  }): APIGatewayProxyEvent {
    return {
      resource: options.path,
      path: options.path,
      httpMethod: options.httpMethod,
      headers: options.headers || {},
      multiValueHeaders: {},
      queryStringParameters: options.queryStringParameters || null,
      multiValueQueryStringParameters: null,
      pathParameters: options.pathParameters || null,
      stageVariables: null,
      requestContext: {
        resourceId: 'test',
        resourcePath: options.path,
        httpMethod: options.httpMethod,
        requestId: `test-${Date.now()}`,
        protocol: 'HTTP/1.1',
        path: `/dev${options.path}`,
        stage: 'dev',
        requestTimeEpoch: Date.now(),
        requestTime: new Date().toISOString(),
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          sourceIp: '127.0.0.1',
          principalOrgId: null,
          accessKey: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent: 'Local-Lambda-Tester/1.0',
          user: null,
          apiKey: null,
          apiKeyId: null,
          clientCert: null
        },
        domainName: 'localhost',
        apiId: 'test-api',
        authorizer: options.authorizer || null
      } as any,
      body: options.body || null,
      isBase64Encoded: false
    };
  }

  async testHealthHandler(): Promise<void> {
    console.log('\n🧪 Testing Health Handler...');
    
    const event = this.createMockEvent({
      httpMethod: 'GET',
      path: '/health'
    });
    
    const context = this.createMockContext('mindsdb-rag-health-api-dev');
    
    try {
      const result = await healthHandler(event, context);
      console.log('✅ Health Handler Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Health check passed!');
      } else {
        console.log('❌ Health check failed!');
      }
    } catch (error) {
      console.error('❌ Health Handler Error:', error);
    }
  }

  async testChatHandler(): Promise<void> {
    console.log('\n🧪 Testing Chat Handler...');
    
    const event = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/chat',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        query: 'Hello, how can you help me with my e-commerce store?',
        merchant_id: 'test-merchant-123',
        user_id: 'test-user-456'
      }),
      authorizer: {
        userId: 'test-user-456',
        merchantId: 'test-merchant-123'
      }
    });
    
    const context = this.createMockContext('mindsdb-rag-chat-api-dev');
    
    try {
      const result = await chatHandler(event, context);
      console.log('✅ Chat Handler Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Chat handler passed!');
      } else {
        console.log('❌ Chat handler failed!');
      }
    } catch (error) {
      console.error('❌ Chat Handler Error:', error);
    }
  }

  async testDocumentsHandler(): Promise<void> {
    console.log('\n🧪 Testing Documents Handler...');
    
    // Test document creation
    const createEvent = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/merchants/test-merchant-123/documents',
      pathParameters: {
        merchantId: 'test-merchant-123'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        content: 'This is a comprehensive laptop product description. Our gaming laptop features Intel i7 processor, 16GB RAM, RTX 4060 graphics card.',
        title: 'Gaming Laptop - High Performance',
        source: 'lambda_test',
        document_type: 'product'
      })
    });
    
    const context = this.createMockContext('mindsdb-rag-documents-api-dev');
    
    try {
      const result = await documentsHandler(createEvent, context);
      console.log('✅ Documents Handler (Create) Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Document creation passed!');
      } else {
        console.log('❌ Document creation failed!');
      }
    } catch (error) {
      console.error('❌ Documents Handler Error:', error);
    }

    // Test document search
    const searchEvent = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/merchants/test-merchant-123/documents/search',
      pathParameters: {
        merchantId: 'test-merchant-123',
        resource: 'search'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        query: 'gaming laptop with RTX graphics',
        limit: 5,
        threshold: 0.7
      })
    });
    
    try {
      const result = await documentsHandler(searchEvent, context);
      console.log('✅ Documents Handler (Search) Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Document search passed!');
      } else {
        console.log('❌ Document search failed!');
      }
    } catch (error) {
      console.error('❌ Documents Search Handler Error:', error);
    }
  }

  async testBedrockHandler(): Promise<void> {
    console.log('\n🧪 Testing Bedrock Handler...');
    
    // Test Bedrock initialization
    const initEvent = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/merchants/test-merchant-123/bedrock/initialize',
      pathParameters: {
        merchantId: 'test-merchant-123',
        action: 'initialize'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        useServiceDefaults: true,
        modelId: 'amazon.nova-micro-v1:0',
        temperature: 0.7
      })
    });
    
    const context = this.createMockContext('mindsdb-rag-bedrock-api-dev');
    
    try {
      const result = await bedrockHandler(initEvent, context);
      console.log('✅ Bedrock Handler (Initialize) Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Bedrock initialization passed!');
      } else {
        console.log('❌ Bedrock initialization failed!');
      }
    } catch (error) {
      console.error('❌ Bedrock Handler Error:', error);
    }

    // Test Bedrock ask
    const askEvent = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/merchants/test-merchant-123/bedrock/ask',
      pathParameters: {
        merchantId: 'test-merchant-123',
        action: 'ask'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        question: 'What gaming laptops are available in our inventory?'
      })
    });
    
    try {
      const result = await bedrockHandler(askEvent, context);
      console.log('✅ Bedrock Handler (Ask) Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Bedrock ask passed!');
      } else {
        console.log('❌ Bedrock ask failed!');
      }
    } catch (error) {
      console.error('❌ Bedrock Ask Handler Error:', error);
    }
  }

  async testSemanticRetrievalHandler(): Promise<void> {
    console.log('\n🧪 Testing Semantic Retrieval Handler...');
    
    // Test deployment
    const deployEvent = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/semantic-retrieval/deploy',
      pathParameters: {
        action: 'deploy'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        merchantId: 'test-merchant-123'
      })
    });
    
    const context = this.createMockContext('mindsdb-rag-semantic-api-dev');
    
    try {
      const result = await semanticRetrievalHandler(deployEvent, context);
      console.log('✅ Semantic Retrieval Handler (Deploy) Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Semantic retrieval deployment passed!');
      } else {
        console.log('❌ Semantic retrieval deployment failed!');
      }
    } catch (error) {
      console.error('❌ Semantic Retrieval Handler Error:', error);
    }

    // Test search
    const searchEvent = this.createMockEvent({
      httpMethod: 'POST',
      path: '/v1/semantic-retrieval/search',
      pathParameters: {
        action: 'search'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_user_123:test-merchant-123'
      },
      body: JSON.stringify({
        query: 'high performance laptop for gaming',
        merchantId: 'test-merchant-123',
        limit: 5,
        threshold: 0.7
      })
    });
    
    try {
      const result = await semanticRetrievalHandler(searchEvent, context);
      console.log('✅ Semantic Retrieval Handler (Search) Result:', JSON.stringify(result, null, 2));
      
      if (result.statusCode === 200) {
        console.log('✅ Semantic retrieval search passed!');
      } else {
        console.log('❌ Semantic retrieval search failed!');
      }
    } catch (error) {
      console.error('❌ Semantic Retrieval Search Handler Error:', error);
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Local Lambda Function Tests...');
    console.log('=' .repeat(60));
    
    await this.testHealthHandler();
    await this.testChatHandler();
    await this.testDocumentsHandler();
    await this.testBedrockHandler();
    await this.testSemanticRetrievalHandler();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All Lambda function tests completed!');
    console.log('Check the output above for any failures.');
  }
}

// Export for use in other files
export { LocalLambdaTester };

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new LocalLambdaTester();
  tester.runAllTests().catch(console.error);
}