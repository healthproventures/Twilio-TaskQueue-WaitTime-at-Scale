// Mock the redis library
const mockClient = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue('{"queues":{}}'),
  disconnect: jest.fn().mockResolvedValue('OK'),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockClient),
}));

const { createClient } = require('redis');

describe('RedisUtils', () => {
  let RedisUtils;

  beforeEach(() => {
    jest.clearAllMocks();
    createClient.mockReturnValue(mockClient);
    // Dynamically require the module to get the latest instance with mocks
    RedisUtils = require('../RedisUtils');
  });

  afterEach(() => {
    // Reset modules after each test to ensure a clean state
    jest.resetModules();
  });

  it('should create and connect a redis client on module load', () => {
    // This test relies on the beforeEach hook to load the module
    expect(createClient).toHaveBeenCalled();
    expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockClient.connect).toHaveBeenCalled();
  });

  describe('saveToRedis', () => {
    it('should call client.set with the correct key and value', async () => {
      const testValue = '{"test":"data"}';
      await RedisUtils.saveToRedis(testValue);
      expect(mockClient.set).toHaveBeenCalledWith('queue-times', testValue);
    });
  });

  describe('getQueueTimes', () => {
    it('should call client.get with the correct key', async () => {
      await RedisUtils.getQueueTimes();
      expect(mockClient.get).toHaveBeenCalledWith('queue-times');
    });

    it('should return the value from client.get', async () => {
      const expectedValue = '{"queues":{"WQ123":{}}}';
      mockClient.get.mockResolvedValue(expectedValue);
      const result = await RedisUtils.getQueueTimes();
      expect(result).toBe(expectedValue);
    });
  });

  describe('disconnectRedis', () => {
    it('should call client.disconnect', async () => {
      await RedisUtils.disconnectRedis();
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });
});
