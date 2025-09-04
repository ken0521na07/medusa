import GameObject from "./gameObject.js";
import { START_POS_X, START_POS_Y, TILE } from "../core/constants.js";
import { showCustomAlert } from "../ui/modals.js";

export default class Player extends GameObject {
  constructor(x, y, texturePath, mapService) {
    super(x, y, texturePath);
    this.direction = "down";
    this.animationFrame = 0;
    this._suppressUntil = 0;
    this.mapService = mapService;
    this.textures = this.prepareTextures(texturePath);
    this.sprite.texture = this.textures[this.direction][0];
  }

  teleport(x, y) {
    this.gridX = x;
    this.gridY = y;
    this.updatePixelPosition();
    this.direction = "down";
    this.animationFrame = 0;
    this.sprite.texture = this.textures[this.direction][0];
    // briefly suppress further movement input right after teleport
    try {
      this._suppressUntil = Date.now() + 300;
    } catch (e) {}
  }

  prepareTextures(texturePath) {
    const textures = { down: [], up: [], right: [], left: [] };
    const baseTexture = PIXI.Texture.from(texturePath).baseTexture;
    const directionOrder = ["down", "up", "right", "left"];
    const frameWidth = 16;
    const frameHeight = 16;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const rect = new PIXI.Rectangle(
          col * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight
        );
        const tex = new PIXI.Texture(baseTexture, rect);
        textures[directionOrder[row]].push(tex);
      }
    }
    return textures;
  }

  move(dx, dy) {
    // suppress rapid inputs after teleport/fall
    if (Date.now() < (this._suppressUntil || 0)) return;
    // update facing direction
    if (dy > 0) this.direction = "down";
    else if (dy < 0) this.direction = "up";
    else if (dx < 0) this.direction = "left";
    else if (dx > 0) this.direction = "right";

    const newX = this.gridX + dx;
    const newY = this.gridY + dy;

    const isInBounds =
      newX >= 0 &&
      newX < this.mapService.getWidth() &&
      newY >= 0 &&
      newY < this.mapService.getHeight();
    if (!isInBounds) {
      // out of bounds: reset to standing frame
      this.animationFrame = 0;
      this.sprite.texture = this.textures[this.direction][0];
      return;
    }

    const targetTile = this.mapService.getTile(newX, newY);

    switch (targetTile) {
      case TILE.WALL:
      case 1:
        // wall: do not move, show standing frame
        this.animationFrame = 0;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        return;
      case TILE.HOLE:
      case "hole":
        // 1) move into the hole visually
        this.gridX = newX;
        this.gridY = newY;
        this.updatePixelPosition();
        // suppress inputs while alert is shown and before teleport
        try {
          this._suppressUntil = Date.now() + 1000;
        } catch (e) {}
        // 2) show custom alert (overlay). Defer alert until next frame so
        // the renderer has a chance to draw the player at the hole position.
        try {
          requestAnimationFrame(() => {
            try {
              showCustomAlert("穴に落ちてしまった", {
                allowOverlayClose: false,
                onClose: () => {
                  try {
                    this.mapService.onFall();
                  } catch (e) {}
                  this.teleport(START_POS_X, START_POS_Y);
                },
              });
            } catch (e) {
              // fallback: if custom alert fails, use native alert and then teleport
              try {
                window.alert("穴に落ちてしまった");
              } catch (e2) {}
              try {
                this.mapService.onFall();
              } catch (e3) {}
              this.teleport(START_POS_X, START_POS_Y);
            }
          });
        } catch (e) {
          // if requestAnimationFrame isn't available, fallback immediately
          try {
            showCustomAlert("穴に落ちてしまった", {
              allowOverlayClose: false,
              onClose: () => {
                try {
                  this.mapService.onFall();
                } catch (e) {}
                this.teleport(START_POS_X, START_POS_Y);
              },
            });
          } catch (e) {
            try {
              window.alert("穴に落ちてしまった");
            } catch (e2) {}
            try {
              this.mapService.onFall();
            } catch (e3) {}
            this.teleport(START_POS_X, START_POS_Y);
          }
        }
        return;
      default:
        // normal floor or item: move and animate
        this.gridX = newX;
        this.gridY = newY;
        this.updatePixelPosition();
        this.animationFrame = (this.animationFrame + 1) % 4;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        return;
    }
  }
}
