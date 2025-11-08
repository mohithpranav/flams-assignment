#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const QueueManager = require("../src/queue-manager");
const WorkerManager = require("../src/worker-manager");
const package = require("../package.json");

const program = new Command();

program
  .name("queuectl")
  .description("CLI-based background job queue system with workers, retry logic, and DLQ")
  .version(package.version);

// Enqueue command
program
  .command("enqueue <job>")
  .description("Add a new job to the queue")
  .action((jobJson) => {
    try {
      const qm = new QueueManager();
      const job = qm.enqueue(jobJson);

      console.log(chalk.green("✓ Job enqueued successfully"));
      console.log(chalk.gray("Job ID:"), job.id);
      console.log(chalk.gray("Command:"), job.command);
      console.log(chalk.gray("State:"), job.state);
      console.log(chalk.gray("Max Retries:"), job.max_retries);

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

// Worker commands
const worker = program.command("worker").description("Manage worker processes");

worker
  .command("start")
  .description("Start worker processes")
  .option("-c, --count <number>", "Number of workers to start", "1")
  .action(async (options) => {
    try {
      const count = parseInt(options.count);
      if (isNaN(count) || count < 1) {
        throw new Error("Worker count must be a positive number");
      }

      const wm = new WorkerManager();
      await wm.startWorkers(count);
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

worker
  .command("stop")
  .description("Stop all running workers")
  .action(async () => {
    try {
      const wm = new WorkerManager();
      await wm.stopWorkers();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description("Show summary of job states and active workers")
  .action(() => {
    try {
      const qm = new QueueManager();
      const { stats, config } = qm.getStatus();

      console.log(chalk.bold("\n📊 Queue Status\n"));

      console.log(chalk.cyan("Job Statistics:"));
      console.log(`  Pending:    ${chalk.yellow(stats.pending)}`);
      console.log(`  Processing: ${chalk.blue(stats.processing)}`);
      console.log(`  Completed:  ${chalk.green(stats.completed)}`);
      console.log(`  Failed:     ${chalk.red(stats.failed)}`);
      console.log(`  Dead (DLQ): ${chalk.magenta(stats.dead)}`);
      console.log(`  Total:      ${chalk.bold(stats.total)}`);

      console.log(chalk.cyan("\nConfiguration:"));
      console.log(`  Max Retries:  ${config["max-retries"]}`);
      console.log(`  Backoff Base: ${config["backoff-base"]}`);

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List jobs")
  .option(
    "-s, --state <state>",
    "Filter by state (pending, processing, completed, failed, dead)"
  )
  .action((options) => {
    try {
      const qm = new QueueManager();
      const jobs = qm.listJobs(options.state);

      if (jobs.length === 0) {
        console.log(chalk.yellow("No jobs found"));
        qm.close();
        return;
      }

      console.log(
        chalk.bold(`\n📋 Jobs ${options.state ? `(${options.state})` : ""}\n`)
      );

      jobs.forEach((job) => {
        const stateColor =
          {
            pending: "yellow",
            processing: "blue",
            completed: "green",
            failed: "red",
            dead: "magenta",
          }[job.state] || "white";

        console.log(chalk.gray("─".repeat(60)));
        console.log(`${chalk.bold("ID:")} ${job.id}`);
        console.log(`${chalk.bold("Command:")} ${job.command}`);
        console.log(`${chalk.bold("State:")} ${chalk[stateColor](job.state)}`);
        console.log(
          `${chalk.bold("Attempts:")} ${job.attempts}/${job.max_retries}`
        );
        console.log(
          `${chalk.bold("Created:")} ${new Date(
            job.created_at
          ).toLocaleString()}`
        );

        if (job.error_message) {
          console.log(
            `${chalk.bold("Error:")} ${chalk.red(job.error_message)}`
          );
        }

        if (job.next_retry_at) {
          console.log(
            `${chalk.bold("Next Retry:")} ${new Date(
              job.next_retry_at
            ).toLocaleString()}`
          );
        }
      });

      console.log(chalk.gray("─".repeat(60)));
      console.log(chalk.bold(`\nTotal: ${jobs.length} job(s)\n`));

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

// DLQ commands
const dlq = program.command("dlq").description("Manage Dead Letter Queue");

dlq
  .command("list")
  .description("List jobs in Dead Letter Queue")
  .action(() => {
    try {
      const qm = new QueueManager();
      const jobs = qm.listDLQ();

      if (jobs.length === 0) {
        console.log(chalk.yellow("Dead Letter Queue is empty"));
        qm.close();
        return;
      }

      console.log(chalk.bold.magenta("\n⚠️  Dead Letter Queue\n"));

      jobs.forEach((job) => {
        console.log(chalk.gray("─".repeat(60)));
        console.log(`${chalk.bold("ID:")} ${job.id}`);
        console.log(`${chalk.bold("Command:")} ${job.command}`);
        console.log(
          `${chalk.bold("Attempts:")} ${job.attempts}/${job.max_retries}`
        );
        console.log(
          `${chalk.bold("Error:")} ${chalk.red(job.error_message || "Unknown")}`
        );
        console.log(
          `${chalk.bold("Failed At:")} ${new Date(
            job.updated_at
          ).toLocaleString()}`
        );
      });

      console.log(chalk.gray("─".repeat(60)));
      console.log(chalk.bold(`\nTotal: ${jobs.length} job(s) in DLQ\n`));

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

dlq
  .command("retry <jobId>")
  .description("Retry a specific job from DLQ")
  .action((jobId) => {
    try {
      const qm = new QueueManager();
      const job = qm.retryDLQJob(jobId);

      console.log(chalk.green("✓ Job moved back to queue"));
      console.log(chalk.gray("Job ID:"), job.id);
      console.log(chalk.gray("State:"), job.state);

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

dlq
  .command("retry-all")
  .description("Retry all jobs from DLQ")
  .action(() => {
    try {
      const qm = new QueueManager();
      const count = qm.retryAllDLQ();

      console.log(chalk.green(`✓ ${count} job(s) moved back to queue`));

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

// Config commands
const config = program.command("config").description("Manage configuration");

config
  .command("get [key]")
  .description("Get configuration value(s)")
  .action((key) => {
    try {
      const qm = new QueueManager();
      const configData = qm.getConfig(key);

      if (key) {
        console.log(`${chalk.bold(key)}: ${configData}`);
      } else {
        console.log(chalk.bold("\n⚙️  Configuration\n"));
        Object.entries(configData).forEach(([k, v]) => {
          console.log(`${chalk.cyan(k)}: ${v}`);
        });
        console.log();
      }

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

config
  .command("set <key> <value>")
  .description("Set configuration value")
  .action((key, value) => {
    try {
      const qm = new QueueManager();
      const result = qm.setConfig(key, value);

      console.log(chalk.green("✓ Configuration updated"));
      console.log(`${chalk.bold(result.key)}: ${result.value}`);

      qm.close();
    } catch (error) {
      console.error(chalk.red("✗ Error:"), error.message);
      process.exit(1);
    }
  });

program.parse();
