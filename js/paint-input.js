import { exportPaletteToFile, importPaletteFromFile } from './paint-palette-ui.js';

export class PaintInputController {
  constructor(editor) {
    this.editor = editor;
    this.isPanning = false;
    this.panStart = [0, 0];
    this.touchStartDist = null;
    this.touchStartZoom = 1.0;
    this.touchStartPan = [0, 0];
    this.touchStartCenter = [0, 0];
  }

  bindAll() {
    const ed = this.editor;
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    document.querySelectorAll('.paint-tool-btn').forEach(btn => {
      btn.onclick = () => {
        if (ed.clipMgr.floatingLayer) ed.clipMgr.commitFloatingLayer();
        document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ed.currentTool = btn.dataset.tool;
        ed.lineStart = null;
        ed.rectFillStart = null;
        ed.selStart = null;
        ed.polyPoints = [];

        if (ed.currentTool === 'hand') {
          ed.selectionMask = null;
          if (ed.selMover) ed.selMover.reset();
        }

        ed._drawOverlay();
        ed._updateStatus();
      };
    });

    document.querySelectorAll('.sel-mode-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.sel-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ed.selectionMode = btn.dataset.selMode;
        ed._updateStatus();
      };
    });

    bindClick('btn-paint-resize', () => ed.resizeCtrl.openDialog());
    bindClick('btn-paint-copy', () => ed.clipMgr.copySelection());
    bindClick('btn-paint-paste', () => ed.clipMgr.pasteClipboard());
    bindClick('btn-paint-import-img', () => ed.clipMgr.importExternalImage());
    bindClick('btn-paint-reimport-img', () => ed.clipMgr.reapplyLastImportedImage());
    bindClick('btn-paint-flip-h', () => ed.clipMgr.flipHorizontal());
    bindClick('btn-paint-flip-v', () => ed.clipMgr.flipVertical());
    bindClick('btn-commit-floating', () => ed.clipMgr.commitFloatingLayer());
    bindClick('btn-cancel-floating', () => ed.clipMgr.cancelFloatingLayer());

    bindClick('btn-export-palette', () => exportPaletteToFile(ed));
    bindClick('btn-import-palette', () => importPaletteFromFile(ed));
    bindClick('btn-open-palette-blend', () => ed.dialogs.openPaletteBlendDialog());

    bindClick('btn-paint-regen-mask', () => {
      if (ed.targetType !== 'mask') return;
      const regenerated = ed.app.regenerateMaskFromBase();
      if (regenerated) {
        ed._pushHistory();
        ed.ctx.clearRect(0, 0, ed.width, ed.height);
        ed.ctx.imageSmoothingEnabled = false;
        ed.ctx.drawImage(regenerated, 0, 0, ed.width, ed.height);
        ed.selectionMask = null;
        ed.polyPoints = [];
        ed._drawOverlay();
        ed._showHint('🔄 ベース画像からマスク画像を再生成しました');
      }
    });

    this._bindGuideControls();

    bindClick('btn-paint-apply', () => ed.applyAndClose());
    bindClick('btn-paint-cancel', () => ed._cancelAndClose());
    bindClick('btn-paint-undo', () => ed.undo());
    bindClick('btn-paint-redo', () => ed.redo());
    bindClick('btn-paint-clear-sel', () => {
      ed.selectionMask = null;
      ed.polyPoints = [];
      if (ed.selMover) ed.selMover.reset();
      ed._drawOverlay();
      ed._updateStatus();
    });

    bindClick('btn-gen-base-palette', () => {
      const pm = ed.app.paletteManager;
      pm.basePaletteConfig.brightestHex = document.getElementById('inp-gray-max').value.trim() || '#FEFEFE';
      pm.basePaletteConfig.darkestHex = document.getElementById('inp-gray-min').value.trim() || '#404040';
      pm.basePaletteConfig.steps = parseInt(document.getElementById('inp-gray-steps').value, 10) || 16;
      pm.generateBasePalette();
      ed.customDeftilePalette = null;
      ed._renderPaletteUI();
    });

    bindClick('btn-add-mask-custom-color', async () => {
      const picked = await ed.app.colorPicker.open(ed.currentColor || '#FFFFFF');
      if (picked) {
        ed.app.paletteManager.addColorToMaskPalette(picked);
        ed.currentColor = picked;
        ed._renderPaletteUI();
      }
    });

    bindClick('btn-open-image-sampler', () => ed.dialogs.openSamplerModal());
    bindClick('btn-open-color-replace', () => ed.dialogs.openColorReplaceDialog());
    bindClick('btn-paint-keybindings', () => ed.dialogs.openKeybindingDialog());

    this._bindViewportPointerAndTouch();
    this._bindKeyboardShortcuts();
  }

  _bindGuideControls() {
    const ed = this.editor;
    const chkGrid = document.getElementById('chk-paint-grid');
    const inpGridStep = document.getElementById('inp-paint-grid-step');
    const inpGridColor = document.getElementById('inp-paint-grid-color');
    const chkIso = document.getElementById('chk-paint-iso');
    const inpIsoW = document.getElementById('inp-paint-iso-w');
    const inpIsoH = document.getElementById('inp-paint-iso-h');
    const inpIsoColor = document.getElementById('inp-paint-iso-color');

    if (chkGrid) chkGrid.onchange = (e) => { ed.showGrid = e.target.checked; ed._drawOverlay(); };
    if (inpGridStep) inpGridStep.oninput = (e) => { ed.gridStep = Math.max(1, Math.min(256, parseInt(e.target.value, 10) || 8)); ed._drawOverlay(); };
    if (inpGridColor) inpGridColor.oninput = (e) => { ed.gridColor = e.target.value; ed._drawOverlay(); };

    if (chkIso) chkIso.onchange = (e) => { ed.showIsoTile = e.target.checked; ed._drawOverlay(); };
    if (inpIsoW) {
      inpIsoW.oninput = (e) => {
        const w = Math.max(4, Math.min(512, parseInt(e.target.value, 10) || 64));
        ed.isoTileW = w;
        const autoH = Math.max(2, Math.round(w / 2));
        ed.isoTileH = autoH;
        if (inpIsoH) inpIsoH.value = autoH;
        ed._drawOverlay();
      };
    }
    if (inpIsoH) inpIsoH.oninput = (e) => { ed.isoTileH = Math.max(2, Math.min(512, parseInt(e.target.value, 10) || 32)); ed._drawOverlay(); };
    if (inpIsoColor) inpIsoColor.oninput = (e) => { ed.isoColor = e.target.value; ed._drawOverlay(); };
  }

  _bindViewportPointerAndTouch() {
    const ed = this.editor;
    const vp = ed.viewport;

    vp.addEventListener('contextmenu', (e) => e.preventDefault());
    if (ed.canvas) ed.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    if (ed.overlayCanvas) ed.overlayCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    vp.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      const newZoom = Math.max(1, Math.min(64, ed.zoomLevel * delta));
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ix = (cx - ed.panX) / ed.zoomLevel;
      const iy = (cy - ed.panY) / ed.zoomLevel;
      ed.zoomLevel = newZoom;
      ed.panX = Math.round(cx - ix * newZoom);
      ed.panY = Math.round(cy - iy * newZoom);
      ed._updateTransform();
    };

    const getPixelCoords = (clientX, clientY) => {
      const rect = vp.getBoundingClientRect();
      const px = Math.floor((clientX - rect.left - ed.panX) / ed.zoomLevel);
      const py = Math.floor((clientY - rect.top - ed.panY) / ed.zoomLevel);
      return { px, py };
    };

    vp.onmousedown = (e) => {
      if (e.button === 1 || e.button === 2 || e.spaceKey || (ed.currentTool === 'hand' && e.button === 0)) {
        this.isPanning = true;
        this.panStart = [e.clientX - ed.panX, e.clientY - ed.panY];
        ed.updateCursor();
        return;
      }
      const { px, py } = getPixelCoords(e.clientX, e.clientY);
      ed._handlePointerDown(px, py);
    };

    vp.ondblclick = (e) => {
      if (ed.currentTool === 'polySelect' && ed.polyPoints.length >= 3) {
        e.preventDefault();
        ed._finalizePolySelect();
      }
    };

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        ed.panX = e.clientX - this.panStart[0];
        ed.panY = e.clientY - this.panStart[1];
        ed._updateTransform();
        return;
      }
      if (!ed.modal || !ed.modal.open) return;
      const { px, py } = getPixelCoords(e.clientX, e.clientY);
      const coordLbl = document.getElementById('paint-lbl-coord');
      if (coordLbl) coordLbl.textContent = `X: ${px}, Y: ${py} (${ed.width}×${ed.height})`;
      ed._handlePointerMove(px, py);
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        ed.updateCursor();
        return;
      }
      const { px, py } = getPixelCoords(e.clientX, e.clientY);
      ed._handlePointerUp(px, py);
    });

    vp.addEventListener('touchstart', (e) => {
      if (!ed.modal || !ed.modal.open) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (ed.currentTool === 'hand') {
          this.isPanning = true;
          this.panStart = [t.clientX - ed.panX, t.clientY - ed.panY];
          return;
        }
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        ed._handlePointerDown(px, py);
      } else if (e.touches.length === 2) {
        this.isPanning = false;
        ed.isDrawing = false;
        ed.clipMgr.isDraggingFloating = false;
        if (ed.onionSkinMgr) ed.onionSkinMgr.isDragging = false;
        const t1 = e.touches[0], t2 = e.touches[1];
        this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        this.touchStartZoom = ed.zoomLevel;
        const rect = vp.getBoundingClientRect();
        this.touchStartCenter = [((t1.clientX + t2.clientX) / 2) - rect.left, ((t1.clientY + t2.clientY) / 2) - rect.top];
        this.touchStartPan = [ed.panX, ed.panY];
      }
    }, { passive: false });

    vp.addEventListener('touchmove', (e) => {
      if (!ed.modal || !ed.modal.open) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (this.isPanning) {
          ed.panX = t.clientX - this.panStart[0];
          ed.panY = t.clientY - this.panStart[1];
          ed._updateTransform();
          return;
        }
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        const coordLbl = document.getElementById('paint-lbl-coord');
        if (coordLbl) coordLbl.textContent = `X: ${px}, Y: ${py} (${ed.width}×${ed.height})`;
        ed._handlePointerMove(px, py);
      } else if (e.touches.length === 2 && this.touchStartDist) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const curDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const newZoom = Math.max(1, Math.min(64, this.touchStartZoom * (curDist / this.touchStartDist)));
        const rect = vp.getBoundingClientRect();
        const curCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
        const curCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;
        const imgX = (this.touchStartCenter[0] - this.touchStartPan[0]) / this.touchStartZoom;
        const imgY = (this.touchStartCenter[1] - this.touchStartPan[1]) / this.touchStartZoom;
        ed.zoomLevel = newZoom;
        ed.panX = Math.round(curCenterX - imgX * newZoom);
        ed.panY = Math.round(curCenterY - imgY * newZoom);
        ed._updateTransform();
      }
    }, { passive: false });

    vp.addEventListener('touchend', (e) => {
      if (!ed.modal || !ed.modal.open) return;
      if (e.touches.length === 0) {
        if (this.isPanning) {
          this.isPanning = false;
          this.touchStartDist = null;
          return;
        }
        const t = e.changedTouches[0];
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        ed._handlePointerUp(px, py);
        this.touchStartDist = null;
      }
    }, { passive: false });
  }

  _bindKeyboardShortcuts() {
    const ed = this.editor;
    window.addEventListener('keydown', (e) => {
      if (!ed.modal || !ed.modal.open) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Escape' && ed.dialogs?.colorReplace?.cancelCanvasPick()) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { e.preventDefault(); ed.clipMgr.copySelection(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); ed.clipMgr.pasteClipboard(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) ed.redo(); else ed.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); ed.redo(); return; }

      if (ed.clipMgr.handleKeyDown(e)) return;

      if (ed.currentTool === 'moveSel' && ed.selectionMask && ed.selMover) {
        if (e.code === 'ArrowUp') { e.preventDefault(); ed.selMover.nudge(0, -1); return; }
        if (e.code === 'ArrowDown') { e.preventDefault(); ed.selMover.nudge(0, 1); return; }
        if (e.code === 'ArrowLeft') { e.preventDefault(); ed.selMover.nudge(-1, 0); return; }
        if (e.code === 'ArrowRight') { e.preventDefault(); ed.selMover.nudge(1, 0); return; }
      }

      if (e.code === 'Enter' && ed.currentTool === 'polySelect' && ed.polyPoints.length >= 3) {
        e.preventDefault();
        ed._finalizePolySelect();
        return;
      }
      if (e.code === 'Escape' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyD')) {
        if (ed.polyPoints.length > 0) {
          ed.polyPoints = [];
          ed._drawOverlay();
        } else {
          ed.selectionMask = null;
          if (ed.selMover) ed.selMover.reset();
          ed._drawOverlay();
          ed._updateStatus();
        }
        return;
      }

      for (const [tool, code] of Object.entries(ed.dialogs.keybindings)) {
        if (e.code === code) {
          const btn = document.querySelector(`.paint-tool-btn[data-tool="${tool}"]`);
          if (btn) btn.click();
          break;
        }
      }
    });
  }
}