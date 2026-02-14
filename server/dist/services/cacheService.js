"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCachePattern = exports.deleteCache = exports.setCache = exports.getCache = void 0;
const redis_1 = require("redis");
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
// Connect automatically (or call this in index.ts)
(async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    }
    catch (e) {
        console.warn('Failed to connect to Redis. Caching will be disabled.', e);
    }
})();
const getCache = async (key) => {
    try {
        if (!redisClient.isOpen)
            return null;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (e) {
        console.error('Redis Get Error:', e);
        return null;
    }
};
exports.getCache = getCache;
const setCache = async (key, value, ttlSeconds = 3600) => {
    try {
        if (!redisClient.isOpen)
            return;
        await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    }
    catch (e) {
        console.error('Redis Set Error:', e);
    }
};
exports.setCache = setCache;
const deleteCache = async (key) => {
    try {
        if (!redisClient.isOpen)
            return;
        await redisClient.del(key);
    }
    catch (e) {
        console.error('Redis Del Error:', e);
    }
};
exports.deleteCache = deleteCache;
const deleteCachePattern = async (pattern) => {
    try {
        if (!redisClient.isOpen)
            return;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    }
    catch (e) {
        console.error('Redis Del Pattern Error:', e);
    }
};
exports.deleteCachePattern = deleteCachePattern;
//# sourceMappingURL=cacheService.js.map