require('dotenv').config();
const { getQueueTimes, disconnectRedis } = require('../../utils/RedisUtils');

// It's generally better to handle initialization outside the handler in serverless environments.
// However, for Twilio Functions, environment variables are loaded into the `context` object.
// We will access them from there.

exports.handler = async (context, event, callback) => {
  const { queueSid } = event;

  if (!queueSid) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing queueSid parameter.',
      }),
    };
    return callback(null, response);
  }

  try {
    const queueTimesJson = await getQueueTimes();

    if (!queueTimesJson) {
      console.warn('No queue times data found in Redis.');
      // Return a default or estimated wait time, or an error, depending on business requirements.
      // Here, we'll return an error response.
      return callback(null, {
        statusCode: 404,
        body: JSON.stringify({ error: 'Wait time data not available.' }),
      });
    }

    const queueTimesObj = JSON.parse(queueTimesJson);
    const queueData = queueTimesObj.queues[queueSid];

    if (!queueData) {
      console.warn(`Wait time for queue ${queueSid} not found in cached data.`);
      return callback(null, {
        statusCode: 404,
        body: JSON.stringify({
          error: `Wait time for queue ${queueSid} not found.`,
        }),
      });
    }

    const { waittime } = queueData;
    console.log(`Retrieved wait time for ${queueSid}: ${waittime} seconds.`);

    // Twilio Functions expect a specific callback format.
    // The second argument is the object to be returned as the response body.
    return callback(null, { waittime });
  } catch (error) {
    console.error('An error occurred while retrieving queue wait time:', error);
    // The first argument to the callback is for errors.
    return callback(error, {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  } finally {
    // While the Redis client now persists, in some serverless environments
    // it's good practice to disconnect if the runtime will be torn down.
    // For Twilio Functions, this might not be strictly necessary, but it's a good practice.
    await disconnectRedis();
    console.log('Redis client disconnected.');
  }
};
