const Player = require('./player');

class Room {
  static instances = {};

  constructor(id) {
    this.id = id;
    this.players = {};
    this.bullets = [];
    this.nextPlayerId = 1;
    Room.instances[id] = this;
  }

  addPlayer(name) {
    const initialPosition = this.getInitialPosition();
    const player = new Player(initialPosition.x, initialPosition.y, name);
    this.players[player.getId()] = player;
    return player;
  }

  removePlayer(playerId) {
    delete this.players[playerId];
    if (Object.keys(this.players).length === 0) {
      delete Room.instances[this.id];
      return true;
    }
    return false;
  }

  getInitialPosition() {
    const playerCount = Object.keys(this.players).length;
    if (playerCount === 0) return { x: 300, y: 200 };
    if (playerCount === 1) return { x: 500, y: 400 };
    return { x: Math.random() * 800, y: Math.random() * 600 };
  }

  static getAllRooms() {
    return Room.instances;
  }

  static getRoomById(id) {
    return Room.instances[id];
  }

  static getAvailableRoom() {
    for (const id in Room.instances) {
      if (Object.keys(Room.instances[id].players).length === 1) {
        return Room.instances[id];
      }
    }
    return null;
  }

  static createNewRoom() {
    let roomId = 1;
    while (Room.instances[`room${roomId}`]) {
      roomId++;
    }
    return new Room(`room${roomId}`);
  }

  static checkCollision() {
    Object.values(Room.instances).forEach(room => {
      const players = room.players;
      const bullets = room.bullets;

      for (const playerId in players) {
        const player = players[playerId];
        for (let i = 0; i < bullets.length; i++) {
          const bullet = bullets[i];
          if (bullet.ownerId !== player.getId() && bullet.checkCollision(player)) {
            player.isDead = true;
            player.score -= 1;
            bullets.splice(i, 1);
          }
        }
      }
    });
  }

}

module.exports = Room;
