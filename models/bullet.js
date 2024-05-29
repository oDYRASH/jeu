class Bullet {
    static instances = [];
    static radius = 59 / 5;
    static speed = 4 * 4.26;

    constructor(x, y, targetX, targetY, ownerId) {
      this.x = x;
      this.y = y;
      this.targetX = targetX;
      this.targetY = targetY;
      this.radius = Bullet.radius;
      this.speed = Bullet.speed;
      this.ownerId = ownerId;
      Bullet.instances.push(this);
    }

    // Method to update the bullet's position
    updatePosition() {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= this.speed) {
        this.x = this.targetX;
        this.y = this.targetY;
        delete this;
        return false; // The bullet has reached its target
      } else {
        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;
        return true; // The bullet is still in motion
      }
    }

    // Method to check collision with a player
    checkCollision(player) {
      const distance = Math.sqrt((this.x - player.getX()) ** 2 + (this.y - player.getY()) ** 2);
      return distance < this.radius + player.getRadius();
    }

    // Static method to update all bullets' positions
    static updateAllPositions() {
      Bullet.instances = Bullet.instances.filter(bullet => bullet.updatePosition());
    }
}

module.exports = Bullet;
