const { v4: uuidv4 } = require("crypto");

/**
 * Job Model
 * Represents a background job with retry logic and state management
 */
class Job {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.command = data.command;
    this.state = data.state || "pending";
    this.attempts = data.attempts || 0;
    this.max_retries = data.max_retries || 3;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.next_retry_at = data.next_retry_at || null;
    this.error_message = data.error_message || null;
    this.locked_by = data.locked_by || null;
    this.locked_at = data.locked_at || null;
  }

  generateId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      command: this.command,
      state: this.state,
      attempts: this.attempts,
      max_retries: this.max_retries,
      created_at: this.created_at,
      updated_at: this.updated_at,
      next_retry_at: this.next_retry_at,
      error_message: this.error_message,
    };
  }

  static fromJSON(json) {
    if (typeof json === "string") {
      json = JSON.parse(json);
    }
    return new Job(json);
  }

  static calculateBackoffDelay(attempts, baseSeconds = 2) {
    // Exponential backoff: delay = base ^ attempts seconds
    return Math.pow(baseSeconds, attempts);
  }

  static getNextRetryTime(attempts, baseSeconds = 2) {
    const delaySeconds = this.calculateBackoffDelay(attempts, baseSeconds);
    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + delaySeconds);
    return nextRetry.toISOString();
  }
}

// Job states
Job.STATE = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  DEAD: "dead",
};

module.exports = Job;
