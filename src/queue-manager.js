const JobDatabase = require("./database");
const Job = require("./job");

class QueueManager {
  constructor() {
    this.db = new JobDatabase();
  }

  enqueue(jobData) {
    try {
      // Parse if it's a string
      if (typeof jobData === "string") {
        jobData = JSON.parse(jobData);
      }

      // Validate required fields
      if (!jobData.command) {
        throw new Error("Job command is required");
      }

      // Create job
      const job = new Job({
        id: jobData.id,
        command: jobData.command,
        max_retries: jobData.max_retries || this.db.getConfig("max-retries"),
      });

      // Save to database
      this.db.createJob(job);

      return job;
    } catch (error) {
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }
  }

  getStatus() {
    const stats = this.db.getStats();
    const config = this.db.getAllConfig();

    return {
      stats,
      config,
    };
  }

  listJobs(state = null) {
    return this.db.getAllJobs(state);
  }

  getJob(id) {
    return this.db.getJob(id);
  }

  deleteJob(id) {
    return this.db.deleteJob(id);
  }

  // DLQ operations
  listDLQ() {
    return this.db.getAllJobs(Job.STATE.DEAD);
  }

  retryDLQJob(jobId) {
    const job = this.db.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.state !== Job.STATE.DEAD) {
      throw new Error(`Job ${jobId} is not in Dead Letter Queue`);
    }

    // Reset job for retry
    this.db.updateJob(jobId, {
      state: Job.STATE.PENDING,
      attempts: 0,
      next_retry_at: null,
      error_message: null,
      locked_by: null,
      locked_at: null,
    });

    return this.db.getJob(jobId);
  }

  retryAllDLQ() {
    const dlqJobs = this.listDLQ();

    dlqJobs.forEach((job) => {
      this.retryDLQJob(job.id);
    });

    return dlqJobs.length;
  }

  // Config operations
  getConfig(key = null) {
    if (key) {
      return this.db.getConfig(key);
    }
    return this.db.getAllConfig();
  }

  setConfig(key, value) {
    // Validate config keys
    const validKeys = ["max-retries", "backoff-base"];
    if (!validKeys.includes(key)) {
      throw new Error(
        `Invalid config key: ${key}. Valid keys: ${validKeys.join(", ")}`
      );
    }

    // Validate values
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) {
      throw new Error(`Config value must be a positive number`);
    }

    this.db.setConfig(key, numValue);
    return { key, value: numValue };
  }

  close() {
    this.db.close();
  }
}

module.exports = QueueManager;
