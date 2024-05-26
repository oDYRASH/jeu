const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};
let nextPlayerId = 1;
const speed = 5;
const updateInterval = 1000 / 64; // 64 times per second

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;
  players[playerId] = { id: playerId, x: 0, y: 0, color: getRandomColor(), radius: 20, targetX: null, targetY: null };

  ws.send(JSON.stringify({ type: 'init', playerId, players, speed }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'move') {
      const player = players[data.id];
      player.targetX = data.x;
      player.targetY = data.y;

      // Broadcast updated target positions to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'update', id: player.id, targetX: player.targetX, targetY: player.targetY }));
        }
      });
    }
  });

  ws.on('close', () => {
    delete players[playerId];
  });
});

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Update positions at a regular interval (64 times per second)
setInterval(() => {
  for (const id in players) {
    const player = players[id];
    if (player.targetX !== null && player.targetY !== null) {
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < speed) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.targetX = null;
        player.targetY = null;
      } else {
        player.x += dx / distance * speed;
        player.y += dy / distance * speed;
      }
    }
  }
}, updateInterval);

const PORT = 10000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
