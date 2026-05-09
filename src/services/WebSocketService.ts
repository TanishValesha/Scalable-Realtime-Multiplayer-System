import { WebSocketServer, WebSocket } from "ws";
import type { Client, Message } from "../types/types.js";
import { Logger } from "../utils/logger.js";
import {v4 as uuidv4} from "uuid"
import { GameStateService } from "./GameStateService.js";
import { RoomService } from "./RoomService.js";
import { MatchMakingService } from "./MatchMakingService.js";


export class WebSocketService {
    private wss: WebSocketServer;
    private clients: Map<string, Client> = new Map();
    private maxPlayersPerRoom = 2;

    constructor (private port: number, private roomService: RoomService, private matchmaking: MatchMakingService, private gameState: GameStateService) {
        this.wss = new WebSocketServer({ port });
        this.initialize();
        Logger.info(`WebSocket Server created, listening on port ${port}`)
    }

    private initialize() {
        this.wss.on('connection', (socket: WebSocket) => {
            const clientId = uuidv4();
            const client: Client = {id: clientId, socket};
            this.clients.set(clientId, client);

            Logger.info(`Client connected: ${clientId}`);

            socket.on("message", (data: string) => {
                this.handleMessage(clientId, data); 
            })
            socket.on("close", () => this.handleDisconnect(clientId));
        })
    }

    private async handleAddPlayersToQueue(clientId: string) {
        if (!this.clients.has(clientId)) return;
        await this.matchmaking.addPlayerToQueue(clientId);
        Logger.info(`Client ${clientId} added to matchmaking queue`);

        const roomId = await this.matchmaking.matchMakingPlayers(2);
        if(roomId) await this.nofifyMatchCreated(roomId);
    }

    private async nofifyMatchCreated(roomId: string){
        Logger.info(`Match created: ${roomId}`);
        const players = await this.roomService.listAllPlayers(roomId);
        const payload = JSON.stringify({
            type: "match_start",
            payload: { room: roomId, players },
        });

        for (const pid of players) {
            const client = this.clients.get(pid);
            if (client && client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(payload);
            }
        }

        await this.gameState.initRoom(roomId, players);
        
        await this.gameState.subscribeToRoom(roomId, async () => {
            await this.broadcastStateUpdate(roomId);
        });
    }

    private async joinRoom(clientId: string, roomId: string) {
        const roomLength = await this.roomService.getRoomLength(roomId);
        const roomExists = await this.roomService.roomExists(roomId);

        if (!roomExists) {
            this.clients.get(clientId)?.socket.send(JSON.stringify({type: "error", payload: "Room does not exist"}));
            Logger.error(`Room ${roomId} does not exist`);
            return;
        }

        if (roomLength >= this.maxPlayersPerRoom) {
            this.clients.get(clientId)?.socket.send(JSON.stringify({type: "error", payload: "Room is full"}));
            Logger.error(`Room ${roomId} is full`);
            return;
        }

        await this.roomService.addPlayers(roomId, clientId);
        Logger.info(`Client ${clientId} joined ${roomId}`);
    }

    private async leaveRoom(clientId: string, roomId: string) {
        await this.roomService.removePlayersAndCleanUp(roomId, clientId);
        Logger.info(`Client ${clientId} left ${roomId}`);
    }
    

    private async handleMessage(clientId: string, data: string){
        try {
            const message: Message = JSON.parse(data);

            switch(message.type){
                case 'ECHO':
                    this.clients.get(clientId)?.socket.send(JSON.stringify({type: "echo", payload: message.payload}));
                    Logger.info(`Received from ${clientId}: ${data}`);
                    break;
                case 'JOIN':
                    this.joinRoom(clientId, message.payload.room);
                    break;
                case 'LEAVE':
                    this.leaveRoom(clientId, message.payload.room);
                    break;
                case 'CHAT':
                    this.broadcastToRoom(message.payload.room, clientId, data);
                    break;
                case 'MATCH_START':
                    this.handleAddPlayersToQueue(clientId);
                    break;
                case "PLAYER_ACTION": {                                     
                    const { room, action } = message.payload;
                    const roomExists = await this.gameState.checkGameRoomExists(room);
                    if (!roomExists) {
                        this.clients.get(clientId)?.socket.send(JSON.stringify({type: "error", payload: "Room does not exist"}));
                        Logger.error(`Room ${room} does not exist`);
                        return;
                    }
                    await this.gameState.handleAction(room, clientId, action);
                    break;
                }
                default:
                    this.clients.get(clientId)?.socket.send(JSON.stringify({type: "error", payload: "Unknown message type"}));
                    Logger.error(`Unknown message type from ${clientId}: ${message.type}`);
            }
        } catch (error) {
            Logger.error(`Invalid message from ${clientId}: ${data}`);
        }

    }

    private async broadcastStateUpdate(roomId: string) {
        const playersRaw = await this.gameState.redis.hgetall(this.gameState.getRoomKey(roomId));
        if (!playersRaw) return;

        const players = Object.keys(playersRaw)
            .filter(key => key.endsWith(":x"))
            .map(key => {
                const id = key.split(":")[0];
                return {
                    id,
                    x: parseInt(playersRaw[`${id}:x`] ?? "0", 10),
                    y: parseInt(playersRaw[`${id}:y`] ?? "0", 10),
                    health: parseInt(playersRaw[`${id}:health`] ?? "100", 10),
                };
            });

        const payload = JSON.stringify({
            type: "STATE_UPDATE",
            payload: { players },
        });

        const clientsInRoom = await this.roomService.listAllPlayers(roomId)
        if (!clientsInRoom) return;

        for (const cid of clientsInRoom) {
            const client = this.clients.get(cid);
            if (client && client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(payload);
            }
        }
    }


    private async broadcastToRoom(roomId: string, senderId: string, data: string) {
        const members = await this.roomService.listAllPlayers(roomId);
        const parsed: Message = JSON.parse(data);

        if(members.length === 0) {
            this.clients.get(senderId)?.socket.send(JSON.stringify({type: "error", payload: "Room is empty or does not exist"}));
            Logger.error(`Room ${roomId} is empty or does not exist`);
            return;
        }

        for (const pid of members) {
            if (pid === senderId) continue;
            const client = this.clients.get(pid);
            if (client?.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify({ type: "server", payload: parsed.payload }));
            }
        }
        Logger.info(`Broadcast from ${senderId} to ${roomId}`);
    }

    private handleDisconnect(clientId: string){
        this.clients.delete(clientId);
        Logger.info(`Client disconnected: ${clientId}`);
    }
}