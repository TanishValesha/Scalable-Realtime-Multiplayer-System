import { WebSocketServer, WebSocket } from "ws";
import { Logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
export class WebSocketService {
    constructor(port, roomService, matchmaking, gameState) {
        this.port = port;
        this.roomService = roomService;
        this.matchmaking = matchmaking;
        this.gameState = gameState;
        this.clients = new Map();
        this.wss = new WebSocketServer({ port });
        this.initialize();
        Logger.info(`WebSocket Server created, listening on port ${port}`);
    }
    initialize() {
        this.wss.on('connection', (socket) => {
            const clientId = uuidv4();
            const client = { id: clientId, socket };
            this.clients.set(clientId, client);
            Logger.info(`Client connected: ${clientId}`);
            socket.on("message", (data) => {
                this.handleMessage(clientId, data);
            });
            socket.on("close", () => this.handleDisconnect(clientId));
        });
    }
    async handleAddPlayersToQueue(clientId) {
        if (!this.clients.has(clientId))
            return;
        await this.matchmaking.addPlayerToQueue(clientId);
        Logger.info(`Client ${clientId} added to matchmaking queue`);
        const roomId = await this.matchmaking.matchMakingPlayers(2);
        if (roomId)
            await this.nofifyMatchCreated(roomId);
    }
    async nofifyMatchCreated(roomId) {
        console.log(`Match created: ${roomId}`);
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
    async joinRoom(clientId, roomId) {
        await this.roomService.addPlayers(roomId, clientId);
        Logger.info(`Client ${clientId} joined ${roomId}`);
    }
    async leaveRoom(clientId, roomId) {
        await this.roomService.removePlayersAndCleanUp(roomId, clientId);
        Logger.info(`Client ${clientId} left ${roomId}`);
    }
    async handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case 'ECHO':
                    this.clients.get(clientId)?.socket.send(JSON.stringify({ type: "echo", payload: message.payload }));
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
                    await this.gameState.handleAction(room, clientId, action);
                    break;
                }
                default:
                    Logger.error(`Unknown message type from ${clientId}: ${message.type}`);
            }
        }
        catch (error) {
            Logger.error(`Invalid message from ${clientId}: ${data}`);
        }
    }
    async broadcastStateUpdate(roomId) {
        const playersRaw = await this.gameState.redis.hgetall(this.gameState.getRoomKey(roomId));
        if (!playersRaw)
            return;
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
        const clientsInRoom = await this.roomService.listAllPlayers(roomId);
        if (!clientsInRoom)
            return;
        for (const cid of clientsInRoom) {
            const client = this.clients.get(cid);
            if (client && client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(payload);
            }
        }
    }
    async broadcastToRoom(roomId, senderId, data) {
        const members = await this.roomService.listAllPlayers(roomId);
        const parsed = JSON.parse(data);
        for (const pid of members) {
            if (pid === senderId)
                continue;
            const client = this.clients.get(pid);
            if (client?.socket.readyState === WebSocket.OPEN) {
                client.socket.send(JSON.stringify({ type: "server", payload: parsed.payload }));
            }
        }
        Logger.info(`Broadcast from ${senderId} to ${roomId}`);
    }
    handleDisconnect(clientId) {
        this.clients.delete(clientId);
        Logger.info(`Client disconnected: ${clientId}`);
    }
}
//# sourceMappingURL=WebSocketService.js.map