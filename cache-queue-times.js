require('dotenv').config();
const { saveToRedis, disconnectRedis } = require('./utils/RedisUtils');
const twilio = require('twilio');

// Initialize Twilio client outside the handler
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WORKSPACE_SID } =
  process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Get Queue SIDS
const getQueueSids = async () => {
  const queues = await client.taskrouter
    .workspaces(TWILIO_WORKSPACE_SID)
    .taskQueues.list();
  return queues.map((tq) => tq.sid);
};

// Get wait time for a single queue
const getQueueWaitTime = async (sid) => {
  const stats = await client.taskrouter
    .workspaces(TWILIO_WORKSPACE_SID)
    .taskQueues(sid)
    .cumulativeStatistics()
    .fetch();
  return stats.waitDurationInQueueUntilAccepted.avg;
};

// Main handler function for AWS Lambda
exports.handler = async () => {
  console.log('Starting to cache queue times...');
  let successCount = 0;
  let failureCount = 0;

  try {
    const queueSids = await getQueueSids();
    console.log(`Found ${queueSids.length} queues to process.`);

    const waitTimeObj = { queues: {} };

    for (const sid of queueSids) {
      try {
        const waitTime = await getQueueWaitTime(sid);
        const timestamp = new Date().toISOString();
        waitTimeObj.queues[sid] = {
          waittime: waitTime,
          timestamp,
        };
        successCount++;
      } catch (error) {
        failureCount++;
        console.error(`Failed to retrieve wait time for queue ${sid}:`, error);
        // Continue to next queue
      }
    }

    if (successCount > 0) {
      const queueTimes = JSON.stringify(waitTimeObj);
      await saveToRedis(queueTimes);
      console.log('Successfully cached wait times for', successCount, 'queues.');
    } else {
      console.warn('No queue wait times were successfully retrieved.');
    }

    if (failureCount > 0) {
      console.error('Failed to retrieve wait times for', failureCount, 'queues.');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cache process completed.',
        successCount,
        failureCount,
      }),
    };
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    // In case of a critical error (e.g., fetching queue list fails), we throw to indicate a failed execution
    throw error;
  } finally {
    // Disconnect Redis client for graceful shutdown in Lambda
    await disconnectRedis();
    console.log('Redis client disconnected.');
  }
};
