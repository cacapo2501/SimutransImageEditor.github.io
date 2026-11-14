export class PaintOnionSkinManager {
  constructor(editor) {
    this.editor = editor;
    this.skins = [];
    this.selectedId = null;
    this._nextId = 1;
  }

  // エディタ終了・保存時にオニオンスキンを完全に破棄（本体画像には一切出力しない）
  clearAll() {
    this.skins = [];
    this.selectedId = null;
    this.renderUI();
    if (this.editor && this.editor.oCtx) {
      this.editor._drawOverlay();
    }
  }

  bindEvents() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    bindClick('btn-onion-add', () => this.openFilePicker());
    bindClick('btn-onion-clear', () => this.clearAll());

    bindClick('btn-onion-x-minus', () => this.nudgeSelected(-1, 0));
    bindClick('btn-onion-x-plus', () => this.nudgeSelected(1, 0));
    bindClick('btn-onion-y-minus', () => this.nudgeSelected(0, -1));
    bindClick('btn-onion-y-plus', () => this.nudgeSelected(0, 1));

    const inpX = document.getElementById('inp-onion-x');
    if (inpX) {
      inpX.oninput = (e) => {
        const s = this.getSelected();
        if (!s) return;
        s.x = parseInt(e.target.value, 10) || 0;
        this.editor._drawOverlay();
      };
    }

    const inpY = document.getElementById('inp-onion-y');
    if (inpY) {
      inpY.oninput = (e) => {
        const s = this.getSelected();
        if (!s) return;
        s.y = parseInt(e.target.value, 10) || 0;
        this.editor._drawOverlay();
      };
    }

    const sliderOp = document.getElementById('slider-onion-opacity');
    if (sliderOp) {
      sliderOp.oninput = (e) => {
        const s = this.getSelected();
        if (!s) return;
        s.opacity = parseFloat(e.target.value);
        const lbl = document.getElementById('lbl-onion-opacity');
        if (lbl) lbl.textContent = `${Math.round(s.opacity * 100)}%`;
        this.editor._drawOverlay();
      };
    }

    const chkTrans = document.getElementById('chk-onion-trans-e7ffff');
    if (chkTrans) {
      chkTrans.onchange = (e) => {
        const s = this.getSelected();
        if (!s) return;
        s.transE7ffff = e.target.checked;
        this.editor._drawOverlay();
      };
    }
  }

  getSelected() {
    return this.skins.find(s => s.id === this.selectedId) || null;
  }

  nudgeSelected(dx, dy) {
    const s = this.getSelected();
    if (!s) return;
    s.x += dx;
    s.y += dy;
    this._syncSelectedControls();
    this.editor._drawOverlay();
  }

  openFilePicker() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.onchange = async () => {
      if (!inp.files || inp.files.length === 0) return;
      for (const file of Array.from(inp.files)) {
        try {
          const img = await this.editor.app.paletteManager.loadImageSafely(file);
          this._addSkinFromImage(img, file.name);
        } catch (err) {
          alert(`オニオンスキン画像の読込に失敗しました (${file.name}): ${err.message || err}`);
        }
      }
      this.renderUI();
      this.editor._drawOverlay();
    };
    inp.click();
  }

  _addSkinFromImage(img, name) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = w;
    rawCanvas.height = h;
    const rCtx = rawCanvas.getContext('2d');
    rCtx.imageSmoothingEnabled = false;
    rCtx.drawImage(img, 0, 0);

    const transCanvas = document.createElement('canvas');
    transCanvas.width = w;
    transCanvas.height = h;
    const tCtx = transCanvas.getContext('2d');
    tCtx.imageSmoothingEnabled = false;
    tCtx.drawImage(rawCanvas, 0, 0);
    const imgData = tCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 231 && d[i + 1] === 255 && d[i + 2] === 255) {
        d[i + 3] = 0;
      }
    }
    tCtx.putImageData(imgData, 0, 0);

    const id = this._nextId++;
    this.skins.push({
      id,
      name: name || `ref_${id}.png`,
      rawCanvas,
      transCanvas,
      width: w,
      height: h,
      x: 0,
      y: 0,
      opacity: 0.45,
      visible: true,
      transE7ffff: true
    });
    this.selectedId = id;
  }

  removeSkin(id) {
    this.skins = this.skins.filter(s => s.id !== id);
    if (this.selectedId === id) {
      this.selectedId = this.skins.length > 0 ? this.skins[this.skins.length - 1].id : null;
    }
    this.renderUI();
    this.editor._drawOverlay();
  }

  renderUI() {
    const listEl = document.getElementById('onion-skin-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.skins.length === 0) {
      listEl.innerHTML = '<div class="info-text" style="text-align:center; padding:4px 0;">未登録（保存時には出力されません）</div>';
      this._syncSelectedControls();
      return;
    }

    this.skins.forEach(s => {
      const row = document.createElement('div');
      row.className = 'onion-item-row' + (s.id === this.selectedId ? ' selected' : '');

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = s.visible;
      chk.title = '表示/非表示';
      chk.onclick = (e) => {
        e.stopPropagation();
        s.visible = chk.checked;
        this.editor._drawOverlay();
      };

      const lbl = document.createElement('span');
      lbl.className = 'onion-item-name';
      lbl.textContent = `${s.name} (${s.x},${s.y})`;
      lbl.title = `${s.name} [${s.width}×${s.height}px]`;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '✕';
      delBtn.style.padding = '1px 5px';
      delBtn.style.color = '#ff7b7b';
      delBtn.title = '削除';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        this.removeSkin(s.id);
      };

      row.onclick = () => {
        this.selectedId = s.id;
        this.renderUI();
      };

      row.appendChild(chk);
      row.appendChild(lbl);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });

    this._syncSelectedControls();
  }

  _syncSelectedControls() {
    const ctrlWrap = document.getElementById('onion-selected-controls');
    const s = this.getSelected();
    if (!ctrlWrap) return;

    if (!s) {
      ctrlWrap.style.display = 'none';
      return;
    }

    ctrlWrap.style.display = 'block';
    const inpX = document.getElementById('inp-onion-x');
    const inpY = document.getElementById('inp-onion-y');
    const sliderOp = document.getElementById('slider-onion-opacity');
    const lblOp = document.getElementById('lbl-onion-opacity');
    const chkTrans = document.getElementById('chk-onion-trans-e7ffff');

    if (inpX) inpX.value = s.x;
    if (inpY) inpY.value = s.y;
    if (sliderOp) sliderOp.value = s.opacity;
    if (lblOp) lblOp.textContent = `${Math.round(s.opacity * 100)}%`;
    if (chkTrans) chkTrans.checked = s.transE7ffff;
  }

  // プレビュー専用オーバーレイキャンバス(oCtx)にのみ描画するため、本体キャンバスには一切書き込まない
  drawOverlay(oCtx) {
    if (this.skins.length === 0) return;

    oCtx.save();
    oCtx.imageSmoothingEnabled = false;
    for (let i = 0; i < this.skins.length; i++) {
      const s = this.skins[i];
      if (!s.visible || s.opacity <= 0) continue;
      oCtx.globalAlpha = s.opacity;
      const src = s.transE7ffff ? s.transCanvas : s.rawCanvas;
      oCtx.drawImage(src, s.x, s.y);
    }
    oCtx.restore();
  }
}