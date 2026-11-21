// ペイントエディタ用 画像トリミング（選択範囲切り抜き・余白自動除去・数値範囲指定・マスク連動）モジュール
import { getSelectionBounds } from './paint-flip.js';
import { parseHexColor } from './color-utils.js';

// 指定ピクセル配列から余白を除いた外接矩形を算出する
export function computeAutoTrimBounds(rgbaData, width, height, {
  trimE7ffff = true,
  trimTransparent = true,
  trimCornerColor = false,
  margin = 0
} = {}) {
  if (!rgbaData || width <= 0 || height <= 0) {
    return { x: 0, y: 0, w: width || 1, h: height || 1, empty: true };
  }

  const cornerR = rgbaData[0];
  const cornerG = rgbaData[1];
  const cornerB = rgbaData[2];
  const cornerA = rgbaData[3];

  const isMarginPixel = (idx) => {
    const r = rgbaData[idx];
    const g = rgbaData[idx + 1];
    const b = rgbaData[idx + 2];
    const a = rgbaData[idx + 3];
    if (trimTransparent && a === 0) return true;
    if (trimE7ffff && r === 231 && g === 255 && b === 255 && a > 0) return true;
    if (trimCornerColor && r === cornerR && g === cornerG && b === cornerB && a === cornerA) return true;
    return false;
  };

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (!isMarginPixel(idx)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, w: width, h: height, empty: true };
  }

  const pad = Math.max(0, parseInt(margin, 10) || 0);
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(width - 1, maxX + pad);
  const y1 = Math.min(height - 1, maxY + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, empty: false };
}

// ソース画像またはCanvasから矩形 (x, y, w, h) を切り抜いた新しいCanvasを作成する
export function cropCanvasRect(srcSource, x, y, w, h, {
  selectionMask = null,
  srcW = 0,
  srcH = 0,
  clearOutsideSelection = false,
  outsideFillHex = '#E7FFFF'
} = {}) {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcSource, x, y, w, h, 0, 0, w, h);

  if (clearOutsideSelection && selectionMask && srcW > 0 && srcH > 0) {
    const [fr, fg, fb, fa] = parseHexColor(outsideFillHex);
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let dy = 0; dy < h; dy++) {
      const sy = y + dy;
      for (let dx = 0; dx < w; dx++) {
        const sx = x + dx;
        if (sx < 0 || sx >= srcW || sy < 0 || sy >= srcH || !selectionMask[sy * srcW + sx]) {
          const idx = (dy * w + dx) * 4;
          d[idx] = fr;
          d[idx + 1] = fg;
          d[idx + 2] = fb;
          d[idx + 3] = fa;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return out;
}

// トリミング・サイズ変更の前後でベース画像および複数マスク画像を履歴保存・復元する補助関数
export function captureTrimHistorySnapshots(editor) {
  const app = editor.app;
  if (!app) return null;
  const baseSnap = (editor.targetType === 'mask' && app.baseImage)
    ? cropCanvasRect(app.baseImage, 0, 0, app.baseW || app.baseImage.naturalWidth || app.baseImage.width, app.baseH || app.baseImage.naturalHeight || app.baseImage.height)
    : null;
  const maskEntries = (app.maskMgr && app.maskMgr.items.length > 0)
    ? app.maskMgr.items.map(it => ({
      id: it.id,
      name: it.name,
      image: it.image ? cropCanvasRect(it.image, 0, 0, it.image.naturalWidth || it.image.width, it.image.naturalHeight || it.image.height) : null
    }))
    : null;
  return { baseSnap, maskEntries };
}

export function restoreTrimHistorySnapshots(editor, snaps) {
  const app = editor.app;
  if (!snaps || !app) return;
  if (snaps.baseSnap && editor.targetType === 'mask') {
    app.applyBaseImage(snaps.baseSnap, app.baseName, { resetMask: false, resetDat: false, isTransform: true });
  }
  if (snaps.maskEntries && app.maskMgr) {
    snaps.maskEntries.forEach((entry, idx) => {
      const item = app.maskMgr.items[idx];
      if (item && entry.image) {
        item.image = entry.image;
        item.name = entry.name;
      }
    });
    const active = app.maskMgr.getActive();
    if (active && active.image) app.applyMaskImage(active.image, active.name);
  }
}

export class PaintTrimController {
  constructor(editor) {
    this.editor = editor;
    this.bound = false;
    this.lastComputed = { x: 0, y: 0, w: 1, h: 1 };
  }

  bindEvents() {
    const modal = document.getElementById('modal-trim-image');
    if (!modal || this.bound) return;
    this.bound = true;

    const onModeOrOptChange = () => this._updatePreviewFromUI();
    document.querySelectorAll('input[name="trim-mode"]').forEach(r => {
      r.addEventListener('change', onModeOrOptChange);
    });
    ['chk-trim-e7ffff', 'chk-trim-transparent', 'chk-trim-corner', 'inp-trim-margin',
      'chk-trim-clear-outside', 'sel-trim-outside-fill'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', onModeOrOptChange);
        el.addEventListener('change', onModeOrOptChange);
      }
    });

    // 座標・サイズ指定と上下左右カット量を双方向連動させる
    ['inp-trim-x', 'inp-trim-y', 'inp-trim-w', 'inp-trim-h'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this._syncCutsFromRectInputs());
    });
    ['inp-trim-cut-top', 'inp-trim-cut-bottom', 'inp-trim-cut-left', 'inp-trim-cut-right'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this._syncRectFromCutInputs());
    });

    document.getElementById('btn-trim-ok')?.addEventListener('click', () => this.applyTrim());
    document.getElementById('btn-trim-cancel')?.addEventListener('click', () => modal.close());
  }

  openDialog() {
    const ed = this.editor;
    if (!ed.canvas || ed.width <= 0 || ed.height <= 0) return;
    if (ed.clipMgr && ed.clipMgr.floatingLayer) ed.clipMgr.commitFloatingLayer();

    const modal = document.getElementById('modal-trim-image');
    if (!modal) return;
    this.bindEvents();

    const curLbl = document.getElementById('lbl-trim-current');
    if (curLbl) curLbl.textContent = `現在のサイズ: ${ed.width} × ${ed.height} px`;

    const selBounds = ed.selectionMask ? getSelectionBounds(ed.selectionMask, ed.width, ed.height) : null;
    const radioSel = document.querySelector('input[name="trim-mode"][value="selection"]');
    const radioAuto = document.querySelector('input[name="trim-mode"][value="auto"]');
    const selInfo = document.getElementById('lbl-trim-selection-info');
    if (radioSel) radioSel.disabled = !selBounds;
    if (selInfo) {
      selInfo.textContent = selBounds
        ? `選択範囲: ${selBounds.w}×${selBounds.h}px (起点: ${selBounds.minX}, ${selBounds.minY})`
        : '選択範囲なし（選択ツールで範囲指定すると利用できます）';
    }

    if (selBounds && radioSel) radioSel.checked = true;
    else if (radioAuto) radioAuto.checked = true;

    const autoBounds = this._computeCurrentAutoBounds();
    const initRect = selBounds
      ? { x: selBounds.minX, y: selBounds.minY, w: selBounds.w, h: selBounds.h }
      : (!autoBounds.empty ? autoBounds : { x: 0, y: 0, w: ed.width, h: ed.height });
    this._writeRectAndCutInputs(initRect);

    const rowSync = document.getElementById('row-trim-sync-mask');
    const lblSync = document.getElementById('lbl-trim-sync-mask');
    const chkSync = document.getElementById('chk-trim-sync-mask');
    if (rowSync) {
      const needSync = (ed.targetType === 'base' && Boolean(ed.app?.maskImage)) ||
        (ed.targetType === 'mask' && Boolean(ed.app?.baseImage));
      rowSync.style.display = needSync ? 'flex' : 'none';
      if (lblSync) {
        lblSync.textContent = ed.targetType === 'mask'
          ? 'ベース画像・他マスク画像も同範囲で連動トリミング（サイズ整合維持）'
          : '登録済みのマスク画像も同範囲で連動トリミング（サイズ整合維持）';
      }
      if (chkSync) chkSync.checked = true;
    }

    this._updatePreviewFromUI();
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  _computeCurrentAutoBounds() {
    const ed = this.editor;
    const px = ed.ctx.getImageData(0, 0, ed.width, ed.height).data;
    return computeAutoTrimBounds(px, ed.width, ed.height, {
      trimE7ffff: Boolean(document.getElementById('chk-trim-e7ffff')?.checked ?? true),
      trimTransparent: Boolean(document.getElementById('chk-trim-transparent')?.checked ?? true),
      trimCornerColor: Boolean(document.getElementById('chk-trim-corner')?.checked ?? false),
      margin: parseInt(document.getElementById('inp-trim-margin')?.value, 10) || 0
    });
  }

  _clampRect(raw) {
    const ed = this.editor;
    const x = Math.max(0, Math.min(ed.width - 1, Math.trunc(raw.x) || 0));
    const y = Math.max(0, Math.min(ed.height - 1, Math.trunc(raw.y) || 0));
    const w = Math.max(1, Math.min(ed.width - x, Math.trunc(raw.w) || 1));
    const h = Math.max(1, Math.min(ed.height - y, Math.trunc(raw.h) || 1));
    return { x, y, w, h };
  }

  _writeRectAndCutInputs(rect) {
    const ed = this.editor;
    const r = this._clampRect(rect);
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    setV('inp-trim-x', r.x);
    setV('inp-trim-y', r.y);
    setV('inp-trim-w', r.w);
    setV('inp-trim-h', r.h);
    setV('inp-trim-cut-left', r.x);
    setV('inp-trim-cut-top', r.y);
    setV('inp-trim-cut-right', Math.max(0, ed.width - (r.x + r.w)));
    setV('inp-trim-cut-bottom', Math.max(0, ed.height - (r.y + r.h)));
  }

  _syncCutsFromRectInputs() {
    const ed = this.editor;
    const getN = (id, fb) => { const n = parseInt(document.getElementById(id)?.value, 10); return Number.isFinite(n) ? n : fb; };
    const r = this._clampRect({
      x: getN('inp-trim-x', 0),
      y: getN('inp-trim-y', 0),
      w: getN('inp-trim-w', ed.width),
      h: getN('inp-trim-h', ed.height)
    });
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    setV('inp-trim-cut-left', r.x);
    setV('inp-trim-cut-top', r.y);
    setV('inp-trim-cut-right', Math.max(0, ed.width - (r.x + r.w)));
    setV('inp-trim-cut-bottom', Math.max(0, ed.height - (r.y + r.h)));
    const radioManual = document.querySelector('input[name="trim-mode"][value="manual"]');
    if (radioManual) radioManual.checked = true;
    this._updatePreviewFromUI();
  }

  _syncRectFromCutInputs() {
    const ed = this.editor;
    const getN = (id) => Math.max(0, parseInt(document.getElementById(id)?.value, 10) || 0);
    const cutL = getN('inp-trim-cut-left');
    const cutT = getN('inp-trim-cut-top');
    const cutR = getN('inp-trim-cut-right');
    const cutB = getN('inp-trim-cut-bottom');
    const x = Math.min(ed.width - 1, cutL);
    const y = Math.min(ed.height - 1, cutT);
    const w = Math.max(1, ed.width - x - cutR);
    const h = Math.max(1, ed.height - y - cutB);
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    setV('inp-trim-x', x);
    setV('inp-trim-y', y);
    setV('inp-trim-w', w);
    setV('inp-trim-h', h);
    const radioManual = document.querySelector('input[name="trim-mode"][value="manual"]');
    if (radioManual) radioManual.checked = true;
    this._updatePreviewFromUI();
  }

  _getActiveMode() {
    return document.querySelector('input[name="trim-mode"]:checked')?.value || 'auto';
  }

  _updatePreviewFromUI() {
    const ed = this.editor;
    const mode = this._getActiveMode();
    const selOpts = document.getElementById('trim-selection-opts');
    const autoOpts = document.getElementById('trim-auto-opts');
    const manOpts = document.getElementById('trim-manual-opts');
    if (selOpts) selOpts.style.display = mode === 'selection' ? 'flex' : 'none';
    if (autoOpts) autoOpts.style.display = mode === 'auto' ? 'flex' : 'none';
    if (manOpts) manOpts.style.display = mode === 'manual' ? 'flex' : 'none';

    let rect = { x: 0, y: 0, w: ed.width, h: ed.height };
    let note = '';
    if (mode === 'selection') {
      const b = ed.selectionMask ? getSelectionBounds(ed.selectionMask, ed.width, ed.height) : null;
      if (b) rect = { x: b.minX, y: b.minY, w: b.w, h: b.h };
    } else if (mode === 'auto') {
      const auto = this._computeCurrentAutoBounds();
      rect = { x: auto.x, y: auto.y, w: auto.w, h: auto.h };
      if (auto.empty) note = '（※余白以外のピクセルが検出されませんでした）';
    } else {
      const getN = (id, fb) => { const n = parseInt(document.getElementById(id)?.value, 10); return Number.isFinite(n) ? n : fb; };
      rect = this._clampRect({
        x: getN('inp-trim-x', 0),
        y: getN('inp-trim-y', 0),
        w: getN('inp-trim-w', ed.width),
        h: getN('inp-trim-h', ed.height)
      });
    }

    this.lastComputed = this._clampRect(rect);
    const lbl = document.getElementById('lbl-trim-preview');
    if (lbl) {
      const r = this.lastComputed;
      lbl.textContent = `トリミング後: ${r.w} × ${r.h} px (X:${r.x}, Y:${r.y}) ${note}`;
    }
  }

  applyTrim() {
    const ed = this.editor;
    const mode = this._getActiveMode();
    this._updatePreviewFromUI();
    const { x, y, w, h } = this.lastComputed;
    if (w <= 0 || h <= 0) return;

    const clearOutside = mode === 'selection' && Boolean(document.getElementById('chk-trim-clear-outside')?.checked);
    const outsideFillHex = document.getElementById('sel-trim-outside-fill')?.value || '#E7FFFF';
    const syncMask = Boolean(document.getElementById('chk-trim-sync-mask')?.checked ?? true);

    ed._pushHistory();
    const oldW = ed.width;
    const oldH = ed.height;
    const trimmed = cropCanvasRect(ed.canvas, x, y, w, h, {
      selectionMask: ed.selectionMask,
      srcW: oldW,
      srcH: oldH,
      clearOutsideSelection: clearOutside,
      outsideFillHex
    });

    ed.width = w;
    ed.height = h;
    ed.canvas.width = w;
    ed.canvas.height = h;
    ed.overlayCanvas.width = w;
    ed.overlayCanvas.height = h;
    ed.ctx.imageSmoothingEnabled = false;
    ed.ctx.drawImage(trimmed, 0, 0);

    if (syncMask && (ed.targetType === 'base' || ed.targetType === 'mask')) {
      ed.app.baseW = w;
      ed.app.baseH = h;
      if (ed.targetType === 'mask' && ed.app.baseImage) {
        const croppedBase = cropCanvasRect(ed.app.baseImage, x, y, w, h);
        ed.app.applyBaseImage(croppedBase, ed.app.baseName, { resetMask: false, resetDat: false, isTransform: true });
      }
      if (ed.app.maskMgr && ed.app.maskMgr.items.length > 0) {
        ed.app.maskMgr.items.forEach((item, idx) => {
          if (ed.targetType === 'mask' && idx === ed.app.maskMgr.activeIndex) {
            item.image = cropCanvasRect(ed.canvas, 0, 0, w, h);
          } else if (item.image) {
            item.image = cropCanvasRect(item.image, x, y, w, h);
          }
        });
        const cur = ed.app.maskMgr.getActive();
        if (cur && cur.image) ed.app.applyMaskImage(cur.image, cur.name);
      } else if (ed.targetType === 'base' && ed.app.maskImage) {
        ed.app.applyMaskImage(cropCanvasRect(ed.app.maskImage, x, y, w, h), ed.app.maskName);
      }
    }

    ed.selectionMask = null;
    ed.polyPoints = [];
    if (ed.selMover) ed.selMover.reset();
    ed._updateTransform();
    ed._drawOverlay();
    ed._updateStatus();
    document.getElementById('modal-trim-image')?.close();
    ed._showHint(`✂️ 画像を ${w}×${h}px (起点 X:${x}, Y:${y}) にトリミングしました`);
  }
}
