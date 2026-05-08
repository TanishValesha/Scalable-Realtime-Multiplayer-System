export class MatchMakingService {
    constructor(redisManager, roomService) {
        this.queueId = "matchmaking:queue";
        this.redis = redisManager;
        this.rooms = roomService;
    }
    async addPlayerToQueue(playerId) {
        await this.redis.enqueue(this.queueId, playerId);
    }
    async removePlayerFromQueue() {
        return this.redis.dequeue(this.queueId);
    }
    async matchMakingPlayers(roomSize = 2) {
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
        if (!result)
            return null;
        const players = result;
        const roomId = `match-${Date.now()}`;
        await this.rooms.createRoom(roomId, players);
        return roomId;
    }
    async getQueueLength() {
        return this.redis.getQueueLen(this.queueId);
    }
}
//# sourceMappingURL=MatchMakingService.js.map