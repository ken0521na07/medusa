import { TILE_SIZE } from "../core/constants.js";

export default class GameObject {
  constructor(x, y, texture) {
    this.gridX = x;
    this.gridY = y;
    this.sprite = PIXI.Sprite.from(texture);
    this.sprite.width = TILE_SIZE;
    this.sprite.height = TILE_SIZE;
    this.updatePixelPosition();
  }

  updatePixelPosition() {
    this.sprite.x = this.gridX * TILE_SIZE;
    this.sprite.y = this.gridY * TILE_SIZE;
  }
}
