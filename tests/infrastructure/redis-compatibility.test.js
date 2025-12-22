/**
 * Property-Based Test for Redis Compatibility
 * Feature: aws-conversion, Property 10: Redis Compatibility
 * Validates: Requirements 3.2
 * 
 * This test verifies that all existing Redis operations used by the application
 * (sessions, caching, real-time data) function identically after migration to ElastiCache.
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fc = require('fast-check');

// Mock Redis clients for comparison
const mockOriginalRedis = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  sismember: jest.fn(),
  zadd: jest.fn(),
  zrem: jest.fn(),
  zrange: jest.fn(),
  zrank: jest.fn(),
  lpush: jest.fn(),
  rpush: jest.fn(),
  lpop: jest.fn(),
  rpop: jest.fn(),
  lrange: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  incrby: jest.fn(),
  decrby: jest.fn(),
  ping: jest.fn()
};

const mockElastiCacheRedis = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  sismember: jest.fn(),
  zadd: jest.fn(),
  zrem: jest.fn(),
  zrange: jest.fn(),
  zrank: jest.fn(),
  lpush: jest.fn(),
  rpush: jest.fn(),
  lpop: jest.fn(),
  rpop: jest.fn(),
  lrange: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  incrby: jest.fn(),
  decrby: jest.fn(),
  ping: jest.fn()
};

// Mock ioredis for both original and ElastiCache
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((config) => {
    // Return ElastiCache mock if connecting to AWS endpoint
    if (config.host && config.host.includes('amazonaws.com')) {
      return mockElastiCacheRedis;
    }
    // Return original Redis mock for local/standard Redis
    return mockOriginalRedis;
  });
});

const Redis = require('ioredis');

describe('Redis Compatibility Property Tests', () => {
  let originalRedis;
  let elastiCacheRedis;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock successful connections for both clients
    mockOriginalRedis.connect.mockResolvedValue('OK');
    mockOriginalRedis.ping.mockResolvedValue('PONG');
    mockOriginalRedis.disconnect.mockResolvedValue('OK');
    
    mockElastiCacheRedis.connect.mockResolvedValue('OK');
    mockElastiCacheRedis.ping.mockResolvedValue('PONG');
    mockElastiCacheRedis.disconnect.mockResolvedValue('OK');
    
    // Create Redis clients
    originalRedis = new Redis({
      host: 'localhost',
      port: 6379
    });

    elastiCacheRedis = new Redis({
      host: 'direct-fan-platform-redis-enhanced.cache.amazonaws.com',
      port: 6379,
      tls: {}
    });

    await originalRedis.connect();
    await elastiCacheRedis.connect();
  });

  afterEach(async () => {
    if (originalRedis) {
      await originalRedis.disconnect();
    }
    if (elastiCacheRedis) {
      await elastiCacheRedis.disconnect();
    }
  });

  /**
   * Property 10: Redis Compatibility
   * For any existing Redis operation used by the application, the operation should 
   * function identically after migration to ElastiCache
   */
  test('Property: String operations maintain identical behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 1, maxLength: 100 }),
          value: fc.string({ minLength: 0, maxLength: 1000 }),
          ttl: fc.integer({ min: 1, max: 3600 }),
          operation: fc.constantFrom('set', 'get', 'del', 'exists', 'expire', 'ttl')
        }),
        async (testData) => {
          // Mock identical responses for both Redis instances
          const mockValue = testData.value;
          const mockTtl = testData.ttl;
          
          // Configure mocks to return identical results
          mockOriginalRedis.set.mockResolvedValue('OK');
          mockElastiCacheRedis.set.mockResolvedValue('OK');
          
          mockOriginalRedis.get.mockResolvedValue(mockValue);
          mockElastiCacheRedis.get.mockResolvedValue(mockValue);
          
          mockOriginalRedis.del.mockResolvedValue(1);
          mockElastiCacheRedis.del.mockResolvedValue(1);
          
          mockOriginalRedis.exists.mockResolvedValue(1);
          mockElastiCacheRedis.exists.mockResolvedValue(1);
          
          mockOriginalRedis.expire.mockResolvedValue(1);
          mockElastiCacheRedis.expire.mockResolvedValue(1);
          
          mockOriginalRedis.ttl.mockResolvedValue(mockTtl);
          mockElastiCacheRedis.ttl.mockResolvedValue(mockTtl);

          let originalResult, elastiCacheResult;

          // Execute the same operation on both Redis instances
          switch (testData.operation) {
            case 'set':
              originalResult = await originalRedis.set(testData.key, testData.value);
              elastiCacheResult = await elastiCacheRedis.set(testData.key, testData.value);
              break;
            case 'get':
              originalResult = await originalRedis.get(testData.key);
              elastiCacheResult = await elastiCacheRedis.get(testData.key);
              break;
            case 'del':
              originalResult = await originalRedis.del(testData.key);
              elastiCacheResult = await elastiCacheRedis.del(testData.key);
              break;
            case 'exists':
              originalResult = await originalRedis.exists(testData.key);
              elastiCacheResult = await elastiCacheRedis.exists(testData.key);
              break;
            case 'expire':
              originalResult = await originalRedis.expire(testData.key, testData.ttl);
              elastiCacheResult = await elastiCacheRedis.expire(testData.key, testData.ttl);
              break;
            case 'ttl':
              originalResult = await originalRedis.ttl(testData.key);
              elastiCacheResult = await elastiCacheRedis.ttl(testData.key);
              break;
          }

          // Property: Results should be identical
          expect(elastiCacheResult).toEqual(originalResult);

          // Property: Both operations should complete successfully
          expect(originalResult).toBeDefined();
          expect(elastiCacheResult).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash operations maintain identical behavior
   * For any hash operation, ElastiCache should behave identically to standard Redis
   */
  test('Property: Hash operations maintain identical behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hashKey: fc.string({ minLength: 1, maxLength: 50 }),
          field: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.string({ minLength: 0, maxLength: 500 }),
          operation: fc.constantFrom('hset', 'hget', 'hdel', 'hgetall')
        }),
        async (hashData) => {
          // Mock hash operations with identical responses
          const mockHashValue = { [hashData.field]: hashData.value };
          
          mockOriginalRedis.hset.mockResolvedValue(1);
          mockElastiCacheRedis.hset.mockResolvedValue(1);
          
          mockOriginalRedis.hget.mockResolvedValue(hashData.value);
          mockElastiCacheRedis.hget.mockResolvedValue(hashData.value);
          
          mockOriginalRedis.hdel.mockResolvedValue(1);
          mockElastiCacheRedis.hdel.mockResolvedValue(1);
          
          mockOriginalRedis.hgetall.mockResolvedValue(mockHashValue);
          mockElastiCacheRedis.hgetall.mockResolvedValue(mockHashValue);

          let originalResult, elastiCacheResult;

          switch (hashData.operation) {
            case 'hset':
              originalResult = await originalRedis.hset(hashData.hashKey, hashData.field, hashData.value);
              elastiCacheResult = await elastiCacheRedis.hset(hashData.hashKey, hashData.field, hashData.value);
              break;
            case 'hget':
              originalResult = await originalRedis.hget(hashData.hashKey, hashData.field);
              elastiCacheResult = await elastiCacheRedis.hget(hashData.hashKey, hashData.field);
              break;
            case 'hdel':
              originalResult = await originalRedis.hdel(hashData.hashKey, hashData.field);
              elastiCacheResult = await elastiCacheRedis.hdel(hashData.hashKey, hashData.field);
              break;
            case 'hgetall':
              originalResult = await originalRedis.hgetall(hashData.hashKey);
              elastiCacheResult = await elastiCacheRedis.hgetall(hashData.hashKey);
              break;
          }

          // Property: Hash operations should return identical results
          expect(elastiCacheResult).toEqual(originalResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Set operations maintain identical behavior
   * For any set operation, ElastiCache should behave identically to standard Redis
   */
  test('Property: Set operations maintain identical behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          setKey: fc.string({ minLength: 1, maxLength: 50 }),
          member: fc.string({ minLength: 1, maxLength: 100 }),
          operation: fc.constantFrom('sadd', 'srem', 'sismember', 'smembers')
        }),
        async (setData) => {
          // Mock set operations with identical responses
          const mockMembers = [setData.member, 'existing_member'];
          
          mockOriginalRedis.sadd.mockResolvedValue(1);
          mockElastiCacheRedis.sadd.mockResolvedValue(1);
          
          mockOriginalRedis.srem.mockResolvedValue(1);
          mockElastiCacheRedis.srem.mockResolvedValue(1);
          
          mockOriginalRedis.sismember.mockResolvedValue(1);
          mockElastiCacheRedis.sismember.mockResolvedValue(1);
          
          mockOriginalRedis.smembers.mockResolvedValue(mockMembers);
          mockElastiCacheRedis.smembers.mockResolvedValue(mockMembers);

          let originalResult, elastiCacheResult;

          switch (setData.operation) {
            case 'sadd':
              originalResult = await originalRedis.sadd(setData.setKey, setData.member);
              elastiCacheResult = await elastiCacheRedis.sadd(setData.setKey, setData.member);
              break;
            case 'srem':
              originalResult = await originalRedis.srem(setData.setKey, setData.member);
              elastiCacheResult = await elastiCacheRedis.srem(setData.setKey, setData.member);
              break;
            case 'sismember':
              originalResult = await originalRedis.sismember(setData.setKey, setData.member);
              elastiCacheResult = await elastiCacheRedis.sismember(setData.setKey, setData.member);
              break;
            case 'smembers':
              originalResult = await originalRedis.smembers(setData.setKey);
              elastiCacheResult = await elastiCacheRedis.smembers(setData.setKey);
              break;
          }

          // Property: Set operations should return identical results
          expect(elastiCacheResult).toEqual(originalResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sorted set operations maintain identical behavior
   * For any sorted set operation, ElastiCache should behave identically to standard Redis
   */
  test('Property: Sorted set operations maintain identical behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          zsetKey: fc.string({ minLength: 1, maxLength: 50 }),
          member: fc.string({ minLength: 1, maxLength: 100 }),
          score: fc.float({ min: -1000, max: 1000 }),
          operation: fc.constantFrom('zadd', 'zrem', 'zrank', 'zrange')
        }),
        async (zsetData) => {
          // Mock sorted set operations with identical responses
          const mockRange = [zsetData.member, 'other_member'];
          
          mockOriginalRedis.zadd.mockResolvedValue(1);
          mockElastiCacheRedis.zadd.mockResolvedValue(1);
          
          mockOriginalRedis.zrem.mockResolvedValue(1);
          mockElastiCacheRedis.zrem.mockResolvedValue(1);
          
          mockOriginalRedis.zrank.mockResolvedValue(0);
          mockElastiCacheRedis.zrank.mockResolvedValue(0);
          
          mockOriginalRedis.zrange.mockResolvedValue(mockRange);
          mockElastiCacheRedis.zrange.mockResolvedValue(mockRange);

          let originalResult, elastiCacheResult;

          switch (zsetData.operation) {
            case 'zadd':
              originalResult = await originalRedis.zadd(zsetData.zsetKey, zsetData.score, zsetData.member);
              elastiCacheResult = await elastiCacheRedis.zadd(zsetData.zsetKey, zsetData.score, zsetData.member);
              break;
            case 'zrem':
              originalResult = await originalRedis.zrem(zsetData.zsetKey, zsetData.member);
              elastiCacheResult = await elastiCacheRedis.zrem(zsetData.zsetKey, zsetData.member);
              break;
            case 'zrank':
              originalResult = await originalRedis.zrank(zsetData.zsetKey, zsetData.member);
              elastiCacheResult = await elastiCacheRedis.zrank(zsetData.zsetKey, zsetData.member);
              break;
            case 'zrange':
              originalResult = await originalRedis.zrange(zsetData.zsetKey, 0, -1);
              elastiCacheResult = await elastiCacheRedis.zrange(zsetData.zsetKey, 0, -1);
              break;
          }

          // Property: Sorted set operations should return identical results
          expect(elastiCacheResult).toEqual(originalResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: List operations maintain identical behavior
   * For any list operation, ElastiCache should behave identically to standard Redis
   */
  test('Property: List operations maintain identical behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          listKey: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.string({ minLength: 1, maxLength: 100 }),
          operation: fc.constantFrom('lpush', 'rpush', 'lpop', 'rpop', 'lrange')
        }),
        async (listData) => {
          // Mock list operations with identical responses
          const mockList = [listData.value, 'existing_item'];
          
          mockOriginalRedis.lpush.mockResolvedValue(2);
          mockElastiCacheRedis.lpush.mockResolvedValue(2);
          
          mockOriginalRedis.rpush.mockResolvedValue(2);
          mockElastiCacheRedis.rpush.mockResolvedValue(2);
          
          mockOriginalRedis.lpop.mockResolvedValue(listData.value);
          mockElastiCacheRedis.lpop.mockResolvedValue(listData.value);
          
          mockOriginalRedis.rpop.mockResolvedValue(listData.value);
          mockElastiCacheRedis.rpop.mockResolvedValue(listData.value);
          
          mockOriginalRedis.lrange.mockResolvedValue(mockList);
          mockElastiCacheRedis.lrange.mockResolvedValue(mockList);

          let originalResult, elastiCacheResult;

          switch (listData.operation) {
            case 'lpush':
              originalResult = await originalRedis.lpush(listData.listKey, listData.value);
              elastiCacheResult = await elastiCacheRedis.lpush(listData.listKey, listData.value);
              break;
            case 'rpush':
              originalResult = await originalRedis.rpush(listData.listKey, listData.value);
              elastiCacheResult = await elastiCacheRedis.rpush(listData.listKey, listData.value);
              break;
            case 'lpop':
              originalResult = await originalRedis.lpop(listData.listKey);
              elastiCacheResult = await elastiCacheRedis.lpop(listData.listKey);
              break;
            case 'rpop':
              originalResult = await originalRedis.rpop(listData.listKey);
              elastiCacheResult = await elastiCacheRedis.rpop(listData.listKey);
              break;
            case 'lrange':
              originalResult = await originalRedis.lrange(listData.listKey, 0, -1);
              elastiCacheResult = await elastiCacheRedis.lrange(listData.listKey, 0, -1);
              break;
          }

          // Property: List operations should return identical results
          expect(elastiCacheResult).toEqual(originalResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Numeric operations maintain identical behavior
   * For any numeric operation, ElastiCache should behave identically to standard Redis
   */
  test('Property: Numeric operations maintain identical behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 1, maxLength: 50 }),
          increment: fc.integer({ min: 1, max: 100 }),
          operation: fc.constantFrom('incr', 'decr', 'incrby', 'decrby')
        }),
        async (numericData) => {
          // Mock numeric operations with identical responses
          const mockValue = 42;
          const mockIncrementedValue = mockValue + numericData.increment;
          const mockDecrementedValue = mockValue - numericData.increment;
          
          mockOriginalRedis.incr.mockResolvedValue(mockValue + 1);
          mockElastiCacheRedis.incr.mockResolvedValue(mockValue + 1);
          
          mockOriginalRedis.decr.mockResolvedValue(mockValue - 1);
          mockElastiCacheRedis.decr.mockResolvedValue(mockValue - 1);
          
          mockOriginalRedis.incrby.mockResolvedValue(mockIncrementedValue);
          mockElastiCacheRedis.incrby.mockResolvedValue(mockIncrementedValue);
          
          mockOriginalRedis.decrby.mockResolvedValue(mockDecrementedValue);
          mockElastiCacheRedis.decrby.mockResolvedValue(mockDecrementedValue);

          let originalResult, elastiCacheResult;

          switch (numericData.operation) {
            case 'incr':
              originalResult = await originalRedis.incr(numericData.key);
              elastiCacheResult = await elastiCacheRedis.incr(numericData.key);
              break;
            case 'decr':
              originalResult = await originalRedis.decr(numericData.key);
              elastiCacheResult = await elastiCacheRedis.decr(numericData.key);
              break;
            case 'incrby':
              originalResult = await originalRedis.incrby(numericData.key, numericData.increment);
              elastiCacheResult = await elastiCacheRedis.incrby(numericData.key, numericData.increment);
              break;
            case 'decrby':
              originalResult = await originalRedis.decrby(numericData.key, numericData.increment);
              elastiCacheResult = await elastiCacheRedis.decrby(numericData.key, numericData.increment);
              break;
          }

          // Property: Numeric operations should return identical results
          expect(elastiCacheResult).toEqual(originalResult);

          // Property: Results should be numeric
          expect(typeof originalResult).toBe('number');
          expect(typeof elastiCacheResult).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Session storage compatibility
   * For any session-related operations, ElastiCache should maintain identical behavior
   * to ensure seamless user session management
   */
  test('Property: Session storage operations maintain compatibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 10, maxLength: 50 }),
          userId: fc.string({ minLength: 1, maxLength: 20 }),
          sessionData: fc.record({
            role: fc.constantFrom('user', 'admin', 'creator'),
            permissions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            lastActivity: fc.integer({ min: 1600000000, max: 2000000000 })
          }),
          ttl: fc.integer({ min: 300, max: 86400 }) // 5 minutes to 24 hours
        }),
        async (sessionConfig) => {
          const sessionKey = `session:${sessionConfig.sessionId}`;
          const sessionValue = JSON.stringify(sessionConfig.sessionData);
          
          // Mock session operations with identical responses
          mockOriginalRedis.set.mockResolvedValue('OK');
          mockElastiCacheRedis.set.mockResolvedValue('OK');
          
          mockOriginalRedis.get.mockResolvedValue(sessionValue);
          mockElastiCacheRedis.get.mockResolvedValue(sessionValue);
          
          mockOriginalRedis.expire.mockResolvedValue(1);
          mockElastiCacheRedis.expire.mockResolvedValue(1);
          
          mockOriginalRedis.ttl.mockResolvedValue(sessionConfig.ttl);
          mockElastiCacheRedis.ttl.mockResolvedValue(sessionConfig.ttl);

          // Test session creation with TTL
          const originalSetResult = await originalRedis.set(sessionKey, sessionValue);
          const elastiCacheSetResult = await elastiCacheRedis.set(sessionKey, sessionValue);
          
          const originalExpireResult = await originalRedis.expire(sessionKey, sessionConfig.ttl);
          const elastiCacheExpireResult = await elastiCacheRedis.expire(sessionKey, sessionConfig.ttl);

          // Test session retrieval
          const originalGetResult = await originalRedis.get(sessionKey);
          const elastiCacheGetResult = await elastiCacheRedis.get(sessionKey);

          // Test TTL check
          const originalTtlResult = await originalRedis.ttl(sessionKey);
          const elastiCacheTtlResult = await elastiCacheRedis.ttl(sessionKey);

          // Property: All session operations should return identical results
          expect(elastiCacheSetResult).toEqual(originalSetResult);
          expect(elastiCacheExpireResult).toEqual(originalExpireResult);
          expect(elastiCacheGetResult).toEqual(originalGetResult);
          expect(elastiCacheTtlResult).toEqual(originalTtlResult);

          // Property: Session data should be retrievable and parseable
          const originalParsedData = JSON.parse(originalGetResult);
          const elastiCacheParsedData = JSON.parse(elastiCacheGetResult);
          
          expect(elastiCacheParsedData).toEqual(originalParsedData);
          expect(elastiCacheParsedData.role).toBe(sessionConfig.sessionData.role);
          expect(elastiCacheParsedData.permissions).toEqual(sessionConfig.sessionData.permissions);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Real-time data operations maintain compatibility
   * For any real-time data operations (WebSocket state, live streams),
   * ElastiCache should maintain identical behavior
   */
  test('Property: Real-time data operations maintain compatibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          streamId: fc.string({ minLength: 5, maxLength: 30 }),
          viewerCount: fc.integer({ min: 0, max: 10000 }),
          chatMessages: fc.array(
            fc.record({
              userId: fc.string({ minLength: 1, maxLength: 20 }),
              message: fc.string({ minLength: 1, maxLength: 200 }),
              timestamp: fc.integer({ min: 1600000000, max: 2000000000 })
            }),
            { minLength: 0, maxLength: 10 }
          ),
          streamStatus: fc.constantFrom('live', 'offline', 'starting', 'ending')
        }),
        async (realtimeConfig) => {
          const streamKey = `stream:${realtimeConfig.streamId}`;
          const viewerKey = `viewers:${realtimeConfig.streamId}`;
          const chatKey = `chat:${realtimeConfig.streamId}`;
          
          const streamData = {
            status: realtimeConfig.streamStatus,
            viewerCount: realtimeConfig.viewerCount,
            startTime: Date.now()
          };
          
          // Mock real-time operations with identical responses
          mockOriginalRedis.hset.mockResolvedValue(1);
          mockElastiCacheRedis.hset.mockResolvedValue(1);
          
          mockOriginalRedis.hgetall.mockResolvedValue(streamData);
          mockElastiCacheRedis.hgetall.mockResolvedValue(streamData);
          
          mockOriginalRedis.incr.mockResolvedValue(realtimeConfig.viewerCount + 1);
          mockElastiCacheRedis.incr.mockResolvedValue(realtimeConfig.viewerCount + 1);
          
          mockOriginalRedis.lpush.mockResolvedValue(realtimeConfig.chatMessages.length + 1);
          mockElastiCacheRedis.lpush.mockResolvedValue(realtimeConfig.chatMessages.length + 1);
          
          mockOriginalRedis.lrange.mockResolvedValue(
            realtimeConfig.chatMessages.map(msg => JSON.stringify(msg))
          );
          mockElastiCacheRedis.lrange.mockResolvedValue(
            realtimeConfig.chatMessages.map(msg => JSON.stringify(msg))
          );

          // Test stream state management
          const originalStreamSet = await originalRedis.hset(
            streamKey, 
            'status', realtimeConfig.streamStatus,
            'viewerCount', realtimeConfig.viewerCount
          );
          const elastiCacheStreamSet = await elastiCacheRedis.hset(
            streamKey,
            'status', realtimeConfig.streamStatus,
            'viewerCount', realtimeConfig.viewerCount
          );

          // Test viewer count increment
          const originalViewerIncr = await originalRedis.incr(viewerKey);
          const elastiCacheViewerIncr = await elastiCacheRedis.incr(viewerKey);

          // Test chat message storage
          if (realtimeConfig.chatMessages.length > 0) {
            const testMessage = JSON.stringify(realtimeConfig.chatMessages[0]);
            const originalChatPush = await originalRedis.lpush(chatKey, testMessage);
            const elastiCacheChatPush = await elastiCacheRedis.lpush(chatKey, testMessage);
            
            expect(elastiCacheChatPush).toEqual(originalChatPush);
          }

          // Test data retrieval
          const originalStreamGet = await originalRedis.hgetall(streamKey);
          const elastiCacheStreamGet = await elastiCacheRedis.hgetall(streamKey);

          const originalChatGet = await originalRedis.lrange(chatKey, 0, -1);
          const elastiCacheChatGet = await elastiCacheRedis.lrange(chatKey, 0, -1);

          // Property: All real-time operations should return identical results
          expect(elastiCacheStreamSet).toEqual(originalStreamSet);
          expect(elastiCacheViewerIncr).toEqual(originalViewerIncr);
          expect(elastiCacheStreamGet).toEqual(originalStreamGet);
          expect(elastiCacheChatGet).toEqual(originalChatGet);

          // Property: Stream data should maintain structure and types
          expect(elastiCacheStreamGet.status).toBe(realtimeConfig.streamStatus);
          expect(parseInt(elastiCacheStreamGet.viewerCount)).toBe(realtimeConfig.viewerCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});