import { getUsageAggregationJob } from "./UsageAggregationJob";

/**
 * Simple job scheduler for running background tasks
 * 
 * In production, you would use:
 * - AWS EventBridge (CloudWatch Events) for scheduled Lambda invocations
 * - Kubernetes CronJobs
 * - node-cron or bull/bee-queue for Node.js-based scheduling
 * 
 * This is a basic implementation for development/testing
 */

interface SchedulerConfig {
  usageAggregationInterval?: number; // in milliseconds
  enableUsageAggregation?: boolean;
}

export class JobScheduler {
  private config: SchedulerConfig;
  private intervals: NodeJS.Timeout[] = [];
  private isRunning: boolean = false;

  constructor(config: SchedulerConfig = {}) {
    this.config = {
      usageAggregationInterval: config.usageAggregationInterval || 3600000, // 1 hour default
      enableUsageAggregation: config.enableUsageAggregation !== false, // enabled by default
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log("[JobScheduler] Already running");
      return;
    }

    console.log("[JobScheduler] Starting job scheduler");
    this.isRunning = true;

    // Schedule usage aggregation job
    if (this.config.enableUsageAggregation) {
      this.scheduleUsageAggregation();
    }

    console.log("[JobScheduler] Job scheduler started successfully");
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log("[JobScheduler] Not running");
      return;
    }

    console.log("[JobScheduler] Stopping job scheduler");
    
    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    
    this.isRunning = false;
    console.log("[JobScheduler] Job scheduler stopped");
  }

  /**
   * Schedule the usage aggregation job
   */
  private scheduleUsageAggregation(): void {
    const job = getUsageAggregationJob();
    
    console.log(
      `[JobScheduler] Scheduling usage aggregation job (interval: ${this.config.usageAggregationInterval}ms)`
    );

    // Run immediately on startup
    this.runUsageAggregation();

    // Schedule periodic runs
    const interval = setInterval(() => {
      this.runUsageAggregation();
    }, this.config.usageAggregationInterval);

    this.intervals.push(interval);
  }

  /**
   * Run the usage aggregation job
   */
  private async runUsageAggregation(): Promise<void> {
    try {
      console.log("[JobScheduler] Running usage aggregation job");
      const job = getUsageAggregationJob();
      
      // Aggregate yesterday's data
      const result = await job.run();
      
      if (result.success) {
        console.log(
          `[JobScheduler] Usage aggregation completed successfully. Records: ${result.recordsAggregated}`
        );
      } else {
        console.error(
          `[JobScheduler] Usage aggregation completed with errors. Records: ${result.recordsAggregated}, Errors: ${result.errors.length}`
        );
        result.errors.forEach((error) => {
          console.error(`  - ${error}`);
        });
      }
    } catch (error: any) {
      console.error("[JobScheduler] Error running usage aggregation job:", error);
    }
  }

  /**
   * Run a job manually (for testing/debugging)
   */
  async runJobManually(jobName: "usageAggregation"): Promise<void> {
    console.log(`[JobScheduler] Running job manually: ${jobName}`);
    
    switch (jobName) {
      case "usageAggregation":
        await this.runUsageAggregation();
        break;
      default:
        console.error(`[JobScheduler] Unknown job: ${jobName}`);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.intervals.length,
      config: this.config,
    };
  }
}

// Export singleton instance
let schedulerInstance: JobScheduler | null = null;

export const getJobScheduler = (config?: SchedulerConfig): JobScheduler => {
  if (!schedulerInstance) {
    schedulerInstance = new JobScheduler(config);
  }
  return schedulerInstance;
};

// CLI interface for running jobs manually
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const runCLI = async () => {
    const job = getUsageAggregationJob();

    switch (command) {
      case "aggregate":
        // Run aggregation for yesterday
        console.log("Running usage aggregation for yesterday...");
        const result = await job.run();
        console.log("Result:", result);
        process.exit(result.success ? 0 : 1);
        break;

      case "aggregate-date":
        // Run aggregation for a specific date
        const dateStr = args[1];
        if (!dateStr) {
          console.error("Usage: npm run job aggregate-date YYYY-MM-DD");
          process.exit(1);
        }
        const date = new Date(dateStr);
        console.log(`Running usage aggregation for ${dateStr}...`);
        const dateResult = await job.run(date);
        console.log("Result:", dateResult);
        process.exit(dateResult.success ? 0 : 1);
        break;

      case "aggregate-range":
        // Run aggregation for a date range
        const startDateStr = args[1];
        const endDateStr = args[2];
        if (!startDateStr || !endDateStr) {
          console.error(
            "Usage: npm run job aggregate-range YYYY-MM-DD YYYY-MM-DD"
          );
          process.exit(1);
        }
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        console.log(
          `Running usage aggregation for range ${startDateStr} to ${endDateStr}...`
        );
        const rangeResult = await job.aggregateDateRange(startDate, endDate);
        console.log("Result:", rangeResult);
        process.exit(rangeResult.success ? 0 : 1);
        break;

      case "aggregate-merchant":
        // Run aggregation for a specific merchant
        const merchantId = args[1];
        const merchantDateStr = args[2] || new Date().toISOString().split("T")[0];
        if (!merchantId) {
          console.error(
            "Usage: npm run job aggregate-merchant MERCHANT_ID [YYYY-MM-DD]"
          );
          process.exit(1);
        }
        const merchantDate = new Date(merchantDateStr);
        console.log(
          `Running usage aggregation for merchant ${merchantId} on ${merchantDateStr}...`
        );
        const merchantResult = await job.aggregateMerchant(
          merchantId,
          merchantDate
        );
        console.log("Result:", merchantResult);
        process.exit(merchantResult.success ? 0 : 1);
        break;

      case "status":
        // Check aggregation status for a date
        const statusDateStr = args[1] || new Date().toISOString().split("T")[0];
        const statusDate = new Date(statusDateStr);
        console.log(`Checking aggregation status for ${statusDateStr}...`);
        const status = await job.getAggregationStatus(statusDate);
        console.log("Status:", status);
        process.exit(0);
        break;

      case "scheduler":
        // Run the scheduler (for testing)
        console.log("Starting job scheduler...");
        const scheduler = getJobScheduler({
          usageAggregationInterval: 60000, // 1 minute for testing
          enableUsageAggregation: true,
        });
        scheduler.start();
        
        // Keep process alive
        console.log("Scheduler running. Press Ctrl+C to stop.");
        process.on("SIGINT", () => {
          console.log("\nStopping scheduler...");
          scheduler.stop();
          process.exit(0);
        });
        break;

      default:
        console.log("Usage Aggregation Job CLI");
        console.log("");
        console.log("Commands:");
        console.log("  aggregate                           - Aggregate yesterday's usage data");
        console.log("  aggregate-date YYYY-MM-DD           - Aggregate usage for a specific date");
        console.log("  aggregate-range START END           - Aggregate usage for a date range");
        console.log("  aggregate-merchant ID [DATE]        - Aggregate usage for a specific merchant");
        console.log("  status [YYYY-MM-DD]                 - Check aggregation status for a date");
        console.log("  scheduler                           - Run the job scheduler");
        console.log("");
        console.log("Examples:");
        console.log("  ts-node src/jobs/scheduler.ts aggregate");
        console.log("  ts-node src/jobs/scheduler.ts aggregate-date 2025-11-01");
        console.log("  ts-node src/jobs/scheduler.ts aggregate-range 2025-11-01 2025-11-07");
        console.log("  ts-node src/jobs/scheduler.ts aggregate-merchant acme_electronics_2024");
        console.log("  ts-node src/jobs/scheduler.ts status 2025-11-01");
        console.log("  ts-node src/jobs/scheduler.ts scheduler");
        process.exit(1);
    }
  };

  runCLI().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
