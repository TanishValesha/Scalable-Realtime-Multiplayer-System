import { createClient } from "redis";
import { Logger } from "../utils/logger.js";
export class RedisManager {
    constructor(url) {
        this.url = url;
        this.publisher = createClient({ url });
        this.subscriber = createClient({ url });
    }
    static getInstance(url = process.env.REDIS_URL ?? "redis://localhost:6379") {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager(url);
        }
        return RedisManager.instance;
    }
    async connect() {
        await this.publisher.connect();
        await this.subscriber.connect();
        Logger.info("Redis Connected");
    }
    async disconnect() {
        await this.publisher.disconnect();
        await this.subscriber.disconnect();
    }
    async publish(channel, data) {
        await this.publisher.publish(channel, JSON.stringify(data));
    }
    async subscribe(channel, callback) {
        await this.subscriber.subscribe(channel, callback);
    }
    async unsubscribe(channel) {
        await this.subscriber.unsubscribe(channel);
    }
    async enqueue(queue, value) {
        await this.publisher.rPush(queue, value);
    }
    async dequeue(queue) {
        const raw = await this.publisher.lPop(queue);
        return raw ? JSON.parse(raw) : null;
    }
    getQueueLen(queue) {
        return this.publisher.lLen(queue);
    }
    async sadd(key, members) {
        if (Array.isArray(members)) {
            for (const member of members) {
                await this.publisher.sAdd(key, member);
            }
        }
        else {
            await this.publisher.sAdd(key, members);
        }
    }
    async srem(key, members) {
        if (Array.isArray(members)) {
            for (const member of members) {
                await this.publisher.sRem(key, member);
            }
        }
        else {
            await this.publisher.sRem(key, members);
        }
    }
    async smembers(key) {
        return this.publisher.sMembers(key);
    }
    async del(key) {
        await this.publisher.del(key);
    }
    async hset(key, fieldOrEntries, value) {
        if (Array.isArray(fieldOrEntries)) {
            return this.publisher.hSet(key, fieldOrEntries);
        }
        if (value !== undefined) {
            return this.publisher.hSet(key, fieldOrEntries, value);
        }
        throw new Error("Invalid arguments to hset");
    }
    async hgetall(key) {
        return this.publisher.hGetAll(key);
    }
    async hincrby(key, field, amount) {
        return this.publisher.hIncrBy(key, field, amount);
    }
    async hget(key, field) {
        return this.publisher.hGet(key, field);
    }
    async hdel(key, fields) {
        await this.publisher.hDel(key, fields);
    }
    async eval(script, options) {
        return this.publisher.eval(script, options);
    }
}
//# sourceMappingURL=RedisManager.js.map