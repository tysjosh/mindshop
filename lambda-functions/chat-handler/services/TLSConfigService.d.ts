import * as https from 'https';
import * as tls from 'tls';
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
export declare class TLSConfigService {
    private static instance;
    private tlsConfig;
    private certificates;
    private constructor();
    static getInstance(): TLSConfigService;
    /**
     * Create secure TLS configuration enforcing TLS 1.3
     */
    private createSecureTLSConfig;
    /**
     * Load SSL/TLS certificates from environment or file system
     */
    private loadCertificates;
    /**
     * Load client certificates for connecting to external services
     */
    private loadClientCertificates;
    /**
     * Get TLS configuration for HTTPS server
     */
    getServerTLSOptions(): https.ServerOptions;
    /**
     * Get TLS configuration for HTTPS client connections
     */
    getClientTLSOptions(serviceName?: string): https.RequestOptions;
    /**
     * Create secure HTTPS agent for external API calls
     */
    createSecureAgent(serviceName?: string): https.Agent;
    /**
     * Validate TLS connection security
     */
    validateTLSConnection(socket: tls.TLSSocket): {
        isSecure: boolean;
        protocol: string;
        cipher: string;
        issues: string[];
    };
    /**
     * Check if cipher suite is considered secure
     */
    private isSecureCipher;
    /**
     * Get security headers for HTTP responses
     */
    getSecurityHeaders(): Record<string, string>;
    /**
     * Rotate TLS certificates
     */
    rotateCertificates(): Promise<void>;
    /**
     * Monitor certificate expiration
     */
    checkCertificateExpiration(): {
        service: string;
        expiresAt: Date;
        daysUntilExpiry: number;
        needsRenewal: boolean;
    }[];
    /**
     * Get TLS configuration summary for monitoring
     */
    getTLSConfigSummary(): {
        tlsVersion: string;
        cipherSuites: string[];
        certificatesLoaded: string[];
        securityLevel: 'high' | 'medium' | 'low';
    };
}
export declare const getTLSConfigService: () => TLSConfigService;
//# sourceMappingURL=TLSConfigService.d.ts.map