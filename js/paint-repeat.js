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

  // ドット単位描画（選択範囲内のピクセル描画と同時に、選択範囲外の上方指定pxおきに反復描画）
  // 32bit編集時で既存ピクセルが半透明(0 < alpha < 255)の場合は元のアルファを維持し、透明(0)または不透明(255)の場合はalpha=255で描画
  drawPixel(x, y) {
    const ed = this.editor;
    if (x < 0 || x >= ed.width || y < 0 || y >= ed.height) return;
    if (ed.selectionMask && !ed.selectionMask[y * ed.width + x]) return;

    this._writeColorPreservingSemiAlpha(x, y);

    if (this.isActive()) {
      for (let k = 1; k <= this.count; k++) {
        const ty = y - k * this.stepY;
        if (ty < 0 || ty >= ed.height) break;
        if (!ed.selectionMask[ty * ed.width + x]) {
          this._writeColorPreservingSemiAlpha(x, ty);
        }
      }
    }
  }

  _writeColorPreservingSemiAlpha(x, y) {
    const ed = this.editor;
    const hex = (ed.currentColor || '#FFFFFF').replace('#', '');
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const img = ed.ctx.getImageData(x, y, 1, 1);
    const d = img.data;
    const origA = d[3];
    // 元のピクセルが半透明 (1〜254) の場合は32bitアルファ値を消さずに維持する
    d[0] = r;
    d[1] = g;
    d[2] = b;
    d[3] = (origA > 0 && origA < 255) ? origA : 255;
    ed.ctx.putImageData(img, x, y);
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