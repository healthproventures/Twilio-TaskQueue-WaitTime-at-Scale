// Mock dependencies
jest.mock('../../../utils/RedisUtils', () => ({
  getQueueTimes: jest.fn(),
  disconnectRedis: jest.fn(),
}));

const { handler } = require('../get-queue-times');
const { getQueueTimes, disconnectRedis } = require('../../../utils/RedisUtils');

describe('get-queue-times handler', () => {
  let mockCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallback = jest.fn();
  });

  it('should return wait time for a valid queue SID', async () => {
    const mockData = {
      queues: {
        WQ123: { waittime: 150, timestamp: '2023-01-01T00:00:00.000Z' },
      },
    };
    getQueueTimes.mockResolvedValue(JSON.stringify(mockData));

    await handler({}, { queueSid: 'WQ123' }, mockCallback);

    expect(getQueueTimes).toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledWith(null, { waittime: 150 });
    expect(disconnectRedis).toHaveBeenCalled();
  });

  it('should return a 400 error if queueSid is missing', async () => {
    await handler({}, {}, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing queueSid parameter.' }),
    });
    expect(getQueueTimes).not.toHaveBeenCalled();
  });

  it('should return a 404 error if queue data is not in Redis', async () => {
    getQueueTimes.mockResolvedValue(null);

    await handler({}, { queueSid: 'WQ123' }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, {
      statusCode: 404,
      body: JSON.stringify({ error: 'Wait time data not available.' }),
    });
  });

  it('should return a 404 error if specific queue SID is not found', async () => {
    const mockData = {
      queues: {
        WQ456: { waittime: 200, timestamp: '2023-01-01T00:00:00.000Z' },
      },
    };
    getQueueTimes.mockResolvedValue(JSON.stringify(mockData));

    await handler({}, { queueSid: 'WQ123' }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, {
      statusCode: 404,
      body: JSON.stringify({
        error: `Wait time for queue WQ123 not found.`,
      }),
    });
  });

  it('should handle JSON parsing errors gracefully', async () => {
    getQueueTimes.mockResolvedValue('invalid-json');

    await handler({}, { queueSid: 'WQ123' }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(expect.any(Error), {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });
});
