export interface ModelArtifact {
    modelId: string;
    version: string;
    merchantId: string;
    predictorName: string;
    s3Location: string;
    metadata: {
        trainingDataSize: number;
        accuracy: number;
        features: string[];
        hyperparameters: Record<string, any>;
        trainingDuration: number;
        datasetHash: string;
        modelSize: number;
    };
    createdAt: Date;
    size: number;
    checksum: string;
    tags: Record<string, string>;
}
export interface ArtifactVersion {
    version: string;
    s3Location: string;
    createdAt: Date;
    size: number;
    checksum: string;
    isActive: boolean;
    metadata: Record<string, any>;
}
export interface ArtifactStorageConfig {
    bucketName: string;
    region: string;
    encryptionKey?: string;
    versioningEnabled: boolean;
    lifecyclePolicy: {
        deleteAfterDays: number;
        transitionToIA: number;
        transitionToGlacier: number;
    };
}
export interface MindsDBStudioIntegration {
    studioEndpoint: string;
    apiKey: string;
    projectId: string;
}
/**
 * Model Artifact Storage Service
 * Manages model artifacts in S3 with versioning and MindsDB Studio integration
 */
export declare class ModelArtifactService {
    private cacheService;
    private storageConfig;
    private studioIntegration?;
    constructor(storageConfig?: ArtifactStorageConfig, studioIntegration?: MindsDBStudioIntegration);
    /**
     * Initialize S3 storage configuration
     */
    private initializeStorage;
    /**
     * Store a model artifact in S3 with versioning
     */
    storeArtifact(merchantId: string, predictorName: string, artifactData: Buffer, metadata: Partial<ModelArtifact['metadata']>, tags?: Record<string, string>): Promise<ModelArtifact>;
    /**
     * Retrieve a model artifact
     */
    getArtifact(merchantId: string, predictorName: string, version?: string): Promise<ModelArtifact | null>;
    /**
     * Download artifact data from S3
     */
    downloadArtifact(merchantId: string, predictorName: string, version?: string): Promise<Buffer | null>;
    /**
     * List all versions of a model artifact
     */
    listVersions(merchantId: string, predictorName: string): Promise<ArtifactVersion[]>;
    /**
     * Delete a specific version of an artifact
     */
    deleteVersion(merchantId: string, predictorName: string, version: string): Promise<void>;
    /**
     * Set active version for a predictor
     */
    setActiveVersion(merchantId: string, predictorName: string, version: string): Promise<void>;
    /**
     * Get active version for a predictor
     */
    getActiveVersion(merchantId: string, predictorName: string): Promise<string | null>;
    /**
     * Compare two artifact versions
     */
    compareVersions(merchantId: string, predictorName: string, version1: string, version2: string): Promise<{
        version1: ModelArtifact;
        version2: ModelArtifact;
        differences: {
            accuracy: number;
            size: number;
            features: {
                added: string[];
                removed: string[];
            };
            hyperparameters: Record<string, {
                old: any;
                new: any;
            }>;
        };
    }>;
    /**
     * Get storage statistics
     */
    getStorageStats(merchantId?: string): Promise<{
        totalArtifacts: number;
        totalSize: number;
        averageSize: number;
        oldestArtifact: Date;
        newestArtifact: Date;
        costEstimate: number;
    }>;
    /**
     * Clean up old artifacts based on lifecycle policy
     */
    cleanupOldArtifacts(): Promise<{
        deleted: number;
        transitionedToIA: number;
        transitionedToGlacier: number;
    }>;
    /**
     * Private helper methods
     */
    private generateVersion;
    private generateS3Key;
    private extractS3Key;
    private calculateChecksum;
    private uploadToS3;
    private downloadFromS3;
    private deleteFromS3;
    private storeArtifactMetadata;
    private removeArtifactMetadata;
    private registerWithStudio;
    private unregisterFromStudio;
    private updateStudioActiveVersion;
    private compareFeatures;
    private compareHyperparameters;
}
export declare const getModelArtifactService: () => ModelArtifactService;
//# sourceMappingURL=ModelArtifactService.d.ts.map