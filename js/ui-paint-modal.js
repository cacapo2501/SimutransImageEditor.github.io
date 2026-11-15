export function renderPaintModalUI() {
  if (document.getElementById('modal-paint-editor')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-paint-editor">
      <div id="paint-editor-container">
        <header id="paint-toolbar">
          <div class="paint-tool-group">
            <button class="paint-tool-btn" data-tool="hand" title="描画・選択を解除してハンドスクロール (手のひら移動)">✋ スクロール</button>
            <button class="paint-tool-btn active" data-tool="pencil" title="ドットブラシ">✏️ ドット</button>
            <button class="paint-tool-btn" data-tool="line" title="直線 (連続)">📏 直線</button>
            <button class="paint-tool-btn" data-tool="rectFill" title="矩形塗りつぶし">⬛ 矩形塗潰</button>
            <button class="paint-tool-btn" data-tool="bucket" title="塗りつぶし">🪣 塗潰</button>
            <button class="paint-tool-btn" data-tool="picker" title="スポイト (色取得)">🎯 スポイト</button>
            <button class="paint-tool-btn" data-tool="rectSelect" title="矩形選択">🔲 矩形選択</button>
            <button class="paint-tool-btn" data-tool="polySelect" title="多角形選択 (ダブルクリック/始点クリック/Enterで確定)">📐 多角形選択</button>
            <button class="paint-tool-btn" data-tool="wand" title="自動選択 (Magic Wand)">🪄 自動選択</button>
            <button class="paint-tool-btn" data-tool="colorSelect" title="同色選択">🎯 同色選択</button>
            <button class="paint-tool-btn" data-tool="moveSel" title="選択範囲の移動（中のピクセルを移動）">↔️ 選択移動</button>
            <button class="paint-tool-btn" data-tool="text" title="テキスト挿入">🔤 文字</button>
            <button id="btn-open-color-replace" title="色置換・複数色置換">🔄 色置換</button>
            <button id="btn-paint-resize" title="ベース画像の大きさ変更（マスク画像も連動）">📐 画像サイズ変更</button>
          </div>

          <div class="paint-tool-group sel-mode-group" title="選択ツールの演算モード">
            <span style="font-size:10px; color:#aaa;">選択:</span>
            <button class="sel-mode-btn active" data-sel-mode="replace" title="新規選択">新規</button>
            <button class="sel-mode-btn" data-sel-mode="add" title="現在の選択範囲に追加">＋追加</button>
            <button class="sel-mode-btn" data-sel-mode="subtract" title="現在の選択範囲から一部削除">－削除</button>
            <button class="sel-mode-btn" data-sel-mode="intersect" title="現在の選択範囲と重なる部分のみ残す（乗算）">×乗算</button>
            <button id="btn-paint-clear-sel" title="選択解除 (Esc / Ctrl+D)">✕ 解除</button>
          </div>

          <div class="paint-tool-group guide-control-group" title="選択範囲内を描画編集した際、選択範囲外の上方指定pxおきに指定回数同じ編集を繰り返します">
            <label class="inline-chk-lbl">
              <input type="checkbox" id="chk-paint-repeat-up"> 🔁 上方リピート:
            </label>
            <span style="font-size:10px; color:#aaa;">間隔</span>
            <input type="number" id="inp-paint-repeat-step" class="num-input-mini" value="8" min="1" max="512">
            <span style="font-size:10px; color:#aaa;">px ×</span>
            <input type="number" id="inp-paint-repeat-count" class="num-input-mini" value="3" min="1" max="64">
            <span style="font-size:10px; color:#aaa;">回</span>
          </div>

          <div class="paint-tool-group">
            <button id="btn-paint-copy" title="選択範囲をコピー (Ctrl+C)">📋 コピー</button>
            <button id="btn-paint-paste" title="貼り付け (Ctrl+V)">📌 貼付</button>
            <button id="btn-paint-import-img" title="外部画像を取り込んで貼り付け">🖼️ 画像貼付</button>
            <button id="btn-paint-reimport-img" title="前回貼り付けた外部画像をもう一度貼り付け" disabled>🔁 再貼付</button>
            <button id="btn-paint-flip-h" title="左右反転 (貼付中/選択範囲/全体)">↔ 左右反転</button>
            <button id="btn-paint-flip-v" title="上下反転 (貼付中/選択範囲/全体)">↕ 上下反転</button>
          </div>

          <div class="paint-tool-group floating-bar" id="floating-action-bar" style="display:none;">
            <span style="font-size:10px; color:#00ff88; font-weight:bold;">貼付調整中:</span>
            <button id="btn-commit-floating" class="btn-primary">✓ 確定 (Enter)</button>
            <button id="btn-cancel-floating">✕ 破棄 (Esc)</button>
          </div>

          <div class="paint-tool-group guide-control-group">
            <label class="inline-chk-lbl" title="等間隔の直交補助線を表示">
              <input type="checkbox" id="chk-paint-grid"> 補助線:
            </label>
            <input type="number" id="inp-paint-grid-step" class="num-input-mini" value="8" min="1" max="256">
            <span style="font-size:10px; color:#aaa;">px</span>
            <input type="color" id="inp-paint-grid-color" class="color-input-mini" value="#00FF66" title="補助線の色を選択">

            <label class="inline-chk-lbl" style="margin-left:6px;" title="ベースタイルのアイソメトリック菱形を表示">
              <input type="checkbox" id="chk-paint-iso"> タイル菱形:
            </label>
            <span style="font-size:10px; color:#aaa;">幅</span>
            <input type="number" id="inp-paint-iso-w" class="num-input-mini" value="64" min="4" max="512">
            <span style="font-size:10px; color:#aaa;">×高</span>
            <input type="number" id="inp-paint-iso-h" class="num-input-mini" value="32" min="2" max="512">
            <span style="font-size:10px; color:#aaa;">px</span>
            <input type="color" id="inp-paint-iso-color" class="color-input-mini" value="#FFAA00" title="タイル菱形の色を選択">
          </div>

          <div class="paint-tool-group">
            <button id="btn-paint-undo" title="元に戻す (Ctrl+Z)">↩ Undo</button>
            <button id="btn-paint-redo" title="やり直し (Ctrl+Y)">↪ Redo</button>
            <button id="btn-paint-keybindings" title="キーバインド設定">⌨️ キー設定</button>
          </div>
          <div class="paint-tool-group ml-auto">
            <span id="paint-lbl-zoom" class="val-badge">100%</span>
            <button id="btn-paint-apply" class="btn-primary">✓ 完了(反映)</button>
            <button id="btn-paint-cancel">キャンセル</button>
          </div>
        </header>

        <div id="paint-main-body">
          <aside id="paint-sidebar">
            <div class="sub-panel">
              <legend>描画色</legend>
              <div class="color-preview-row">
                <span id="paint-current-color-swatch" class="color-swatch"></span>
                <strong id="paint-current-color-hex">#FFFFFF</strong>
              </div>
            </div>

            <fieldset class="sub-panel">
              <legend>🧅 オニオンスキン (位置目安)</legend>
              <div class="btn-group">
                <button id="btn-onion-add" class="btn-primary">＋ 画像重ね(複数可)</button>
                <button id="btn-onion-clear">全削除</button>
              </div>
              <div id="onion-skin-list" style="max-height:95px; overflow-y:auto; display:flex; flex-direction:column; gap:3px;">
                <div class="info-text" style="text-align:center; padding:4px 0;">未登録（保存時には出力されません）</div>
              </div>
              <div id="onion-selected-controls" style="display:none; border-top:1px solid #3a3a3a; padding-top:5px;">
                <div class="step-row">
                  <span style="font-size:11px; width:20px;">X:</span>
                  <button type="button" id="btn-onion-x-minus" style="padding:2px 6px;">-1</button>
                  <input type="number" id="inp-onion-x" class="num-input-mini" value="0" style="width:52px;">
                  <button type="button" id="btn-onion-x-plus" style="padding:2px 6px;">+1</button>
                </div>
                <div class="step-row mt-05">
                  <span style="font-size:11px; width:20px;">Y:</span>
                  <button type="button" id="btn-onion-y-minus" style="padding:2px 6px;">-1</button>
                  <input type="number" id="inp-onion-y" class="num-input-mini" value="0" style="width:52px;">
                  <button type="button" id="btn-onion-y-plus" style="padding:2px 6px;">+1</button>
                </div>
                <div class="row mt-05">
                  <span style="font-size:11px;">濃さ:</span>
                  <span id="lbl-onion-opacity" class="val-badge" style="min-width:36px;">45%</span>
                  <input type="range" id="slider-onion-opacity" min="0.05" max="1" step="0.05" value="0.45">
                </div>
                <label class="mt-05"><input type="checkbox" id="chk-onion-trans-e7ffff" checked> #E7FFFF を透過</label>
              </div>
            </fieldset>

            <fieldset class="sub-panel" id="base-palette-tools">
              <legend>グレースケール生成設定</legend>
              <div class="row">
                <span>明色:</span>
                <input type="text" id="inp-gray-max" value="#FEFEFE" style="width:70px;">
              </div>
              <div class="row mt-05">
                <span>暗色:</span>
                <input type="text" id="inp-gray-min" value="#404040" style="width:70px;">
              </div>
              <div class="row mt-05">
                <span>段階:</span>
                <input type="number" id="inp-gray-steps" value="16" min="2" max="64" style="width:50px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px;">
              </div>
              <button id="btn-gen-base-palette" class="w-100 mt-05">パレット再生成 (SpecialColor回避)</button>
            </fieldset>

            <fieldset class="sub-panel" id="mask-palette-tools" style="display:none;">
              <legend>マスクパレット設定</legend>
              <div class="btn-group">
                <button id="btn-add-mask-custom-color" class="btn-primary">＋ 任意色を追加</button>
                <button id="btn-open-image-sampler">🖼️ 画像からスポイト</button>
              </div>
              <span class="info-text">※右クリックでパレットから色を削除</span>
            </fieldset>

            <fieldset class="sub-panel">
              <legend>カラーパレット一覧</legend>
              <div class="btn-group">
                <button id="btn-export-palette" title="現在のパレットをJSONファイルに出力">💾 パレット出力</button>
                <button id="btn-import-palette" title="パレットJSONファイルを読み込み（置換/追加）">📂 パレット入力</button>
              </div>
              <span class="info-text">※ダブルクリック/長タップで色編集</span>
              <div id="paint-palette-slots"></div>
              <div id="paint-palette-empty-msg" class="info-text" style="display:none; text-align:center; padding:10px 0;">
                パレットは空です。<br>「＋ 任意色を追加」または「画像からスポイト」で色を追加してください。
              </div>
            </fieldset>
          </aside>

          <div id="paint-viewport">
            <div id="paint-canvas-wrapper">
              <canvas id="paint-canvas"></canvas>
              <canvas id="paint-overlay-canvas"></canvas>
            </div>
          </div>
        </div>

        <footer id="paint-footer">
          <span id="paint-lbl-tool">ツール: ドット</span>
          <span id="paint-lbl-hint" style="margin-left:16px; color:#aaa;"></span>
          <span id="paint-lbl-coord" style="margin-left:auto;">X: 0, Y: 0</span>
        </footer>
      </div>
    </dialog>
  `);
}
"""

---

### 3. `js/paint-editor.js`（全量・376行）

```javascript
import { PaintClipboardManager } from './paint-clipboard.js';
import { PaintDialogs } from './paint-dialogs.js';
import { PaintResizeController, cloneCanvasFromSource } from './paint-resize.js';
import { PaintInputController } from './paint-input.js';
import { PaintToolHandler } from './paint-tools.js';
import { PaintOnionSkinManager } from './paint-onion-skin.js';
import { PaintRepeatManager } from './paint-repeat.js';
import { PaintSelectionMover } from './paint-selection-move.js';
import { renderEditorPaletteUI, updateEditorCurrentColorUI } from './paint-palette-ui.js';
import { renderPaintModalUI } from './ui-paint-modal.js';
import { renderSubModalsUI } from './ui-sub-modals.js';
import { renderDeftileModalUI } from './ui-deftile-modal.js';

export class PaintEditor {
  constructor(app) {
    this.app = app;
    this.targetType = 'base';
    this.width = 0;
    this.height = 0;
    this.initialized = false;

    this.modal = null;
    this.canvas = null;
    this.ctx = null;
    this.overlayCanvas = null;
    this.oCtx = null;
    this.viewport = null;

    this.clipMgr = null;
    this.dialogs = null;
    this.resizeCtrl = null;
    this.inputCtrl = null;
    this.toolHandler = null;
    this.onionSkinMgr = null;
    this.repeatMgr = null;
    this.selMover = null;

    this.currentColor = '#FFFFFF';
    this.currentTool = 'pencil';
    this.selectionMode = 'replace';
    this.zoomLevel = 8.0;
    this.panX = 40;
    this.panY = 40;
    this.isDrawing = false;
    this.lastDrawPos = null;

    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.polyPoints = [];
    this.selectionMask = null;

    this.showGrid = false;
    this.gridStep = 8;
    this.gridColor = '#00FF66';
    this.showIsoTile = false;
    this.isoTileW = 64;
    this.isoTileH = 32;
    this.isoColor = '#FFAA00';

    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 25;
  }

  _ensureInitialized() {
    if (this.initialized) return true;

    renderPaintModalUI();
    renderSubModalsUI();
    renderDeftileModalUI();

    this.modal = document.getElementById('modal-paint-editor');
    this.canvas = document.getElementById('paint-canvas');
    this.overlayCanvas = document.getElementById('paint-overlay-canvas');
    this.viewport = document.getElementById('paint-viewport');

    if (!this.modal || !this.canvas || !this.overlayCanvas || !this.viewport) {
      alert('ペイントエディタのUI初期化に失敗しました。ページを再読み込みしてください。');
      return false;
    }

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.oCtx = this.overlayCanvas.getContext('2d');
    this.clipMgr = new PaintClipboardManager(this);
    this.dialogs = new PaintDialogs(this);
    this.resizeCtrl = new PaintResizeController(this);
    this.inputCtrl = new PaintInputController(this);
    this.toolHandler = new PaintToolHandler(this);
    this.onionSkinMgr = new PaintOnionSkinManager(this);
    this.repeatMgr = new PaintRepeatManager(this);
    this.selMover = new PaintSelectionMover(this);

    this.resizeCtrl.bindEvents();
    this.inputCtrl.bindAll();
    this.onionSkinMgr.bindEvents();
    this.repeatMgr.bindEvents();

    const btnToggleLive = document.getElementById('btn-toggle-live-preview-size');
    if (btnToggleLive) {
      btnToggleLive.onclick = () => {
        document.getElementById('paint-deftile-live-preview')?.classList.toggle('expanded');
      };
    }

    this.initialized = true;
    return true;
  }

  get keybindings() {
    if (!this.dialogs) this._ensureInitialized();
    return this.dialogs ? this.dialogs.keybindings : {};
  }

  saveKeybindings() {
    if (this.dialogs) this.dialogs.saveKeybindings();
  }

  updateCursor() {
    if (!this.viewport) return;
    let cur = 'crosshair';
    if (this.inputCtrl && this.inputCtrl.isPanning) {
      cur = 'grabbing';
    } else if (this.currentTool === 'hand') {
      cur = 'grab';
    } else if (this.currentTool === 'moveSel') {
      cur = 'move';
    } else {
      cur = 'crosshair';
    }
    this.viewport.style.cursor = cur;
    if (this.canvas) this.canvas.style.cursor = cur;
    if (this.overlayCanvas) this.overlayCanvas.style.cursor = cur;
  }

  open(targetType = 'base') {
    if (!this._ensureInitialized()) return;

    this.targetType = targetType;
    let srcImg = null;
    if (targetType === 'base') srcImg = this.app.baseImage;
    else if (targetType === 'mask') srcImg = this.app.maskImage;
    else if (targetType === 'deftile') srcImg = this.app.deftileBuilder?.deftileCanvas;

    if (!srcImg) {
      alert('編集対象の画像が読み込まれていません。');
      return;
    }

    const btnResize = document.getElementById('btn-paint-resize');
    if (btnResize) {
      btnResize.style.display = targetType === 'base' ? 'inline-block' : 'none';
    }

    const livePreviewBox = document.getElementById('paint-deftile-live-preview');
    if (livePreviewBox) {
      livePreviewBox.style.display = targetType === 'deftile' ? 'flex' : 'none';
    }

    this.width = srcImg.naturalWidth || srcImg.width;
    this.height = srcImg.naturalHeight || srcImg.height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(srcImg, 0, 0);

    this.selectionMask = null;
    this.polyPoints = [];
    this.lineStart = null;
    this.rectFillStart = null;
    this.selStart = null;
    this.clipMgr.reset();
    this.selMover.reset();
    this.onionSkinMgr.clearAll();

    this.undoStack = [];
    this.redoStack = [];
    this._pushHistory();

    this._renderPaletteUI();
    this.updateCursor();
    if (typeof this.modal.showModal === 'function') {
      this.modal.showModal();
    } else {
      this.modal.setAttribute('open', '');
    }

    requestAnimationFrame(() => {
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const fitZoom = Math.max(1, Math.min(32, Math.floor(Math.min((vw - 80) / this.width, (vh - 80) / this.height))));
      this.zoomLevel = Math.max(2, fitZoom);
      this.panX = Math.round((vw - this.width * this.zoomLevel) / 2);
      this.panY = Math.round((vh - this.height * this.zoomLevel) / 2);
      this._updateTransform();
      this._drawOverlay();
      this._refreshDeftileLivePreview();
    });

    this._updateStatus();
  }

  _refreshDeftileLivePreview() {
    if (this.targetType === 'deftile' && this.app.deftileBuilder) {
      this.app.deftileBuilder.renderLiveMiniPreview(this.canvas);
    }
  }

  applyAndClose() {
    if (this.clipMgr && this.clipMgr.floatingLayer) this.clipMgr.commitFloatingLayer();
    if (this.onionSkinMgr) this.onionSkinMgr.clearAll();

    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.width;
    outCanvas.height = this.height;
    outCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

    if (this.targetType === 'deftile') {
      this.app.deftileBuilder.setDeftileCanvas(outCanvas);
      this.modal.close();
      return;
    }

    const latestState = this.undoStack[this.undoStack.length - 1];
    if (this.targetType === 'base' && latestState && latestState.maskCanvas) {
      this.app.applyBaseImage(outCanvas, this.app.baseName, { resetMask: false });
      this.app.applyMaskImage(latestState.maskCanvas, this.app.maskName);
    } else if (this.targetType === 'base') {
      this.app.applyBaseImage(outCanvas, this.app.baseName, { resetMask: false });
    } else {
      this.app.applyMaskImage(outCanvas, this.app.maskName);
    }

    this.app.markDirty();
    this.app.render();
    this.modal.close();
  }

  _cancelAndClose() {
    if (this.onionSkinMgr) this.onionSkinMgr.clearAll();
    if (this.targetType === 'base' && this.undoStack.length > 0 && this.undoStack[0].maskCanvas) {
      this.app.applyMaskImage(this.undoStack[0].maskCanvas, this.app.maskName);
      this.app.render();
    }
    this.modal.close();
  }

  _pushHistory() {
    const data = this.ctx.getImageData(0, 0, this.width, this.height);
    const maskSnap = (this.targetType === 'base' && this.app.maskImage)
      ? cloneCanvasFromSource(this.app.maskImage)
      : null;

    this.undoStack.push({ imageData: data, width: this.width, height: this.height, maskCanvas: maskSnap });
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  _restoreHistoryState(state) {
    if (!state) return;
    this.width = state.width;
    this.height = state.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;
    this.ctx.putImageData(state.imageData, 0, 0);

    if (this.targetType === 'base' && state.maskCanvas) {
      this.app.baseW = this.width;
      this.app.baseH = this.height;
      this.app.applyMaskImage(state.maskCanvas, this.app.maskName);
    }

    this.selectionMask = null;
    this.polyPoints = [];
    this.selMover.reset();
    this._updateTransform();
    this._drawOverlay();
    this._updateStatus();
    this._refreshDeftileLivePreview();
  }

  undo() {
    if (this.clipMgr && this.clipMgr.floatingLayer) { this.clipMgr.cancelFloatingLayer(); return; }
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop());
    this._restoreHistoryState(this.undoStack[this.undoStack.length - 1]);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this._restoreHistoryState(next);
  }

  _renderPaletteUI() { renderEditorPaletteUI(this); }
  _updateCurrentColorUI() { updateEditorCurrentColorUI(this); }

  _updateTransform() {
    const s = this.zoomLevel;
    const tStr = `translate(${this.panX}px, ${this.panY}px) scale(${s})`;
    this.canvas.style.transformOrigin = '0 0';
    this.canvas.style.transform = tStr;
    this.overlayCanvas.style.transformOrigin = '0 0';
    this.overlayCanvas.style.transform = tStr;
    const lbl = document.getElementById('paint-lbl-zoom');
    if (lbl) lbl.textContent = `${Math.round(s * 100)}%`;
  }

  _showHint(msg) {
    const hintEl = document.getElementById('paint-lbl-hint');
    if (hintEl) hintEl.textContent = msg;
  }

  _drawPixel(x, y) {
    this.repeatMgr.drawPixel(x, y);
  }

  _handlePointerDown(px, py) {
    this.toolHandler.handlePointerDown(px, py);
    this._refreshDeftileLivePreview();
  }
  _handlePointerMove(px, py) {
    this.toolHandler.handlePointerMove(px, py);
    if (this.isDrawing && this.currentTool === 'pencil') {
      this._refreshDeftileLivePreview();
    }
  }
  _handlePointerUp(px, py) {
    this.toolHandler.handlePointerUp(px, py);
    this._refreshDeftileLivePreview();
  }
  _finalizePolySelect() { this.toolHandler.finalizePolySelect(); }
  _drawOverlay(curPos = null) {
    this.toolHandler.drawOverlay(curPos);
    this._refreshDeftileLivePreview();
  }

  _updateStatus() {
    this.updateCursor();
    const modeNames = {
      replace: '新規',
      add: '＋追加',
      subtract: '－一部削除',
      intersect: '×乗算(交差)'
    };
    const toolLbl = document.getElementById('paint-lbl-tool');
    if (toolLbl) {
      toolLbl.textContent = `ツール: ${this.currentTool} | 選択モード: ${modeNames[this.selectionMode] || this.selectionMode} (${this.width}×${this.height}px)`;
    }

    if (this.currentTool === 'hand') {
      this._showHint('✋ ハンドスクロールモード: 描画・選択を解除済。1本指または左ドラッグでキャンバスをスクロール移動できます');
    } else if (this.currentTool === 'moveSel') {
      this._showHint(this.selectionMask
        ? '↔️ 選択範囲の移動: 選択範囲内をドラッグまたは矢印キーで移動できます'
        : '⚠️ 選択範囲がありません。先に選択ツールで範囲を指定してください');
    } else if (this.repeatMgr && this.repeatMgr.enabled && !this.selectionMask) {
      this._showHint('🔁 上方リピートON中: 先に選択範囲を指定してその中を描画すると上方へ反復されます');
    } else if (this.repeatMgr && this.repeatMgr.isActive()) {
      this._showHint(`🔁 上方リピート有効: 選択範囲内の編集を上方 ${this.repeatMgr.stepY}px おきに ${this.repeatMgr.count} 回反復`);
    } else if (this.currentTool === 'polySelect') {
      this._showHint('クリックで頂点追加 / 始点クリック・ダブルクリック・Enterで確定 / Escで取消');
    } else if (this.currentTool === 'rectFill') {
      this._showHint('ドラッグで矩形範囲を一括塗りつぶし');
    } else {
      this._showHint('');
    }
  }
}
"""

---

### 4. `js/paint-input.js`（全量・333行）

```javascript
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
"""

---

### 5. `js/paint-tools.js`（全量・224行）

```javascript
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
    if (ed.currentTool === 'hand') return;
    if (ed.dialogs?.colorReplace?.handleCanvasPick(px, py)) return;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerDown(px, py)) return;
    if (ed.clipMgr.handlePointerDown(px, py)) return;
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
