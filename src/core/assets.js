export async function loadAssets(manifest = []) {
  if (!Array.isArray(manifest)) return;
  await PIXI.Assets.load(manifest);
}
