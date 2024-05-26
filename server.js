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
const speed = 5;
const updateInterval = 1000 / 64; // 64 times per second

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;

  let initialX, initialY;

  // Assign initial positions based on the number of players
  if (Object.keys(players).length === 0) {
    initialX = 300;
    initialY = 200;
  } else if (Object.keys(players).length === 1) {
    initialX = 500;
    initialY = 400;
  } else {
    // Assign random positions or implement other logic for additional players
    initialX = Math.random() * 800;
    initialY = Math.random() * 600;
  }
  players[playerId] = { id: playerId, x: initialX, y: initialY, color: getRandomColor(), radius: 20, targetX: null, targetY: null };
  // Send initial data to the new player
  ws.send(JSON.stringify({ type: 'init', playerId, players, speed }));

  // Notify all existing players about the new player
  wss.clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'newPlayer', player: players[playerId] }));
    }
  });

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

    if (data.type === 'shoot') {
        const player = players[data.id];
        const bullet = {
          x: player.x,
          y: player.y,
          targetX: data.targetX,
          targetY: data.targetY,
          radius: 5,
          speed: 10,
          color: player.color,
          ownerId: player.id // Add ownerId to the bullet
        };
        bullets.push(bullet);
      
        // Broadcast shooting action to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'shoot', id: player.id, targetX: bullet.targetX, targetY: bullet.targetY }));
          }
        });
      }
      
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', () => {
    delete players[playerId];

    // Notify all clients about the disconnected player
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'removePlayer', id: playerId }));
      }
    });
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


function checkCollisions() {
    for (const id in players) {
      const player = players[id];
      if (!player.isDead) {
        bullets = bullets.filter(bullet => {
          if (bullet.ownerId === player.id) {
            return true; // Skip collision check if bullet is owned by the player
          }
          const dx = bullet.x - player.x;
          const dy = bullet.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
  
          if (distance < player.radius + bullet.radius) {
            player.isDead = true; // Mark the player as dead
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'playerDead', id: player.id }));
              }
            });
            return false; // Remove the bullet
          }
          return true; // Keep the bullet
        });
      }
    }
  }
  
  

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
  
    // Move bullets
    bullets = bullets.filter(bullet => {
      const dx = bullet.targetX - bullet.x;
      const dy = bullet.targetY - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
  
      if (distance < bullet.speed) {
        return false; // Remove bullet when it reaches the target
      } else {
        bullet.x += dx / distance * bullet.speed;
        bullet.y += dy / distance * bullet.speed;
        return true;
      }
    });
  
    checkCollisions();
  }, updateInterval);
  

const PORT = 10000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
