jest.mock('../utils/RedisUtils', () => ({
  saveToRedis: jest.fn(),
  disconnectRedis: jest.fn(),
}));
jest.mock('twilio');

const twilio = require('twilio');
const { saveToRedis, disconnectRedis } = require('../utils/RedisUtils');

// Set up the mock return value before importing the module
const mockTaskQueuesList = jest.fn();
const mockCumulativeStatisticsFetch = jest.fn();
const mockTwilioClient = {
  taskrouter: {
    workspaces: jest.fn().mockReturnThis(),
    taskQueues: jest.fn((sid) => ({
      cumulativeStatistics: jest.fn(() => ({
        fetch: () => mockCumulativeStatisticsFetch(sid),
      })),
    })),
  },
};
mockTwilioClient.taskrouter.workspaces().taskQueues.list = mockTaskQueuesList;
twilio.mockReturnValue(mockTwilioClient);

// Now, require the handler
const { handler } = require('../cache-queue-times');


describe('cache-queue-times handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskQueuesList.mockResolvedValue([
      { sid: 'WQ001' },
      { sid: 'WQ002' },
    ]);
    mockCumulativeStatisticsFetch.mockImplementation((sid) => {
      if (sid === 'WQ001_FAIL') {
        return Promise.reject(new Error('Failed to fetch stats'));
      }
      return Promise.resolve({
        waitDurationInQueueUntilAccepted: { avg: 120 },
      });
    });
  });

  it('should fetch queue SIDs, get wait times, and save to Redis', async () => {
    const result = await handler();

    expect(mockTaskQueuesList).toHaveBeenCalled();
    expect(mockCumulativeStatisticsFetch).toHaveBeenCalledWith('WQ001');
    expect(mockCumulativeStatisticsFetch).toHaveBeenCalledWith('WQ002');
    expect(saveToRedis).toHaveBeenCalled();
    expect(disconnectRedis).toHaveBeenCalled();

    const savedData = JSON.parse(saveToRedis.mock.calls[0][0]);
    expect(savedData.queues['WQ001'].waittime).toBe(120);
    expect(savedData.queues['WQ002'].waittime).toBe(120);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).successCount).toBe(2);
    expect(JSON.parse(result.body).failureCount).toBe(0);
  });

  it('should handle failures for individual queues gracefully', async () => {
    mockTaskQueuesList.mockResolvedValue([
      { sid: 'WQ001' },
      { sid: 'WQ001_FAIL' },
    ]);

    const result = await handler();

    expect(saveToRedis).toHaveBeenCalled();
    const savedData = JSON.parse(saveToRedis.mock.calls[0][0]);
    expect(savedData.queues['WQ001'].waittime).toBe(120);
    expect(savedData.queues['WQ001_FAIL']).toBeUndefined();
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).successCount).toBe(1);
    expect(JSON.parse(result.body).failureCount).toBe(1);
  });

  it('should throw an error if fetching the list of queues fails', async () => {
    const error = new Error('Twilio API error');
    mockTaskQueuesList.mockRejectedValue(error);

    await expect(handler()).rejects.toThrow('Twilio API error');
    expect(saveToRedis).not.toHaveBeenCalled();
    expect(disconnectRedis).toHaveBeenCalled();
  });
});
