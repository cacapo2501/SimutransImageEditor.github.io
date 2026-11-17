import { getSelectionBounds } from './paint-flip.js';

// 選択マスクが隙間・欠けのない矩形であるかを判定し、境界を返す
export function isRectangularSelection(mask, width, height) {
  if (!mask || width <= 0 || height <= 0) return null;
  const bounds = getSelectionBounds(mask, width, height);
  if (!bounds) return null;
  const { minX, minY, maxX, maxY } = bounds;
  for (let y = minY; y <= maxY; y++) {
    const row = y * width;
    for (let x = minX; x <= maxX; x++) {
      if (!mask[row + x]) return null;
    }
  }
  return bounds;
}

// タブレット端末での矩形選択(新規)用・四隅リサイズ制御点コントローラ
export class PaintRectHandlesController {
  constructor(editor) {
    this.editor = editor;
    this.isResizing = false;
    this.activeCorner = null;
    this.anchor = [0, 0];
    this.previewBounds = null;
  }

  reset() {
    this.isResizing = false;
    this.activeCorner = null;
    this.previewBounds = null;
    this.updateUI();
  }

  // 四隅制御点を表示すべき条件を満たしているか判定
  _getActiveBounds() {
    const ed = this.editor;
    if (!ed.modal || !ed.modal.open) return null;
    if (ed.currentTool !== 'rectSelect') return null;
    if (ed.selectionMode !== 'replace') return null;
    if (!ed.isTouchMode) return null;
    if (ed.clipMgr?.floatingLayer) return null;
    if (ed.selMover?.isMoving) return null;

    if (this.isResizing && this.previewBounds) {
      return this.previewBounds;
    }
    if (ed.isDrawing) return null;
    return isRectangularSelection(ed.selectionMask, ed.width, ed.height);
  }

  // ビューポート座標系での四隅ハンドル座標を計算
  _getCornerViewportPositions(bounds) {
    const ed = this.editor;
    const z = ed.zoomLevel;
    let left = ed.panX + bounds.minX * z;
    let top = ed.panY + bounds.minY * z;
    let right = ed.panX + (bounds.maxX + 1) * z;
    let bottom = ed.panY + (bounds.maxY + 1) * z;

    // 選択範囲が画面上で小さい場合でも指で掴みやすいよう外側に最低限の間隔を確保
    const minSpan = 20;
    if (right - left < minSpan) {
      const padX = (minSpan - (right - left)) / 2;
      left -= padX;
      right += padX;
    }
    if (bottom - top < minSpan) {
      const padY = (minSpan - (bottom - top)) / 2;
      top -= padY;
      bottom += padY;
    }

    return {
      tl: [left, top],
      tr: [right, top],
      bl: [left, bottom],
      br: [right, bottom]
    };
  }

  // 四隅ハンドルのDOM表示・位置を更新
  updateUI() {
    const wrap = document.getElementById('paint-rect-handles');
    if (!wrap) return;

    const bounds = this._getActiveBounds();
    if (!bounds) {
      wrap.style.display = 'none';
      return;
    }

    const corners = this._getCornerViewportPositions(bounds);
    wrap.style.display = 'block';
    for (const key of ['tl', 'tr', 'bl', 'br']) {
      const el = wrap.querySelector(`.paint-rect-handle[data-corner="${key}"]`);
      if (!el) continue;
      const [cx, cy] = corners[key];
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      el.classList.toggle('active', this.isResizing && this.activeCorner === key);
    }
  }

  // タッチ開始時に四隅ハンドルへのヒット判定を行い、該当すればリサイズ開始
  handleTouchStart(clientX, clientY) {
    const bounds = this._getActiveBounds();
    if (!bounds || this.isResizing) return false;

    const vp = this.editor.viewport;
    if (!vp) return false;
    const rect = vp.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    const corners = this._getCornerViewportPositions(bounds);
    const hitRadius = 28;
    let bestKey = null;
    let bestDist = Infinity;

    for (const [key, [cx, cy]] of Object.entries(corners)) {
      const d = Math.hypot(vx - cx, vy - cy);
      if (d <= hitRadius && d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }

    if (!bestKey) return false;

    // 操作対象の対角にある頂点を固定アンカーとして保持
    const anchorMap = {
      tl: [bounds.maxX, bounds.maxY],
      tr: [bounds.minX, bounds.maxY],
      bl: [bounds.maxX, bounds.minY],
      br: [bounds.minX, bounds.minY]
    };

    this.isResizing = true;
    this.activeCorner = bestKey;
    this.anchor = anchorMap[bestKey];
    this.previewBounds = { ...bounds };
    this.updateUI();
    this.editor._drawOverlay();
    return true;
  }

  // タッチ移動中に選択範囲のプレビュー矩形を更新
  handleTouchMove(px, py) {
    if (!this.isResizing) return false;
    const ed = this.editor;
    const cx = Math.max(0, Math.min(ed.width - 1, px));
    const cy = Math.max(0, Math.min(ed.height - 1, py));
    const [ax, ay] = this.anchor;

    let x0, x1, y0, y1;
    if (ed.gridSnap && ed.gridSnap.enabled) {
      const sw = Math.max(1, ed.gridSnap.stepW);
      const sh = Math.max(1, ed.gridSnap.stepH);
      if (cx >= ax) {
        x0 = ax;
        x1 = Math.max(x0, Math.min(ed.width - 1, (Math.floor(cx / sw) + 1) * sw - 1));
      } else {
        x0 = Math.floor(cx / sw) * sw;
        x1 = ax;
      }
      if (cy >= ay) {
        y0 = ay;
        y1 = Math.max(y0, Math.min(ed.height - 1, (Math.floor(cy / sh) + 1) * sh - 1));
      } else {
        y0 = Math.floor(cy / sh) * sh;
        y1 = ay;
      }
    } else {
      x0 = Math.min(ax, cx);
      x1 = Math.max(ax, cx);
      y0 = Math.min(ay, cy);
      y1 = Math.max(ay, cy);
    }

    this.previewBounds = { minX: x0, minY: y0, maxX: x1, maxY: y1 };
    ed._drawOverlay();
    ed._showHint(`📐 矩形選択変更中: ${x1 - x0 + 1}×${y1 - y0 + 1}px (${x0},${y0})-(${x1},${y1})`);
    return true;
  }

  // タッチ終了時にリサイズ後の矩形選択マスクを確定
  handleTouchEnd() {
    if (!this.isResizing) return false;
    const ed = this.editor;
    const b = this.previewBounds;
    this.isResizing = false;
    this.activeCorner = null;
    this.previewBounds = null;

    if (b) {
      const newMask = new Uint8Array(ed.width * ed.height);
      for (let y = b.minY; y <= b.maxY; y++) {
        const row = y * ed.width;
        for (let x = b.minX; x <= b.maxX; x++) {
          newMask[row + x] = 1;
        }
      }
      ed.selectionMask = newMask;
    }

    ed._drawOverlay();
    ed._updateStatus();
    return true;
  }
}
