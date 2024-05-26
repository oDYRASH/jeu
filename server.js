const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};
let nextPlayerId = 1;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;
  players[playerId] = { id: playerId, x: 0, y: 0, color: getRandomColor(), radius: 20 };

  ws.send(JSON.stringify({ type: 'init', playerId, players }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'move') {
      players[data.id].x = data.x;
      players[data.id].y = data.y;

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'update', players }));
        }
      });
    }
  });

  ws.on('close', () => {
    delete players[playerId];

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', players }));
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
