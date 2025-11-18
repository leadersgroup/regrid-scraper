# Email Verifier API Documentation

REST API for email verification with single and bulk processing capabilities.

## Base URL

```
http://localhost:3000
```

## Getting Started

### Installation

```bash
cd email-verifier
npm install
```

### Start the API Server

```bash
# Production mode
npm run api

# Development mode (with detailed logging)
npm run api:dev

# Or directly
node api-server.js
```

The server will start on port 3000 (or the PORT environment variable if set).

## Rate Limiting

- **60 requests per minute** per IP address
- Returns `429 Too Many Requests` when limit exceeded
- Response includes `retryAfter` field with seconds to wait

## Endpoints

### 1. Health Check

Check if the API server is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123.456,
  "timestamp": "2025-01-18T12:00:00.000Z"
}
```

---

### 2. API Documentation

Get full API documentation in JSON format.

**Endpoint:** `GET /api/docs`

**Response:** Complete API documentation with examples

---

### 3. Verify Single Email

Verify a single email address with full SMTP validation.

**Endpoint:** `POST /api/verify`

**Request Body:**
```json
{
  "email": "test@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "email": "test@example.com",
    "valid": true,
    "syntax": {
      "valid": true,
      "message": "Valid syntax"
    },
    "domain": {
      "valid": true,
      "name": "example.com",
      "message": "Domain exists"
    },
    "mx": {
      "valid": true,
      "records": ["mx1.example.com", "mx2.example.com"],
      "message": "Found 2 MX record(s)"
    },
    "smtp": {
      "valid": true,
      "status": "valid",
      "message": "Mailbox exists"
    },
    "disposable": false,
    "roleBased": false,
    "catchAll": false,
    "freeProvider": false,
    "error": null,
    "verifiedAt": "2025-01-18T12:00:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**JavaScript Example:**
```javascript
const response = await fetch('http://localhost:3000/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com' })
});

const data = await response.json();
console.log(data.result);
```

---

### 4. Verify Bulk Emails

Verify multiple emails (up to 10,000 per request).

**Endpoint:** `POST /api/verify/bulk`

**Request Body:**
```json
{
  "emails": [
    "test1@example.com",
    "test2@example.com",
    "test3@example.com"
  ],
  "async": true,
  "webhook": "https://yourdomain.com/webhook"
}
```

**Parameters:**
- `emails` (required): Array of email addresses (max 10,000)
- `async` (optional): Process asynchronously (default: true for >100 emails)
- `webhook` (optional): URL to receive completion notification

**Synchronous Response (≤100 emails):**
```json
{
  "success": true,
  "results": [
    {
      "email": "test1@example.com",
      "valid": true,
      ...
    }
  ],
  "stats": {
    "total": 3,
    "processed": 3,
    "valid": 2,
    "invalid": 1,
    "disposable": 0,
    "roleBased": 1,
    "catchAll": 0,
    "freeProvider": 2,
    "errors": 0
  },
  "message": "Verified 3 email(s)"
}
```

**Asynchronous Response (>100 emails):**
```json
{
  "success": true,
  "jobId": "job_1705579200000_abc123",
  "message": "Bulk verification job started",
  "statusUrl": "/api/verify/bulk/job_1705579200000_abc123"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/verify/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "emails": ["test1@example.com", "test2@example.com"],
    "async": false
  }'
```

**JavaScript Example:**
```javascript
const response = await fetch('http://localhost:3000/api/verify/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emails: ['test1@example.com', 'test2@example.com'],
    async: true,
    webhook: 'https://yourdomain.com/webhook'
  })
});

const data = await response.json();
console.log('Job ID:', data.jobId);
```

---

### 5. Check Job Status

Get the status and results of a bulk verification job.

**Endpoint:** `GET /api/verify/bulk/:jobId`

**Response:**
```json
{
  "success": true,
  "job": {
    "jobId": "job_1705579200000_abc123",
    "status": "completed",
    "totalEmails": 1000,
    "createdAt": "2025-01-18T12:00:00.000Z",
    "startedAt": "2025-01-18T12:00:01.000Z",
    "completedAt": "2025-01-18T12:03:45.000Z",
    "progress": {
      "processed": 1000,
      "total": 1000,
      "percentComplete": 100,
      "emailsPerSecond": 7.8
    },
    "results": [...],
    "stats": {
      "total": 1000,
      "processed": 1000,
      "valid": 850,
      "invalid": 150,
      ...
    },
    "error": null
  }
}
```

**Status Values:**
- `pending`: Job queued, not started yet
- `processing`: Currently verifying emails
- `completed`: Verification finished successfully
- `failed`: Verification failed with error

**cURL Example:**
```bash
curl http://localhost:3000/api/verify/bulk/job_1705579200000_abc123
```

**JavaScript Example:**
```javascript
const response = await fetch('http://localhost:3000/api/verify/bulk/job_1705579200000_abc123');
const data = await response.json();

console.log('Status:', data.job.status);
console.log('Progress:', data.job.progress);
```

---

### 6. List All Jobs

Get a list of all verification jobs.

**Endpoint:** `GET /api/jobs`

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job_1705579200000_abc123",
      "status": "completed",
      "totalEmails": 1000,
      "hasResults": true,
      "createdAt": "2025-01-18T12:00:00.000Z",
      "completedAt": "2025-01-18T12:03:45.000Z"
    }
  ],
  "total": 1
}
```

**cURL Example:**
```bash
curl http://localhost:3000/api/jobs
```

---

### 7. Delete Job

Delete a verification job and its results.

**Endpoint:** `DELETE /api/jobs/:jobId`

**Response:**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:3000/api/jobs/job_1705579200000_abc123
```

---

## Webhook Notifications

When you provide a `webhook` URL in the bulk verification request, the API will send a POST request to that URL when the job completes.

**Webhook Payload:**
```json
{
  "jobId": "job_1705579200000_abc123",
  "status": "completed",
  "stats": {
    "total": 1000,
    "processed": 1000,
    "valid": 850,
    "invalid": 150
  },
  "completedAt": "2025-01-18T12:03:45.000Z"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Error Codes:**
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Endpoint or job not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Examples

### Complete Workflow Example

```javascript
// 1. Verify a single email
async function verifySingle() {
  const response = await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' })
  });

  const data = await response.json();
  console.log('Valid:', data.result.valid);
}

// 2. Start bulk verification
async function verifyBulk() {
  const emails = [/* ... array of emails ... */];

  const response = await fetch('http://localhost:3000/api/verify/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails, async: true })
  });

  const data = await response.json();
  return data.jobId;
}

// 3. Poll for job completion
async function waitForJob(jobId) {
  while (true) {
    const response = await fetch(`http://localhost:3000/api/verify/bulk/${jobId}`);
    const data = await response.json();

    if (data.job.status === 'completed') {
      console.log('Results:', data.job.results);
      console.log('Stats:', data.job.stats);
      break;
    } else if (data.job.status === 'failed') {
      console.error('Job failed:', data.job.error);
      break;
    }

    console.log(`Progress: ${data.job.progress.percentComplete}%`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  }
}

// Run the workflow
const jobId = await verifyBulk();
await waitForJob(jobId);
```

### Python Example

```python
import requests
import time

# Verify single email
response = requests.post('http://localhost:3000/api/verify',
    json={'email': 'test@example.com'})
result = response.json()
print(f"Valid: {result['result']['valid']}")

# Bulk verification
emails = ['test1@example.com', 'test2@example.com']
response = requests.post('http://localhost:3000/api/verify/bulk',
    json={'emails': emails, 'async': True})
job_id = response.json()['jobId']

# Poll for results
while True:
    response = requests.get(f'http://localhost:3000/api/verify/bulk/{job_id}')
    job = response.json()['job']

    if job['status'] == 'completed':
        print(f"Valid: {job['stats']['valid']}")
        break

    print(f"Progress: {job['progress']['percentComplete']}%")
    time.sleep(2)
```

## Performance Notes

- Single email verification: ~1-2 seconds per email
- Bulk verification: ~5-10 emails per second
- 1,000 emails: ~2-3 minutes
- 10,000 emails: ~20-30 minutes

## Configuration

Modify `config.js` to adjust:
- Rate limiting settings
- SMTP timeouts
- Concurrent connections
- Batch sizes

## Support

For issues or questions, check the main [README.md](README.md) or raise an issue.
