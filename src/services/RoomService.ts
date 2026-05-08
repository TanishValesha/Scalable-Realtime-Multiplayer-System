import { RedisManager } from "../manager/RedisManager.js";
import { GameStateService } from "./GameStateService.js";

export class RoomService {
    private redis: RedisManager;
    private gameState: GameStateService;
    private roomPrefix = "room"

    constructor(redisManager: RedisManager, gameState: GameStateService){
        this.redis = redisManager;
        this.gameState = gameState;
    }

    private getRoomKey(roomId: string){
        return `${this.roomPrefix}:${roomId}:players`;
    }

    public async createRoom(roomId: string, players: string[] | string): Promise<void>{
         const key = this.getRoomKey(roomId);
        if (players.length) {
        await this.redis.sadd(key, players);
        } else {
        await this.redis.sadd(key, []);
        }
    }

    public async deleteRoom(roomId: string): Promise<void> {
        const key = this.getRoomKey(roomId);
        await this.redis.del(key);              
    }
    
    public async addPlayers(roomId: string, player: string[] | string): Promise<void>{
        const key = this.getRoomKey(roomId);
        await this.redis.sadd(key, player);
    }

    // public async notifyPlayerLeft(roomId: string, playerId: string): Promise<void> {
    //     await this.redis.publish(`game:${roomId}:events`, {
    //         type: "player_left",
    //         payload: { playerId: playerId }
    //     });
    // }

    public async removePlayersAndCleanUp(roomId: string, player: string): Promise<void>{
        const roomKey = this.getRoomKey(roomId);
        const gameKey = this.gameState.getRoomKey(roomId);
        await this.redis.srem(roomKey, player);
        await this.gameState.removePlayerFromRoom(gameKey, player);

        // await this.notifyPlayerLeft(roomId, player);

        if(Array.isArray(await this.redis.smembers(roomKey)) && (await this.redis.smembers(roomKey)).length === 0) {
            await this.deleteRoom(roomId);
            await this.gameState.unsubscribeFromRoom(gameKey);
            await this.gameState.deleteRoom(gameKey);
        }
    }

    public async listAllPlayers(roomId: string): Promise<string[]>{
        const key = this.getRoomKey(roomId);
        return this.redis.smembers(key);
    }

    public async isPlayerInRoom(roomId: string, playerId: string): Promise<boolean>{
        const key = this.getRoomKey(roomId);
        const members = await this.redis.smembers(key);
        return members.includes(playerId);
    }
}