import GameObject from "./gameObject.js";
import {
  START_POS_X,
  START_POS_Y,
  START_FLOOR,
  TILE,
  playerState, // import playerState to check medusa state
} from "../core/constants.js";
import { showCustomAlert } from "../ui/modals.js";
import { emit } from "../core/eventBus.js";
import * as snakeManager from "../managers/snakeManager.js";

export default class Player extends GameObject {
  constructor(x, y, texturePath, mapService, floor = START_FLOOR) {
    super(x, y, texturePath);
    this.direction = "down";
    this.animationFrame = 0;
    this._suppressUntil = 0;
    this.mapService = mapService;
    this.textures = this.prepareTextures(texturePath);
    this.sprite.texture = this.textures[this.direction][0];
    this.floor = floor;
    // per-floor start positions recorded when the player teleports to a floor
    // key -> { x, y }
    this.startPositions = {};
    this.startPositions[this.floor] = { x: this.gridX, y: this.gridY };
    // ensure mapService knows current floor
    try {
      this.mapService.setFloor(this.floor);
    } catch (e) {}
    // notify UI to update map image
    try {
      emit("floorChanged", this.floor);
    } catch (e) {}
  }

  teleport(x, y, floor = this.floor) {
    const prevFloor = this.floor;
    this.gridX = x;
    this.gridY = y;
    this.floor = floor;
    try {
      this.mapService.setFloor(this.floor);
    } catch (e) {}
    // notify UI about floor change so background map can update
    try {
      emit("floorChanged", this.floor);
    } catch (e) {}
    this.updatePixelPosition();
    this.direction = "down";
    this.animationFrame = 0;
    this.sprite.texture = this.textures[this.direction][0];
    // briefly suppress further movement input right after teleport
    try {
      this._suppressUntil = Date.now() + 300;
    } catch (e) {}
    // If the player changed floors via teleport, record this position as
    // the start position for the new floor. This allows returning here on death.
    try {
      if (prevFloor !== this.floor) {
        this.startPositions[this.floor] = { x: this.gridX, y: this.gridY };
      }
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

  // check whether a `snake` tile exists along the player's current
  // facing direction (straight line) before being blocked by a wall.
  isSnakeInSight() {
    // If a snake currently occupies the player's own tile, treat as seen.
    try {
      if (snakeManager.getSnakeAt(this.gridX, this.gridY, this.floor))
        return true;
    } catch (e) {}

    // NOTE: medusa no longer counts as a lethal sight-source in any case.
    // (previous code treated medusa on the player's tile or in sight as lethal)

    const dirMap = {
      down: [0, 1],
      up: [0, -1],
      left: [-1, 0],
      right: [1, 0],
    };
    const vec = dirMap[this.direction];
    if (!vec) return false;
    let x = this.gridX + vec[0];
    let y = this.gridY + vec[1];
    while (
      x >= 0 &&
      x < this.mapService.getWidth() &&
      y >= 0 &&
      y < this.mapService.getHeight()
    ) {
      const t = this.mapService.getTile(x, y, this.floor);
      // stop if a wall (or numeric 1) blocks the view
      if (t === TILE.WALL || t === 1) return false;
      // stop if a statue (or any tile that starts with "statue_") blocks the view
      if (typeof t === "string" && t.startsWith("statue")) return false;
      // stop if a statue constant is used
      if (t === TILE.STATUE_J) return false;
      // check dynamic snake entity as well (only after blockers checked)
      try {
        if (snakeManager.getSnakeAt(x, y, this.floor)) return true;
      } catch (e) {}
      if (t === TILE.SNAKE || t === "snake") {
        // only consider the tile lethal if a live snake entity currently occupies it
        try {
          if (snakeManager.getSnakeAt(x, y, this.floor)) return true;
        } catch (e) {}
        // otherwise treat it as non-lethal and continue scanning past it
      }
      x += vec[0];
      y += vec[1];
    }
    return false;
  }

  // unified fall handler: show alert (prefer custom) then call mapService.onFall()
  // and teleport player back to start. Uses requestAnimationFrame when available
  // so the renderer can show the player stepping onto the tile first.
  // options: { onClose: function } -- optional callback to run after the built-in death handling when the alert is closed
  triggerFall(message, options = {}) {
    const doOnClose = async () => {
      try {
        // call optional external onClose first so it can modify runtime and persisted state
        if (options && typeof options.onClose === "function") {
          try {
            await Promise.resolve(options.onClose());
          } catch (e) {}
        }
      } catch (e) {}

      try {
        // ensure mapService.onFall completes after external onClose
        if (this.mapService && typeof this.mapService.onFall === "function") {
          try {
            await Promise.resolve(this.mapService.onFall(options));
          } catch (e) {
            // continue even if restore fails
          }
        }
      } catch (e) {}

      // reset snake positions to their initial state when player dies
      try {
        if (typeof snakeManager.resetPositions === "function") {
          snakeManager.resetPositions();
        }
      } catch (e) {}
      try {
        // teleport to recorded start position for the current floor if present
        const floor = this.floor || START_FLOOR;
        const start = this.startPositions && this.startPositions[floor];
        if (
          start &&
          typeof start.x === "number" &&
          typeof start.y === "number"
        ) {
          this.teleport(start.x, start.y, floor);
        } else {
          // fallback to global START_* constants
          this.teleport(START_POS_X, START_POS_Y, START_FLOOR);
        }
      } catch (e) {}
    };

    const show = () => {
      try {
        showCustomAlert(message, {
          allowOverlayClose: false,
          onClose: doOnClose,
        });
      } catch (e) {
        try {
          window.alert(message);
        } catch (e2) {}
        doOnClose();
      }
    };

    try {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(show);
      } else {
        show();
      }
    } catch (e) {
      show();
    }
  }

  move(dx, dy) {
    // suppress rapid inputs after teleport/fall
    if (Date.now() < (this._suppressUntil || 0)) return;
    // determine intended facing direction, but don't apply it yet.
    // We'll set the sprite's direction right before finishing the move so
    // intermediate logic (line-of-sight, collisions) isn't affected.
    let intendedDirection = this.direction;
    if (dy > 0) intendedDirection = "down";
    else if (dy < 0) intendedDirection = "up";
    else if (dx < 0) intendedDirection = "left";
    else if (dx > 0) intendedDirection = "right";

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

    // check if a snake entity currently occupies the target tile
    try {
      const snakeHere = snakeManager.getSnakeAt(newX, newY, this.floor);
      if (snakeHere) {
        // behave like TILE.SNAKE
        this.direction = intendedDirection;
        this.animationFrame = 0;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        try {
          this._suppressUntil = Date.now() + 300;
        } catch (e) {}
        this.triggerFall("ヘビを見て石化してしまった...！");
        return;
      }
    } catch (e) {}

    const targetTile = this.mapService.getTile(newX, newY, this.floor);

    // handle medusa tile similarly to other special tiles inside the switch
    switch (targetTile) {
      case TILE.MEDUSA:
      case "medusa":
        // Treat Medusa as an impassable, non-lethal obstacle: face it but do not petrify.
        this.direction = intendedDirection;
        this.animationFrame = 0;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        try {
          this._suppressUntil = Date.now() + 300;
        } catch (e) {}
        return;
    }

    // Prevent moving into statue tiles: change facing only and debounce input
    try {
      if (typeof targetTile === "string" && targetTile.startsWith("statue")) {
        this.direction = intendedDirection;
        this.animationFrame = 0;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        try {
          this._suppressUntil = Date.now() + 300;
        } catch (e) {}
        return;
      }
    } catch (e) {}

    switch (targetTile) {
      case TILE.WALL:
      case 1:
        // wall: change facing to attempted direction, do not move
        this.direction = intendedDirection;
        this.animationFrame = 0;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        try {
          this._suppressUntil = Date.now() + 300;
        } catch (e) {}
        return;
      case TILE.HOLE:
      case "hole":
        // 1) move into the hole visually
        // apply intended facing now so the character turns just before the move
        this.direction = intendedDirection;
        this.gridX = newX;
        this.gridY = newY;
        this.updatePixelPosition();
        // suppress inputs while alert is shown and before teleport
        try {
          this._suppressUntil = Date.now() + 1000;
        } catch (e) {}

        // Check for active cushion effect saved globally
        try {
          const cushionState = window.__cushionState || null;
          const cushionMap = window.__cushionMap || null;
          const key = `${this.gridX},${this.gridY},${this.floor}`;
          if (
            cushionState &&
            cushionState.active &&
            typeof cushionState.remainingSteps === "number" &&
            cushionState.remainingSteps > 0 &&
            cushionMap &&
            cushionMap[key]
          ) {
            // teleport to mapped destination instead of immediate death
            const dest = cushionMap[key];
            try {
              this.teleport(dest.x, dest.y, dest.f);
            } catch (e) {}
            // consume one step
            try {
              window.__cushionState.remainingSteps = Math.max(
                0,
                (window.__cushionState.remainingSteps || 0) - 1
              );
              // if steps exhausted, deactivate
              if (window.__cushionState.remainingSteps <= 0) {
                window.__cushionState.active = false;
              }
            } catch (e) {}
            // notify player
            try {
              showCustomAlert("クッショ効果で穴を回避した！");
            } catch (e) {
              try {
                window.alert("クッショ効果で穴を回避した！");
              } catch (e2) {}
            }
            return;
          }
        } catch (e) {}

        // unified fall behavior
        this.triggerFall("穴に落ちてしまった");
        return;
      case TILE.SNAKE:
      case "snake":
        // Treat snake tiles as impassable (like a wall). However, only trigger
        // petrification if a live snake entity actually occupies the target tile.
        this.direction = intendedDirection;
        // show standing frame in new facing
        this.animationFrame = 0;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        try {
          // small debounce to avoid spamming when player holds the button
          this._suppressUntil = Date.now() + 300;
        } catch (e) {}
        try {
          const live = snakeManager.getSnakeAt(newX, newY, this.floor);
          if (live) {
            // only fall if a live snake is present
            this.triggerFall("ヘビを見て石化してしまった...！");
          }
        } catch (e) {
          // on error, conservatively assume lethal
          try {
            this.triggerFall("ヘビを見て石化してしまった...！");
          } catch (e2) {}
        }
        return;
      default:
        // normal floor or item: move and animate
        this.gridX = newX;
        this.gridY = newY;
        this.updatePixelPosition();
        this.animationFrame = (this.animationFrame + 1) % 4;
        // now that movement is practically done, apply the facing and update texture
        this.direction = intendedDirection;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];

        // emit an event indicating the player moved so other systems (snake)
        // can react AFTER the player finished moving.
        try {
          emit("playerMoved", {
            x: this.gridX,
            y: this.gridY,
            floor: this.floor,
          });
        } catch (e) {}

        // If a cushion effect is active, consume one step on each successful move.
        // This ensures the effect only protects for the next N actual steps,
        // and will not linger indefinitely if the player doesn't fall into a hole.
        try {
          const cs = window.__cushionState;
          if (cs && cs.active && typeof cs.remainingSteps === "number") {
            cs.remainingSteps = Math.max(0, cs.remainingSteps - 1);
            if (cs.remainingSteps <= 0) cs.active = false;
          }
        } catch (e) {}

        return;
    }
  }

  // Serialize minimal player runtime state for saving
  serialize() {
    try {
      return {
        x: this.gridX,
        y: this.gridY,
        floor: this.floor,
        direction: this.direction,
        startPositions: this.startPositions || {},
      };
    } catch (e) {
      return null;
    }
  }

  // Restore player runtime state from saved object
  deserialize(obj) {
    try {
      if (!obj) return;
      if (typeof obj.x === "number" && typeof obj.y === "number") {
        this.gridX = obj.x;
        this.gridY = obj.y;
      }
      if (typeof obj.floor === "number") this.floor = obj.floor;
      if (typeof obj.direction === "string") this.direction = obj.direction;
      if (obj.startPositions && typeof obj.startPositions === "object")
        this.startPositions = obj.startPositions;
      // apply to sprite/pixel position
      try {
        this.mapService.setFloor(this.floor);
      } catch (e) {}
      this.updatePixelPosition();
      this.sprite.texture =
        this.textures[this.direction] && this.textures[this.direction][0]
          ? this.textures[this.direction][0]
          : this.sprite.texture;
      // notify UI about floor change so background map can update
      try {
        emit("floorChanged", this.floor);
      } catch (e) {}
    } catch (e) {}
  }
}
