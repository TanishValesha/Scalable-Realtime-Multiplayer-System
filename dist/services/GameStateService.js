export class GameStateService {
    constructor(redis) {
        this.redis = redis;
    }
    getRoomKey(roomId) {
        return `game:${roomId}:state`;
    }
    channel(roomId) {
        return `game:${roomId}:events`;
    }
    async initRoom(roomId, players) {
        const key = this.getRoomKey(roomId);
        const entries = players.flatMap(id => [
            `${id}:x`, "0",
            `${id}:y`, "0",
            `${id}:health`, "100"
        ]);
        await this.redis.hset(key, entries);
    }
    async getPlayer(roomId, playerId) {
        const raw = await this.redis.hgetall(this.getRoomKey(roomId));
        return {
            id: playerId,
            x: parseInt(raw[`${playerId}:x`] ?? "0", 10),
            y: parseInt(raw[`${playerId}:y`] ?? "0", 10),
            health: parseInt(raw[`${playerId}:health`] ?? "100", 10)
        };
    }
    async subscribeToRoom(roomId, listener) {
        await this.redis.subscribe(this.channel(roomId), (msg) => {
            console.log("[DEBUG] subscriber fired for", roomId, msg);
            listener(JSON.parse(msg));
        });
    }
    async unsubscribeFromRoom(roomId) {
        await this.redis.unsubscribe(this.channel(roomId));
    }
    async handleAction(roomId, playerId, action) {
        const key = this.getRoomKey(roomId);
        switch (action.type) {
            case "move":
                if (action.dx !== undefined) {
                    await this.redis.hincrby(key, `${playerId}:x`, action.dx);
                }
                if (action.dy !== undefined) {
                    await this.redis.hincrby(key, `${playerId}:y`, action.dy);
                }
                break;
            case "attack":
                if (action.targetId) {
                    const targetHealthField = `${action.targetId}:health`;
                    await this.redis.hincrby(key, targetHealthField, -(action.damage ?? 10));
                }
                break;
            case "heal":
                const healthField = `${playerId}:health`;
                const current = parseInt(await this.redis.hget(key, healthField) ?? "100", 10);
                const newValue = Math.min(100, current + 20);
                await this.redis.hset(key, healthField, newValue.toString());
                break;
        }
        console.log("[DEBUG] publishing to", this.channel(roomId));
        await this.redis.publish(this.channel(roomId), { playerId, action });
    }
    async removePlayerFromRoom(roomId, playerId) {
        await this.redis.hdel(roomId, [
            `${playerId}:x`,
            `${playerId}:y`,
            `${playerId}:health`
        ]);
    }
    async deleteRoom(roomId) {
        await this.redis.del(roomId);
    }
}
//# sourceMappingURL=GameStateService.js.map