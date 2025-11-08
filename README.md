# QueueCTL - CLI-Based Background Job Queue System

[![Node.js](https://img.shields.io/badge/node.js-v14+-green.svg)](https://nodejs.org/)

A production-grade CLI-based background job queue system with worker processes, automatic retry logic using exponential backoff, and a Dead Letter Queue (DLQ) for permanently failed jobs.

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
- [Architecture](#-architecture)
- [Job Lifecycle](#-job-lifecycle)
- [Configuration](#-configuration)
- [Testing](#-testing)
- [Assumptions & Trade-offs](#-assumptions--trade-offs)
- [Demo Video](#-demo-video)

> 📚 **Additional Documentation:** See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design

## ✨ Features

- ✅ **CLI Interface** - Complete command-line interface for all operations
- ✅ **Multiple Workers** - Run multiple worker processes in parallel
- ✅ **Persistent Storage** - SQLite database ensures jobs survive restarts
- ✅ **Exponential Backoff** - Smart retry mechanism with configurable backoff
- ✅ **Dead Letter Queue** - Capture permanently failed jobs for investigation
- ✅ **Job Locking** - Prevents duplicate processing across workers
- ✅ **Graceful Shutdown** - Workers finish current jobs before stopping
- ✅ **Configurable** - Adjust retry count and backoff base via CLI
- ✅ **Real-time Status** - Monitor job states and worker activity

## 🛠 Tech Stack

- **Runtime**: Node.js v14+
- **Database**: JSON file-based storage (persistent across restarts)
- **CLI Framework**: Commander.js
- **Styling**: Chalk (terminal colors)

## 📥 Installation

### Prerequisites

- Node.js v14 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd flams

# Install dependencies
npm install

# Verify installation
node bin/queuectl.js --version
```

## 🚀 Quick Start

```bash
# 1. Enqueue a job (Windows PowerShell)
node bin/queuectl.js enqueue "{\"id\":\"job1\",\"command\":\"echo Hello World\"}"

# 1. Enqueue a job (Linux/Mac)
node bin/queuectl.js enqueue '{"id":"job1","command":"echo Hello World"}'

# 2. Start workers (in a separate terminal)
node bin/queuectl.js worker start --count 2

# 3. Check status
node bin/queuectl.js status

# 4. List jobs
node bin/queuectl.js list

# 5. Stop workers (Ctrl+C in worker terminal)
```

## 📖 Usage Examples

### Enqueuing Jobs

```bash
# Simple command
node bin/queuectl.js enqueue '{"id":"job1","command":"echo Hello"}'

# Command with custom retry limit
node bin/queuectl.js enqueue '{"id":"job2","command":"sleep 2","max_retries":5}'

# Multiple jobs
node bin/queuectl.js enqueue '{"command":"echo Task 1"}'
node bin/queuectl.js enqueue '{"command":"echo Task 2"}'
node bin/queuectl.js enqueue '{"command":"echo Task 3"}'
```

### Worker Management

```bash
# Start single worker
node bin/queuectl.js worker start

# Start multiple workers
node bin/queuectl.js worker start --count 3

# Stop workers gracefully (Ctrl+C)
# Workers will finish current jobs before exiting
```

### Checking Status

```bash
# View queue statistics
node bin/queuectl.js status

# Output:
# 📊 Queue Status
#
# Job Statistics:
#   Pending:    5
#   Processing: 2
#   Completed:  10
#   Failed:     1
#   Dead (DLQ): 0
#   Total:      18
#
# Configuration:
#   Max Retries:  3
#   Backoff Base: 2
```

### Listing Jobs

```bash
# List all jobs
node bin/queuectl.js list

# List pending jobs only
node bin/queuectl.js list --state pending

# List completed jobs
node bin/queuectl.js list --state completed

# List failed jobs
node bin/queuectl.js list --state failed
```

### Dead Letter Queue (DLQ)

```bash
# View DLQ jobs
node bin/queuectl.js dlq list

# Retry specific DLQ job
node bin/queuectl.js dlq retry job1

# Retry all DLQ jobs
node bin/queuectl.js dlq retry-all
```

### Configuration Management

```bash
# View all configuration
node bin/queuectl.js config get

# Get specific config value
node bin/queuectl.js config get max-retries

# Set max retries
node bin/queuectl.js config set max-retries 5

# Set backoff base (for exponential backoff)
node bin/queuectl.js config set backoff-base 3
```

## 🏗 Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                     CLI Interface                        │
│                   (bin/queuectl.js)                      │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼─────────┐          ┌──────────▼─────────┐
│  Queue Manager   │          │  Worker Manager    │
│ (queue-manager)  │          │ (worker-manager)   │
└────────┬─────────┘          └──────────┬─────────┘
         │                               │
         │                    ┌──────────┴─────────┐
         │                    │                    │
         │               ┌────▼────┐         ┌────▼────┐
         │               │ Worker 1│         │ Worker 2│
         │               └────┬────┘         └────┬────┘
         │                    │                   │
         └────────────────────┴───────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  SQLite Database   │
                    │   (Job Storage)    │
                    └────────────────────┘
```

### Directory Structure

```
queuectl/
├── bin/
│   └── queuectl.js          # CLI entry point
├── src/
│   ├── database.js          # SQLite database layer
│   ├── job.js               # Job model & logic
│   ├── worker.js            # Worker process
│   ├── worker-manager.js    # Worker pool management
│   └── queue-manager.js     # Queue operations
├── tests/
│   └── test-scenarios.js    # Test suite
├── data/
│   └── queuectl.db          # SQLite database (auto-created)
├── package.json
└── README.md
```

### Data Persistence

**Storage Format:** JSON files in the `data/` directory

- `queuectl.json` - All job data
- `config.json` - System configuration

**Structure:**

```json
// queuectl.json
{
  "jobs": {
    "job_id_1": {
      "id": "job_id_1",
      "command": "echo Hello",
      "state": "pending",
      "attempts": 0,
      "max_retries": 3,
      "created_at": "2025-11-09T...",
      "updated_at": "2025-11-09T...",
      "next_retry_at": null,
      "error_message": null,
      "locked_by": null,
      "locked_at": null
    }
  }
}

// config.json
{
  "max-retries": 3,
  "backoff-base": 2
}
```

## 🔄 Job Lifecycle

```
┌─────────┐
│ PENDING │  ◄─────────────────┐
└────┬────┘                    │
     │                         │
     │ Worker picks up         │ Retry after
     │                         │ backoff delay
     ▼                         │
┌────────────┐                 │
│ PROCESSING │                 │
└─────┬──────┘                 │
      │                        │
      ├─────► Success          │
      │          │              │
      │          ▼              │
      │     ┌───────────┐      │
      │     │ COMPLETED │      │
      │     └───────────┘      │
      │                        │
      └─────► Failure          │
                 │              │
                 ▼              │
            ┌────────┐          │
            │ FAILED │──────────┘
            └────┬───┘
                 │
                 │ Max retries
                 │ exhausted
                 ▼
            ┌──────┐
            │ DEAD │  (DLQ)
            └──────┘
```

### State Transitions

| State        | Description           | Next State                          |
| ------------ | --------------------- | ----------------------------------- |
| `pending`    | Waiting for worker    | `processing`                        |
| `processing` | Being executed        | `completed` or `failed`             |
| `completed`  | Successfully executed | (terminal)                          |
| `failed`     | Failed but retryable  | `pending` (after backoff) or `dead` |
| `dead`       | Permanently failed    | (terminal)                          |

### Exponential Backoff

Failed jobs are retried with exponential backoff:

**Formula:** `delay = base ^ attempts` seconds

**Examples** (with base=2):

- Attempt 1: 2^1 = 2 seconds
- Attempt 2: 2^2 = 4 seconds
- Attempt 3: 2^3 = 8 seconds

## ⚙️ Configuration

Default configuration:

- **max-retries**: 3
- **backoff-base**: 2

Change anytime using:

```bash
node bin/queuectl.js config set max-retries 5
node bin/queuectl.js config set backoff-base 3
```

## 🧪 Testing

### Automated Tests

Run the test suite to validate core functionality:

**Windows:**

```bash
test.bat
```

**Linux/Mac:**

```bash
chmod +x test.sh
./test.sh
```

**Or using npm:**

```bash
npm test
```

This will test:

1. Basic job enqueuing
2. Multiple job handling
3. Failed job retry mechanism
4. Invalid command handling
5. Configuration management
6. Job listing and filtering
7. Status reporting
8. DLQ operations

### Manual Worker Testing

```bash
# Terminal 1: Start workers
node bin/queuectl.js worker start --count 2

# Terminal 2: Enqueue jobs
node bin/queuectl.js enqueue '{"command":"echo Test 1"}'
node bin/queuectl.js enqueue '{"command":"sleep 3"}'
node bin/queuectl.js enqueue '{"command":"exit 1","max_retries":2}'

# Watch workers process jobs in Terminal 1
# Check status in Terminal 2
node bin/queuectl.js status
```

### Test Scenarios Covered

✅ **Scenario 1**: Basic job completes successfully

```bash
node bin/queuectl.js enqueue '{"command":"echo Success"}'
```

✅ **Scenario 2**: Failed job retries with backoff

```bash
node bin/queuectl.js enqueue '{"command":"exit 1","max_retries":3}'
```

✅ **Scenario 3**: Multiple workers process without overlap

```bash
node bin/queuectl.js worker start --count 3
```

✅ **Scenario 4**: Invalid commands fail gracefully

```bash
node bin/queuectl.js enqueue '{"command":"invalidcmd123"}'
```

✅ **Scenario 5**: Job data survives restart

```bash
# Enqueue jobs, stop workers (Ctrl+C), restart workers
# Jobs should still be processed
```

## 🤔 Assumptions & Trade-offs

### Assumptions

1. **Single Machine**: Workers run on the same machine (no distributed setup)
2. **Command Execution**: Jobs execute shell commands via `cmd.exe` (Windows) or `/bin/sh` (Unix)
3. **Exit Code**: Command success determined by exit code 0
4. **Worker Crash**: Locked jobs older than 5 minutes are automatically unlocked
5. **Synchronous DB**: Using better-sqlite3 for synchronous, blocking operations

### Trade-offs

| Decision           | Reason                                      | Alternative                      |
| ------------------ | ------------------------------------------- | -------------------------------- |
| SQLite             | Simple, embedded, no setup                  | PostgreSQL/Redis for distributed |
| Synchronous DB     | Simpler code, sufficient for single machine | Async for high concurrency       |
| Polling            | Simple implementation                       | Message queue (RabbitMQ, Redis)  |
| File-based PID     | Simple process tracking                     | Process manager (PM2)            |
| 5-min lock timeout | Balance between safety and recovery         | Configurable timeout             |

### Known Limitations

- ⚠️ Not suitable for distributed systems (single database file)
- ⚠️ Worker count limited by machine resources
- ⚠️ No job priority system (FIFO queue)
- ⚠️ No scheduled/delayed jobs
- ⚠️ Limited to shell commands (no native function execution)

## 🎥 Demo Video

📹 **Working Demo**: [Link to Drive]

> _Upload a screen recording showing:_
>
> - Enqueuing multiple jobs
> - Starting workers
> - Real-time job processing
> - Retry mechanism with failed jobs
> - DLQ operations
> - Status and listing commands

## 📋 Command Reference

### Complete CLI Commands

```bash
# Job Management
queuectl enqueue <json>              # Add job to queue
queuectl list [--state <state>]     # List jobs
queuectl status                      # Show queue status

# Worker Management
queuectl worker start [--count <n>]  # Start workers
queuectl worker stop                 # Stop workers

# Dead Letter Queue
queuectl dlq list                    # List DLQ jobs
queuectl dlq retry <jobId>           # Retry specific job
queuectl dlq retry-all               # Retry all DLQ jobs

# Configuration
queuectl config get [key]            # Get config
queuectl config set <key> <value>    # Set config

# Help
queuectl --help                      # Show help
queuectl <command> --help            # Command help
```

## 🔧 Development

### Adding New Features

The codebase is structured for easy extension:

- **New CLI commands**: Edit `bin/queuectl.js`
- **Job logic**: Modify `src/job.js`
- **Worker behavior**: Update `src/worker.js`
- **Database schema**: Change `src/database.js`

### Code Structure

- **Separation of Concerns**: Each component has a single responsibility
- **Database Layer**: Abstracted in `database.js` for easy swapping
- **Error Handling**: Comprehensive try-catch with user-friendly messages
- **Logging**: Console logs with colors for better readability

## ‍💻 Author

Built as part of QueueCTL Backend Developer Internship Assignment

---

**Questions or Issues?** Open an issue on GitHub or contact via email.

**⭐ If you found this useful, please star the repository!**
