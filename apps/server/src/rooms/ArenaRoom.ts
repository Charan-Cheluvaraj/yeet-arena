import { Room, Client } from '@colyseus/core';
import { ArenaRoomState } from './ArenaRoomState.js';
import { GAME_CONSTANTS } from '@yeet-arena/shared';

export class ArenaRoom extends Room {
  maxClients = GAME_CONSTANTS.MAX_PLAYERS;

  onCreate(_options?: Record<string, unknown>) {
    this.setState(new ArenaRoomState());
    console.log(`[ArenaRoom] Created room: ${this.roomId}`);

    this.onMessage('ping', (client: Client, message: unknown) => {
      client.send('pong', { received: message, timestamp: Date.now() });
    });
  }

  onJoin(client: Client, _options?: Record<string, unknown>) {
    console.log(`[ArenaRoom] Client joined: ${client.sessionId}`);
  }

  onLeave(client: Client, code?: number) {
    console.log(`[ArenaRoom] Client left: ${client.sessionId} (code: ${code})`);
  }

  onDispose() {
    console.log(`[ArenaRoom] Disposed room: ${this.roomId}`);
  }
}
