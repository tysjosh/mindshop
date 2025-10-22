import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelRetrainingPipeline, PipelineConfig } from '../ModelRetrainingPipeline';

// Mock the dependencies
vi.mock('../ModelRetrainingService', () => ({
  getModelRetrainingService: () => ({
    createRetrainingJob: vi.fn().mockResolvedValue('job-123'),
    listJobs: vi.fn().mockReturnValue([]),
    getJobStatus: vi.fn().mockReturnValue(null)
  })
}));

vi.mock('../DriftDetectionService', () => ({
  getDriftDetectionService: () => ({
    startMonitoring: vi.fn().mockResolvedValue(undefined),
    stopMonitoring: vi.fn(),
    getActiveAlerts: vi.fn().mockReturnValue([])
  })
}));

vi.mock('../ModelArtifactService', () => ({
  getModelArtifactService: () => ({
    storeArtifact: vi.fn().mockResolvedValue({}),
    getArtifact: vi.fn().mockResolvedValue(null)
  })
}));

vi.mock('../TrainingJobOrchestrator', () => ({
  getTrainingJobOrchestrator: () => ({
    submitJob: vi.fn().mockResolvedValue('exec-123'),
    getExecution: vi.fn().mockReturnValue(null)
  })
}));

vi.mock('../CacheService', () => ({
  getCacheService: () => ({
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined)
  })
}));

describe('ModelRetrainingPipeline', () => {
  let pipeline: ModelRetrainingPipeline;
  let mockConfig: PipelineConfig;

  beforeEach(() => {
    pipeline = new ModelRetrainingPipeline();
    
    mockConfig = {
      merchantId: 'test-merchant',
      predictorName: 'test-predictor',
      retrainingConfig: {
        merchantId: 'test-merchant',
        predictorName: 'test-predictor',
        trainingDataQuery: 'SELECT * FROM training_data',
        schedule: 'weekly',
        spotInstanceConfig: {
          instanceType: 'c5.large',
          maxPrice: 0.05,
          availabilityZone: 'us-east-1a'
        },
        resourceLimits: {
          cpu: '2',
          memory: '4096',
          timeout: 3600
        }
      },
      driftConfig: {
        merchantId: 'test-merchant',
        predictorName: 'test-predictor',
        monitoringWindow: 24,
        confidenceThreshold: 0.1,
        accuracyThreshold: 0.05,
        featureImportanceThreshold: 0.1,
        dataDistributionThreshold: 0.1,
        alertChannels: ['email'],
        autoRetrain: true
      },
      scheduledRetraining: {
        enabled: true,
        cronExpression: '0 2 * * 0',
        timezone: 'UTC'
      },
      costLimits: {
        maxCostPerJob: 10.0,
        maxMonthlyCost: 100.0,
        alertThreshold: 80.0
      },
      notifications: {
        email: ['admin@example.com']
      }
    };
  });

  describe('createPipeline', () => {
    it('should create a new pipeline with valid configuration', async () => {
      await expect(pipeline.createPipeline(mockConfig)).resolves.not.toThrow();
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = { ...mockConfig, merchantId: '' };
      await expect(pipeline.createPipeline(invalidConfig)).rejects.toThrow('merchantId and predictorName are required');
    });

    it('should throw error for negative cost limits', async () => {
      const invalidConfig = { ...mockConfig, costLimits: { ...mockConfig.costLimits, maxCostPerJob: -1 } };
      await expect(pipeline.createPipeline(invalidConfig)).rejects.toThrow('Cost limits must be positive values');
    });

    it('should throw error for invalid confidence threshold', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        driftConfig: { ...mockConfig.driftConfig, confidenceThreshold: 1.5 } 
      };
      await expect(pipeline.createPipeline(invalidConfig)).rejects.toThrow('Confidence threshold must be between 0 and 1');
    });
  });

  describe('triggerRetraining', () => {
    beforeEach(async () => {
      await pipeline.createPipeline(mockConfig);
    });

    it('should trigger manual retraining successfully', async () => {
      const jobId = await pipeline.triggerRetraining('test-merchant', 'test-predictor', 'manual');
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should throw error for non-existent pipeline', async () => {
      await expect(
        pipeline.triggerRetraining('non-existent', 'predictor', 'manual')
      ).rejects.toThrow('Pipeline non-existent:predictor not found');
    });
  });

  describe('getPipelineStatus', () => {
    beforeEach(async () => {
      await pipeline.createPipeline(mockConfig);
    });

    it('should return pipeline status', async () => {
      const status = await pipeline.getPipelineStatus('test-merchant', 'test-predictor');
      
      expect(status).toMatchObject({
        merchantId: 'test-merchant',
        predictorName: 'test-predictor',
        isActive: true
      });
      
      expect(status.driftStatus).toBeDefined();
      expect(status.costTracking).toBeDefined();
      expect(status.performance).toBeDefined();
    });

    it('should throw error for non-existent pipeline', async () => {
      await expect(
        pipeline.getPipelineStatus('non-existent', 'predictor')
      ).rejects.toThrow('Pipeline non-existent:predictor not found');
    });
  });

  describe('updatePipeline', () => {
    beforeEach(async () => {
      await pipeline.createPipeline(mockConfig);
    });

    it('should update pipeline configuration', async () => {
      const updates = {
        costLimits: {
          maxCostPerJob: 15.0,
          maxMonthlyCost: 150.0,
          alertThreshold: 120.0
        }
      };

      await expect(
        pipeline.updatePipeline('test-merchant', 'test-predictor', updates)
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid updates', async () => {
      const invalidUpdates = {
        costLimits: {
          maxCostPerJob: -5.0,
          maxMonthlyCost: 100.0,
          alertThreshold: 80.0
        }
      };

      await expect(
        pipeline.updatePipeline('test-merchant', 'test-predictor', invalidUpdates)
      ).rejects.toThrow('Cost limits must be positive values');
    });
  });

  describe('removePipeline', () => {
    beforeEach(async () => {
      await pipeline.createPipeline(mockConfig);
    });

    it('should remove pipeline successfully', async () => {
      await expect(
        pipeline.removePipeline('test-merchant', 'test-predictor')
      ).resolves.not.toThrow();
    });
  });

  describe('listPipelines', () => {
    beforeEach(async () => {
      await pipeline.createPipeline(mockConfig);
    });

    it('should list all pipelines', () => {
      const pipelines = pipeline.listPipelines();
      expect(pipelines).toHaveLength(1);
      expect(pipelines[0].merchantId).toBe('test-merchant');
    });

    it('should filter pipelines by merchant', () => {
      const pipelines = pipeline.listPipelines('test-merchant');
      expect(pipelines).toHaveLength(1);
      
      const emptyPipelines = pipeline.listPipelines('other-merchant');
      expect(emptyPipelines).toHaveLength(0);
    });
  });

  describe('getPipelineMetrics', () => {
    it('should return pipeline metrics', async () => {
      const metrics = await pipeline.getPipelineMetrics();
      
      expect(metrics).toMatchObject({
        totalRetrainingJobs: expect.any(Number),
        successfulJobs: expect.any(Number),
        failedJobs: expect.any(Number),
        averageJobDuration: expect.any(Number),
        totalCostSavings: expect.any(Number),
        driftDetectionAccuracy: expect.any(Number),
        averageModelImprovement: expect.any(Number)
      });
    });

    it('should return metrics for specific merchant', async () => {
      const metrics = await pipeline.getPipelineMetrics('test-merchant');
      expect(metrics).toBeDefined();
    });
  });
});