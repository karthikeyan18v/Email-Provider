// MockEmailProvider simulates an external email sending service
class MockEmailProvider {
    constructor(name) {
        this.name = name;         // Name of the provider
        this.shouldFail = false;  // Flag to force failure (used in tests)
    }

    async sendEmail(email) {
        // Simulate failure randomly or if shouldFail is true
        if (this.shouldFail || Math.random() > 0.7) {
            throw new Error(`${this.name} failed`);
        }
        // Simulate successful email send
        return `${this.name} sent email to ${email.to}`;
    }
}

// Simple rate limiter class to control request flow
class RateLimiter {
    constructor(limit, interval) {
        this.limit = limit;             // Max allowed operations
        this.interval = interval;       // Time window in milliseconds
        this.timestamps = [];           // Timestamps of recent actions
    }

    allow() {
        const now = Date.now();
        // Remove old timestamps outside the interval
        this.timestamps = this.timestamps.filter(ts => now - ts < this.interval);
        if (this.timestamps.length < this.limit) {
            this.timestamps.push(now);  // Record new timestamp
            return true;                // Allow the action
        }
        return false;                   // Deny if limit exceeded
    }
}

// Circuit breaker to prevent repeated failures
class CircuitBreaker {
    constructor(failureThreshold = 3, recoveryTime = 10000) {
        this.failureThreshold = failureThreshold; // Failures before opening circuit
        this.recoveryTime = recoveryTime;         // Time before trying again
        this.failures = 0;                        // Count of failures
        this.lastFailureTime = 0;                 // Time of last failure
    }

    allow() {
        // If too many failures and not enough recovery time passed, block
        if (this.failures >= this.failureThreshold && (Date.now() - this.lastFailureTime < this.recoveryTime)) {
            return false;
        }
        return true; // Allow operation otherwise
    }

    recordFailure() {
        this.failures++;                      // Increment failure count
        this.lastFailureTime = Date.now();    // Update last failure timestamp
    }

    reset() {
        this.failures = 0; // Reset failures on success
    }
}

// Core email service with retry, fallback, circuit breaker, and rate limiting
class EmailService {
    constructor(providers) {
        this.providers = providers;                       // List of email providers
        this.rateLimiter = new RateLimiter(5, 10000);     // Allow 5 emails every 10 sec
        this.statusLog = new Map();                       // Track status by email ID
        this.sentEmails = new Set();                      // Track sent email IDs for idempotency
        this.circuitBreakers = providers.map(() => new CircuitBreaker()); // One circuit breaker per provider
    }

    // Main method to send an email
    async send(email, id) {
        // Check if rate limit exceeded
        if (!this.rateLimiter.allow()) {
            return this.trackStatus(id, 'Rate limited');
        }

        // Check if this email ID was already sent (idempotency)
        if (this.sentEmails.has(id)) {
            return this.trackStatus(id, 'Duplicate skipped');
        }

        // Try each provider
        for (let i = 0; i < this.providers.length; i++) {
            if (!this.circuitBreakers[i].allow()) {
                continue; // Skip if circuit is open
            }

            try {
                // Try sending with retries
                await this.retryWithBackoff(() => this.providers[i].sendEmail(email));
                this.sentEmails.add(id);             // Mark email as sent
                this.circuitBreakers[i].reset();     // Reset circuit breaker on success
                return this.trackStatus(id, `Sent via ${this.providers[i].name}`);
            } catch (err) {
                console.log(`[LOG] Provider ${this.providers[i].name} failed:`, err.message);
                this.circuitBreakers[i].recordFailure(); // Record failure
            }
        }

        // If all providers failed
        return this.trackStatus(id, 'All providers failed');
    }

    // Retry logic with exponential backoff
    async retryWithBackoff(fn, retries = 3, delay = 500) {
        let attempt = 0;
        while (attempt < retries) {
            try {
                return await fn(); // Try executing function
            } catch (e) {
                attempt++;
                if (attempt >= retries) throw e; // Throw if all retries failed
                await new Promise(res => setTimeout(res, delay * 2 ** attempt)); // Exponential backoff
            }
        }
    }

    // Save status for given email ID
    trackStatus(id, status) {
        this.statusLog.set(id, status);
        return status;
    }

    // Retrieve status for given email ID
    getStatus(id) {
        return this.statusLog.get(id);
    }
}

// Self-executing test block
(async () => {
    const provider1 = new MockEmailProvider("ProviderA"); // Create mock provider A
    const provider2 = new MockEmailProvider("ProviderB"); // Create mock provider B
    const service = new EmailService([provider1, provider2]); // Create email service with both providers

    // Send 10 emails
    for (let i = 0; i < 10; i++) {
        const id = `email-${i}`;
        const result = await service.send({ to: `user${i}@example.com`, subject: "Hello" }, id);
        console.log(id, result); // Log result
    }
})();

// Export classes for testing
module.exports = { EmailService, MockEmailProvider };
