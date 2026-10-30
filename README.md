# YEET ARENA 🥊💥

A multiplayer 2D pixel-art arena brawler built for the browser.

## Monorepo Architecture

```
yeet-arena/
├── apps/
│   ├── client/     # React + Vite + TypeScript + Phaser 4.2.1
│   └── server/     # Node.js + TypeScript + Colyseus 0.18+
├── packages/
│   └── shared/     # Shared physics, game rules, and constants
├── package.json    # Root npm workspaces configuration
└── tsconfig.base.json
```

## Quick Start

### 1. Prerequisites
- Node.js LTS (v20+ recommended)
- npm 9+

### 2. Installation
```bash
npm install
```

### 3. Build Packages
```bash
npm run build:shared
```

### 4. Running the Development Servers

In terminal 1 (Colyseus game server & health endpoint):
```bash
npm run dev:server
```

In terminal 2 (Vite + Phaser client):
```bash
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running Tests & Quality Checks
```bash
# Run shared physics/logic unit tests with Vitest
npm run test

# Typecheck all workspaces
npm run typecheck

# Lint files
npm run lint

# Format code
npm run format
```

