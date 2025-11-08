const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const queuectl = path.join(__dirname, "..", "bin", "queuectl.js");

function run(command) {
  console.log(`\n$ ${command}`);
  try {
    const output = execSync(`"node" "${queuectl}" ${command}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log(output);
    return output;
  } catch (error) {
    console.error(error.stdout || error.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupDatabase() {
  const dbPath = path.join(process.cwd(), "data", "queuectl.db");
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("✓ Cleaned up test database");
  }
}

async function runTests() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("          QueueCTL Test Scenarios");
  console.log("═══════════════════════════════════════════════════════\n");

  // Clean up before tests
  await cleanupDatabase();

  console.log("\n📋 Test 1: Basic Job Completion");
  console.log("─────────────────────────────────────────────────────");
  run('enqueue \'{"id":"test1","command":"echo Hello World"}\'');
  run("status");

  console.log("\n📋 Test 2: Multiple Jobs");
  console.log("─────────────────────────────────────────────────────");
  run('enqueue \'{"id":"test2","command":"echo Job 2"}\'');
  run('enqueue \'{"id":"test3","command":"echo Job 3"}\'');
  run("list --state pending");

  console.log("\n📋 Test 3: Failed Job with Retry");
  console.log("─────────────────────────────────────────────────────");
  run('enqueue \'{"id":"test-fail","command":"exit 1","max_retries":2}\'');

  console.log("\n📋 Test 4: Invalid Command");
  console.log("─────────────────────────────────────────────────────");
  run(
    'enqueue \'{"id":"test-invalid","command":"nonexistentcommand123","max_retries":1}\''
  );

  console.log("\n📋 Test 5: Configuration Management");
  console.log("─────────────────────────────────────────────────────");
  run("config get");
  run("config set max-retries 5");
  run("config get max-retries");
  run("config set backoff-base 3");
  run("config get");

  console.log("\n📋 Test 6: List Jobs by State");
  console.log("─────────────────────────────────────────────────────");
  run("list --state pending");

  console.log("\n📋 Test 7: Status Overview");
  console.log("─────────────────────────────────────────────────────");
  run("status");

  console.log("\n📋 Test 8: DLQ Operations");
  console.log("─────────────────────────────────────────────────────");
  run("dlq list");

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("✓ All test scenarios completed!");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n📝 To test worker functionality, run:");
  console.log("   node bin/queuectl.js worker start --count 2");
  console.log(
    "\n   This will start 2 workers that will process all pending jobs."
  );
  console.log("   Press Ctrl+C to stop workers gracefully.\n");
}

runTests().catch(console.error);
