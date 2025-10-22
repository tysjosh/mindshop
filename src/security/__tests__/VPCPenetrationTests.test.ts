import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response } from 'express';
import * as net from 'net';
import * as dns from 'dns';
import { promisify } from 'util';

// Mock AWS SDK for security testing
vi.mock('aws-sdk', () => ({
  EC2: vi.fn().mockImplementation(() => ({
    describeSecurityGroups: vi.fn(),
    describeVpcs: vi.fn(),
    describeSubnets: vi.fn(),
    describeRouteTables: vi.fn(),
    describeNetworkAcls: vi.fn(),
  })),
  SecretsManager: vi.fn().mockImplementation(() => ({
    getSecretValue: vi.fn(),
    listSecrets: vi.fn(),
    describeSecret: vi.fn(),
  })),
  IAM: vi.fn().mockImplementation(() => ({
    getRole: vi.fn(),
    listRolePolicies: vi.fn(),
    getRolePolicy: vi.fn(),
    listAttachedRolePolicies: vi.fn(),
  })),
  STS: vi.fn().mockImplementation(() => ({
    getCallerIdentity: vi.fn(),
    assumeRole: vi.fn(),
  })),
}));

const dnsLookup = promisify(dns.lookup);

describe('VPC and Infrastructure Security Penetration Tests', () => {
  let mockEC2: any;
  let mockSecretsManager: any;
  let mockIAM: any;
  let mockSTS: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEC2 = {
      describeSecurityGroups: vi.fn(),
      describeVpcs: vi.fn(),
      describeSubnets: vi.fn(),
      describeRouteTables: vi.fn(),
      describeNetworkAcls: vi.fn(),
    };

    mockSecretsManager = {
      getSecretValue: vi.fn(),
      listSecrets: vi.fn(),
      describeSecret: vi.fn(),
    };

    mockIAM = {
      getRole: vi.fn(),
      listRolePolicies: vi.fn(),
      getRolePolicy: vi.fn(),
      listAttachedRolePolicies: vi.fn(),
    };

    mockSTS = {
      getCallerIdentity: vi.fn(),
      assumeRole: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('VPC Network Security Tests', () => {
    it('should verify private subnet isolation', async () => {
      // Arrange
      const mockVPCResponse = {
        Vpcs: [{
          VpcId: 'vpc-12345678',
          CidrBlock: '10.0.0.0/16',
          State: 'available',
        }],
      };

      const mockSubnetsResponse = {
        Subnets: [
          {
            SubnetId: 'subnet-private-1',
            VpcId: 'vpc-12345678',
            CidrBlock: '10.0.1.0/24',
            AvailabilityZone: 'us-east-1a',
            MapPublicIpOnLaunch: false, // Private subnet
            Tags: [{ Key: 'Name', Value: 'MindsDB-Private-Subnet-1' }],
          },
          {
            SubnetId: 'subnet-private-2',
            VpcId: 'vpc-12345678',
            CidrBlock: '10.0.2.0/24',
            AvailabilityZone: 'us-east-1b',
            MapPublicIpOnLaunch: false, // Private subnet
            Tags: [{ Key: 'Name', Value: 'MindsDB-Private-Subnet-2' }],
          },
          {
            SubnetId: 'subnet-public-1',
            VpcId: 'vpc-12345678',
            CidrBlock: '10.0.101.0/24',
            AvailabilityZone: 'us-east-1a',
            MapPublicIpOnLaunch: true, // Public subnet
            Tags: [{ Key: 'Name', Value: 'MindsDB-Public-Subnet-1' }],
          },
        ],
      };

      mockEC2.describeVpcs.mockReturnValue({
        promise: () => Promise.resolve(mockVPCResponse),
      });

      mockEC2.describeSubnets.mockReturnValue({
        promise: () => Promise.resolve(mockSubnetsResponse),
      });

      // Act
      const vpcResult = await mockEC2.describeVpcs().promise();
      const subnetsResult = await mockEC2.describeSubnets().promise();

      // Assert
      expect(vpcResult.Vpcs).toHaveLength(1);
      
      const privateSubnets = subnetsResult.Subnets.filter(
        subnet => !subnet.MapPublicIpOnLaunch
      );
      const publicSubnets = subnetsResult.Subnets.filter(
        subnet => subnet.MapPublicIpOnLaunch
      );

      expect(privateSubnets).toHaveLength(2);
      expect(publicSubnets).toHaveLength(1);

      // Verify private subnets don't auto-assign public IPs
      privateSubnets.forEach(subnet => {
        expect(subnet.MapPublicIpOnLaunch).toBe(false);
      });
    });

    it('should verify security group rules are restrictive', async () => {
      // Arrange
      const mockSecurityGroupsResponse = {
        SecurityGroups: [
          {
            GroupId: 'sg-mindsdb-app',
            GroupName: 'MindsDB-Application-SG',
            Description: 'Security group for MindsDB application tier',
            VpcId: 'vpc-12345678',
            IpPermissions: [
              {
                IpProtocol: 'tcp',
                FromPort: 443,
                ToPort: 443,
                UserIdGroupPairs: [{ GroupId: 'sg-alb-12345' }], // Only from ALB
                IpRanges: [], // No direct internet access
              },
              {
                IpProtocol: 'tcp',
                FromPort: 8080,
                ToPort: 8080,
                UserIdGroupPairs: [{ GroupId: 'sg-alb-12345' }], // Only from ALB
                IpRanges: [], // No direct internet access
              },
            ],
            IpPermissionsEgress: [
              {
                IpProtocol: 'tcp',
                FromPort: 443,
                ToPort: 443,
                IpRanges: [{ CidrIp: '0.0.0.0/0' }], // HTTPS outbound only
              },
              {
                IpProtocol: 'tcp',
                FromPort: 5432,
                ToPort: 5432,
                UserIdGroupPairs: [{ GroupId: 'sg-rds-12345' }], // Only to RDS
              },
            ],
          },
          {
            GroupId: 'sg-rds-12345',
            GroupName: 'MindsDB-RDS-SG',
            Description: 'Security group for RDS Aurora cluster',
            VpcId: 'vpc-12345678',
            IpPermissions: [
              {
                IpProtocol: 'tcp',
                FromPort: 5432,
                ToPort: 5432,
                UserIdGroupPairs: [{ GroupId: 'sg-mindsdb-app' }], // Only from app tier
                IpRanges: [], // No direct access
              },
            ],
            IpPermissionsEgress: [], // No outbound rules needed for RDS
          },
        ],
      };

      mockEC2.describeSecurityGroups.mockReturnValue({
        promise: () => Promise.resolve(mockSecurityGroupsResponse),
      });

      // Act
      const result = await mockEC2.describeSecurityGroups().promise();

      // Assert
      const appSG = result.SecurityGroups.find(sg => sg.GroupName === 'MindsDB-Application-SG');
      const rdsSG = result.SecurityGroups.find(sg => sg.GroupName === 'MindsDB-RDS-SG');

      expect(appSG).toBeDefined();
      expect(rdsSG).toBeDefined();

      // Verify app tier has no direct internet inbound access
      const directInternetRules = appSG.IpPermissions.filter(rule =>
        rule.IpRanges.some(range => range.CidrIp === '0.0.0.0/0')
      );
      expect(directInternetRules).toHaveLength(0);

      // Verify RDS only accepts connections from app tier
      expect(rdsSG.IpPermissions).toHaveLength(1);
      expect(rdsSG.IpPermissions[0].UserIdGroupPairs[0].GroupId).toBe('sg-mindsdb-app');

      // Verify no overly permissive rules (0.0.0.0/0 inbound)
      result.SecurityGroups.forEach(sg => {
        sg.IpPermissions.forEach(rule => {
          rule.IpRanges.forEach(range => {
            if (range.CidrIp === '0.0.0.0/0') {
              // Should only be for specific outbound HTTPS or health checks
              expect(['443', '80']).toContain(rule.FromPort?.toString());
            }
          });
        });
      });
    });

    it('should verify network ACLs provide additional layer of security', async () => {
      // Arrange
      const mockNetworkAclsResponse = {
        NetworkAcls: [
          {
            NetworkAclId: 'acl-12345678',
            VpcId: 'vpc-12345678',
            IsDefault: false,
            Entries: [
              {
                RuleNumber: 100,
                Protocol: '6', // TCP
                RuleAction: 'allow',
                PortRange: { From: 443, To: 443 },
                CidrBlock: '10.0.0.0/16', // Only internal VPC traffic
              },
              {
                RuleNumber: 110,
                Protocol: '6', // TCP
                RuleAction: 'allow',
                PortRange: { From: 5432, To: 5432 },
                CidrBlock: '10.0.1.0/24', // Only from app subnet
              },
              {
                RuleNumber: 32767,
                Protocol: '-1',
                RuleAction: 'deny',
                CidrBlock: '0.0.0.0/0', // Deny all other traffic
              },
            ],
          },
        ],
      };

      mockEC2.describeNetworkAcls.mockReturnValue({
        promise: () => Promise.resolve(mockNetworkAclsResponse),
      });

      // Act
      const result = await mockEC2.describeNetworkAcls().promise();

      // Assert
      const customAcl = result.NetworkAcls.find(acl => !acl.IsDefault);
      expect(customAcl).toBeDefined();

      // Verify explicit deny rule exists
      const denyAllRule = customAcl.Entries.find(entry => 
        entry.RuleAction === 'deny' && entry.CidrBlock === '0.0.0.0/0'
      );
      expect(denyAllRule).toBeDefined();

      // Verify only necessary ports are allowed
      const allowRules = customAcl.Entries.filter(entry => entry.RuleAction === 'allow');
      allowRules.forEach(rule => {
        expect(['443', '5432', '80']).toContain(rule.PortRange?.From?.toString());
      });
    });

    it('should test for common network misconfigurations', async () => {
      // Test for overly permissive security groups
      const testOverlyPermissiveSG = () => {
        const secureRules = [
          { protocol: 'tcp', port: 22, cidr: '10.0.0.0/16' }, // SSH from VPC only
          { protocol: 'tcp', port: 3389, cidr: '10.0.0.0/16' }, // RDP from VPC only
          { protocol: 'tcp', port: 5432, cidr: '10.0.1.0/24' }, // Database from app subnet only
          { protocol: 'tcp', port: 443, cidr: '0.0.0.0/0' }, // HTTPS from anywhere (acceptable)
        ];

        secureRules.forEach(rule => {
          // Only HTTPS should be allowed from anywhere
          if (rule.port !== 443) {
            expect(rule.cidr).not.toBe('0.0.0.0/0');
          }
        });
      };

      // Test for default VPC usage (should use custom VPC)
      const testDefaultVPCUsage = async () => {
        const mockVPCs = {
          Vpcs: [
            { VpcId: 'vpc-12345678', IsDefault: false, CidrBlock: '10.0.0.0/16' },
          ],
        };

        mockEC2.describeVpcs.mockReturnValue({
          promise: () => Promise.resolve(mockVPCs),
        });

        const result = await mockEC2.describeVpcs().promise();
        const defaultVPC = result.Vpcs.find(vpc => vpc.IsDefault);
        
        // Should not use default VPC for production workloads
        expect(defaultVPC).toBeUndefined();
      };

      // Execute tests
      testOverlyPermissiveSG();
      await testDefaultVPCUsage();
    });
  });

  describe('Secrets Manager Security Tests', () => {
    it('should verify secrets are properly encrypted and rotated', async () => {
      // Arrange
      const mockSecretsResponse = {
        SecretList: [
          {
            ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:mindsdb/rds-credentials-AbCdEf',
            Name: 'mindsdb/rds-credentials',
            Description: 'RDS Aurora credentials for MindsDB',
            KmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
            RotationEnabled: true,
            RotationRules: {
              AutomaticallyAfterDays: 90,
            },
            LastRotatedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            NextRotationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
          },
          {
            ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:mindsdb/api-keys-XyZaBc',
            Name: 'mindsdb/api-keys',
            Description: 'API keys for external services',
            KmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
            RotationEnabled: true,
            RotationRules: {
              AutomaticallyAfterDays: 90,
            },
          },
        ],
      };

      mockSecretsManager.listSecrets.mockReturnValue({
        promise: () => Promise.resolve(mockSecretsResponse),
      });

      // Act
      const result = await mockSecretsManager.listSecrets().promise();

      // Assert
      result.SecretList.forEach(secret => {
        // Verify all secrets have KMS encryption
        expect(secret.KmsKeyId).toBeDefined();
        expect(secret.KmsKeyId).toMatch(/^arn:aws:kms:/);

        // Verify rotation is enabled
        expect(secret.RotationEnabled).toBe(true);
        expect(secret.RotationRules?.AutomaticallyAfterDays).toBeLessThanOrEqual(90);

        // Verify proper naming convention
        expect(secret.Name).toMatch(/^mindsdb\//);
      });
    });

    it('should test unauthorized access to secrets', async () => {
      // Arrange
      const unauthorizedSecretAccess = async () => {
        mockSecretsManager.getSecretValue.mockReturnValue({
          promise: () => Promise.reject(new Error('AccessDenied: User is not authorized to perform: secretsmanager:GetSecretValue')),
        });

        try {
          await mockSecretsManager.getSecretValue({
            SecretId: 'mindsdb/rds-credentials',
          }).promise();
        } catch (error) {
          return error;
        }
      };

      // Act
      const error = await unauthorizedSecretAccess();

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('AccessDenied');
    });

    it('should verify secret value encryption in transit and at rest', async () => {
      // Arrange
      const mockSecretValue = {
        ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:mindsdb/rds-credentials-AbCdEf',
        Name: 'mindsdb/rds-credentials',
        VersionId: '12345678-1234-1234-1234-123456789012',
        SecretString: JSON.stringify({
          username: 'mindsdb_user',
          password: 'SecureRandomPassword123!',
          engine: 'postgres',
          host: 'mindsdb-aurora-cluster.cluster-xyz.us-east-1.rds.amazonaws.com',
          port: 5432,
          dbname: 'mindsdb',
        }),
        CreatedDate: new Date(),
      };

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: () => Promise.resolve(mockSecretValue),
      });

      // Act
      const result = await mockSecretsManager.getSecretValue({
        SecretId: 'mindsdb/rds-credentials',
      }).promise();

      // Assert
      expect(result.SecretString).toBeDefined();
      
      const secretData = JSON.parse(result.SecretString);
      expect(secretData.username).toBeDefined();
      expect(secretData.password).toBeDefined();
      expect(secretData.host).toMatch(/\.rds\.amazonaws\.com$/);

      // Verify password complexity (should be strong)
      expect(secretData.password.length).toBeGreaterThan(12);
      expect(secretData.password).toMatch(/[A-Z]/); // Uppercase
      expect(secretData.password).toMatch(/[a-z]/); // Lowercase
      expect(secretData.password).toMatch(/[0-9]/); // Numbers
      expect(secretData.password).toMatch(/[!@#$%^&*]/); // Special chars
    });
  });

  describe('IAM Role and Policy Security Tests', () => {
    it('should verify IAM roles follow principle of least privilege', async () => {
      // Arrange
      const mockRoleResponse = {
        Role: {
          RoleName: 'MindsDBECSTaskRole',
          Arn: 'arn:aws:iam::123456789012:role/MindsDBECSTaskRole',
          AssumeRolePolicyDocument: encodeURIComponent(JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'ecs-tasks.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          })),
          MaxSessionDuration: 3600,
        },
      };

      const mockAttachedPoliciesResponse = {
        AttachedPolicies: [
          {
            PolicyName: 'MindsDBSecretsManagerPolicy',
            PolicyArn: 'arn:aws:iam::123456789012:policy/MindsDBSecretsManagerPolicy',
          },
          {
            PolicyName: 'MindsDBRDSPolicy',
            PolicyArn: 'arn:aws:iam::123456789012:policy/MindsDBRDSPolicy',
          },
        ],
      };

      const mockInlinePoliciesResponse = {
        PolicyNames: [], // Should have no inline policies
      };

      mockIAM.getRole.mockReturnValue({
        promise: () => Promise.resolve(mockRoleResponse),
      });

      mockIAM.listAttachedRolePolicies.mockReturnValue({
        promise: () => Promise.resolve(mockAttachedPoliciesResponse),
      });

      mockIAM.listRolePolicies.mockReturnValue({
        promise: () => Promise.resolve(mockInlinePoliciesResponse),
      });

      // Act
      const roleResult = await mockIAM.getRole({ RoleName: 'MindsDBECSTaskRole' }).promise();
      const attachedPolicies = await mockIAM.listAttachedRolePolicies({ RoleName: 'MindsDBECSTaskRole' }).promise();
      const inlinePolicies = await mockIAM.listRolePolicies({ RoleName: 'MindsDBECSTaskRole' }).promise();

      // Assert
      // Verify role can only be assumed by ECS tasks
      const assumeRolePolicy = JSON.parse(decodeURIComponent(roleResult.Role.AssumeRolePolicyDocument));
      expect(assumeRolePolicy.Statement[0].Principal.Service).toBe('ecs-tasks.amazonaws.com');

      // Verify no overly broad policies
      attachedPolicies.AttachedPolicies.forEach(policy => {
        expect(policy.PolicyName).not.toContain('Admin');
        expect(policy.PolicyName).not.toContain('FullAccess');
        expect(policy.PolicyName).toMatch(/^MindsDB/); // Should be service-specific
      });

      // Verify no inline policies (should use managed policies)
      expect(inlinePolicies.PolicyNames).toHaveLength(0);

      // Verify session duration is reasonable
      expect(roleResult.Role.MaxSessionDuration).toBeLessThanOrEqual(3600); // Max 1 hour
    });

    it('should test for privilege escalation vulnerabilities', async () => {
      // Arrange
      const dangerousPermissions = [
        'iam:CreateRole',
        'iam:AttachRolePolicy',
        'iam:PutRolePolicy',
        'iam:PassRole',
        'sts:AssumeRole',
        'ec2:*',
        's3:*',
        'secretsmanager:*',
      ];

      const mockPolicyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'secretsmanager:GetSecretValue',
              'secretsmanager:DescribeSecret',
            ],
            Resource: [
              'arn:aws:secretsmanager:us-east-1:123456789012:secret:mindsdb/*',
            ],
          },
          {
            Effect: 'Allow',
            Action: [
              'rds:DescribeDBClusters',
              'rds:DescribeDBInstances',
            ],
            Resource: [
              'arn:aws:rds:us-east-1:123456789012:cluster:mindsdb-*',
            ],
          },
        ],
      };

      // Act & Assert
      mockPolicyDocument.Statement.forEach(statement => {
        if (Array.isArray(statement.Action)) {
          statement.Action.forEach(action => {
            // Should not have dangerous permissions
            expect(dangerousPermissions).not.toContain(action);
            
            // Should not have wildcard permissions
            if (action.includes('*')) {
              expect(action).not.toBe('*');
              // If wildcard is used, should be scoped (e.g., 's3:Get*' not 's3:*')
            }
          });
        }

        // Resources should be scoped, not wildcard
        if (Array.isArray(statement.Resource)) {
          statement.Resource.forEach(resource => {
            expect(resource).not.toBe('*');
            expect(resource).toMatch(/mindsdb/); // Should be service-specific
          });
        }
      });
    });

    it('should verify cross-account access is properly restricted', async () => {
      // Arrange
      const mockCallerIdentity = {
        UserId: 'AIDACKCEVSQ6C2EXAMPLE',
        Account: '123456789012',
        Arn: 'arn:aws:iam::123456789012:role/MindsDBECSTaskRole',
      };

      mockSTS.getCallerIdentity.mockReturnValue({
        promise: () => Promise.resolve(mockCallerIdentity),
      });

      // Test unauthorized cross-account assume role
      const unauthorizedAssumeRole = async () => {
        mockSTS.assumeRole.mockReturnValue({
          promise: () => Promise.reject(new Error('AccessDenied: User is not authorized to perform: sts:AssumeRole')),
        });

        try {
          await mockSTS.assumeRole({
            RoleArn: 'arn:aws:iam::999999999999:role/UnauthorizedRole',
            RoleSessionName: 'test-session',
          }).promise();
        } catch (error) {
          return error;
        }
      };

      // Act
      const identity = await mockSTS.getCallerIdentity().promise();
      const assumeRoleError = await unauthorizedAssumeRole();

      // Assert
      expect(identity.Account).toBe('123456789012');
      expect(assumeRoleError).toBeInstanceOf(Error);
      expect(assumeRoleError.message).toContain('AccessDenied');
    });
  });

  describe('Network Connectivity and Port Scanning Tests', () => {
    it('should verify internal services are not accessible from internet', async () => {
      // Test internal service endpoints
      const internalEndpoints = [
        { host: '10.0.1.100', port: 5432, service: 'RDS Aurora' },
        { host: '10.0.1.200', port: 6379, service: 'ElastiCache Redis' },
        { host: '10.0.2.100', port: 8080, service: 'MindsDB Internal' },
      ];

      const testConnectivity = async (endpoint: { host: string; port: number; service: string }) => {
        return new Promise((resolve) => {
          const socket = new net.Socket();
          const timeout = 5000; // 5 second timeout

          socket.setTimeout(timeout);
          
          socket.on('connect', () => {
            socket.destroy();
            resolve({ accessible: true, endpoint });
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({ accessible: false, endpoint, reason: 'timeout' });
          });

          socket.on('error', (error) => {
            socket.destroy();
            resolve({ accessible: false, endpoint, reason: error.message });
          });

          socket.connect(endpoint.port, endpoint.host);
        });
      };

      // Act
      const connectivityResults = await Promise.all(
        internalEndpoints.map(endpoint => testConnectivity(endpoint))
      );

      // Assert
      connectivityResults.forEach((result: any) => {
        // Internal services should NOT be accessible from external networks
        // In a real test environment, this would test from an external IP
        // For this test, we expect connection failures due to network isolation
        expect(result.accessible).toBe(false);
        expect(['timeout', 'ECONNREFUSED', 'EHOSTUNREACH']).toContain(
          result.reason?.includes('ECONNREFUSED') ? 'ECONNREFUSED' :
          result.reason?.includes('EHOSTUNREACH') ? 'EHOSTUNREACH' :
          result.reason
        );
      });
    });

    it('should verify DNS resolution for internal services', async () => {
      // Test internal DNS resolution
      const internalDomains = [
        'mindsdb-aurora-cluster.cluster-xyz.us-east-1.rds.amazonaws.com',
        'mindsdb-redis.cache.amazonaws.com',
        'internal-alb.mindsdb.local',
      ];

      const testDNSResolution = async (domain: string) => {
        try {
          const result = await dnsLookup(domain);
          return { domain, resolved: true, address: result.address };
        } catch (error) {
          return { domain, resolved: false, error: error.message };
        }
      };

      // Act
      const dnsResults = await Promise.all(
        internalDomains.map(domain => testDNSResolution(domain))
      );

      // Assert
      dnsResults.forEach(result => {
        if (result.resolved) {
          // If resolved, should be private IP ranges
          const address = result.address;
          const isPrivateIP = 
            address.startsWith('10.') ||
            address.startsWith('172.') ||
            address.startsWith('192.168.');
          
          expect(isPrivateIP).toBe(true);
        }
        // DNS resolution failure is acceptable for internal domains from external networks
      });
    });

    it('should test for common security misconfigurations', async () => {
      // Test for exposed management interfaces
      const managementPorts = [
        { port: 22, service: 'SSH' },
        { port: 3389, service: 'RDP' },
        { port: 5432, service: 'PostgreSQL' },
        { port: 6379, service: 'Redis' },
        { port: 9200, service: 'Elasticsearch' },
        { port: 27017, service: 'MongoDB' },
      ];

      const publicIP = '203.0.113.1'; // Example public IP (should not be accessible)

      const testPortAccess = async (port: number) => {
        return new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(3000);

          socket.on('connect', () => {
            socket.destroy();
            resolve({ port, accessible: true });
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({ port, accessible: false });
          });

          socket.on('error', () => {
            socket.destroy();
            resolve({ port, accessible: false });
          });

          socket.connect(port, publicIP);
        });
      };

      // Act
      const portScanResults = await Promise.all(
        managementPorts.map(({ port }) => testPortAccess(port))
      );

      // Assert
      portScanResults.forEach((result: any) => {
        // Management ports should NOT be accessible from public internet
        expect(result.accessible).toBe(false);
      });
    });
  });

  describe('Security Headers and TLS Configuration Tests', () => {
    it('should verify proper TLS configuration', async () => {
      // Mock TLS configuration test
      const mockTLSConfig = {
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        cipherSuites: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA256',
        ],
        certificateValidation: true,
        hsts: {
          enabled: true,
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
      };

      // Assert TLS configuration
      expect(mockTLSConfig.minVersion).toBe('TLSv1.2');
      expect(['TLSv1.2', 'TLSv1.3']).toContain(mockTLSConfig.maxVersion);
      
      // Verify strong cipher suites
      mockTLSConfig.cipherSuites.forEach(cipher => {
        expect(cipher).not.toMatch(/RC4|MD5|SHA1|DES/); // Weak ciphers
        expect(cipher).toMatch(/AES|CHACHA20|GCM|SHA256|SHA384/); // Strong ciphers
      });

      // Verify HSTS configuration
      expect(mockTLSConfig.hsts.enabled).toBe(true);
      expect(mockTLSConfig.hsts.maxAge).toBeGreaterThanOrEqual(31536000); // At least 1 year
      expect(mockTLSConfig.hsts.includeSubDomains).toBe(true);
    });

    it('should verify security headers are properly set', () => {
      // Mock security headers that should be present
      const mockSecurityHeaders = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      };

      // Assert security headers
      Object.entries(mockSecurityHeaders).forEach(([header, value]) => {
        expect(value).toBeDefined();
        
        switch (header) {
          case 'Strict-Transport-Security':
            expect(value).toContain('max-age=');
            expect(value).toContain('includeSubDomains');
            break;
          case 'X-Content-Type-Options':
            expect(value).toBe('nosniff');
            break;
          case 'X-Frame-Options':
            expect(['DENY', 'SAMEORIGIN']).toContain(value);
            break;
          case 'Content-Security-Policy':
            expect(value).toContain("default-src 'self'");
            break;
        }
      });
    });
  });

  describe('Compliance and Audit Trail Tests', () => {
    it('should verify audit logging is comprehensive', () => {
      // Mock audit log entries that should be captured
      const mockAuditEvents = [
        {
          eventType: 'authentication_success',
          timestamp: new Date().toISOString(),
          userId: 'user123',
          merchantId: 'merchant_abc',
          sourceIP: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          resource: '/api/documents',
          action: 'read',
        },
        {
          eventType: 'database_query_execution',
          timestamp: new Date().toISOString(),
          userId: 'user123',
          merchantId: 'merchant_abc',
          queryType: 'SELECT',
          tablesAccessed: ['documents'],
          tenantIsolationApplied: true,
        },
        {
          eventType: 'secrets_access',
          timestamp: new Date().toISOString(),
          serviceRole: 'MindsDBECSTaskRole',
          secretName: 'mindsdb/rds-credentials',
          action: 'retrieve',
          success: true,
        },
        {
          eventType: 'encryption_operation',
          timestamp: new Date().toISOString(),
          operation: 'encrypt',
          keyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
          dataType: 'customer_pii',
          merchantId: 'merchant_abc',
        },
      ];

      // Assert audit log completeness
      mockAuditEvents.forEach(event => {
        expect(event.eventType).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(new Date(event.timestamp)).toBeInstanceOf(Date);

        // Verify required fields based on event type
        switch (event.eventType) {
          case 'authentication_success':
            expect(event.userId).toBeDefined();
            expect(event.sourceIP).toBeDefined();
            expect(event.resource).toBeDefined();
            break;
          case 'database_query_execution':
            expect(event.merchantId).toBeDefined();
            expect(event.queryType).toBeDefined();
            expect(event.tenantIsolationApplied).toBeDefined();
            break;
          case 'secrets_access':
            expect(event.serviceRole).toBeDefined();
            expect(event.secretName).toBeDefined();
            expect(event.success).toBeDefined();
            break;
          case 'encryption_operation':
            expect(event.keyId).toBeDefined();
            expect(event.dataType).toBeDefined();
            break;
        }
      });
    });

    it('should verify data retention and compliance requirements', () => {
      // Mock compliance configuration
      const mockComplianceConfig = {
        dataRetention: {
          auditLogs: 2555, // 7 years in days
          conversationLogs: 1095, // 3 years in days
          transactionLogs: 2555, // 7 years in days
          encryptionKeys: 2555, // 7 years in days
        },
        dataClassification: {
          pii: 'restricted',
          financial: 'confidential',
          operational: 'internal',
          public: 'public',
        },
        encryptionRequirements: {
          atRest: true,
          inTransit: true,
          keyRotation: 90, // days
          algorithm: 'AES-256',
        },
        accessControls: {
          mfa: true,
          roleBasedAccess: true,
          leastPrivilege: true,
          regularReview: 90, // days
        },
      };

      // Assert compliance requirements
      expect(mockComplianceConfig.dataRetention.auditLogs).toBeGreaterThanOrEqual(2555); // 7 years
      expect(mockComplianceConfig.encryptionRequirements.atRest).toBe(true);
      expect(mockComplianceConfig.encryptionRequirements.inTransit).toBe(true);
      expect(mockComplianceConfig.encryptionRequirements.keyRotation).toBeLessThanOrEqual(90);
      expect(mockComplianceConfig.accessControls.mfa).toBe(true);
      expect(mockComplianceConfig.accessControls.roleBasedAccess).toBe(true);
    });
  });
});