const path = require("path");
const fs = require("fs");

class JobDatabase {
  constructor(dbPath = null) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = dbPath || path.join(dataDir, "queuectl.json");
    this.configPath = path.join(dataDir, "config.json");
    this.data = this.loadData();
    this.config = this.loadConfig();
    this.setDefaultConfig();
  }

  loadData() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const content = fs.readFileSync(this.dbPath, "utf8");
        return JSON.parse(content);
      } catch (error) {
        console.error("Error loading database:", error.message);
        return { jobs: {} };
      }
    }
    return { jobs: {} };
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, "utf8");
        return JSON.parse(content);
      } catch (error) {
        return {};
      }
    }
    return {};
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Error saving database:", error.message);
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("Error saving config:", error.message);
    }
  }

  setDefaultConfig() {
    const defaults = {
      "max-retries": 3,
      "backoff-base": 2,
    };

    let changed = false;
    for (const [key, value] of Object.entries(defaults)) {
      if (this.config[key] === undefined) {
        this.config[key] = value;
        changed = true;
      }
    }

    if (changed) {
      this.saveConfig();
    }
  }

  // Job operations
  createJob(job) {
    this.data.jobs[job.id] = {
      id: job.id,
      command: job.command,
      state: job.state || "pending",
      attempts: job.attempts || 0,
      max_retries: job.max_retries || this.getConfig("max-retries"),
      created_at: job.created_at || new Date().toISOString(),
      updated_at: job.updated_at || new Date().toISOString(),
      next_retry_at: job.next_retry_at || null,
      error_message: job.error_message || null,
      locked_by: job.locked_by || null,
      locked_at: job.locked_at || null,
    };
    this.save();
    return this.data.jobs[job.id];
  }

  getJob(id) {
    return this.data.jobs[id] || null;
  }

  getAllJobs(state = null) {
    const jobs = Object.values(this.data.jobs);

    if (state) {
      return jobs
        .filter((job) => job.state === state)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  updateJob(id, updates) {
    if (!this.data.jobs[id]) {
      throw new Error(`Job ${id} not found`);
    }

    Object.assign(this.data.jobs[id], updates, {
      updated_at: new Date().toISOString(),
    });

    this.save();
    return this.data.jobs[id];
  }

  deleteJob(id) {
    if (this.data.jobs[id]) {
      delete this.data.jobs[id];
      this.save();
      return true;
    }
    return false;
  }

  // Get next available job for processing (with simple locking)
  getNextPendingJob(workerId) {
    const now = new Date().toISOString();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Find a pending job or a failed job ready for retry
    const jobs = Object.values(this.data.jobs);

    for (const job of jobs) {
      // Check if job is available
      const isPending = job.state === "pending";
      const isFailedAndReady =
        job.state === "failed" && job.next_retry_at && job.next_retry_at <= now;
      const isStale = job.locked_by && job.locked_at < fiveMinutesAgo;

      if (
        (isPending || isFailedAndReady || isStale) &&
        (!job.locked_by || isStale)
      ) {
        // Lock the job
        this.updateJob(job.id, {
          locked_by: workerId,
          locked_at: now,
          state: "processing",
        });

        return this.data.jobs[job.id];
      }
    }

    return null;
  }

  unlockJob(id) {
    if (this.data.jobs[id]) {
      this.updateJob(id, {
        locked_by: null,
        locked_at: null,
      });
    }
  }

  // Get job statistics
  getStats() {
    const jobs = Object.values(this.data.jobs);
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
      total: jobs.length,
    };

    jobs.forEach((job) => {
      if (stats[job.state] !== undefined) {
        stats[job.state]++;
      }
    });

    return stats;
  }

  // Config operations
  getConfig(key) {
    return this.config[key] !== undefined ? this.config[key] : null;
  }

  setConfig(key, value) {
    this.config[key] = typeof value === "string" ? parseInt(value) : value;
    this.saveConfig();
    return this.config[key];
  }

  getAllConfig() {
    return { ...this.config };
  }

  close() {
    // Save one final time before closing
    this.save();
    this.saveConfig();
  }
}

module.exports = JobDatabase;
