import { RedisManager } from "../manager/RedisManager.js";
import { GameStateService } from "./GameStateService.js";
export declare class RoomService {
    private redis;
    private gameState;
    private roomPrefix;
    constructor(redisManager: RedisManager, gameState: GameStateService);
    private getRoomKey;
    createRoom(roomId: string, players: string[] | string): Promise<void>;
    deleteRoom(roomId: string): Promise<void>;
    addPlayers(roomId: string, player: string[] | string): Promise<void>;
    removePlayersAndCleanUp(roomId: string, player: string): Promise<void>;
    listAllPlayers(roomId: string): Promise<string[]>;
    isPlayerInRoom(roomId: string, playerId: string): Promise<boolean>;
}
//# sourceMappingURL=RoomService.d.ts.map