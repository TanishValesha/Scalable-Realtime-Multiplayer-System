import { RedisManager } from "../manager/RedisManager.js";


export interface PlayerState {
    id: string;
    x: number;
    y: number;
    health: number;
}

export class GameStateService {
    public redis: RedisManager;

    constructor(redis: RedisManager){
        this.redis = redis;
    }

    public getRoomKey(roomId: string){
        return `game:${roomId}:state`
    }

    private channel(roomId: string){
        return `game:${roomId}:events`
    }

    public async initRoom(roomId: string, players: string[]) {
        const key = this.getRoomKey(roomId);
        const entries = players.flatMap(id => [
            `${id}:x`, "0",
            `${id}:y`, "0",
            `${id}:health`, "100"
        ]);
        await this.redis.hset(key, entries);
    }

    public async getPlayer(roomId: string, playerId: string): Promise<PlayerState> {
        const raw = await this.redis.hgetall(this.getRoomKey(roomId));
        return {
            id: playerId,
            x: parseInt(raw[`${playerId}:x`] ?? "0", 10),
            y: parseInt(raw[`${playerId}:y`] ?? "0", 10),
            health: parseInt(raw[`${playerId}:health`] ?? "100", 10)
        };
    }

   	public async subscribeToRoom(roomId: string, listener: (evt: { playerId: string; action: any }) => void): Promise<void> {
		await this.redis.subscribe(this.channel(roomId), (msg) => {
            console.log("[DEBUG] subscriber fired for", roomId, msg);
			listener(JSON.parse(msg));
		});
	
    }

    public async unsubscribeFromRoom(roomId: string): Promise<void> {
    	await this.redis.unsubscribe(this.channel(roomId));
	}
    

    public async handleAction(roomId: string, playerId: string, action: any) {
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
        await this.redis.publish(this.channel(roomId),{ playerId, action });
    }

     public async removePlayerFromRoom(
        roomId: string,
        playerId: string
    ): Promise<void> {
           await this.redis.hdel(roomId, [
        `${playerId}:x`,
        `${playerId}:y`,
        `${playerId}:health`
    ]);
    
    }

    public async deleteRoom(roomId: string): Promise<void> {
        await this.redis.del(roomId);
    }
}
