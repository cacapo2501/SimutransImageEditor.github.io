import { bindPaletteControls } from './paint-palette-actions.js';
import {
  bindPaintGuideControls,
  bindPaintToolbarToggles,
  applyDefaultPaintCompactLayout
} from './paint-toolbar-layout.js';

export class PaintInputController {
  constructor(editor) {
    this.editor = editor;
    this.isPanning = false;
    this.isRightPicking = false;
    this.panStart = [0, 0];
    this.touchStartDist = null;
    this.touchStartZoom = 1.0;
    this.touchStartPan = [0, 0];
    this.touchStartCenter = [0, 0];
    this.lastTouchTime = 0;
    this.hasUserToggledLayout = false;
  }

  bindAll() {
    const ed = this.editor;
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    document.querySelectorAll('#paint-toolbar .paint-tool-btn[data-tool]').forEach(btn => {
      btn.onclick = () => ed.selectTool(btn.dataset.tool);
    });

    document.querySelectorAll('.sel-mode-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.sel-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ed.selectionMode = btn.dataset.selMode;
        ed._drawOverlay();
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
    bindClick('btn-edit-floating-text', () => ed.textCtrl.reopenFromFloating());

    bindPaletteControls(ed);

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

    bindPaintGuideControls(ed);
    bindPaintToolbarToggles(this);

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

    bindClick('btn-open-image-sampler', () => ed.dialogs.openSamplerModal());
    bindClick('btn-open-color-replace', () => ed.dialogs.openColorReplaceDialog());
    bindClick('btn-paint-keybindings', () => ed.dialogs.openKeybindingDialog());

    this._bindViewportPointerAndTouch();
    this._bindKeyboardShortcuts();
  }

  applyDefaultCompactLayout() {
    applyDefaultPaintCompactLayout(this);
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

    const updateCoordLabel = (px, py) => {
      const coordLbl = document.getElementById('paint-lbl-coord');
      if (!coordLbl) return;
      if (ed.gridSnap && ed.gridSnap.isPointSnapTool(ed.currentTool)) {
        const [sx, sy] = ed.gridSnap.snapPoint(px, py);
        coordLbl.textContent = `X: ${px}, Y: ${py} → スナップ(${sx},${sy}) (${ed.width}×${ed.height})`;
      } else {
        coordLbl.textContent = `X: ${px}, Y: ${py} (${ed.width}×${ed.height})`;
      }
    };

    vp.onmousedown = (e) => {
      if (Date.now() - this.lastTouchTime < 800) return;
      if (ed.isTouchMode) {
        ed.isTouchMode = false;
        if (ed.rectHandles) ed.rectHandles.updateUI();
      }
      const { px, py } = getPixelCoords(e.clientX, e.clientY);

      // 描画系ツール使用時は右クリックをスポイトにする
      if (e.button === 2 && ed.isDrawingTool() && !ed.dialogs?.colorReplace?.isPicking()) {
        this.isRightPicking = true;
        ed.toolHandler.pickColorAt(px, py);
        return;
      }

      const isReplaceHand = ed.dialogs?.colorReplace?.isHandMode();
      if (e.button === 1 || e.button === 2 || e.spaceKey || ((ed.currentTool === 'hand' || isReplaceHand) && e.button === 0)) {
        this.isPanning = true;
        this.panStart = [e.clientX - ed.panX, e.clientY - ed.panY];
        ed.updateCursor();
        return;
      }
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
      updateCoordLabel(px, py);
      if (this.isRightPicking) return;
      ed._handlePointerMove(px, py);
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isRightPicking) {
        this.isRightPicking = false;
        return;
      }
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
      this.lastTouchTime = Date.now();
      if (!ed.isTouchMode) {
        ed.isTouchMode = true;
        if (ed.rectHandles) ed.rectHandles.updateUI();
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const isReplaceHand = ed.dialogs?.colorReplace?.isHandMode();
        if (ed.currentTool === 'hand' || isReplaceHand) {
          this.isPanning = true;
          this.panStart = [t.clientX - ed.panX, t.clientY - ed.panY];
          return;
        }
        if (ed.rectHandles && ed.rectHandles.handleTouchStart(t.clientX, t.clientY)) return;
        const { px, py } = getPixelCoords(t.clientX, t.clientY);
        ed._handlePointerDown(px, py);
      } else if (e.touches.length === 2) {
        this.isPanning = false;
        ed.isDrawing = false;
        ed.clipMgr.isDraggingFloating = false;
        if (ed.onionSkinMgr) ed.onionSkinMgr.isDragging = false;
        if (ed.rectHandles && ed.rectHandles.isResizing) ed.rectHandles.reset();
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
        updateCoordLabel(px, py);
        if (ed.rectHandles && ed.rectHandles.handleTouchMove(px, py)) return;
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
        if (ed.rectHandles && ed.rectHandles.handleTouchEnd()) {
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
      if (ed.textCtrl?.modal?.open) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (ed.dialogs?.colorReplace?.isPicking()) {
        if (e.code === 'Escape') { e.preventDefault(); ed.dialogs.colorReplace.cancelCanvasPick(); return; }
        if (e.code === 'Enter') { e.preventDefault(); ed.dialogs.colorReplace.confirmCanvasPick(); return; }
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
          ed.selectTool(tool);
          break;
        }
      }
    });
  }
}
