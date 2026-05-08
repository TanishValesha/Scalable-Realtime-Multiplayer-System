import { RedisManager } from "../manager/RedisManager.js";
import { RoomService } from "./RoomService.js";

export class MatchMakingService {
    private redis: RedisManager;
    private rooms: RoomService;
    private queueId = "matchmaking:queue"

    constructor(redisManager: RedisManager, roomService: RoomService){
        this.redis = redisManager;
        this.rooms = roomService;
    }

    public async addPlayerToQueue(playerId: string): Promise<void>{
        await this.redis.enqueue(this.queueId, playerId);
    }

    public async removePlayerFromQueue(): Promise<string | null>{
        return this.redis.dequeue<string>(this.queueId);
    }

    public async matchMakingPlayers(roomSize = 2): Promise<string | null> {
         const lua = `
            local players = {}
            for i = 1, tonumber(ARGV[1]) do
                local p = redis.call('LPOP', KEYS[1])
                if not p then
                    -- not enough players, push back and abort
                    for _, v in ipairs(players) do
                        redis.call('LPUSH', KEYS[1], v)
                    end
                    return nil
                end
                table.insert(players, p)
            end
            return players
        `;
        const result = await this.redis.eval(lua, {
            keys: ['matchmaking:queue'],
            arguments: [roomSize.toString()]
        });
        if (!result) return null;

        const players = result as string[];
        const roomId = `match-${Date.now()}`;
        await this.rooms.createRoom(roomId, players);
        return roomId;
    }

    public async getQueueLength(): Promise<number | undefined> {
        return this.redis.getQueueLen(this.queueId)
    }
}