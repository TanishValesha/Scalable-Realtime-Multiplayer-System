import { WebSocketService } from "./services/WebSocketService.js";
import { RedisManager } from "./manager/RedisManager.js";
import { RoomService } from "./services/RoomService.js";
import { MatchMakingService } from "./services/MatchMakingService.js";
import { GameStateService } from "./services/GameStateService.js";

(async () => {
  const redis = new RedisManager(process.env.REDIS_URL ?? "redis://localhost:6379");
  await redis.connect();

  const roomService = new RoomService(redis);
  const matchMakingService = new MatchMakingService(redis, roomService);
  const gameStateService = new GameStateService(redis);

  new WebSocketService(8080, roomService, matchMakingService, gameStateService);
})();
