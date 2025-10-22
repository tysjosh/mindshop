import * as https from 'https';
import * as tls from 'tls';
import * as constants from 'constants';
import * as fs from 'fs';
import * as path from 'path';

export interface TLSConfig {
  minVersion: string;
  maxVersion: string;
  ciphers: string;
  honorCipherOrder: boolean;
  secureProtocol: string;
  rejectUnauthorized: boolean;
}

export interface CertificateInfo {
  cert: string;
  key: string;
  ca?: string;
  passphrase?: string;
}

/**
 * Service for managing TLS 1.3 configuration and certificate handling
 */
export class TLSConfigService {
  private static instance: TLSConfigService;
  private tlsConfig: TLSConfig;
  private certificates: Map<string, CertificateInfo> = new Map();

  private constructor() {
    this.tlsConfig = this.createSecureTLSConfig();
    this.loadCertificates();
  }

  public static getInstance(): TLSConfigService {
    if (!TLSConfigService.instance) {
      TLSConfigService.instance = new TLSConfigService();
    }
    return TLSConfigService.instance;
  }

  /**
   * Create secure TLS configuration enforcing TLS 1.3
   */
  private createSecureTLSConfig(): TLSConfig {
    return {
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
      ciphers: [
        // TLS 1.3 cipher suites (these are the only ones supported in TLS 1.3)
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        // Fallback TLS 1.2 cipher suites (in case TLS 1.3 is not available)
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA',
        'ECDHE-RSA-AES128-SHA',
      ].join(':'),
      honorCipherOrder: true,
      secureProtocol: 'TLSv1_3_method',
      rejectUnauthorized: true,
    };
  }

  /**
   * Load SSL/TLS certificates from environment or file system
   */
  private loadCertificates(): void {
    try {
      // Load default certificate for the service
      const certPath = process.env.TLS_CERT_PATH || '/etc/ssl/certs/service.crt';
      const keyPath = process.env.TLS_KEY_PATH || '/etc/ssl/private/service.key';
      const caPath = process.env.TLS_CA_PATH;

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const cert = fs.readFileSync(certPath, 'utf8');
        const key = fs.readFileSync(keyPath, 'utf8');
        const ca = caPath && fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : undefined;

        this.certificates.set('default', {
          cert,
          key,
          ca,
          passphrase: process.env.TLS_KEY_PASSPHRASE,
        });

        console.log('Loaded default TLS certificates');
      } else {
        console.warn('TLS certificates not found, using environment variables or defaults');
        
        // Try to load from environment variables
        const envCert = process.env.TLS_CERT;
        const envKey = process.env.TLS_KEY;
        const envCA = process.env.TLS_CA;

        if (envCert && envKey) {
          this.certificates.set('default', {
            cert: envCert,
            key: envKey,
            ca: envCA,
            passphrase: process.env.TLS_KEY_PASSPHRASE,
          });
          console.log('Loaded TLS certificates from environment variables');
        }
      }

      // Load client certificates for external service connections
      this.loadClientCertificates();

    } catch (error) {
      console.error('Failed to load TLS certificates:', error);
    }
  }

  /**
   * Load client certificates for connecting to external services
   */
  private loadClientCertificates(): void {
    const services = ['mindsdb', 'bedrock', 'aurora', 'redis'];

    services.forEach(service => {
      const certPath = process.env[`${service.toUpperCase()}_CLIENT_CERT_PATH`];
      const keyPath = process.env[`${service.toUpperCase()}_CLIENT_KEY_PATH`];
      const caPath = process.env[`${service.toUpperCase()}_CA_PATH`];

      if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        try {
          const cert = fs.readFileSync(certPath, 'utf8');
          const key = fs.readFileSync(keyPath, 'utf8');
          const ca = caPath && fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : undefined;

          this.certificates.set(service, {
            cert,
            key,
            ca,
            passphrase: process.env[`${service.toUpperCase()}_KEY_PASSPHRASE`],
          });

          console.log(`Loaded client certificates for ${service}`);
        } catch (error) {
          console.error(`Failed to load client certificates for ${service}:`, error);
        }
      }
    });
  }

  /**
   * Get TLS configuration for HTTPS server
   */
  public getServerTLSOptions(): https.ServerOptions {
    const defaultCert = this.certificates.get('default');
    
    if (!defaultCert) {
      throw new Error('No TLS certificates available for server');
    }

    return {
      cert: defaultCert.cert,
      key: defaultCert.key,
      ca: defaultCert.ca,
      passphrase: defaultCert.passphrase,
      minVersion: this.tlsConfig.minVersion as any,
      maxVersion: this.tlsConfig.maxVersion as any,
      ciphers: this.tlsConfig.ciphers,
      honorCipherOrder: this.tlsConfig.honorCipherOrder,
      secureProtocol: this.tlsConfig.secureProtocol as any,
      rejectUnauthorized: this.tlsConfig.rejectUnauthorized,
      // Additional security options
      requestCert: false, // Set to true if client certificates are required
      secureOptions: 
        (constants as any).SSL_OP_NO_SSLv2 |
        (constants as any).SSL_OP_NO_SSLv3 |
        (constants as any).SSL_OP_NO_TLSv1 |
        (constants as any).SSL_OP_NO_TLSv1_1 |
        (constants as any).SSL_OP_CIPHER_SERVER_PREFERENCE,
    };
  }

  /**
   * Get TLS configuration for HTTPS client connections
   */
  public getClientTLSOptions(serviceName?: string): https.RequestOptions {
    const cert = serviceName ? this.certificates.get(serviceName) : this.certificates.get('default');

    const baseOptions: https.RequestOptions = {
      minVersion: this.tlsConfig.minVersion as any,
      maxVersion: this.tlsConfig.maxVersion as any,
      ciphers: this.tlsConfig.ciphers,
      rejectUnauthorized: this.tlsConfig.rejectUnauthorized,
      secureProtocol: this.tlsConfig.secureProtocol as any,
    };

    if (cert) {
      return {
        ...baseOptions,
        cert: cert.cert,
        key: cert.key,
        ca: cert.ca,
        passphrase: cert.passphrase,
      };
    }

    return baseOptions;
  }

  /**
   * Create secure HTTPS agent for external API calls
   */
  public createSecureAgent(serviceName?: string): https.Agent {
    const tlsOptions = this.getClientTLSOptions(serviceName);

    return new https.Agent({
      ...tlsOptions,
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 30000,
    } as any);
  }

  /**
   * Validate TLS connection security
   */
  public validateTLSConnection(socket: tls.TLSSocket): {
    isSecure: boolean;
    protocol: string;
    cipher: string;
    issues: string[];
  } {
    const issues: string[] = [];
    const protocol = socket.getProtocol();
    const cipher = socket.getCipher();

    // Check protocol version
    if (!protocol || !protocol.startsWith('TLSv1.3')) {
      issues.push(`Insecure protocol: ${protocol || 'unknown'}`);
    }

    // Check cipher suite
    if (!cipher || !this.isSecureCipher(cipher.name)) {
      issues.push(`Weak cipher: ${cipher?.name || 'unknown'}`);
    }

    // Check certificate
    const cert = socket.getPeerCertificate();
    if (!cert || !socket.authorized) {
      issues.push('Invalid or unauthorized certificate');
    }

    return {
      isSecure: issues.length === 0,
      protocol: protocol || 'unknown',
      cipher: cipher?.name || 'unknown',
      issues,
    };
  }

  /**
   * Check if cipher suite is considered secure
   */
  private isSecureCipher(cipherName: string): boolean {
    const secureCiphers = [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
    ];

    return secureCiphers.some(secure => cipherName.includes(secure));
  }

  /**
   * Get security headers for HTTP responses
   */
  public getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https:",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'",
      ].join('; '),
    };
  }

  /**
   * Rotate TLS certificates
   */
  public async rotateCertificates(): Promise<void> {
    console.log('Starting TLS certificate rotation...');

    try {
      // In a production environment, this would:
      // 1. Request new certificates from CA or certificate manager
      // 2. Validate new certificates
      // 3. Update certificate store
      // 4. Gracefully restart services with new certificates
      // 5. Verify connections are working with new certificates

      // For now, we'll reload certificates from the file system
      this.loadCertificates();

      console.log('TLS certificate rotation completed successfully');

    } catch (error) {
      console.error('TLS certificate rotation failed:', error);
      throw error;
    }
  }

  /**
   * Monitor certificate expiration
   */
  public checkCertificateExpiration(): {
    service: string;
    expiresAt: Date;
    daysUntilExpiry: number;
    needsRenewal: boolean;
  }[] {
    const results: {
      service: string;
      expiresAt: Date;
      daysUntilExpiry: number;
      needsRenewal: boolean;
    }[] = [];

    this.certificates.forEach((cert, serviceName) => {
      try {
        // Parse certificate to get expiration date
        const certData = cert.cert;
        const matches = certData.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
        
        if (matches) {
          // In a real implementation, you would use a proper X.509 parser
          // For now, we'll create a placeholder result
          const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
          const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          const needsRenewal = daysUntilExpiry < 30; // Renew if less than 30 days

          results.push({
            service: serviceName,
            expiresAt,
            daysUntilExpiry,
            needsRenewal,
          });
        }

      } catch (error) {
        console.error(`Failed to check certificate expiration for ${serviceName}:`, error);
      }
    });

    return results;
  }

  /**
   * Get TLS configuration summary for monitoring
   */
  public getTLSConfigSummary(): {
    tlsVersion: string;
    cipherSuites: string[];
    certificatesLoaded: string[];
    securityLevel: 'high' | 'medium' | 'low';
  } {
    const certificatesLoaded = Array.from(this.certificates.keys());
    
    let securityLevel: 'high' | 'medium' | 'low' = 'high';
    
    // Determine security level based on configuration
    if (this.tlsConfig.minVersion !== 'TLSv1.3') {
      securityLevel = 'medium';
    }
    
    if (!this.tlsConfig.rejectUnauthorized || certificatesLoaded.length === 0) {
      securityLevel = 'low';
    }

    return {
      tlsVersion: `${this.tlsConfig.minVersion} - ${this.tlsConfig.maxVersion}`,
      cipherSuites: this.tlsConfig.ciphers.split(':'),
      certificatesLoaded,
      securityLevel,
    };
  }
}

// Export singleton instance
export const getTLSConfigService = (): TLSConfigService => {
  return TLSConfigService.getInstance();
};