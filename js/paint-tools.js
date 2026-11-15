import { rgbToHex } from './color-utils.js';
import {
  drawLineContinuous,
  floodFill,
  magicWandMask,
  colorSelectMask,
  rasterizePolygonMask,
  renderTextPixels,
  drawSelectionOverlay,
  drawGuidesOverlay
} from './paint-algorithms.js';

export class PaintToolHandler {
  constructor(editor) {
    this.editor = editor;
  }

  handlePointerDown(px, py) {
    const ed = this.editor;
    if (ed.dialogs?.colorReplace?.handleCanvasPick(px, py)) return;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerDown(px, py)) return;
    if (ed.clipMgr.handlePointerDown(px, py)) return;
    if (ed.currentTool === 'hand') return;
    if (ed.selMover && ed.selMover.handlePointerDown(px, py)) return;
    if (px < 0 || px >= ed.width || py < 0 || py >= ed.height) return;

    if (ed.currentTool === 'picker') {
      const p = ed.ctx.getImageData(px, py, 1, 1).data;
      if (p[3] > 0) {
        const hex = rgbToHex(p[0], p[1], p[2]);
        ed.currentColor = hex;
        ed._updateCurrentColorUI();
        if (ed.targetType === 'mask') {
          ed.app.paletteManager.addColorToMaskPalette(hex);
          ed._renderPaletteUI();
        }
      }
      return;
    }

    ed.isDrawing = true;
    ed.lastDrawPos = [px, py];

    if (ed.currentTool === 'pencil') {
      ed._pushHistory();
      ed._drawPixel(px, py);
    } else if (ed.currentTool === 'line') {
      ed.lineStart = [px, py];
    } else if (ed.currentTool === 'rectFill') {
      ed.rectFillStart = [px, py];
      this.drawOverlay([px, py]);
    } else if (ed.currentTool === 'bucket') {
      ed._pushHistory();
      const before = ed.repeatMgr ? ed.repeatMgr.snapshotBefore() : null;
      floodFill(ed.ctx, ed.width, ed.height, px, py, ed.currentColor, ed.selectionMask);
      if (ed.repeatMgr && before) ed.repeatMgr.applyDiff(before);
      ed.isDrawing = false;
    } else if (ed.currentTool === 'rectSelect') {
      ed.selStart = [px, py];
    } else if (ed.currentTool === 'polySelect') {
      if (ed.polyPoints.length >= 3 && Math.hypot(px - ed.polyPoints[0][0], py - ed.polyPoints[0][1]) <= 1.5) {
        this.finalizePolySelect();
      } else {
        const last = ed.polyPoints[ed.polyPoints.length - 1];
        if (!last || last[0] !== px || last[1] !== py) ed.polyPoints.push([px, py]);
        this.drawOverlay([px, py]);
      }
      ed.isDrawing = false;
    } else if (ed.currentTool === 'wand') {
      ed.clipMgr.applySelectionMask(magicWandMask(ed.ctx, ed.width, ed.height, px, py));
      ed.isDrawing = false;
    } else if (ed.currentTool === 'colorSelect') {
      ed.clipMgr.applySelectionMask(colorSelectMask(ed.ctx, ed.width, ed.height, px, py));
      ed.isDrawing = false;
    } else if (ed.currentTool === 'text') {
      const text = prompt('挿入するテキストを入力してください:');
      if (text) {
        const fontSize = parseInt(prompt('フォントサイズ (px):', '10'), 10) || 10;
        ed._pushHistory();
        renderTextPixels(ed.width, ed.height, text, fontSize, px, py, (tx, ty) => ed._drawPixel(tx, ty));
      }
      ed.isDrawing = false;
    }
  }

  handlePointerMove(px, py) {
    const ed = this.editor;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerMove(px, py)) return;
    if (ed.clipMgr.handlePointerMove(px, py)) return;
    if (ed.selMover && ed.selMover.handlePointerMove(px, py)) return;

    if (ed.isDrawing) {
      if (ed.currentTool === 'pencil') {
        const [lx, ly] = ed.lastDrawPos;
        drawLineContinuous(lx, ly, px, py, (x, y) => ed._drawPixel(x, y));
        ed.lastDrawPos = [px, py];
      } else if (ed.currentTool === 'line' || ed.currentTool === 'rectFill' || ed.currentTool === 'rectSelect') {
        this.drawOverlay([px, py]);
      }
    } else if (ed.currentTool === 'polySelect' && ed.polyPoints.length > 0) {
      this.drawOverlay([px, py]);
    }
  }

  handlePointerUp(px, py) {
    const ed = this.editor;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerUp()) return;
    if (ed.clipMgr.handlePointerUp()) return;
    if (ed.selMover && ed.selMover.handlePointerUp()) return;
    if (!ed.isDrawing) return;
    ed.isDrawing = false;

    if (ed.currentTool === 'line' && ed.lineStart) {
      ed._pushHistory();
      drawLineContinuous(ed.lineStart[0], ed.lineStart[1], px, py, (x, y) => ed._drawPixel(x, y));
      ed.lineStart = null;
      this.drawOverlay();
    } else if (ed.currentTool === 'rectFill' && ed.rectFillStart) {
      ed._pushHistory();
      const x0 = Math.max(0, Math.min(ed.rectFillStart[0], px));
      const x1 = Math.min(ed.width - 1, Math.max(ed.rectFillStart[0], px));
      const y0 = Math.max(0, Math.min(ed.rectFillStart[1], py));
      const y1 = Math.min(ed.height - 1, Math.max(ed.rectFillStart[1], py));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) ed._drawPixel(x, y);
      }
      ed.rectFillStart = null;
      this.drawOverlay();
    } else if (ed.currentTool === 'rectSelect' && ed.selStart) {
      const x0 = Math.max(0, Math.min(ed.selStart[0], px));
      const x1 = Math.min(ed.width - 1, Math.max(ed.selStart[0], px));
      const y0 = Math.max(0, Math.min(ed.selStart[1], py));
      const y1 = Math.min(ed.height - 1, Math.max(ed.selStart[1], py));
      const newMask = new Uint8Array(ed.width * ed.height);
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) newMask[sy * ed.width + sx] = 1;
      }
      ed.selStart = null;
      ed.clipMgr.applySelectionMask(newMask);
    }
  }

  finalizePolySelect() {
    const ed = this.editor;
    if (ed.polyPoints.length < 3) return;
    const newMask = rasterizePolygonMask(ed.width, ed.height, ed.polyPoints);
    ed.polyPoints = [];
    ed.clipMgr.applySelectionMask(newMask);
  }

  drawOverlay(curPos = null) {
    const ed = this.editor;
    const oCtx = ed.oCtx;
    oCtx.clearRect(0, 0, ed.width, ed.height);

    if (ed.onionSkinMgr) ed.onionSkinMgr.drawOverlay(oCtx, ed.zoomLevel);
    ed.clipMgr.drawFloatingOverlay(oCtx, ed.zoomLevel);

    if (ed.selMover && ed.selMover.isMoving) {
      ed.selMover.drawMovingOverlay(oCtx);
    } else {
      drawSelectionOverlay(oCtx, ed.width, ed.height, ed.selectionMask);
    }
    if (ed.repeatMgr) ed.repeatMgr.drawOverlay(oCtx);

    if (ed.currentTool === 'line' && ed.lineStart && curPos) {
      oCtx.fillStyle = ed.currentColor;
      drawLineContinuous(ed.lineStart[0], ed.lineStart[1], curPos[0], curPos[1], (x, y) => oCtx.fillRect(x, y, 1, 1));
    } else if (ed.currentTool === 'rectFill' && ed.rectFillStart && curPos) {
      const x0 = Math.min(ed.rectFillStart[0], curPos[0]);
      const y0 = Math.min(ed.rectFillStart[1], curPos[1]);
      const w = Math.abs(curPos[0] - ed.rectFillStart[0]) + 1;
      const h = Math.abs(curPos[1] - ed.rectFillStart[1]) + 1;
      oCtx.fillStyle = ed.currentColor;
      oCtx.globalAlpha = 0.7;
      oCtx.fillRect(x0, y0, w, h);
      oCtx.globalAlpha = 1.0;
    } else if (ed.currentTool === 'rectSelect' && ed.selStart && curPos) {
      const x = Math.min(ed.selStart[0], curPos[0]);
      const y = Math.min(ed.selStart[1], curPos[1]);
      const w = Math.abs(curPos[0] - ed.selStart[0]) + 1;
      const h = Math.abs(curPos[1] - ed.selStart[1]) + 1;
      oCtx.fillStyle = 'rgba(255, 255, 0, 0.25)';
      oCtx.fillRect(x, y, w, h);
    }

    if (ed.polyPoints.length > 0) {
      oCtx.lineWidth = 1 / Math.max(1, ed.zoomLevel * 0.5);
      oCtx.strokeStyle = '#00FF66';
      oCtx.beginPath();
      oCtx.moveTo(ed.polyPoints[0][0] + 0.5, ed.polyPoints[0][1] + 0.5);
      for (let i = 1; i < ed.polyPoints.length; i++) {
        oCtx.lineTo(ed.polyPoints[i][0] + 0.5, ed.polyPoints[i][1] + 0.5);
      }
      if (curPos) oCtx.lineTo(curPos[0] + 0.5, curPos[1] + 0.5);
      oCtx.stroke();

      if (curPos && ed.polyPoints.length >= 2) {
        oCtx.setLineDash([1, 1]);
        oCtx.strokeStyle = 'rgba(0, 255, 102, 0.55)';
        oCtx.beginPath();
        oCtx.moveTo(curPos[0] + 0.5, curPos[1] + 0.5);
        oCtx.lineTo(ed.polyPoints[0][0] + 0.5, ed.polyPoints[0][1] + 0.5);
        oCtx.stroke();
        oCtx.setLineDash([]);
      }

      ed.polyPoints.forEach(([vx, vy], idx) => {
        oCtx.fillStyle = idx === 0 ? '#00FF66' : '#FFFF00';
        oCtx.fillRect(vx, vy, 1, 1);
      });
    }

    drawGuidesOverlay(oCtx, ed.width, ed.height, ed.zoomLevel, {
      showGrid: ed.showGrid,
      gridStep: ed.gridStep,
      gridColor: ed.gridColor,
      showIsoTile: ed.showIsoTile,
      isoTileW: ed.isoTileW,
      isoTileH: ed.isoTileH,
      isoColor: ed.isoColor
    });
  }
}
