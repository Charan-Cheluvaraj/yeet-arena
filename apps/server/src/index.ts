import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ArenaRoom } from './rooms/ArenaRoom.js';

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'YEET ARENA',
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

gameServer.define('arena', ArenaRoom);

server.listen(port, () => {
  console.log(`[Yeet Arena Server] Listening on http://localhost:${port}`);
  console.log(`[Yeet Arena Server] Health check available at http://localhost:${port}/health`);
});

