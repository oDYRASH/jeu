const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');

//models import
const Player = require('./models/player');
const Bullet = require('./models/bullet');
const Room = require('./models/room');

//app creation / settings
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// tick rate
const updateInterval = 1000 / 64;

app.use(express.static(path.join(__dirname, 'public')));

// App routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/api/room/:room', (req, res) => {
  const room = Room.getRoomById(req.params.room);
  if (room) {
    res.json({ players: room.players, bullets: room.bullets });
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

app.get('/api/rooms', (req, res) => {
  const rooms = Room.getAllRooms();
  const roomData = {};
  Object.keys(rooms).forEach(room => {
    roomData[room] = {
      players: rooms[room].players,
      bullets: rooms[room].bullets
    };
  });
  res.json(roomData);
});

app.get('/api/getAvailableRoom', (req, res) => {
  const availableRoom = Room.getAvailableRoom();
  if (availableRoom) {
    res.json({ roomId: availableRoom.id });
  } else {
    const newRoom = Room.createNewRoom();
    res.json({ roomId: newRoom.id });
  }
});


// Websocket connection
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  const query = url.parse(request.url, true).query;

  if (pathname === '/ws' && query.room) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, query.room, query.username);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request, room, name) => {
  let currentRoom = Room.getRoomById(room);
  if (!currentRoom) {
    currentRoom = new Room(room);
  }

  const player = currentRoom.addPlayer(name);

  // Set initial positions for first and second player
  if (Object.keys(currentRoom.players).length === 1) {
    player.setPosition(100, 100);
  } else if (Object.keys(currentRoom.players).length === 2) {
    const secondPlayer = Object.values(currentRoom.players).find(p => p.getId() !== player.getId());
    secondPlayer.setPosition(100, 100);
    player.setPosition(1500, 700);

    // Notify both players that the game is ready
    broadcast({ type: 'respawn', id: 1, x: 100, y: 100 }, null, room);
    broadcast({ type: 'respawn', id: 2, x: 1500, y: 700 }, null, room);

  }

  ws.send(JSON.stringify({ type: 'init', playerId: player.getId(), players: currentRoom.players, scores: getScores(room)}));
  ws.room = room;

  broadcast({ type: 'newPlayer', player }, ws, room);
  // score update
  broadcast({ type: 'scoreUpdate', scores: getScores(room) }, null, room);


  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'move') {
      updatePlayerTarget(data, currentRoom.players);
      broadcast({ type: 'update', id: data.id, targetX: data.x, targetY: data.y }, ws, room);
    }

    if (data.type === 'shoot') {
      const player = currentRoom.players[data.id];
      const bullet = new Bullet(player.getX(), player.getY(), data.targetX, data.targetY, player.getId());
      currentRoom.bullets.push(bullet);
      broadcast({ type: 'shoot', bullet }, null, room);
    }
  });

  ws.on('close', () => {
    currentRoom.removePlayer(player.getId());
    broadcast({ type: 'removePlayer', id: player.getId() }, ws, room);
  });

  ws.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      console.error('⚠️ Erreur WebSocket:', err);
    }
  });
});





// server-side functions
const updatePlayerTarget = ({ id, x, y }, players) => {
  if (players[id]) {
    players[id].updateTarget(x, y);
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
  const roomInstance = Room.getRoomById(room);
  const roomPlayers = roomInstance.players;
  let roomBullets = roomInstance.bullets;

  let xxxroomBullets = roomBullets.filter(bullet => {
  //   let hit = false;

    Object.values(roomPlayers).forEach(player => {
      if (!player.isPlayerDead() && bullet.ownerId !== player.getId()) {
        const distance = Math.sqrt((bullet.x - player.getX()) ** 2 + (bullet.y - player.getY()) ** 2);
        if (distance < player.getRadius() + bullet.radius) {

          roomPlayers[bullet.ownerId].incrementScore();
          try {
            roomPlayers[1].respawn(100, 100);
            broadcast({ type: 'respawn', id: 1, x: 100, y: 100 }, null, room);

            roomPlayers[2].respawn(1500, 700);
            broadcast({ type: 'respawn', id: 2, x: 1500, y: 700 }, null, room);
            broadcast({ type: 'scoreUpdate', scores: getScores(room) }, null, room);
          } catch (e) {
            console.log("ERROR ON RESPAWN 💃",e); 
          }
          roomInstance.bullets = [];
          hit = true;
          return false;

        } else if (bullet.x === bullet.targetX && bullet.y === bullet.targetY) {
          hit = true;
        }
      }
    });

  //   return !hit;
  });

  // roomInstance.bullets = roomBullets;
};




const getScores = (room) => {
  const scores = [];
  Object.values(Room.getRoomById(room).players).forEach(player => {
    scores.push({ name: player.getName(), score: player.getScore(), color: player.getColor() });
  });
  return scores;
};


// MAIN SERVER LOOP
setInterval(() => {
  Player.updateAllPositions();
  Bullet.updateAllPositions();

  Object.keys(Room.getAllRooms()).forEach(roomId => {
    checkCollisions(roomId);
  });
}, updateInterval);

const PORT = 10000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
