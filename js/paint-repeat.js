import { parseHexColor, colorHexToCss } from './color-utils.js';

export class PaintRepeatManager {
  constructor(editor) {
    this.editor = editor;
    this.enabled = false;
    this.stepY = 8;
    this.count = 3;
  }

  bindEvents() {
    const chk = document.getElementById('chk-paint-repeat-up');
    const inpStep = document.getElementById('inp-paint-repeat-step');
    const inpCount = document.getElementById('inp-paint-repeat-count');

    if (chk) {
      chk.onchange = (e) => {
        this.enabled = e.target.checked;
        this.editor._drawOverlay();
        this.editor._updateStatus();
      };
    }

    if (inpStep) {
      inpStep.oninput = (e) => {
        this.stepY = Math.max(1, Math.min(512, parseInt(e.target.value, 10) || 8));
        this.editor._drawOverlay();
        this.editor._updateStatus();
      };
    }

    if (inpCount) {
      inpCount.oninput = (e) => {
        this.count = Math.max(1, Math.min(64, parseInt(e.target.value, 10) || 1));
        this.editor._drawOverlay();
        this.editor._updateStatus();
      };
    }
  }

  isActive() {
    return Boolean(this.enabled && this.editor.selectionMask && this.stepY >= 1 && this.count >= 1);
  }

  // ドット単位描画（GPUコマンドのみで超高速にRGBA上書き・選択範囲外の上方指定pxおきに反復描画）
  drawPixel(x, y) {
    const ed = this.editor;
    if (x < 0 || x >= ed.width || y < 0 || y >= ed.height) return;
    if (ed.selectionMask && !ed.selectionMask[y * ed.width + x]) return;

    const [, , , a] = parseHexColor(ed.currentColor);
    const fillCss = colorHexToCss(ed.currentColor);
    if (a < 255) {
      ed.ctx.clearRect(x, y, 1, 1);
    }
    if (a > 0) {
      ed.ctx.fillStyle = fillCss;
      ed.ctx.fillRect(x, y, 1, 1);
    }

    if (this.isActive()) {
      for (let k = 1; k <= this.count; k++) {
        const ty = y - k * this.stepY;
        if (ty < 0 || ty >= ed.height) break;
        if (!ed.selectionMask[ty * ed.width + x]) {
          if (a < 255) ed.ctx.clearRect(x, ty, 1, 1);
          if (a > 0) {
            ed.ctx.fillStyle = fillCss;
            ed.ctx.fillRect(x, ty, 1, 1);
          }
        }
      }
    }
  }

  // 矩形一括塗りつぶし（大きな矩形でもImageDataの連打によるフリーズを起こさず一瞬でRGBA書き込み）
  drawRect(x0, y0, x1, y1) {
    const ed = this.editor;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;

    const [r, g, b, a] = parseHexColor(ed.currentColor);
    const fillCss = colorHexToCss(ed.currentColor);

    if (!ed.selectionMask) {
      if (a < 255) ed.ctx.clearRect(x0, y0, w, h);
      if (a > 0) {
        ed.ctx.fillStyle = fillCss;
        ed.ctx.fillRect(x0, y0, w, h);
      }
      return;
    }

    const imgData = ed.ctx.getImageData(0, 0, ed.width, ed.height);
    const d = imgData.data;
    const mask = ed.selectionMask;
    const repeatOn = this.isActive();

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const pos = y * ed.width + x;
        if (!mask[pos]) continue;
        const idx = pos * 4;
        d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = a;

        if (repeatOn) {
          for (let k = 1; k <= this.count; k++) {
            const ty = y - k * this.stepY;
            if (ty < 0 || ty >= ed.height) break;
            const tPos = ty * ed.width + x;
            if (!mask[tPos]) {
              const tIdx = tPos * 4;
              d[tIdx] = r; d[tIdx + 1] = g; d[tIdx + 2] = b; d[tIdx + 3] = a;
            }
          }
        }
      }
    }
    ed.ctx.putImageData(imgData, 0, 0);
  }

  // 一括ピクセル操作前のスナップショット取得
  snapshotBefore() {
    if (!this.isActive()) return null;
    const ed = this.editor;
    return ed.ctx.getImageData(0, 0, ed.width, ed.height).data;
  }

  // 一括ピクセル操作後（塗りつぶし・色置換・貼付確定）の差分を上方リピート先へ転写
  applyDiff(beforeData) {
    if (!beforeData || !this.isActive()) return;
    const ed = this.editor;
    const w = ed.width;
    const h = ed.height;
    const mask = ed.selectionMask;
    const imgData = ed.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    let modified = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pIdx = y * w + x;
        if (!mask[pIdx]) continue;

        const idx = pIdx * 4;
        if (
          d[idx] !== beforeData[idx] ||
          d[idx + 1] !== beforeData[idx + 1] ||
          d[idx + 2] !== beforeData[idx + 2] ||
          d[idx + 3] !== beforeData[idx + 3]
        ) {
          for (let k = 1; k <= this.count; k++) {
            const ty = y - k * this.stepY;
            if (ty < 0 || ty >= h) break;
            const tPos = ty * w + x;
            if (!mask[tPos]) {
              const tIdx = tPos * 4;
              d[tIdx] = d[idx];
              d[tIdx + 1] = d[idx + 1];
              d[tIdx + 2] = d[idx + 2];
              d[tIdx + 3] = d[idx + 3];
              modified = true;
            }
          }
        }
      }
    }

    if (modified) {
      ed.ctx.putImageData(imgData, 0, 0);
    }
  }

  // オーバーレイに上方リピート先の領域プレビューを描画
  drawOverlay(oCtx) {
    if (!this.isActive()) return;
    const ed = this.editor;
    const w = ed.width;
    const h = ed.height;
    const mask = ed.selectionMask;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!mask[idx]) continue;

        const isEdge =
          x === 0 || !mask[idx - 1] ||
          x === w - 1 || !mask[idx + 1] ||
          y === 0 || !mask[idx - w] ||
          y === h - 1 || !mask[idx + w];

        oCtx.fillStyle = isEdge ? 'rgba(255, 136, 0, 0.75)' : 'rgba(255, 136, 0, 0.16)';

        for (let k = 1; k <= this.count; k++) {
          const ty = y - k * this.stepY;
          if (ty < 0 || ty >= h) break;
          if (!mask[ty * w + x]) {
            oCtx.fillRect(x, ty, 1, 1);
          }
        }
      }
    }
  }
}