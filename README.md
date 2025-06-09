# Email Service

This project implements a robust, resilient email sending service in JavaScript, featuring:

* **Retry Mechanism**: Automatic retries with exponential backoff when a provider fails.
* **Fallback Providers**: Switches to a secondary provider if the primary fails.
* **Idempotency**: Prevents duplicate sends by tracking unique email IDs.
* **Rate Limiting**: Enforces a maximum number of sends per time window.
* **Status Tracking**: Records the outcome of each send attempt.
* **Circuit Breaker**: Temporarily disables a provider after repeated failures.
* **Logging**: Basic console logging of failures.

## File Structure

```
your-project/
├─ src/
│  └─ resilientEmailService.js   # Core implementation
├─ __tests__/
│  └─ emailService.test.js       # Jest unit tests
├─ package.json                  # npm scripts & dependencies
└─ README.md                     # This file
```

## Installation

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd your-project
   ```
2. Install dependencies:

   ```bash
   npm install
   ```

## Usage

### 1. Manual Smoke Test

Run the built-in example in `src/resilientEmailService.js`:

```bash
node src/resilientEmailService.js
```

You should see console output demonstrating:

* Successes via ProviderA or ProviderB
* Random failures and retries
* Rate-limited messages
* Fallback behavior

### 2. Importing the Service

Use the `EmailService` in your code:

```js
const { EmailService, MockEmailProvider } = require('./src/resilientEmailService');

(async () => {
  const providerA = new MockEmailProvider('ProviderA');
  const providerB = new MockEmailProvider('ProviderB');
  const emailService = new EmailService([providerA, providerB]);

  const status = await emailService.send(
    { to: 'user@example.com', subject: 'Welcome' },
    'unique-email-id'
  );
  console.log('Send status:', status);
})();
```

## Configuration

* **RateLimiter**: Modify the `limit` and `interval` in the constructor (default: 5 emails/10s).
* **CircuitBreaker**: Adjust `failureThreshold` and `recoveryTime` (default: 3 failures, 10s cooldown).
* **Retry Logic**: Change `retries` and `delay` parameters in `retryWithBackoff()`.

## Unit Tests

Tests are written with Jest. To run:

```bash
npm test
```

## Extending to Real Providers

Replace `MockEmailProvider` with real implementations exposing a `sendEmail(email)` method that returns a Promise:

```js
class SmtpProvider {
  async sendEmail(email) {
    // integrate with nodemailer or SMTP client
  }
}
```

Then instantiate `EmailService` with your real providers:

```js
const smtp = new SmtpProvider(config);
const awsSes = new AwsSesProvider(config);
const emailService = new EmailService([smtp, awsSes]);
```

---

Feel free to customize rate limits, retry policies, and logging to fit your needs.
