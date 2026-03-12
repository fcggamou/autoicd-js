import type { RateLimit } from "./types.js";

export class AutoICDError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AutoICDError";
    this.status = status;
  }
}

export class AuthenticationError extends AutoICDError {
  constructor(message = "Invalid API key") {
    super(401, message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends AutoICDError {
  readonly rateLimit: RateLimit;

  constructor(message: string, rateLimit: RateLimit) {
    super(429, message);
    this.name = "RateLimitError";
    this.rateLimit = rateLimit;
  }
}

export class NotFoundError extends AutoICDError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}
