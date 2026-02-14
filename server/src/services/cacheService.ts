import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect automatically (or call this in index.ts)
(async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (e) {
        console.warn('Failed to connect to Redis. Caching will be disabled.', e);
    }
})();

export const getCache = async (key: string) => {
    try {
        if (!redisClient.isOpen) return null;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Redis Get Error:', e);
        return null;
    }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600) => {
    try {
        if (!redisClient.isOpen) return;
        await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (e) {
        console.error('Redis Set Error:', e);
    }
};

export const deleteCache = async (key: string) => {
    try {
        if (!redisClient.isOpen) return;
        await redisClient.del(key);
    } catch (e) {
        console.error('Redis Del Error:', e);
    }
};

export const deleteCachePattern = async (pattern: string) => {
    try {
        if (!redisClient.isOpen) return;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (e) {
        console.error('Redis Del Pattern Error:', e);
    }
};
