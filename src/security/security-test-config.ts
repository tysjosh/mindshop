/**
 * Security Test Configuration
 * Defines security testing parameters, thresholds, and compliance requirements
 */

export interface SecurityTestConfig {
  tenantIsolation: {
    testCrossTenantAccess: boolean;
    testDatabaseQueryInterception: boolean;
    testMindsDBPredictorAccess: boolean;
    testConcurrentAccess: boolean;
    maxAllowedViolations: number;
  };
  piiRedaction: {
    testPatternDetection: boolean;
    testTokenization: boolean;
    testKMSIntegration: boolean;
    testConversationSanitization: boolean;
    requiredPatterns: string[];
    tokenExpirationHours: number;
  };
  encryption: {
    testEnvelopeEncryption: boolean;
    testKeyManagement: boolean;
    testKeyRotation: boolean;
    testDataAtRest: boolean;
    testDataInTransit: boolean;
    requiredAlgorithm: string;
    maxKeyAge: number;
  };
  vpcSecurity: {
    testNetworkIsolation: boolean;
    testSecurityGroups: boolean;
    testSecretsManager: boolean;
    testIAMRoles: boolean;
    testPortScanning: boolean;
    allowedPorts: number[];
    blockedPorts: number[];
  };
  compliance: {
    gdpr: boolean;
    pci: boolean;
    sox: boolean;
    hipaa: boolean;
    requiredAuditFields: string[];
    dataRetentionDays: number;
  };
  monitoring: {
    testSecurityEventLogging: boolean;
    testAlerting: boolean;
    testMetricsCollection: boolean;
    requiredLogFields: string[];
    alertThresholds: Record<string, number>;
  };
}

export const defaultSecurityTestConfig: SecurityTestConfig = {
  tenantIsolation: {
    testCrossTenantAccess: true,
    testDatabaseQueryInterception: true,
    testMindsDBPredictorAccess: true,
    testConcurrentAccess: true,
    maxAllowedViolations: 0,
  },
  piiRedaction: {
    testPatternDetection: true,
    testTokenization: true,
    testKMSIntegration: true,
    testConversationSanitization: true,
    requiredPatterns: ['email', 'phone', 'ssn', 'creditCard', 'address'],
    tokenExpirationHours: 24,
  },
  encryption: {
    testEnvelopeEncryption: true,
    testKeyManagement: true,
    testKeyRotation: true,
    testDataAtRest: true,
    testDataInTransit: true,
    requiredAlgorithm: 'AES-256-GCM',
    maxKeyAge: 90, // days
  },
  vpcSecurity: {
    testNetworkIsolation: true,
    testSecurityGroups: true,
    testSecretsManager: true,
    testIAMRoles: true,
    testPortScanning: true,
    allowedPorts: [80, 443, 8080], // Only necessary ports
    blockedPorts: [22, 3389, 5432, 6379, 9200, 27017], // Management/database ports
  },
  compliance: {
    gdpr: true,
    pci: true,
    sox: true,
    hipaa: true,
    requiredAuditFields: [
      'timestamp',
      'eventType',
      'userId',
      'merchantId',
      'sourceIP',
      'resource',
      'action',
      'outcome',
    ],
    dataRetentionDays: 2555, // 7 years
  },
  monitoring: {
    testSecurityEventLogging: true,
    testAlerting: true,
    testMetricsCollection: true,
    requiredLogFields: [
      'timestamp',
      'severity',
      'eventType',
      'details',
    ],
    alertThresholds: {
      tenantIsolationViolation: 1,
      failedAuthentication: 5,
      suspiciousQueryPattern: 10,
      encryptionFailure: 1,
      unauthorizedAccess: 1,
    },
  },
};

export interface SecurityTestResult {
  testName: string;
  category: keyof SecurityTestConfig;
  status: 'PASS' | 'FAIL' | 'WARNING';
  score: number;
  details: string;
  vulnerabilities: string[];
  recommendations: string[];
  timestamp: string;
}

export interface SecurityComplianceReport {
  testSuite: string;
  version: string;
  timestamp: string;
  environment: string;
  overallScore: number;
  results: Record<string, SecurityTestResult[]>;
  compliance: Record<string, boolean>;
  vulnerabilities: string[];
  recommendations: string[];
  nextSteps: string[];
}

/**
 * Security test utilities
 */
export class SecurityTestUtils {
  static generateTestId(): string {
    return `sec_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static calculateSecurityScore(results: SecurityTestResult[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / results.length);
  }

  static assessComplianceStatus(
    results: SecurityTestResult[],
    config: SecurityTestConfig
  ): Record<string, boolean> {
    const scores = {
      tenantIsolation: this.getCategoryScore(results, 'tenantIsolation'),
      piiRedaction: this.getCategoryScore(results, 'piiRedaction'),
      encryption: this.getCategoryScore(results, 'encryption'),
      vpcSecurity: this.getCategoryScore(results, 'vpcSecurity'),
    };

    return {
      gdpr: scores.piiRedaction >= 90 && scores.encryption >= 90,
      pci: scores.encryption >= 95 && scores.vpcSecurity >= 90,
      sox: scores.tenantIsolation >= 95 && scores.encryption >= 90,
      hipaa: scores.piiRedaction >= 95 && scores.encryption >= 95 && scores.tenantIsolation >= 90,
    };
  }

  private static getCategoryScore(
    results: SecurityTestResult[],
    category: keyof SecurityTestConfig
  ): number {
    const categoryResults = results.filter(r => r.category === category);
    return this.calculateSecurityScore(categoryResults);
  }

  static generateRecommendations(results: SecurityTestResult[]): string[] {
    const recommendations = new Set<string>();

    results.forEach(result => {
      if (result.status === 'FAIL' || result.status === 'WARNING') {
        result.recommendations.forEach(rec => recommendations.add(rec));
      }
    });

    // Add general recommendations based on common issues
    if (results.some(r => r.category === 'tenantIsolation' && r.status === 'FAIL')) {
      recommendations.add('Implement stricter tenant isolation controls');
      recommendations.add('Review database query interception logic');
    }

    if (results.some(r => r.category === 'piiRedaction' && r.status === 'FAIL')) {
      recommendations.add('Enhance PII detection patterns');
      recommendations.add('Implement comprehensive tokenization strategy');
    }

    if (results.some(r => r.category === 'encryption' && r.status === 'FAIL')) {
      recommendations.add('Review KMS key management practices');
      recommendations.add('Implement proper key rotation policies');
    }

    if (results.some(r => r.category === 'vpcSecurity' && r.status === 'FAIL')) {
      recommendations.add('Tighten VPC security group rules');
      recommendations.add('Review IAM role permissions');
    }

    return Array.from(recommendations);
  }

  static validateSecurityConfiguration(config: Partial<SecurityTestConfig>): string[] {
    const errors: string[] = [];

    // Validate tenant isolation config
    if (config.tenantIsolation) {
      if (config.tenantIsolation.maxAllowedViolations > 0) {
        errors.push('Tenant isolation should not allow any violations');
      }
    }

    // Validate encryption config
    if (config.encryption) {
      if (config.encryption.requiredAlgorithm !== 'AES-256-GCM') {
        errors.push('Encryption algorithm should be AES-256-GCM');
      }
      if (config.encryption.maxKeyAge > 90) {
        errors.push('Key rotation should occur at least every 90 days');
      }
    }

    // Validate VPC security config
    if (config.vpcSecurity) {
      const dangerousPorts = [22, 3389, 5432, 6379];
      const allowedDangerousPorts = config.vpcSecurity.allowedPorts?.filter(port =>
        dangerousPorts.includes(port)
      );
      if (allowedDangerousPorts && allowedDangerousPorts.length > 0) {
        errors.push(`Dangerous ports should not be allowed: ${allowedDangerousPorts.join(', ')}`);
      }
    }

    // Validate compliance config
    if (config.compliance) {
      if (config.compliance.dataRetentionDays < 2555) {
        errors.push('Data retention should be at least 7 years for compliance');
      }
    }

    return errors;
  }

  static createSecurityReport(
    results: SecurityTestResult[],
    config: SecurityTestConfig
  ): SecurityComplianceReport {
    const overallScore = this.calculateSecurityScore(results);
    const compliance = this.assessComplianceStatus(results, config);
    const vulnerabilities = results
      .filter(r => r.status === 'FAIL')
      .flatMap(r => r.vulnerabilities);
    const recommendations = this.generateRecommendations(results);

    const groupedResults = results.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = [];
      }
      acc[result.category].push(result);
      return acc;
    }, {} as Record<string, SecurityTestResult[]>);

    return {
      testSuite: 'MindsDB RAG Assistant Security Tests',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      overallScore,
      results: groupedResults,
      compliance,
      vulnerabilities,
      recommendations,
      nextSteps: [
        'Address all identified vulnerabilities',
        'Implement security recommendations',
        'Schedule regular security testing',
        'Update security documentation',
        'Conduct security training for development team',
        'Review and update security policies',
        'Implement continuous security monitoring',
      ],
    };
  }
}

/**
 * Security test patterns and constants
 */
export const SECURITY_PATTERNS = {
  PII: {
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ADDRESS: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi,
  },
  SQL_INJECTION: [
    "' OR '1'='1",
    "'; DROP TABLE",
    "' UNION SELECT",
    "' AND 1=1",
    "' OR 1=1--",
  ],
  XSS: [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
  ],
};

export const SECURITY_THRESHOLDS = {
  MINIMUM_OVERALL_SCORE: 80,
  MINIMUM_CATEGORY_SCORE: 75,
  MAXIMUM_VULNERABILITIES: 5,
  MAXIMUM_HIGH_SEVERITY_VULNERABILITIES: 0,
  MAXIMUM_CRITICAL_VULNERABILITIES: 0,
};

export default defaultSecurityTestConfig;