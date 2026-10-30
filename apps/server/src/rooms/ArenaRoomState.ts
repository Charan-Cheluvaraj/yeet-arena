import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('boolean') isAlive: boolean = true;
}

export class ArenaRoomState extends Schema {
  @type('string') status: string = 'WAITING';
}

