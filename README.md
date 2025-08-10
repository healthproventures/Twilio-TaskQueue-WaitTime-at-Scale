# Production-Ready Twilio TaskRouter Wait Times Caching

## Overview

This project provides a robust, production-ready solution for calculating and caching wait times for a high-volume Twilio TaskRouter contact center. It addresses common Twilio API limitations (rate limits, timeouts) by offloading wait time calculations to a scheduled process and storing the results in a fast-access Redis data store.

The system is composed of two core, serverless components:

1.  **Cache-Populating Lambda (`cache-queue-times.js`)**: An AWS Lambda function designed to run on a schedule (e.g., every 2 minutes via CloudWatch). It fetches statistics for all TaskQueues from Twilio and caches the average wait times in Redis.
2.  **Wait-Time Retrieval Function (`get-queue-times.js`)**: A Twilio Serverless Function responsible for retrieving the cached wait time for a *specific* TaskQueue from Redis. This function is designed to be called from a Twilio Studio Flow.

## Key Features & Improvements

*   **Efficient Redis Connection Management**: Uses a single, persistent Redis client across function invocations for improved performance and reliability.
*   **Robust Error Handling**: Both functions include comprehensive error handling to gracefully manage failures (e.g., failed API calls, missing data) without crashing.
*   **Asynchronous & Resilient**: The cache-populating function processes each TaskQueue independently, ensuring that a failure to fetch data for one queue does not halt the entire process.
*   **Test Coverage**: The project includes a full unit test suite using Jest to ensure code reliability and prevent regressions.
*   **Up-to-date Dependencies**: All dependencies have been updated to their latest stable versions.

## Prerequisites

*   An AWS account with permissions to create Lambda, CloudWatch, and ElastiCache resources.
*   A Twilio account with TaskRouter configured.
*   Node.js and npm installed.

## Setup & Deployment

### 1. Configuration

Create a `.env` file in the root of the project by copying the `.env.example` file. Populate it with your specific credentials:

```bash
cp .env.example .env
```

**`.env` file contents:**

```
REDIS_HOST=your-redis-host.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password # (if applicable)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WORKSPACE_SID=WSxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Install Dependencies

Install the required Node.js packages:

```bash
npm install
```

### 3. Deploying the AWS Lambda Function

1.  **Create a Lambda Function**: In the AWS Console, create a new Node.js Lambda function.
2.  **Upload Code**: Package the project files (including `node_modules`) into a zip file and upload it to the Lambda function.
    *   `cache-queue-times.js`
    *   `utils/RedisUtils.js`
    *   `.env` (or configure environment variables directly in the Lambda settings)
    *   `node_modules/` folder
3.  **Set Handler**: Configure the function's handler to be `cache-queue-times.handler`.
4.  **Set Environment Variables**: For better security, configure the environment variables from your `.env` file directly in the Lambda function's configuration settings instead of packaging the `.env` file.
5.  **Schedule with CloudWatch**: Create a CloudWatch Event rule to trigger the Lambda function on a schedule (e.g., `rate(2 minutes)`).

### 4. Deploying the Twilio Function

1.  **Create a Twilio Function Service**: In the Twilio Console, navigate to the Functions section and create a new service.
2.  **Upload the Function**: Add a new function and upload the code from `queue-wait-time/functions/get-queue-times.js`.
3.  **Configure Dependencies**: Add the project's dependencies (`redis`, `dotenv`) in the service's dependencies configuration.
4.  **Set Environment Variables**: Configure the environment variables from your `.env` file in the service's settings.
5.  **Deploy**: Deploy the function. Note the public URL provided after deployment.

## Running Tests

To run the unit tests, use the following command:

```bash
npm test
```
