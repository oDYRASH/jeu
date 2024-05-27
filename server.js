const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};
let bullets = [];
let nextPlayerId = 1;

// Dynamic settings
const playerSpeed = 3;
const bulletSpeed = 3*4.26;
const updateInterval = 1000 / 64;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;
  const initialPosition = getInitialPosition();
  players[playerId] = { id: playerId, x: initialPosition.x, y: initialPosition.y, color: getRandomColor(), radius: 20, targetX: null, targetY: null };

  ws.send(JSON.stringify({ type: 'init', playerId, players, playerSpeed, bulletSpeed }));

  broadcast({ type: 'newPlayer', player: players[playerId] }, ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'move') {
      updatePlayerTarget(data);
      broadcast({ type: 'update', id: data.id, targetX: data.x, targetY: data.y, playerSpeed });
    }

    if (data.type === 'shoot') {
      const player = players[data.id];
      bullets.push({ x: player.x, y: player.y, targetX: data.targetX, targetY: data.targetY, radius: 5, speed: bulletSpeed, color: player.color, ownerId: player.id });
      broadcast({ type: 'shoot', id: player.id, targetX: data.targetX, targetY: data.targetY, bulletSpeed });
    }

   if (data.type === 'stop') {
    if (players[data.id]) {
      players[data.id].targetX = null;
      players[data.id].targetY = null;
    }
  }
  });

  ws.on('close', () => {
    delete players[playerId];
    broadcast({ type: 'removePlayer', id: playerId });
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

const getRandomColor = () => {

  if (nextPlayerId == 2) return '#D33F49';
  if (nextPlayerId == 3) return '#1C448E';

  const letters = '0123456789ABCDEF';
  return '#' + Array.from({ length: 6 }).map(() => letters[Math.floor(Math.random() * 16)]).join('');
};

const getInitialPosition = () => {
  const playerCount = Object.keys(players).length;
  if (playerCount === 0) return { x: 300, y: 200 };
  if (playerCount === 1) return { x: 500, y: 400 };
  return { x: Math.random() * 800, y: Math.random() * 600 };
};

const updatePlayerTarget = ({ id, x, y }) => {
  if (players[id]) {
    players[id].targetX = x;
    players[id].targetY = y;
  }
};

const broadcast = (data, excludeWs) => {
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

const checkCollisions = () => {
  Object.values(players).forEach(player => {
    if (!player.isDead) {
      bullets = bullets.filter(bullet => {
        if (bullet.ownerId === player.id) return true;
        const distance = Math.sqrt((bullet.x - player.x) ** 2 + (bullet.y - player.y) ** 2);
        if (distance < player.radius + bullet.radius) {
          player.isDead = true;
          broadcast({ type: 'playerDead', id: player.id });
          return false;
        }
        return true;
      });
    }
  });
};

setInterval(() => {
  Object.values(players).forEach(player => {
    if (player.targetX !== null && player.targetY !== null) {
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < playerSpeed) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.targetX = null;
        player.targetY = null;
      } else {
        player.x += (dx / distance) * playerSpeed;
        player.y += (dy / distance) * playerSpeed;
      }
    }
  });

  bullets = bullets.filter(bullet => {
    const dx = bullet.targetX - bullet.x;
    const dy = bullet.targetY - bullet.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < bullet.speed) return false;
    bullet.x += (dx / distance) * bullet.speed;
    bullet.y += (dy / distance) * bullet.speed;
    return true;
  });

  checkCollisions();
}, updateInterval);

const PORT = 10000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
