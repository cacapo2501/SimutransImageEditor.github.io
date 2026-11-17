// 描画・選択ツールのグリッドスナップ管理モジュール

const POINT_SNAP_TOOLS = new Set([
  'pencil',
  'line',
  'polySelect',
  'text',
  'wand',
  'colorSelect'
]);

const RECT_SNAP_TOOLS = new Set(['rectFill', 'rectSelect']);

export class PaintGridSnapManager {
  constructor(editor) {
    this.editor = editor;
    this.enabled = false;
    this.stepW = 16;
    this.stepH = 16;
  }

  // ツールバーのグリッドスナップUIイベントをバインド
  bindEvents() {
    const chk = document.getElementById('chk-paint-snap-grid');
    const selPreset = document.getElementById('sel-paint-snap-preset');
    const inpW = document.getElementById('inp-paint-snap-w');
    const inpH = document.getElementById('inp-paint-snap-h');

    const syncPreset = () => {
      if (!selPreset) return;
      const key = `${this.stepW}x${this.stepH}`;
      const hasOption = Array.from(selPreset.options).some(opt => opt.value === key);
      selPreset.value = hasOption ? key : 'custom';
    };

    if (chk) {
      chk.onchange = (e) => {
        this.enabled = e.target.checked;
        this.editor._drawOverlay();
        this.editor._updateStatus();
      };
    }

    if (selPreset) {
      selPreset.onchange = (e) => {
        const val = e.target.value;
        if (val === 'custom') return;
        const [wStr, hStr] = val.split('x');
        const w = parseInt(wStr, 10);
        const h = parseInt(hStr, 10);
        if (w >= 1 && h >= 1) {
          this.stepW = w;
          this.stepH = h;
          if (inpW) inpW.value = w;
          if (inpH) inpH.value = h;
          this.editor._drawOverlay();
          this.editor._updateStatus();
        }
      };
    }

    if (inpW) {
      inpW.oninput = (e) => {
        this.stepW = Math.max(1, Math.min(512, parseInt(e.target.value, 10) || 16));
        syncPreset();
        this.editor._drawOverlay();
        this.editor._updateStatus();
      };
    }

    if (inpH) {
      inpH.oninput = (e) => {
        this.stepH = Math.max(1, Math.min(512, parseInt(e.target.value, 10) || 16));
        syncPreset();
        this.editor._drawOverlay();
        this.editor._updateStatus();
      };
    }
  }

  // 指定ツールが点座標スナップ対象か判定（塗りつぶし・スポイト・ハンドは対象外）
  isPointSnapTool(toolName) {
    return this.enabled && POINT_SNAP_TOOLS.has(toolName);
  }

  // 指定ツールが矩形セルスナップ対象か判定
  isRectSnapTool(toolName) {
    return this.enabled && RECT_SNAP_TOOLS.has(toolName);
  }

  // 点座標を最寄りのグリッド交点へスナップ（画像範囲内にクランプ）
  snapPoint(px, py) {
    const ed = this.editor;
    if (!this.enabled) return [px, py];
    const sw = Math.max(1, this.stepW);
    const sh = Math.max(1, this.stepH);
    const sx = Math.max(0, Math.min(ed.width - 1, Math.round(px / sw) * sw));
    const sy = Math.max(0, Math.min(ed.height - 1, Math.round(py / sh) * sh));
    return [sx, sy];
  }

  // ツール種別に応じて必要な場合のみ点座標をスナップ
  snapForTool(toolName, px, py) {
    if (!this.isPointSnapTool(toolName)) return [px, py];
    return this.snapPoint(px, py);
  }

  // 始点と終点から矩形範囲を計算（スナップ有効時はグリッドセル単位に整列）
  computeRectBounds(startPos, endPos) {
    const ed = this.editor;
    const clampX = (x) => Math.max(0, Math.min(ed.width - 1, x));
    const clampY = (y) => Math.max(0, Math.min(ed.height - 1, y));

    const sx = clampX(startPos[0]);
    const sy = clampY(startPos[1]);
    const ex = clampX(endPos[0]);
    const ey = clampY(endPos[1]);

    if (!this.enabled) {
      return {
        x0: Math.min(sx, ex),
        x1: Math.max(sx, ex),
        y0: Math.min(sy, ey),
        y1: Math.max(sy, ey)
      };
    }

    const sw = Math.max(1, this.stepW);
    const sh = Math.max(1, this.stepH);
    const cx0 = Math.floor(sx / sw);
    const cy0 = Math.floor(sy / sh);
    const cx1 = Math.floor(ex / sw);
    const cy1 = Math.floor(ey / sh);

    const minCx = Math.min(cx0, cx1);
    const maxCx = Math.max(cx0, cx1);
    const minCy = Math.min(cy0, cy1);
    const maxCy = Math.max(cy0, cy1);

    return {
      x0: minCx * sw,
      x1: Math.min(ed.width - 1, (maxCx + 1) * sw - 1),
      y0: minCy * sh,
      y1: Math.min(ed.height - 1, (maxCy + 1) * sh - 1)
    };
  }

  // 移動量(dx, dy)をグリッド間隔単位にスナップ
  snapDelta(dx, dy) {
    if (!this.enabled) return [dx, dy];
    const sw = Math.max(1, this.stepW);
    const sh = Math.max(1, this.stepH);
    return [Math.round(dx / sw) * sw, Math.round(dy / sh) * sh];
  }
}
