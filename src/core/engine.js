import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "./constants.js";

let app = null;

export function initEngine({ viewContainerId = "game-canvas" } = {}) {
  if (app) return app;
  app = new PIXI.Application({
    width: TILE_SIZE * MAP_WIDTH,
    height: TILE_SIZE * MAP_HEIGHT,
    backgroundColor: 0x000000,
  });
  const container = document.getElementById(viewContainerId);
  if (container) container.appendChild(app.view);

  const mapLayer = new PIXI.Container();
  const entityLayer = new PIXI.Container();
  app.stage.addChild(mapLayer);
  app.stage.addChild(entityLayer);

  // export layers for external usage
  app._layers = { mapLayer, entityLayer };

  return app;
}

export function getApp() {
  return app;
}
