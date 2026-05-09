export class RoomService {
    constructor(redisManager, gameState) {
        this.roomPrefix = "room";
        this.redis = redisManager;
        this.gameState = gameState;
    }
    getRoomKey(roomId) {
        return `${this.roomPrefix}:${roomId}:players`;
    }
    async createRoom(roomId, players) {
        const key = this.getRoomKey(roomId);
        if (players.length) {
            await this.redis.sadd(key, players);
        }
        else {
            await this.redis.sadd(key, []);
        }
    }
    async deleteRoom(roomId) {
        const key = this.getRoomKey(roomId);
        await this.redis.del(key);
    }
    async getRoomLength(roomId) {
        const key = this.getRoomKey(roomId);
        return this.redis.smembers(key).then(members => members.length);
    }
    async addPlayers(roomId, player) {
        const key = this.getRoomKey(roomId);
        await this.redis.sadd(key, player);
    }
    // public async notifyPlayerLeft(roomId: string, playerId: string): Promise<void> {
    //     await this.redis.publish(`game:${roomId}:events`, {
    //         type: "player_left",
    //         payload: { playerId: playerId }
    //     });
    // }
    async removePlayersAndCleanUp(roomId, player) {
        const roomKey = this.getRoomKey(roomId);
        const gameKey = this.gameState.getRoomKey(roomId);
        await this.redis.srem(roomKey, player);
        await this.gameState.removePlayerFromRoom(gameKey, player);
        // await this.notifyPlayerLeft(roomId, player);
        if (Array.isArray(await this.redis.smembers(roomKey)) && (await this.redis.smembers(roomKey)).length === 0) {
            await this.deleteRoom(roomId);
            await this.gameState.unsubscribeFromRoom(gameKey);
            await this.gameState.deleteRoom(gameKey);
        }
    }
    async listAllPlayers(roomId) {
        const key = this.getRoomKey(roomId);
        return this.redis.smembers(key);
    }
    async isPlayerInRoom(roomId, playerId) {
        const key = this.getRoomKey(roomId);
        const members = await this.redis.smembers(key);
        return members.includes(playerId);
    }
}
//# sourceMappingURL=RoomService.js.map