const { spawn } = require("child_process");
const JobDatabase = require("./database");
const Job = require("./job");

class Worker {
  constructor(id, db) {
    this.id = id;
    this.db = db;
    this.running = false;
    this.currentJob = null;
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };
  }

  async start() {
    this.running = true;
    console.log(`[Worker ${this.id}] Started and ready to process jobs`);

    while (this.running) {
      try {
        const job = this.db.getNextPendingJob(this.id);

        if (job) {
          this.currentJob = job;
          await this.processJob(job);
          this.currentJob = null;
        } else {
          // No jobs available, wait a bit
          await this.sleep(1000);
        }
      } catch (error) {
        console.error(`[Worker ${this.id}] Error:`, error.message);
        await this.sleep(1000);
      }
    }

    console.log(`[Worker ${this.id}] Stopped gracefully`);
  }

  async processJob(job) {
    console.log(`[Worker ${this.id}] Processing job ${job.id}: ${job.command}`);
    this.stats.processed++;

    try {
      const exitCode = await this.executeCommand(job.command);

      if (exitCode === 0) {
        // Success
        this.db.updateJob(job.id, {
          state: Job.STATE.COMPLETED,
          locked_by: null,
          locked_at: null,
        });
        this.stats.succeeded++;
        console.log(`[Worker ${this.id}] Job ${job.id} completed successfully`);
      } else {
        // Failed
        await this.handleJobFailure(
          job,
          `Command exited with code ${exitCode}`
        );
      }
    } catch (error) {
      await this.handleJobFailure(job, error.message);
    }
  }

  async handleJobFailure(job, errorMessage) {
    const newAttempts = job.attempts + 1;
    const maxRetries = job.max_retries;
    const backoffBase = this.db.getConfig("backoff-base") || 2;

    console.log(
      `[Worker ${this.id}] Job ${job.id} failed: ${errorMessage} (attempt ${newAttempts}/${maxRetries})`
    );
    this.stats.failed++;

    if (newAttempts >= maxRetries) {
      // Move to DLQ
      this.db.updateJob(job.id, {
        state: Job.STATE.DEAD,
        attempts: newAttempts,
        error_message: errorMessage,
        locked_by: null,
        locked_at: null,
      });
      console.log(
        `[Worker ${this.id}] Job ${job.id} moved to Dead Letter Queue`
      );
    } else {
      // Schedule retry with exponential backoff
      const nextRetryAt = Job.getNextRetryTime(newAttempts, backoffBase);
      this.db.updateJob(job.id, {
        state: Job.STATE.FAILED,
        attempts: newAttempts,
        error_message: errorMessage,
        next_retry_at: nextRetryAt,
        locked_by: null,
        locked_at: null,
      });

      const delay = Job.calculateBackoffDelay(newAttempts, backoffBase);
      console.log(
        `[Worker ${this.id}] Job ${job.id} will retry in ${delay} seconds`
      );
    }
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      // Parse command for Windows
      let shell, shellArgs;

      if (process.platform === "win32") {
        shell = "cmd.exe";
        shellArgs = ["/c", command];
      } else {
        shell = "/bin/sh";
        shellArgs = ["-c", command];
      }

      const child = spawn(shell, shellArgs, {
        stdio: "inherit",
        windowsHide: true,
      });

      child.on("exit", (code) => {
        resolve(code);
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  stop() {
    console.log(`[Worker ${this.id}] Stopping gracefully...`);
    this.running = false;

    // If processing a job, unlock it
    if (this.currentJob) {
      this.db.unlockJob(this.currentJob.id);
      this.db.updateJob(this.currentJob.id, {
        state: Job.STATE.PENDING,
      });
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      id: this.id,
      running: this.running,
      currentJob: this.currentJob ? this.currentJob.id : null,
      ...this.stats,
    };
  }
}

module.exports = Worker;
