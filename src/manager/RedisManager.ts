import { createClient, RedisClientType } from "redis";
import { Logger } from "../utils/logger.js";

export class RedisManager {

  private static instance: RedisManager;

  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  constructor(private url: string) {
    this.publisher = createClient({ url });
    this.subscriber = createClient({ url });
  }

  public static getInstance(url = process.env.REDIS_URL ?? "redis://localhost:6379"): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager(url);
    }
    return RedisManager.instance;
  }

  public async connect(): Promise<void> {
    await this.publisher.connect();
    await this.subscriber.connect();
    Logger.info("Redis Connected");
  }

  public async disconnect(): Promise<void> {
    await this.publisher.disconnect();
    await this.subscriber.disconnect();
  }

  public async publish(channel: string, data: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(data));
  }

  public async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }

  public async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  public async enqueue(queue: string, value: any): Promise<void> {
    await this.publisher.rPush(queue, value);
  }

  public async dequeue<T>(queue: string): Promise<T | null> {
    const raw = await this.publisher.lPop(queue);
    return raw ? JSON.parse(raw) : null;
  }

  public getQueueLen(queue: string): Promise<number | undefined> {
    return this.publisher.lLen(queue);
  }

  public async sadd(key: string, members: string[] | string): Promise<void> {
    if (Array.isArray(members)) {
     for(const member of members){
        await this.publisher.sAdd(key, member);
     }
    } else {
      await this.publisher.sAdd(key, members);
    }
  }

  public async srem(key: string, members: string[] | string): Promise<void> {
    if (Array.isArray(members)) {
      for(const member of members){
        await this.publisher.sRem(key, member);
     }
    } else {
      await this.publisher.sRem(key, members);
    }
  }

  public async smembers(key: string): Promise<string[]> {
    return this.publisher.sMembers(key);
  }

  public async del(key: string): Promise<void> {
    await this.publisher.del(key);
  }

  public async hset( key: string, fieldOrEntries: string | string[], value?: string) {
    if (Array.isArray(fieldOrEntries)) {
      return this.publisher.hSet(key, fieldOrEntries);
    }
    if (value !== undefined) {
      return this.publisher.hSet(key, fieldOrEntries, value);
    }
    throw new Error("Invalid arguments to hset");
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    return this.publisher.hGetAll(key);
  }

  public async hincrby(key: string, field: string, amount: number) {
    return this.publisher.hIncrBy(key, field, amount);
  }

  public async hget(key: string, field: string) {
    return this.publisher.hGet(key, field);
  }

  public async hdel(key: string, fields: string[]) {
    await this.publisher.hDel(key, fields);
  }

  public async eval(script: string, options: { keys: string[]; arguments: string[];}) {
    return this.publisher.eval(script, options);
  }
}
