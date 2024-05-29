class Player {
  static instances = [];
  static radius = 50;
  static velocity = 3;

  constructor(x, y, name) {
    this.id =  Player.getAvailablePlayerId();
    this.x = x;
    this.y = y;
    this.radius = Player.radius;
    this.velocity = Player.velocity;
    this.targetX = null;
    this.targetY = null;
    this.score = 0;
    this.name = name || `Player ${id}`;
    this.isDead = false;

    Player.instances.push(this);
  }

  // Getters
  getId() {
    return this.id;
  }

  getX() {
    return this.x;
  }

  getY() {
    return this.y;
  }

  getColor() {
    return this.color;
  }

  getRadius() {
    return this.radius;
  }

  getTargetX() {
    return this.targetX;
  }

  getTargetY() {
    return this.targetY;
  }

  getScore() {
    return this.score;
  }

  getName() {
    return this.name;
  }

  isPlayerDead() {
    return this.isDead;
  }

  getVelocity() {
    return this.velocity;
  }
  // Setters
  setX(x) {
    this.x = x;
  }

  setY(y) {
    this.y = y;
  }

  setColor(color) {
    this.color = color;
  }

  setRadius(radius) {
    this.radius = radius;
  }

  setTargetX(targetX) {
    this.targetX = targetX;
  }

  setTargetY(targetY) {
    this.targetY = targetY;
  }

  setScore(score) {
    this.score = score;
  }

  setName(name) {
    this.name = name;
  }

  setPlayerDead(isDead) {
    this.isDead = isDead;
  }

  // Methods
  updatePosition(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  updateTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  incrementScore() {
    this.score += 1;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  respawn(x, y) {
    this.setPosition(x, y);
    this.setTarget(null, null);
    this.isDead = false; // Réinitialiser l'état de mort
  }

  static getAllPlayers() {
    return Player.instances;
  }

  static removePlayerById(id) {
    Player.instances = Player.instances.filter(player => player.id !== id);
  }

  static updateAllPositions() {
    Player.instances.forEach(player => {
      if (player.targetX !== null && player.targetY !== null) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const playerVelocity = player.getVelocity();


        if (distance < playerVelocity) {
          player.x = player.targetX;
          player.y = player.targetY;
          player.targetX = null;
          player.targetY = null;
        } else {
          player.updatePosition((dx / distance) * playerVelocity, (dy / distance) * playerVelocity);
        }
      }
    });
  }

  // static method to not used player id
  static getAvailablePlayerId() {
    let id = 1;
    while (Player.instances.find(player => player.id === id)) {
      id++;
    }
    return id;
  }
}

module.exports = Player;
