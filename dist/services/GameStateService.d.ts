import { RedisManager } from "../manager/RedisManager.js";
export interface PlayerState {
    id: string;
    x: number;
    y: number;
    health: number;
}
export declare class GameStateService {
    redis: RedisManager;
    constructor(redis: RedisManager);
    getRoomKey(roomId: string): string;
    private channel;
    initRoom(roomId: string, players: string[]): Promise<void>;
    getPlayer(roomId: string, playerId: string): Promise<PlayerState>;
    subscribeToRoom(roomId: string, listener: (evt: {
        playerId: string;
        action: any;
    }) => void): Promise<void>;
    unsubscribeFromRoom(roomId: string): Promise<void>;
    handleAction(roomId: string, playerId: string, action: any): Promise<void>;
    removePlayerFromRoom(roomId: string, playerId: string): Promise<void>;
    deleteRoom(roomId: string): Promise<void>;
}
//# sourceMappingURL=GameStateService.d.ts.map