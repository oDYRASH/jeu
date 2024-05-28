const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

let rooms = {};

// Paramètres dynamiques
const playerSpeed = 3;
const bulletSpeed = 3 * 4.26;
const updateInterval = 1000 / 64;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  const query = url.parse(request.url, true).query;

  if (pathname === '/ws' && query.room) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, query.room);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request, room) => {
  console.log("🌐 Nouvelle connexion WebSocket:", room);

  if (!rooms[room]) {
    rooms[room] = { players: {}, bullets: [], nextPlayerId: 1 };
    console.log("🏠 Nouvelle salle créée:", room);
  }

  const currentRoom = rooms[room];
  const playerId = currentRoom.nextPlayerId++;
  const initialPosition = getInitialPosition(currentRoom.players);
  currentRoom.players[playerId] = { id: playerId, x: initialPosition.x, y: initialPosition.y, color: getRandomColor(currentRoom.nextPlayerId), radius: 20, targetX: null, targetY: null };

  ws.send(JSON.stringify({ type: 'init', playerId, players: currentRoom.players, playerSpeed, bulletSpeed }));
  ws.room = room;

  broadcast({ type: 'newPlayer', player: currentRoom.players[playerId] }, ws, room);
  console.log("👤 Joueur connecté:", playerId);

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log("📩 Message reçu:", data);

    if (data.type === 'move') {
      updatePlayerTarget(data, currentRoom.players);
      broadcast({ type: 'update', id: data.id, targetX: data.x, targetY: data.y, playerSpeed }, ws, room);
      console.log("🚶 Déplacement du joueur:", data);
    }

    if (data.type === 'shoot') {
      const player = currentRoom.players[data.id];
      currentRoom.bullets.push({ x: player.x, y: player.y, targetX: data.targetX, targetY: data.targetY, radius: 5, speed: bulletSpeed, color: player.color, ownerId: player.id });
      broadcast({ type: 'shoot', id: player.id, targetX: data.targetX, targetY: data.targetY, bulletSpeed }, ws, room);
      console.log("🔫 Tir du joueur:", data);
    }

    if (data.type === 'stop') {
      if (currentRoom.players[data.id]) {
        currentRoom.players[data.id].targetX = null;
        currentRoom.players[data.id].targetY = null;
        console.log("⛔ Arrêt du déplacement du joueur:", data.id);
      }
    }
  });

  ws.on('close', () => {
    delete currentRoom.players[playerId];
    broadcast({ type: 'removePlayer', id: playerId }, ws, room);
    console.log("❌ Joueur déconnecté:", playerId);
  });

  ws.on('error', (err) => {
    console.error('⚠️ Erreur WebSocket:', err);
  });
});

const getRandomColor = (nextPlayerId) => {
  if (nextPlayerId == 2) return '#D33F49';
  if (nextPlayerId == 3) return '#1C448E';

  const letters = '0123456789ABCDEF';
  return '#' + Array.from({ length: 6 }).map(() => letters[Math.floor(Math.random() * 16)]).join('');
};

const getInitialPosition = (players) => {
  const playerCount = Object.keys(players).length;
  if (playerCount === 0) return { x: 300, y: 200 };
  if (playerCount === 1) return { x: 500, y: 400 };
  return { x: Math.random() * 800, y: Math.random() * 600 };
};

const updatePlayerTarget = ({ id, x, y }, players) => {
  if (players[id]) {
    players[id].targetX = x;
    players[id].targetY = y;
  }
};

const broadcast = (data, excludeWs, room) => {
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN && client.room === room) {
      client.send(JSON.stringify(data));
    }
  });
};

const checkCollisions = (room) => {
  const roomPlayers = rooms[room].players;
  let roomBullets = rooms[room].bullets;

  roomBullets = roomBullets.filter(bullet => {
    let hit = false;

    Object.values(roomPlayers).forEach(player => {
      if (!player.isDead && bullet.ownerId !== player.id) {
        const distance = Math.sqrt((bullet.x - player.x) ** 2 + (bullet.y - player.y) ** 2);
        if (distance < player.radius + bullet.radius) {
          player.isDead = true;
          broadcast({ type: 'playerDead', id: player.id }, null, room);
          hit = true;
          console.log("💀 Joueur touché:", player.id);
        }
      }
    });

    return !hit;
  });

  rooms[room].bullets = roomBullets;
};

setInterval(() => {
  Object.keys(rooms).forEach(room => {
    // Mettre à jour les positions des joueurs
    Object.values(rooms[room].players).forEach(player => {
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

    // Mettre à jour les positions des balles
    rooms[room].bullets = rooms[room].bullets.filter(bullet => {
      const dx = bullet.targetX - bullet.x;
      const dy = bullet.targetY - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bullet.speed) return false;
      bullet.x += (dx / distance) * bullet.speed;
      bullet.y += (dy / distance) * bullet.speed;
      return true;
    });

    checkCollisions(room);
  });
}, updateInterval);

const PORT = 10000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});


// Route pour obtenir les informations des joueurs dans une salle spécifique
app.get('/api/room/:room', (req, res) => {
  const room = req.params.room;
  if (rooms[room]) {
    res.json({ players: rooms[room].players, bullets: rooms[room].bullets });
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Route pour obtenir les informations sur toutes les salles et leurs joueurs
app.get('/api/rooms', (req, res) => {
  const roomData = {};
  Object.keys(rooms).forEach(room => {
    roomData[room] = {
      players: rooms[room].players,
      bullets: rooms[room].bullets
    };
  });
  res.json(roomData);
});


// WORKING SAVE NO ROOMS
// const express = require('express');
// const path = require('path');
// const http = require('http');
// const WebSocket = require('ws');

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

// let players = {};
// let bullets = [];
// let nextPlayerId = 1;

// // Dynamic settings
// const playerSpeed = 3;
// const bulletSpeed = 3*4.26;
// const updateInterval = 1000 / 64;

// app.use(express.static(path.join(__dirname, 'public')));

// app.get('/game', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'game.html'));
// });

// wss.on('connection', (ws) => {
//   const playerId = nextPlayerId++;
//   const initialPosition = getInitialPosition();
//   players[playerId] = { id: playerId, x: initialPosition.x, y: initialPosition.y, color: getRandomColor(), radius: 20, targetX: null, targetY: null };

//   ws.send(JSON.stringify({ type: 'init', playerId, players, playerSpeed, bulletSpeed }));

//   broadcast({ type: 'newPlayer', player: players[playerId] }, ws);

//   ws.on('message', (message) => {
//     const data = JSON.parse(message);

//     if (data.type === 'move') {
//       updatePlayerTarget(data);
//       broadcast({ type: 'update', id: data.id, targetX: data.x, targetY: data.y, playerSpeed });
//     }

//     if (data.type === 'shoot') {
//       const player = players[data.id];
//       bullets.push({ x: player.x, y: player.y, targetX: data.targetX, targetY: data.targetY, radius: 5, speed: bulletSpeed, color: player.color, ownerId: player.id });
//       broadcast({ type: 'shoot', id: player.id, targetX: data.targetX, targetY: data.targetY, bulletSpeed });
//     }

//    if (data.type === 'stop') {
//     if (players[data.id]) {
//       players[data.id].targetX = null;
//       players[data.id].targetY = null;
//     }
//   }
//   });

//   ws.on('close', () => {
//     delete players[playerId];
//     broadcast({ type: 'removePlayer', id: playerId });
//   });

//   ws.on('error', (err) => {
//     console.error('WebSocket error:', err);
//   });
// });

// const getRandomColor = () => {

//   if (nextPlayerId == 2) return '#D33F49';
//   if (nextPlayerId == 3) return '#1C448E';

//   const letters = '0123456789ABCDEF';
//   return '#' + Array.from({ length: 6 }).map(() => letters[Math.floor(Math.random() * 16)]).join('');
// };

// const getInitialPosition = () => {
//   const playerCount = Object.keys(players).length;
//   if (playerCount === 0) return { x: 300, y: 200 };
//   if (playerCount === 1) return { x: 500, y: 400 };
//   return { x: Math.random() * 800, y: Math.random() * 600 };
// };

// const updatePlayerTarget = ({ id, x, y }) => {
//   if (players[id]) {
//     players[id].targetX = x;
//     players[id].targetY = y;
//   }
// };

// const broadcast = (data, excludeWs) => {
//   wss.clients.forEach(client => {
//     if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify(data));
//     }
//   });
// };

// const checkCollisions = () => {
//   Object.values(players).forEach(player => {
//     if (!player.isDead) {
//       bullets = bullets.filter(bullet => {
//         if (bullet.ownerId === player.id) return true;
//         const distance = Math.sqrt((bullet.x - player.x) ** 2 + (bullet.y - player.y) ** 2);
//         if (distance < player.radius + bullet.radius) {
//           player.isDead = true;
//           broadcast({ type: 'playerDead', id: player.id });
//           return false;
//         }
//         return true;
//       });
//     }
//   });
// };

// setInterval(() => {
//   Object.values(players).forEach(player => {
//     if (player.targetX !== null && player.targetY !== null) {
//       const dx = player.targetX - player.x;
//       const dy = player.targetY - player.y;
//       const distance = Math.sqrt(dx * dx + dy * dy);

//       if (distance < playerSpeed) {
//         player.x = player.targetX;
//         player.y = player.targetY;
//         player.targetX = null;
//         player.targetY = null;
//       } else {
//         player.x += (dx / distance) * playerSpeed;
//         player.y += (dy / distance) * playerSpeed;
//       }
//     }
//   });

//   bullets = bullets.filter(bullet => {
//     const dx = bullet.targetX - bullet.x;
//     const dy = bullet.targetY - bullet.y;
//     const distance = Math.sqrt(dx * dx + dy * dy);

//     if (distance < bullet.speed) return false;
//     bullet.x += (dx / distance) * bullet.speed;
//     bullet.y += (dy / distance) * bullet.speed;
//     return true;
//   });

//   checkCollisions();
// }, updateInterval);

// const PORT = 10000;
// server.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });