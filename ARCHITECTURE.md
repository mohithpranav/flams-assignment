# ARCHITECTURE.md - QueueCTL System Design

## 📐 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Interface                            │
│                      (bin/queuectl.js)                           │
│                                                                   │
│  Commands: enqueue, worker, status, list, dlq, config           │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
                │                                 │
┌───────────────▼──────────────┐    ┌────────────▼──────────────┐
│     Queue Manager             │    │    Worker Manager         │
│   (queue-manager.js)          │    │  (worker-manager.js)      │
│                               │    │                           │
│  • Enqueue jobs               │    │  • Start/stop workers     │
│  • Get status                 │    │  • Graceful shutdown      │
│  • List jobs                  │    │  • Process coordination   │
│  • DLQ operations             │    │                           │
│  • Config management          │    └────────────┬──────────────┘
└───────────────┬───────────────┘                 │
                │                                 │
                │                    ┌────────────▼──────────────┐
                │                    │     Worker Instances      │
                │                    │      (worker.js)          │
                │                    │                           │
                │                    │  Worker 1  Worker 2  ...  │
                │                    │                           │
                │                    │  • Pick pending jobs      │
                │                    │  • Execute commands       │
                │                    │  • Handle failures        │
                │                    │  • Calculate backoff      │
                │                    └────────────┬──────────────┘
                │                                 │
                └─────────────────┬───────────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   Job Database     │
                        │   (database.js)    │
                        │                    │
                        │  • Job storage     │
                        │  • Job locking     │
                        │  • Config storage  │
                        │  • Persistence     │
                        └─────────┬──────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   File System      │
                        │                    │
                        │  queuectl.json     │
                        │  config.json       │
                        │  workers.pid       │
                        └────────────────────┘
```

---

## 🔧 Component Details

### 1. CLI Interface (`bin/queuectl.js`)

**Responsibility:** User interaction and command routing

**Key Features:**

- Command parsing using Commander.js
- Colorized output using Chalk
- Input validation
- Error handling and user-friendly messages

**Commands:**

- `enqueue` - Add jobs to queue
- `worker start/stop` - Manage workers
- `status` - View queue statistics
- `list` - Browse jobs
- `dlq` - Manage Dead Letter Queue
- `config` - System configuration

---

### 2. Queue Manager (`src/queue-manager.js`)

**Responsibility:** Job queue operations and management

**Key Methods:**

```javascript
enqueue(jobData); // Add new job
getStatus(); // Get queue statistics
listJobs(state); // List jobs by state
getJob(id); // Get specific job
deleteJob(id); // Remove job
listDLQ(); // List dead jobs
retryDLQJob(jobId); // Retry specific DLQ job
retryAllDLQ(); // Retry all DLQ jobs
getConfig(key); // Get configuration
setConfig(key, value); // Update configuration
```

**Interactions:**

- Uses `JobDatabase` for persistence
- Creates `Job` instances
- Validates input data

---

### 3. Worker Manager (`src/worker-manager.js`)

**Responsibility:** Worker lifecycle and coordination

**Key Methods:**

```javascript
startWorkers(count); // Start N workers
stopWorkers(); // Stop all workers gracefully
isRunning(); // Check if workers active
savePidInfo(); // Save process info
setupShutdownHandlers(); // Handle Ctrl+C
```

**Features:**

- Spawns multiple worker processes
- Graceful shutdown (waits for current jobs)
- PID file management
- Signal handling (SIGINT, SIGTERM)

---

### 4. Worker (`src/worker.js`)

**Responsibility:** Job execution and retry logic

**Key Methods:**

```javascript
start(); // Start processing loop
processJob(job); // Execute single job
executeCommand(command); // Run shell command
handleJobFailure(job, err); // Retry or DLQ logic
stop(); // Graceful shutdown
```

**Job Processing Flow:**

```
1. Poll database for pending job
2. Lock job (prevent duplicate processing)
3. Execute command
4. If success → Mark completed
5. If failure → Calculate backoff, schedule retry
6. If max retries → Move to DLQ
7. Unlock job
```

**Retry Logic:**

```javascript
// Exponential backoff calculation
delay = base ^ attempts;

// Example with base=2:
// Attempt 1: 2^1 = 2 seconds
// Attempt 2: 2^2 = 4 seconds
// Attempt 3: 2^3 = 8 seconds
```

---

### 5. Job Model (`src/job.js`)

**Responsibility:** Job data structure and utilities

**Properties:**

```javascript
{
  id: string,
  command: string,
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'dead',
  attempts: number,
  max_retries: number,
  created_at: ISO8601,
  updated_at: ISO8601,
  next_retry_at: ISO8601 | null,
  error_message: string | null,
  locked_by: string | null,
  locked_at: ISO8601 | null
}
```

**Static Methods:**

```javascript
calculateBackoffDelay(attempts, base); // Compute delay
getNextRetryTime(attempts, base); // Calculate next retry timestamp
fromJSON(json); // Parse from JSON
```

---

### 6. Database Layer (`src/database.js`)

**Responsibility:** Persistent storage and data access

**Storage Format:** JSON files in `data/` directory

**Key Methods:**

```javascript
createJob(job); // Insert new job
getJob(id); // Retrieve job
getAllJobs(state); // Query jobs
updateJob(id, updates); // Modify job
deleteJob(id); // Remove job
getNextPendingJob(workerId); // Get & lock next job
unlockJob(id); // Release lock
getStats(); // Aggregate statistics
```

**Locking Mechanism:**

```javascript
// Prevent race conditions
1. Check if job is unlocked OR stale (>5min)
2. Set locked_by = worker_id
3. Set locked_at = current_timestamp
4. Set state = 'processing'
5. Return job to worker
```

---

## 🔄 Data Flow Examples

### Example 1: Enqueue Job

```
User
  │
  └─> CLI: queuectl enqueue '{"command":"echo test"}'
       │
       └─> QueueManager.enqueue()
            │
            ├─> Create Job instance
            ├─> Validate data
            └─> Database.createJob()
                 │
                 └─> Save to queuectl.json
                      │
                      └─> Return success to user
```

### Example 2: Worker Processing

```
Worker.start()
  │
  └─> Loop:
       │
       ├─> Database.getNextPendingJob(workerId)
       │    │
       │    ├─> Find pending/failed job
       │    ├─> Lock job
       │    └─> Return job
       │
       ├─> Worker.processJob(job)
       │    │
       │    ├─> Execute command via shell
       │    │
       │    ├─> If SUCCESS:
       │    │    └─> Database.updateJob(id, {state: 'completed'})
       │    │
       │    └─> If FAILURE:
       │         │
       │         ├─> attempts++
       │         │
       │         ├─> If attempts < max_retries:
       │         │    ├─> Calculate backoff delay
       │         │    └─> Database.updateJob(id, {
       │         │         state: 'failed',
       │         │         next_retry_at: future_timestamp
       │         │       })
       │         │
       │         └─> If attempts >= max_retries:
       │              └─> Database.updateJob(id, {state: 'dead'})
       │
       └─> Sleep(1000) if no jobs
```

### Example 3: DLQ Retry

```
User
  │
  └─> CLI: queuectl dlq retry job123
       │
       └─> QueueManager.retryDLQJob('job123')
            │
            ├─> Database.getJob('job123')
            ├─> Verify state == 'dead'
            └─> Database.updateJob('job123', {
                 state: 'pending',
                 attempts: 0,
                 next_retry_at: null,
                 error_message: null
               })
                 │
                 └─> Job returns to queue
                      │
                      └─> Will be picked by next available worker
```

---

## 🔒 Concurrency & Race Conditions

### Problem: Multiple Workers, Same Job

**Solution:** Job Locking

```javascript
// Worker 1 and Worker 2 both poll for jobs

Worker 1:
  ├─> getNextPendingJob('worker-1')
  │    ├─> Find job_123 (state: pending, locked_by: null)
  │    ├─> LOCK: locked_by = 'worker-1'
  │    └─> Return job_123

Worker 2:
  └─> getNextPendingJob('worker-2')
       ├─> Find job_456 (next available)
       │   (job_123 is locked, skip it)
       ├─> LOCK: locked_by = 'worker-2'
       └─> Return job_456

// No duplicate processing!
```

### Stale Lock Recovery

```javascript
// If worker crashes with locked job
if (job.locked_by && job.locked_at < 5_minutes_ago) {
  // Lock is stale, reclaim job
  lock_job(current_worker_id)
}
```

---

## 📊 State Machine

```
          ┌──────────┐
          │  Enqueue │
          └─────┬────┘
                │
                ▼
          ┌─────────┐
    ┌────▶│ PENDING │◀────┐
    │     └────┬────┘     │
    │          │           │
    │          │ Worker    │ Retry
    │          │ picks up  │ after
    │          ▼           │ backoff
    │     ┌────────────┐   │
    │     │ PROCESSING │   │
    │     └─────┬──────┘   │
    │           │           │
    │     ┌─────┴─────┐    │
    │     │           │     │
    │   Success    Failure  │
    │     │           │     │
    │     ▼           ▼     │
    │ ┌─────────┐ ┌────────┤
    │ │COMPLETED│ │ FAILED │
    │ └─────────┘ └────┬───┘
    │                  │
    │             Max retries?
    │                  │
    │              Yes │ No
    │                  ▼  │
    │             ┌────────┤
    │             │  DEAD  │
    │             └────────┘
    │                  │
    │                  │ Manual
    │                  │ retry
    └──────────────────┘
```

---

## ⚡ Performance Considerations

### Scalability Limits

- **File-based storage:** Good for ~10K jobs
- **Worker count:** Limited by CPU cores
- **Job throughput:** ~10-100 jobs/second (depends on job duration)

### Optimization Strategies

1. **For high volume:** Switch to PostgreSQL/Redis
2. **For distributed:** Use message queue (RabbitMQ, Redis)
3. **For monitoring:** Add metrics/logging layer
4. **For scheduling:** Add priority queue system

---

## 🔐 Security Considerations

### Current Implementation

- ✅ No SQL injection (JSON-based)
- ✅ Command execution via shell (intended)
- ⚠️ No input sanitization on commands
- ⚠️ No authentication/authorization
- ⚠️ Local file system access only

### Production Recommendations

1. **Sanitize commands** before execution
2. **Add API authentication** if exposing externally
3. **Limit command whitelist** (only allowed commands)
4. **Add audit logging** for all operations
5. **Encrypt sensitive data** in storage

---

## 📈 Future Enhancements

1. **Job Priority** - High/medium/low priority queues
2. **Scheduled Jobs** - `run_at` timestamp support
3. **Job Dependencies** - Wait for other jobs to complete
4. **Job Timeouts** - Kill long-running jobs
5. **Output Capture** - Store job stdout/stderr
6. **Web Dashboard** - Real-time monitoring UI
7. **Metrics** - Prometheus/Grafana integration
8. **Distributed Mode** - Multi-machine support

---

For implementation details, see the source code in `src/` directory.
