require('dotenv').config();
const { createClient } = require('redis');

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env;
const redisUrl = `redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`;

// Create a single, reusable Redis client
const client = createClient({
  url: redisUrl,
});

client.on('error', (err) => console.error('Redis Client Error', err));

// Connect the client once when the module is loaded.
// The `redis` library will handle reconnecting automatically.
client.connect();

const saveToRedis = async (value) => {
  // Use the existing client connection
  await client.set('queue-times', value);
};

const getQueueTimes = async () => {
  // Use the existing client connection
  const value = await client.get('queue-times');
  return value;
};

// Function to disconnect the client, useful for graceful shutdown
const disconnectRedis = async () => {
  await client.disconnect();
};

module.exports = {
  saveToRedis,
  getQueueTimes,
  disconnectRedis, // Export for use in tests or shutdown hooks
  client, // Export client for more complex operations if needed
};
