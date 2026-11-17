import { getSelectionOverlayStyle } from './paint-algorithms.js';

export class PaintSelectionMover {
  constructor(editor) {
    this.editor = editor;
    this.isMoving = false;
    this.startPx = [0, 0];
    this.delta = [0, 0];
    this.origImageData = null;
    this.origMask = null;
    this.floatingPreview = null;
  }

  reset() {
    this.isMoving = false;
    this.delta = [0, 0];
    this.origImageData = null;
    this.origMask = null;
    this.beforeHistoryState = null;
    this.floatingPreview = null;
  }

  handlePointerDown(px, py) {
    const ed = this.editor;
    if (ed.currentTool !== 'moveSel') return false;
    if (!ed.selectionMask) {
      ed._showHint('⚠️ 先に選択ツール（矩形/多角形/自動/同色）で範囲を指定してください');
      return true;
    }

    if (px >= 0 && px < ed.width && py >= 0 && py < ed.height && ed.selectionMask[py * ed.width + px]) {
      this._beginMove(px, py);
      return true;
    }
    return false;
  }

  _beginMove(px, py) {
    const ed = this.editor;
    const w = ed.width;
    const h = ed.height;

    this.beforeHistoryState = ed._captureHistoryState ? ed._captureHistoryState() : null;
    this.isMoving = true;
    this.startPx = [px, py];
    this.delta = [0, 0];
    this.origImageData = ed.ctx.getImageData(0, 0, w, h);
    this.origMask = new Uint8Array(ed.selectionMask);

    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = w;
    prevCanvas.height = h;
    const pCtx = prevCanvas.getContext('2d');
    const prevData = pCtx.createImageData(w, h);

    const baseData = ed.ctx.getImageData(0, 0, w, h);
    const fillRgb = ed.targetType === 'deftile'
      ? [0, 0, 0]
      : (ed.targetType === 'aircraftPlan' ? [255, 255, 255] : [231, 255, 255]);

    for (let i = 0; i < w * h; i++) {
      if (this.origMask[i]) {
        const idx = i * 4;
        prevData.data[idx] = this.origImageData.data[idx];
        prevData.data[idx + 1] = this.origImageData.data[idx + 1];
        prevData.data[idx + 2] = this.origImageData.data[idx + 2];
        prevData.data[idx + 3] = this.origImageData.data[idx + 3];

        baseData.data[idx] = fillRgb[0];
        baseData.data[idx + 1] = fillRgb[1];
        baseData.data[idx + 2] = fillRgb[2];
        baseData.data[idx + 3] = 255;
      }
    }

    pCtx.putImageData(prevData, 0, 0);
    ed.ctx.putImageData(baseData, 0, 0);
    this.floatingPreview = prevCanvas;
    ed._drawOverlay();
  }

  handlePointerMove(px, py) {
    if (!this.isMoving) return false;
    const rawDx = px - this.startPx[0];
    const rawDy = py - this.startPx[1];
    const ed = this.editor;
    this.delta = ed.gridSnap ? ed.gridSnap.snapDelta(rawDx, rawDy) : [rawDx, rawDy];
    ed._drawOverlay();
    const snapTag = (ed.gridSnap && ed.gridSnap.enabled) ? ` (スナップ ${ed.gridSnap.stepW}×${ed.gridSnap.stepH})` : '';
    ed._showHint(`↔️ 選択範囲を移動中: ΔX=${this.delta[0]}px, ΔY=${this.delta[1]}px${snapTag}`);
    return true;
  }

  handlePointerUp() {
    if (!this.isMoving) return false;
    const [dx, dy] = this.delta;
    this._commitMove(dx, dy);
    return true;
  }

  nudge(dx, dy) {
    const ed = this.editor;
    if (!ed.selectionMask) return false;
    const stepX = (ed.gridSnap && ed.gridSnap.enabled) ? Math.max(1, ed.gridSnap.stepW) : 1;
    const stepY = (ed.gridSnap && ed.gridSnap.enabled) ? Math.max(1, ed.gridSnap.stepH) : 1;
    const actualDx = dx * stepX;
    const actualDy = dy * stepY;
    if (!this.isMoving) {
      this._beginMove(0, 0);
    }
    this._commitMove(actualDx, actualDy);
    ed._showHint(`↔️ 選択範囲を移動しました (ΔX=${actualDx}px, ΔY=${actualDy}px)`);
    return true;
  }

  _commitMove(dx, dy) {
    const ed = this.editor;
    if (dx === 0 && dy === 0) {
      if (this.origImageData) ed.ctx.putImageData(this.origImageData, 0, 0);
      this.reset();
      ed._drawOverlay();
      ed._updateStatus();
      return;
    }
    if (this.beforeHistoryState) {
      ed._pushHistory(this.beforeHistoryState);
    } else {
      ed._pushHistory();
    }
    const w = ed.width;
    const h = ed.height;
    const imgData = ed.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const newMask = new Uint8Array(w * h);
    let hasAny = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcPos = y * w + x;
        if (!this.origMask[srcPos]) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const dstPos = ny * w + nx;
        newMask[dstPos] = 1;
        hasAny = true;

        const sIdx = srcPos * 4;
        const dIdx = dstPos * 4;
        d[dIdx] = this.origImageData.data[sIdx];
        d[dIdx + 1] = this.origImageData.data[sIdx + 1];
        d[dIdx + 2] = this.origImageData.data[sIdx + 2];
        d[dIdx + 3] = this.origImageData.data[sIdx + 3];
      }
    }

    ed.selectionMask = hasAny ? newMask : null;

    if (ed.repeatMgr && ed.repeatMgr.isActive() && ed.selectionMask) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const pIdx = y * w + x;
          if (!ed.selectionMask[pIdx]) continue;
          const idx = pIdx * 4;
          for (let k = 1; k <= ed.repeatMgr.count; k++) {
            const ty = y - k * ed.repeatMgr.stepY;
            if (ty < 0 || ty >= h) break;
            const tPos = ty * w + x;
            if (!ed.selectionMask[tPos]) {
              const tIdx = tPos * 4;
              d[tIdx] = d[idx];
              d[tIdx + 1] = d[idx + 1];
              d[tIdx + 2] = d[idx + 2];
              d[tIdx + 3] = d[idx + 3];
            }
          }
        }
      }
    }

    ed.ctx.putImageData(imgData, 0, 0);
    this.reset();
    ed._drawOverlay();
    ed._updateStatus();
  }

  drawMovingOverlay(oCtx) {
    if (!this.isMoving || !this.floatingPreview || !this.origMask) return;
    const [dx, dy] = this.delta;
    const w = this.editor.width;
    const h = this.editor.height;

    oCtx.imageSmoothingEnabled = false;
    oCtx.drawImage(this.floatingPreview, dx, dy);

    let lastStyle = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcPos = y * w + x;
        if (!this.origMask[srcPos]) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const isEdge =
          x === 0 || !this.origMask[srcPos - 1] ||
          x === w - 1 || !this.origMask[srcPos + 1] ||
          y === 0 || !this.origMask[srcPos - w] ||
          y === h - 1 || !this.origMask[srcPos + w];

        const style = getSelectionOverlayStyle(nx, ny, isEdge);
        if (style !== lastStyle) {
          oCtx.fillStyle = style;
          lastStyle = style;
        }
        oCtx.fillRect(nx, ny, 1, 1);
      }
    }
  }
}
