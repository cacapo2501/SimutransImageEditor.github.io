import { hexToRgb, rgbToHex, hsvToHex } from './color-utils.js';

export class PaintEditor {
  constructor(app) {
    this.app = app;
    this.targetType = 'base';
    this.width = 0;
    this.height = 0;

    // キャンバス・コンテキスト
    this.modal = document.getElementById('modal-paint-editor');
    this.canvas = document.getElementById('paint-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.overlayCanvas = document.getElementById('paint-overlay-canvas');
    this.oCtx = this.overlayCanvas.getContext('2d');
    this.viewport = document.getElementById('paint-viewport');

    // スポイトサンプラーモーダル要素
    this.samplerModal = document.getElementById('modal-image-sampler');
    this.samplerCanvas = document.getElementById('sampler-canvas');
    this.samplerCtx = this.samplerCanvas.getContext('2d', { willReadFrequently: true });
    this.samplerPickedColors = new Set();
    this.samplerLoadedImg = null;

    // 描画状態
    this.currentColor = '#FFFFFF';
    this.currentTool = 'pencil';
    this.zoomLevel = 8.0;
    this.panX = 40;
    this.panY = 40;
    this.isPanning = false;
    this.isDrawing = false;
    this.lastDrawPos = null;

    this.lineStart = null;
    this.polyPoints = [];
    this.selectionMask = null;

    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 25;

    this.keybindings = {
      pencil: 'KeyB',
      line: 'KeyL',
      bucket: 'KeyG',
      rectSelect: 'KeyM',
      polySelect: 'KeyP',
      wand: 'KeyW',
      colorSelect: 'KeyC',
      text: 'KeyT'
    };

    this._loadKeybindings();
    this._bindEvents();
    this._bindSamplerEvents();
  }

  _loadKeybindings() {
    const saved = localStorage.getItem('paint_keybindings');
    if (saved) {
      try { Object.assign(this.keybindings, JSON.parse(saved)); } catch (e) {}
    }
  }

  saveKeybindings() {
    localStorage.setItem('paint_keybindings', JSON.stringify(this.keybindings));
  }

  open(targetType = 'base') {
    this.targetType = targetType;
    const srcImg = targetType === 'base' ? this.app.baseImage : this.app.maskImage;
    if (!srcImg) {
      alert(`${targetType === 'base' ? 'ベース' : 'マスク'}画像が読み込まれていません。`);
      return;
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
    this.undoStack = [];
    this.redoStack = [];
    this._pushHistory();

    this._renderPaletteUI();
    this.modal.showModal();

    requestAnimationFrame(() => {
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const fitZoom = Math.max(1, Math.min(32, Math.floor(Math.min((vw - 80) / this.width, (vh - 80) / this.height))));
      this.zoomLevel = Math.max(2, fitZoom);
      this.panX = Math.round((vw - this.width * this.zoomLevel) / 2);
      this.panY = Math.round((vh - this.height * this.zoomLevel) / 2);
      this._updateTransform();
      this._drawOverlay();
    });

    this._updateStatus();
  }

  applyAndClose() {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = this.width;
    outCanvas.height = this.height;
    const octx = outCanvas.getContext('2d');
    octx.drawImage(this.canvas, 0, 0);

    const img = new Image();
    img.onload = () => {
      if (this.targetType === 'base') {
        this.app.applyBaseImage(img, this.app.baseName);
      } else {
        this.app.applyMaskImage(img, this.app.maskName);
      }
      this.app.markDirty();
      this.app.render();
      this.modal.close();
    };
    img.src = outCanvas.toDataURL('image/png');
  }

  _pushHistory() {
    const data = this.ctx.getImageData(0, 0, this.width, this.height);
    this.undoStack.push(data);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const cur = this.undoStack.pop();
    this.redoStack.push(cur);
    const prev = this.undoStack[this.undoStack.length - 1];
    this.ctx.putImageData(prev, 0, 0);
    this._drawOverlay();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.ctx.putImageData(next, 0, 0);
    this._drawOverlay();
  }

  _renderPaletteUI() {
    const container = document.getElementById('paint-palette-slots');
    container.innerHTML = '';

    const pm = this.app.paletteManager;
    let colors = [];

    if (this.targetType === 'base') {
      document.getElementById('base-palette-tools').style.display = 'block';
      document.getElementById('mask-palette-tools').style.display = 'none';

      if (pm.basePalette.length === 0) pm.generateBasePalette();
      colors = [...pm.basePalette];

      if (this.app.specialColors && this.app.specialColors.size > 0) {
        colors.push(...Array.from(this.app.specialColors));
      }
    } else {
      document.getElementById('base-palette-tools').style.display = 'none';
      document.getElementById('mask-palette-tools').style.display = 'block';
      colors = [...pm.maskPalette];
    }

    colors.forEach(hex => {
      const btn = document.createElement('button');
      btn.className = 'palette-color-btn';
      btn.style.backgroundColor = hex;
      btn.title = hex + (this.targetType === 'mask' ? ' (右クリックで削除)' : '');
      btn.onclick = () => {
        this.currentColor = hex;
        this._updateCurrentColorUI();
      };

      // マスクパレットの場合、右クリックで削除
      if (this.targetType === 'mask') {
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          if (confirm(`マスクパレットから色 ${hex} を削除しますか？`)) {
            pm.removeColorFromMaskPalette(hex);
            this._renderPaletteUI();
          }
        };
      }
      container.appendChild(btn);
    });

    if (!colors.includes(this.currentColor)) {
      this.currentColor = colors[0] || '#FFFFFF';
    }
    this._updateCurrentColorUI();
  }

  _updateCurrentColorUI() {
    document.getElementById('paint-current-color-swatch').style.backgroundColor = this.currentColor;
    document.getElementById('paint-current-color-hex').textContent = this.currentColor;
  }

  _updateTransform() {
    const s = this.zoomLevel;
    const tStr = `translate(${this.panX}px, ${this.panY}px) scale(${s})`;
    this.canvas.style.transformOrigin = '0 0';
    this.canvas.style.transform = tStr;
    this.overlayCanvas.style.transformOrigin = '0 0';
    this.overlayCanvas.style.transform = tStr;
    document.getElementById('paint-lbl-zoom').textContent = `${Math.round(s * 100)}%`;
  }

  _bindEvents() {
    document.querySelectorAll('.paint-tool-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
        this.lineStart = null;
        this.polyPoints = [];
        this._drawOverlay();
        this._updateStatus();
      };
    });

    document.getElementById('btn-paint-apply').onclick = () => this.applyAndClose();
    document.getElementById('btn-paint-cancel').onclick = () => this.modal.close();

    document.getElementById('btn-paint-undo').onclick = () => this.undo();
    document.getElementById('btn-paint-redo').onclick = () => this.redo();
    document.getElementById('btn-paint-clear-sel').onclick = () => {
      this.selectionMask = null;
      this.polyPoints = [];
      this._drawOverlay();
    };

    // グレースケール生成
    document.getElementById('btn-gen-base-palette').onclick = () => {
      const pm = this.app.paletteManager;
      pm.basePaletteConfig.brightestHex = document.getElementById('inp-gray-max').value.trim() || '#FEFEFE';
      pm.basePaletteConfig.darkestHex = document.getElementById('inp-gray-min').value.trim() || '#404040';
      pm.basePaletteConfig.steps = parseInt(document.getElementById('inp-gray-steps').value) || 16;
      pm.generateBasePalette();
      this._renderPaletteUI();
    };

    // ★ マスクパレットに任意色を追加 (HSVカラーピッカー呼出) ★
    document.getElementById('btn-add-mask-custom-color').onclick = async () => {
      const picked = await this.app.colorPicker.open(this.currentColor);
      if (picked) {
        this.app.paletteManager.addColorToMaskPalette(picked);
        this.currentColor = picked;
        this._renderPaletteUI();
      }
    };

    // ★ 画像からスポイト抽出モーダルを開く ★
    document.getElementById('btn-open-image-sampler').onclick = () => {
      this._openSamplerModal();
    };

    document.getElementById('btn-paint-keybindings').onclick = () => this._openKeybindingDialog();

    this.viewport.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      const newZoom = Math.max(1, Math.min(64, this.zoomLevel * delta));
      const rect = this.viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ix = (cx - this.panX) / this.zoomLevel;
      const iy = (cy - this.panY) / this.zoomLevel;
      this.zoomLevel = newZoom;
      this.panX = Math.round(cx - ix * newZoom);
      this.panY = Math.round(cy - iy * newZoom);
      this._updateTransform();
    };

    const getCoords = (e) => {
      const rect = this.viewport.getBoundingClientRect();
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const px = Math.floor((cx - this.panX) / this.zoomLevel);
      const py = Math.floor((cy - this.panY) / this.zoomLevel);
      return { cx, cy, px, py };
    };

    this.viewport.onmousedown = (e) => {
      if (e.button === 1 || e.button === 2 || e.spaceKey) {
        this.isPanning = true;
        this.panStart = [e.clientX - this.panX, e.clientY - this.panY];
        return;
      }
      const { px, py } = getCoords(e);
      this._handleToolStart(px, py);
    };

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart[0];
        this.panY = e.clientY - this.panStart[1];
        this._updateTransform();
        return;
      }
      if (!this.modal.open) return;
      const { px, py } = getCoords(e);
      document.getElementById('paint-lbl-coord').textContent = `X: ${px}, Y: ${py}`;
      if (this.isDrawing) {
        this._handleToolMove(px, py);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) this.isPanning = false;
      if (this.isDrawing) {
        const { px, py } = getCoords(e);
        this._handleToolEnd(px, py);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!this.modal.open) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) this.redo(); else this.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        this.redo();
        return;
      }
      if (e.code === 'Escape' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyD')) {
        this.selectionMask = null;
        this.polyPoints = [];
        this._drawOverlay();
        return;
      }

      for (const [tool, code] of Object.entries(this.keybindings)) {
        if (e.code === code) {
          const btn = document.querySelector(`.paint-tool-btn[data-tool="${tool}"]`);
          if (btn) btn.click();
          break;
        }
      }
    });
  }

  // --- ★ 画像スポイトモーダル制御 (複数ピクセル選択対応) ★ ---
  _openSamplerModal() {
    this.samplerPickedColors.clear();
    this._renderSamplerPickedUI();
    this.samplerModal.showModal();

    if (!this.samplerLoadedImg && this.app.baseImage) {
      this._drawSamplerImage(this.app.baseImage);
    }
  }

  _drawSamplerImage(img) {
    this.samplerLoadedImg = img;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    this.samplerCanvas.width = w;
    this.samplerCanvas.height = h;

    this.samplerCtx.imageSmoothingEnabled = false;
    this.samplerCtx.drawImage(img, 0, 0, w, h);
  }

  _bindSamplerEvents() {
    document.getElementById('btn-close-sampler').onclick = () => this.samplerModal.close();

    // URLから読込 (CORS安全ハンドリング)
    document.getElementById('btn-sampler-load-url').onclick = async () => {
      const url = document.getElementById('inp-sampler-url').value.trim();
      if (!url) return alert('画像のURLを入力してください。');
      try {
        const img = await this.app.paletteManager.loadImageSafely(url);
        this._drawSamplerImage(img);
      } catch (err) {
        alert(err.message || '画像の読み込みに失敗しました。');
      }
    };

    // ローカルファイルから読込
    document.getElementById('btn-sampler-local-file').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = async () => {
        if (inp.files[0]) {
          try {
            const img = await this.app.paletteManager.loadImageSafely(inp.files[0]);
            this._drawSamplerImage(img);
          } catch (err) {
            alert(err.message || '画像の読み込みに失敗しました。');
          }
        }
      };
      inp.click();
    };

    // キャンバスクリックでピクセル色取得 (複数可能)
    this.samplerCanvas.onclick = (e) => {
      if (!this.samplerLoadedImg) return;
      const rect = this.samplerCanvas.getBoundingClientRect();
      const scaleX = this.samplerCanvas.width / rect.width;
      const scaleY = this.samplerCanvas.height / rect.height;
      const px = Math.floor((e.clientX - rect.left) * scaleX);
      const py = Math.floor((e.clientY - rect.top) * scaleY);

      if (px >= 0 && px < this.samplerCanvas.width && py >= 0 && py < this.samplerCanvas.height) {
        const p = this.samplerCtx.getImageData(px, py, 1, 1).data;
        if (p[3] > 0) { // 透明以外
          const hex = rgbToHex(p[0], p[1], p[2]);
          this.samplerPickedColors.add(hex);
          this._renderSamplerPickedUI();
        }
      }
    };

    // クリア
    document.getElementById('btn-sampler-clear').onclick = () => {
      this.samplerPickedColors.clear();
      this._renderSamplerPickedUI();
    };

    // パレットへ一括反映
    document.getElementById('btn-sampler-apply').onclick = () => {
      if (this.samplerPickedColors.size === 0) {
        return alert('画像上をクリックして色を1つ以上採取してください。');
      }
      this.samplerPickedColors.forEach(hex => {
        this.app.paletteManager.addColorToMaskPalette(hex);
      });
      this._renderPaletteUI();
      this.samplerModal.close();
    };
  }

  _renderSamplerPickedUI() {
    const container = document.getElementById('sampler-picked-swatches');
    container.innerHTML = '';

    this.samplerPickedColors.forEach(hex => {
      const b = document.createElement('span');
      b.className = 'color-swatch';
      b.style.backgroundColor = hex;
      b.title = `${hex} (クリックで削除)`;
      b.style.cursor = 'pointer';
      b.onclick = () => {
        this.samplerPickedColors.delete(hex);
        this._renderSamplerPickedUI();
      };
      container.appendChild(b);
    });
  }

  _handleToolStart(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.isDrawing = true;
    this.lastDrawPos = [x, y];

    if (this.currentTool === 'pencil') {
      this._pushHistory();
      this._drawPixel(x, y);
    } else if (this.currentTool === 'line') {
      this.lineStart = [x, y];
    } else if (this.currentTool === 'bucket') {
      this._pushHistory();
      this._floodFill(x, y, this.currentColor);
      this.isDrawing = false;
    } else if (this.currentTool === 'rectSelect') {
      this.selStart = [x, y];
    } else if (this.currentTool === 'polySelect') {
      this.polyPoints.push([x, y]);
      if (this.polyPoints.length >= 3 && Math.hypot(x - this.polyPoints[0][0], y - this.polyPoints[0][1]) <= 1) {
        this._finalizePolySelect();
      }
      this._drawOverlay();
      this.isDrawing = false;
    } else if (this.currentTool === 'wand') {
      this._magicWand(x, y);
      this.isDrawing = false;
    } else if (this.currentTool === 'colorSelect') {
      this._colorSelect(x, y);
      this.isDrawing = false;
    } else if (this.currentTool === 'text') {
      this._insertText(x, y);
      this.isDrawing = false;
    }
  }

  _handleToolMove(x, y) {
    if (this.currentTool === 'pencil') {
      const [lx, ly] = this.lastDrawPos;
      this._drawLineContinuous(lx, ly, x, y, (px, py) => this._drawPixel(px, py));
      this.lastDrawPos = [x, y];
    } else if (this.currentTool === 'line' || this.currentTool === 'rectSelect') {
      this._drawOverlay([x, y]);
    }
  }

  _handleToolEnd(x, y) {
    this.isDrawing = false;
    if (this.currentTool === 'line' && this.lineStart) {
      this._pushHistory();
      this._drawLineContinuous(this.lineStart[0], this.lineStart[1], x, y, (px, py) => this._drawPixel(px, py));
      this.lineStart = null;
      this._drawOverlay();
    } else if (this.currentTool === 'rectSelect' && this.selStart) {
      const x0 = Math.max(0, Math.min(this.selStart[0], x));
      const x1 = Math.min(this.width - 1, Math.max(this.selStart[0], x));
      const y0 = Math.max(0, Math.min(this.selStart[1], y));
      const y1 = Math.min(this.height - 1, Math.max(this.selStart[1], y));

      this.selectionMask = new Uint8Array(this.width * this.height);
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) {
          this.selectionMask[sy * this.width + sx] = 1;
        }
      }
      this.selStart = null;
      this._drawOverlay();
    }
  }

  _drawPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (this.selectionMask && !this.selectionMask[y * this.width + x]) return;

    this.ctx.fillStyle = this.currentColor;
    this.ctx.fillRect(x, y, 1, 1);
  }

  _drawLineContinuous(x0, y0, x1, y1, setPixel) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let curX = x0, curY = y0;

    while (true) {
      setPixel(curX, curY);
      if (curX === x1 && curY === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; curX += sx; }
      if (e2 <= dx) { err += dx; curY += sy; }
    }
  }

  _floodFill(startX, startY, fillHex) {
    if (this.selectionMask && !this.selectionMask[startY * this.width + startX]) return;

    const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
    const d = imgData.data;
    const startIdx = (startY * this.width + startX) * 4;
    const [sr, sg, sb, sa] = [d[startIdx], d[startIdx + 1], d[startIdx + 2], d[startIdx + 3]];
    const [fr, fg, fb] = hexToRgb(fillHex);
    if (sr === fr && sg === fg && sb === fb && sa === 255) return;

    const queue = [[startX, startY]];
    const visited = new Uint8Array(this.width * this.height);
    visited[startY * this.width + startX] = 1;

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      const idx = (cy * this.width + cx) * 4;
      d[idx] = fr; d[idx + 1] = fg; d[idx + 2] = fb; d[idx + 3] = 255;

      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
        const nPos = ny * this.width + nx;
        if (visited[nPos]) continue;
        if (this.selectionMask && !this.selectionMask[nPos]) continue;

        const nIdx = nPos * 4;
        if (d[nIdx] === sr && d[nIdx + 1] === sg && d[nIdx + 2] === sb && d[nIdx + 3] === sa) {
          visited[nPos] = 1;
          queue.push([nx, ny]);
        }
      }
    }
    this.ctx.putImageData(imgData, 0, 0);
  }

  _magicWand(startX, startY) {
    const d = this.ctx.getImageData(0, 0, this.width, this.height).data;
    const sIdx = (startY * this.width + startX) * 4;
    const [sr, sg, sb] = [d[sIdx], d[sIdx + 1], d[sIdx + 2]];

    this.selectionMask = new Uint8Array(this.width * this.height);
    const queue = [[startX, startY]];
    this.selectionMask[startY * this.width + startX] = 1;

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
        const nPos = ny * this.width + nx;
        if (this.selectionMask[nPos]) continue;

        const nIdx = nPos * 4;
        if (d[nIdx] === sr && d[nIdx + 1] === sg && d[nIdx + 2] === sb) {
          this.selectionMask[nPos] = 1;
          queue.push([nx, ny]);
        }
      }
    }
    this._drawOverlay();
  }

  _colorSelect(startX, startY) {
    const d = this.ctx.getImageData(0, 0, this.width, this.height).data;
    const sIdx = (startY * this.width + startX) * 4;
    const [sr, sg, sb] = [d[sIdx], d[sIdx + 1], d[sIdx + 2]];

    this.selectionMask = new Uint8Array(this.width * this.height);
    for (let i = 0; i < this.width * this.height; i++) {
      if (d[i * 4] === sr && d[i * 4 + 1] === sg && d[i * 4 + 2] === sb) {
        this.selectionMask[i] = 1;
      }
    }
    this._drawOverlay();
  }

  _finalizePolySelect() {
    if (this.polyPoints.length < 3) return;
    this.selectionMask = new Uint8Array(this.width * this.height);
    const pts = this.polyPoints;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const xi = pts[i][0], yi = pts[i][1];
          const xj = pts[j][0], yj = pts[j][1];
          const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) this.selectionMask[y * this.width + x] = 1;
      }
    }
    this.polyPoints = [];
  }

  _insertText(x, y) {
    const text = prompt('挿入するテキストを入力してください:');
    if (!text) return;
    const fontSize = parseInt(prompt('フォントサイズ (px):', '10')) || 10;

    const tCanvas = document.createElement('canvas');
    tCanvas.width = this.width;
    tCanvas.height = this.height;
    const tCtx = tCanvas.getContext('2d');
    tCtx.font = `${fontSize}px monospace`;
    tCtx.fillStyle = '#FFFFFF';
    tCtx.textBaseline = 'top';
    tCtx.fillText(text, x, y);

    const tData = tCtx.getImageData(0, 0, this.width, this.height).data;
    this._pushHistory();

    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        const idx = (py * this.width + px) * 4;
        if (tData[idx + 3] > 64) {
          this._drawPixel(px, py);
        }
      }
    }
  }

  _drawOverlay(curPos = null) {
    this.oCtx.clearRect(0, 0, this.width, this.height);

    if (this.selectionMask) {
      this.oCtx.fillStyle = 'rgba(0, 150, 255, 0.25)';
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.selectionMask[y * this.width + x]) {
            this.oCtx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    if (this.currentTool === 'line' && this.lineStart && curPos) {
      this.oCtx.fillStyle = this.currentColor;
      this._drawLineContinuous(this.lineStart[0], this.lineStart[1], curPos[0], curPos[1], (px, py) => {
        this.oCtx.fillRect(px, py, 1, 1);
      });
    }

    if (this.currentTool === 'rectSelect' && this.selStart && curPos) {
      this.oCtx.strokeStyle = '#FFFF00';
      this.oCtx.setLineDash([2, 2]);
      const x = Math.min(this.selStart[0], curPos[0]);
      const y = Math.min(this.selStart[1], curPos[1]);
      const w = Math.abs(curPos[0] - this.selStart[0]) + 1;
      const h = Math.abs(curPos[1] - this.selStart[1]) + 1;
      this.oCtx.strokeRect(x, y, w, h);
      this.oCtx.setLineDash([]);
    }

    if (this.polyPoints.length > 0) {
      this.oCtx.strokeStyle = '#00FF66';
      this.oCtx.beginPath();
      this.oCtx.moveTo(this.polyPoints[0][0] + 0.5, this.polyPoints[0][1] + 0.5);
      for (let i = 1; i < this.polyPoints.length; i++) {
        this.oCtx.lineTo(this.polyPoints[i][0] + 0.5, this.polyPoints[i][1] + 0.5);
      }
      this.oCtx.stroke();
    }
  }

  _openKeybindingDialog() {
    const d = document.getElementById('modal-keybindings');
    const tbody = document.querySelector('#table-keybindings tbody');
    tbody.innerHTML = '';

    const labels = {
      pencil: 'ドットブラシ',
      line: '直線 (連続)',
      bucket: '塗りつぶし',
      rectSelect: '矩形選択',
      polySelect: '多角形選択',
      wand: '自動選択 (Magic Wand)',
      colorSelect: '同色選択',
      text: 'テキスト挿入'
    };

    for (const [tool, code] of Object.entries(this.keybindings)) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${labels[tool]}</td><td><button class="btn-bind" data-tool="${tool}">${code}</button></td>`;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.btn-bind').forEach(btn => {
      btn.onclick = () => {
        btn.textContent = 'キー入力待ち...';
        const onKey = (e) => {
          e.preventDefault();
          this.keybindings[btn.dataset.tool] = e.code;
          btn.textContent = e.code;
          this.saveKeybindings();
          window.removeEventListener('keydown', onKey);
        };
        window.addEventListener('keydown', onKey, { once: true });
      };
    });

    d.showModal();
    document.getElementById('btn-close-keybindings').onclick = () => d.close();
  }

  _updateStatus() {
    document.getElementById('paint-lbl-tool').textContent = `ツール: ${this.currentTool}`;
  }
}