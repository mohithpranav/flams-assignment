const Worker = require("./worker");
const JobDatabase = require("./database");
const fs = require("fs");
const path = require("path");

class WorkerManager {
  constructor() {
    this.workers = [];
    this.db = new JobDatabase();
    this.pidFile = path.join(process.cwd(), "data", "workers.pid");
  }

  async startWorkers(count = 1) {
    if (this.isRunning()) {
      console.log("Workers are already running. Stop them first.");
      return;
    }

    console.log(`Starting ${count} worker(s)...`);

    for (let i = 0; i < count; i++) {
      const worker = new Worker(`worker-${i + 1}`, this.db);
      this.workers.push(worker);

      // Start worker in background (non-blocking)
      worker.start().catch((err) => {
        console.error(`Worker ${worker.id} crashed:`, err);
      });
    }

    // Save PID info
    this.savePidInfo();

    // Setup graceful shutdown
    this.setupShutdownHandlers();

    console.log(`${count} worker(s) started successfully`);
    console.log("Press Ctrl+C to stop workers gracefully");

    // Keep process alive
    await this.keepAlive();
  }

  async stopWorkers() {
    if (!this.isRunning()) {
      console.log("No workers are currently running.");
      return;
    }

    console.log("Stopping all workers gracefully...");

    this.workers.forEach((worker) => worker.stop());

    // Wait for workers to finish current jobs
    await this.sleep(2000);

    this.workers = [];
    this.removePidInfo();

    console.log("All workers stopped");
    process.exit(0);
  }

  setupShutdownHandlers() {
    const shutdown = async () => {
      console.log("\nReceived shutdown signal...");
      await this.stopWorkers();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  isRunning() {
    return fs.existsSync(this.pidFile) || this.workers.length > 0;
  }

  savePidInfo() {
    const dataDir = path.dirname(this.pidFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const info = {
      pid: process.pid,
      count: this.workers.length,
      started_at: new Date().toISOString(),
    };

    fs.writeFileSync(this.pidFile, JSON.stringify(info, null, 2));
  }

  removePidInfo() {
    if (fs.existsSync(this.pidFile)) {
      fs.unlinkSync(this.pidFile);
    }
  }

  getWorkerStats() {
    return this.workers.map((w) => w.getStats());
  }

  async keepAlive() {
    while (this.workers.some((w) => w.running)) {
      await this.sleep(1000);
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = WorkerManager;
