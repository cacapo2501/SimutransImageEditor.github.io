export function cloneCanvasFromSource(src) {
  if (!src) return null;
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  return c;
}

export function resizeSourceCanvas(srcSource, oldW, oldH, newW, newH, mode, anchor, fillHex = '#E7FFFF') {
  const out = document.createElement('canvas');
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (mode === 'scale') {
    ctx.drawImage(srcSource, 0, 0, oldW, oldH, 0, 0, newW, newH);
    return out;
  }

  ctx.fillStyle = fillHex;
  ctx.fillRect(0, 0, newW, newH);

  let dx = 0, dy = 0;
  if (anchor === 'bottom-center') {
    dx = Math.floor((newW - oldW) / 2);
    dy = newH - oldH;
  } else if (anchor === 'center') {
    dx = Math.floor((newW - oldW) / 2);
    dy = Math.floor((newH - oldH) / 2);
  }
  ctx.clearRect(dx, dy, oldW, oldH);
  ctx.drawImage(srcSource, dx, dy);
  return out;
}

export class PaintResizeController {
  constructor(editor) {
    this.editor = editor;
  }

  bindEvents() {
    const modal = document.getElementById('modal-resize-image');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    document.querySelectorAll('input[name="resize-mode"]').forEach(r => {
      r.onchange = (e) => {
        const showCanvasOpts = e.target.value === 'canvas' ? 'flex' : 'none';
        const anchorRow = document.getElementById('row-resize-anchor');
        const fillRow = document.getElementById('row-resize-fill');
        if (anchorRow) anchorRow.style.display = showCanvasOpts;
        if (fillRow) fillRow.style.display = showCanvasOpts;
      };
    });

    document.getElementById('btn-resize-ok').onclick = () => {
      const ed = this.editor;
      const newW = Math.max(1, Math.min(2048, parseInt(document.getElementById('inp-resize-width').value, 10) || ed.width));
      const newH = Math.max(1, Math.min(2048, parseInt(document.getElementById('inp-resize-height').value, 10) || ed.height));
      const modeEl = document.querySelector('input[name="resize-mode"]:checked');
      const mode = modeEl ? modeEl.value : 'canvas';
      const anchor = document.getElementById('sel-resize-anchor').value || 'bottom-center';
      const fillHex = document.getElementById('sel-resize-fill')?.value || '#E7FFFF';

      modal.close();
      if (newW === ed.width && newH === ed.height) return;
      this.resizeBaseAndMask(newW, newH, mode, anchor, fillHex);
    };

    document.getElementById('btn-resize-cancel').onclick = () => modal.close();
  }

  openDialog() {
    const ed = this.editor;
    if (ed.targetType !== 'base') return;
    if (ed.clipMgr && ed.clipMgr.floatingLayer) ed.clipMgr.commitFloatingLayer();

    const modal = document.getElementById('modal-resize-image');
    if (!modal) return;
    this.bindEvents();
    document.getElementById('lbl-resize-current').textContent = `現在のサイズ: ${ed.width} × ${ed.height} px`;
    document.getElementById('inp-resize-width').value = ed.width;
    document.getElementById('inp-resize-height').value = ed.height;
    modal.showModal();
  }

  resizeBaseAndMask(newW, newH, mode, anchor, fillHex = '#E7FFFF') {
    const ed = this.editor;
    ed._pushHistory();
    const oldW = ed.width;
    const oldH = ed.height;

    const resizedBase = resizeSourceCanvas(ed.canvas, oldW, oldH, newW, newH, mode, anchor, fillHex);
    ed.width = newW;
    ed.height = newH;
    ed.canvas.width = newW;
    ed.canvas.height = newH;
    ed.overlayCanvas.width = newW;
    ed.overlayCanvas.height = newH;
    ed.ctx.imageSmoothingEnabled = false;
    ed.ctx.drawImage(resizedBase, 0, 0);

    ed.app.baseW = newW;
    ed.app.baseH = newH;
    if (ed.app.maskMgr && ed.app.maskMgr.items.length > 0) {
      ed.app.maskMgr.saveActiveStateFromApp();
      const transformed = ed.app.maskMgr.items.map((m, index) => {
        if (!m.image) return null;
        const mw = m.image.naturalWidth || m.image.width || oldW;
        const mh = m.image.naturalHeight || m.image.height || oldH;
        return { index, canvas: resizeSourceCanvas(m.image, mw, mh, newW, newH, mode, anchor, fillHex), name: m.name };
      }).filter(Boolean);
      if (transformed.length > 0) ed.app.maskMgr.applyTransformedMasks(transformed);
    } else if (ed.app.maskImage) {
      const mOldW = ed.app.maskImage.naturalWidth || ed.app.maskImage.width || oldW;
      const mOldH = ed.app.maskImage.naturalHeight || ed.app.maskImage.height || oldH;
      const resizedMask = resizeSourceCanvas(ed.app.maskImage, mOldW, mOldH, newW, newH, mode, anchor, fillHex);
      ed.app.applyMaskImage(resizedMask, ed.app.maskName);
    }

    ed.selectionMask = null;
    ed.polyPoints = [];
    ed._updateTransform();
    ed._drawOverlay();
    ed._updateStatus();
    ed._showHint(`サイズを ${newW}×${newH}px に変更しました（マスク画像も連動変更済）`);
  }
}