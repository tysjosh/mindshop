"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelArtifactService = exports.ModelArtifactService = void 0;
const crypto_1 = require("crypto");
const config_1 = require("../config");
const CacheService_1 = require("./CacheService");
/**
 * Model Artifact Storage Service
 * Manages model artifacts in S3 with versioning and MindsDB Studio integration
 */
class ModelArtifactService {
    constructor(storageConfig, studioIntegration) {
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.storageConfig = storageConfig || {
            bucketName: config_1.config.s3?.modelArtifactsBucket || 'mindsdb-model-artifacts',
            region: config_1.config.aws?.region || 'us-east-1',
            encryptionKey: config_1.config.kms?.modelArtifactsKey,
            versioningEnabled: true,
            lifecyclePolicy: {
                deleteAfterDays: 365,
                transitionToIA: 30,
                transitionToGlacier: 90
            }
        };
        this.studioIntegration = studioIntegration;
        this.initializeStorage();
    }
    /**
     * Initialize S3 storage configuration
     */
    async initializeStorage() {
        // This would set up S3 bucket policies, versioning, and lifecycle rules
        console.log('Initializing model artifact storage...');
    }
    /**
     * Store a model artifact in S3 with versioning
     */
    async storeArtifact(merchantId, predictorName, artifactData, metadata, tags) {
        const version = this.generateVersion();
        const modelId = `${predictorName}-${merchantId}`;
        const checksum = this.calculateChecksum(artifactData);
        const s3Key = this.generateS3Key(merchantId, predictorName, version);
        const s3Location = `s3://${this.storageConfig.bucketName}/${s3Key}`;
        // Upload to S3 with versioning and encryption
        await this.uploadToS3(s3Key, artifactData, {
            merchantId,
            predictorName,
            version,
            checksum,
            ...tags
        });
        const artifact = {
            modelId,
            version,
            merchantId,
            predictorName,
            s3Location,
            metadata: {
                trainingDataSize: metadata.trainingDataSize || 0,
                accuracy: metadata.accuracy || 0,
                features: metadata.features || [],
                hyperparameters: metadata.hyperparameters || {},
                trainingDuration: metadata.trainingDuration || 0,
                datasetHash: metadata.datasetHash || '',
                modelSize: artifactData.length,
            },
            createdAt: new Date(),
            size: artifactData.length,
            checksum,
            tags: tags || {}
        };
        // Store artifact metadata in cache and database
        await this.storeArtifactMetadata(artifact);
        // Register with MindsDB Studio if configured
        if (this.studioIntegration) {
            await this.registerWithStudio(artifact);
        }
        // Update active version pointer
        await this.setActiveVersion(merchantId, predictorName, version);
        return artifact;
    }
    /**
     * Retrieve a model artifact
     */
    async getArtifact(merchantId, predictorName, version) {
        const effectiveVersion = version || await this.getActiveVersion(merchantId, predictorName);
        if (!effectiveVersion) {
            return null;
        }
        const cacheKey = `artifact:${merchantId}:${predictorName}:${effectiveVersion}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        // This would query from database in a real implementation
        // For now, we'll return null if not in cache
        return null;
    }
    /**
     * Download artifact data from S3
     */
    async downloadArtifact(merchantId, predictorName, version) {
        const artifact = await this.getArtifact(merchantId, predictorName, version);
        if (!artifact) {
            return null;
        }
        const s3Key = this.extractS3Key(artifact.s3Location);
        return await this.downloadFromS3(s3Key);
    }
    /**
     * List all versions of a model artifact
     */
    async listVersions(merchantId, predictorName) {
        const cacheKey = `versions:${merchantId}:${predictorName}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        // This would query S3 versions or database
        // For now, we'll return simulated versions
        const versions = [
            {
                version: 'v2024-01-15T10-30-00',
                s3Location: `s3://${this.storageConfig.bucketName}/${merchantId}/${predictorName}/v2024-01-15T10-30-00/model.pkl`,
                createdAt: new Date('2024-01-15T10:30:00Z'),
                size: 50 * 1024 * 1024,
                checksum: 'sha256:abc123...',
                isActive: true,
                metadata: { accuracy: 0.85 }
            },
            {
                version: 'v2024-01-08T10-30-00',
                s3Location: `s3://${this.storageConfig.bucketName}/${merchantId}/${predictorName}/v2024-01-08T10-30-00/model.pkl`,
                createdAt: new Date('2024-01-08T10:30:00Z'),
                size: 48 * 1024 * 1024,
                checksum: 'sha256:def456...',
                isActive: false,
                metadata: { accuracy: 0.82 }
            }
        ];
        // Cache for 1 hour
        await this.cacheService.set(cacheKey, versions, 3600);
        return versions;
    }
    /**
     * Delete a specific version of an artifact
     */
    async deleteVersion(merchantId, predictorName, version) {
        const artifact = await this.getArtifact(merchantId, predictorName, version);
        if (!artifact) {
            throw new Error(`Artifact version ${version} not found`);
        }
        // Check if this is the active version
        const activeVersion = await this.getActiveVersion(merchantId, predictorName);
        if (activeVersion === version) {
            throw new Error('Cannot delete active version. Set a different version as active first.');
        }
        const s3Key = this.extractS3Key(artifact.s3Location);
        await this.deleteFromS3(s3Key);
        // Remove from cache and database
        await this.removeArtifactMetadata(merchantId, predictorName, version);
        // Unregister from MindsDB Studio if configured
        if (this.studioIntegration) {
            await this.unregisterFromStudio(artifact);
        }
    }
    /**
     * Set active version for a predictor
     */
    async setActiveVersion(merchantId, predictorName, version) {
        const artifact = await this.getArtifact(merchantId, predictorName, version);
        if (!artifact) {
            throw new Error(`Artifact version ${version} not found`);
        }
        const activeVersionKey = `active_version:${merchantId}:${predictorName}`;
        await this.cacheService.set(activeVersionKey, version, 24 * 60 * 60); // 24 hours
        // Update MindsDB Studio if configured
        if (this.studioIntegration) {
            await this.updateStudioActiveVersion(artifact);
        }
    }
    /**
     * Get active version for a predictor
     */
    async getActiveVersion(merchantId, predictorName) {
        const activeVersionKey = `active_version:${merchantId}:${predictorName}`;
        return await this.cacheService.get(activeVersionKey);
    }
    /**
     * Compare two artifact versions
     */
    async compareVersions(merchantId, predictorName, version1, version2) {
        const artifact1 = await this.getArtifact(merchantId, predictorName, version1);
        const artifact2 = await this.getArtifact(merchantId, predictorName, version2);
        if (!artifact1 || !artifact2) {
            throw new Error('One or both artifact versions not found');
        }
        const differences = {
            accuracy: artifact2.metadata.accuracy - artifact1.metadata.accuracy,
            size: artifact2.size - artifact1.size,
            features: this.compareFeatures(artifact1.metadata.features, artifact2.metadata.features),
            hyperparameters: this.compareHyperparameters(artifact1.metadata.hyperparameters, artifact2.metadata.hyperparameters)
        };
        return {
            version1: artifact1,
            version2: artifact2,
            differences
        };
    }
    /**
     * Get storage statistics
     */
    async getStorageStats(merchantId) {
        // This would query actual storage statistics
        // For now, we'll return simulated stats
        return {
            totalArtifacts: 25,
            totalSize: 1.2 * 1024 * 1024 * 1024, // 1.2 GB
            averageSize: 50 * 1024 * 1024, // 50 MB
            oldestArtifact: new Date('2023-12-01'),
            newestArtifact: new Date(),
            costEstimate: 0.023 // $0.023 per month
        };
    }
    /**
     * Clean up old artifacts based on lifecycle policy
     */
    async cleanupOldArtifacts() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.storageConfig.lifecyclePolicy.deleteAfterDays);
        // This would implement actual cleanup logic
        // For now, we'll return simulated results
        return {
            deleted: 5,
            transitionedToIA: 12,
            transitionedToGlacier: 8
        };
    }
    /**
     * Private helper methods
     */
    generateVersion() {
        const now = new Date();
        return `v${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
    }
    generateS3Key(merchantId, predictorName, version) {
        return `${merchantId}/${predictorName}/${version}/model.pkl`;
    }
    extractS3Key(s3Location) {
        return s3Location.replace(`s3://${this.storageConfig.bucketName}/`, '');
    }
    calculateChecksum(data) {
        return `sha256:${(0, crypto_1.createHash)('sha256').update(data).digest('hex')}`;
    }
    async uploadToS3(key, data, tags) {
        // This would use AWS SDK to upload to S3
        console.log(`Uploading artifact to S3: ${key} (${data.length} bytes)`);
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async downloadFromS3(key) {
        // This would use AWS SDK to download from S3
        console.log(`Downloading artifact from S3: ${key}`);
        // Return simulated data
        return Buffer.from('simulated model data');
    }
    async deleteFromS3(key) {
        // This would use AWS SDK to delete from S3
        console.log(`Deleting artifact from S3: ${key}`);
    }
    async storeArtifactMetadata(artifact) {
        const cacheKey = `artifact:${artifact.merchantId}:${artifact.predictorName}:${artifact.version}`;
        await this.cacheService.set(cacheKey, artifact, 24 * 60 * 60); // 24 hours
    }
    async removeArtifactMetadata(merchantId, predictorName, version) {
        const cacheKey = `artifact:${merchantId}:${predictorName}:${version}`;
        await this.cacheService.delete(cacheKey);
    }
    async registerWithStudio(artifact) {
        if (!this.studioIntegration)
            return;
        // This would register the model with MindsDB Studio
        console.log(`Registering artifact with MindsDB Studio: ${artifact.modelId} v${artifact.version}`);
    }
    async unregisterFromStudio(artifact) {
        if (!this.studioIntegration)
            return;
        // This would unregister the model from MindsDB Studio
        console.log(`Unregistering artifact from MindsDB Studio: ${artifact.modelId} v${artifact.version}`);
    }
    async updateStudioActiveVersion(artifact) {
        if (!this.studioIntegration)
            return;
        // This would update the active version in MindsDB Studio
        console.log(`Updating active version in MindsDB Studio: ${artifact.modelId} v${artifact.version}`);
    }
    compareFeatures(features1, features2) {
        const set1 = new Set(features1);
        const set2 = new Set(features2);
        return {
            added: features2.filter(f => !set1.has(f)),
            removed: features1.filter(f => !set2.has(f))
        };
    }
    compareHyperparameters(params1, params2) {
        const differences = {};
        const allKeys = new Set([...Object.keys(params1), ...Object.keys(params2)]);
        for (const key of allKeys) {
            if (params1[key] !== params2[key]) {
                differences[key] = {
                    old: params1[key],
                    new: params2[key]
                };
            }
        }
        return differences;
    }
}
exports.ModelArtifactService = ModelArtifactService;
// Export singleton instance
let modelArtifactServiceInstance = null;
const getModelArtifactService = () => {
    if (!modelArtifactServiceInstance) {
        modelArtifactServiceInstance = new ModelArtifactService();
    }
    return modelArtifactServiceInstance;
};
exports.getModelArtifactService = getModelArtifactService;
//# sourceMappingURL=ModelArtifactService.js.map