import { packageId } from "../constants.js";

export function registeDrawingsMaskFunctionality() {
  Hooks.on("canvasReady", () => {
    requestAnimationFrame(drawDrawingsMask);
  });

  for (const hook of ["updateDrawing", "createDrawing", "deleteDrawing"]) {
    Hooks.on(hook, (drawing) => {
      drawDrawingsMaskIfCurrentScene(drawing.parent);
    });
  }

  Hooks.on("updateScene", (scene, data) => {
    if (
      foundry.utils.hasProperty(data, "flags.fxmaster.invert") ||
      foundry.utils.hasProperty(data, "flags.fxmaster.-=invert")
    ) {
      drawDrawingsMaskIfCurrentScene(scene);
    }
  });
}

function drawDrawingsMaskIfCurrentScene(scene) {
  if (scene === canvas.scene) {
    drawDrawingsMask();
  }
}

function drawDrawingsMask() {
  const msk = canvas.masks.depth;
  if (msk.fxmasterDrawingsMask) {
    msk.removeChild(msk.fxmasterDrawingsMask);
    delete msk.fxmasterDrawingsMask;
  }
  const invert = canvas.scene.getFlag(packageId, "invert");
  const mask = invert ? createInvertedMask() : createMask();
  mask.mask = new PIXI.MaskData();
  mask.mask.colorMask = PIXI.COLOR_MASK_BITS.BLUE;
  msk.fxmasterDrawingsMask = msk.addChild(mask);
}

function createMask() {
  const mask = new PIXI.LegacyGraphics();
  canvas.drawings.placeables.forEach((drawing) => {
    const isMask = drawing.document.getFlag(packageId, "masking");
    if (!isMask) return;
    mask.beginFill(0x0000ff);
    drawShapeToMask(mask, drawing);
    mask.endFill();
  });

  if (canvas.regions) {
    canvas.regions.placeables.forEach((region) => {
      const isMask = region.document.behaviors.contents.some(b => b.type == "suppressWeather");
      if (!isMask) return;
      mask.beginFill(0x0000ff);
      for (const node of region.polygonTree) {
        if (node.isHole) continue;
        mask.drawShape(node.polygon);
        mask.beginHole();
        for (const hole of node.children) mask.drawShape(hole.polygon);
        mask.endHole();
      }
    });
  }

  return mask;
}

function createInvertedMask() {
  const mask = new PIXI.LegacyGraphics();
  mask.beginFill(0x0000ff).drawShape(canvas.dimensions.rect).endFill();

  canvas.drawings.placeables.forEach((drawing) => {
    const isMask = drawing.document.getFlag(packageId, "masking");
    if (!isMask) return;
    mask.beginHole();
    drawShapeToMask(mask, drawing);
    mask.endHole();
  });

  if (canvas.regions) {
    canvas.regions.placeables.forEach((region) => {
      const isMask = region.document.behaviors.contents.some(b => b.type == "suppressWeather");
      if (!isMask) return;
      for (const node of [...region.polygonTree].filter(p => !p.isHole)) {
        mask.beginHole();
        mask.drawShape(node.polygon);
        mask.endHole();
      }
      for (const node of [...region.polygonTree].filter(p => p.isHole)) {
        mask.beginFill(0x0000ff);
        mask.drawShape(node.polygon);
        mask.endFill();
      }
    });
  }

  return mask;
}

/**
 * Draw a shape to a mask.
 * @param {PIXI.Graphics} mask    The mask to draw to
 * @param {Drawing}       drawing The drawing of which to draw the dhape
 */
function drawShapeToMask(mask, drawing) {
  const shape = drawing.shape.geometry.graphicsData[0].shape.clone();
  switch (drawing.type) {
    case Drawing.SHAPE_TYPES.ELLIPSE: {
      shape.x = drawing.center.x;
      shape.y = drawing.center.y;
      mask.drawShape(shape);
      break;
    }
    case Drawing.SHAPE_TYPES.POLYGON: {
      const points = drawing.document.shape.points.map((p, i) =>
        i % 2 === 0 ? p + drawing.bounds.x : p + drawing.bounds.y,
      );
      mask.drawPolygon(points);
      break;
    }
    default: {
      const s = drawing.document.shape;
      shape.x = drawing.center.x - s.width / 2;
      shape.y = drawing.center.y - s.height / 2;
      mask.drawShape(shape);
    }
  }
}
