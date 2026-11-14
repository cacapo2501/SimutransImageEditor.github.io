const MAX_UI_MASK_COLORS = 200; // 多色画像でのDOMフリーズを防止するUI表示上限

export class ToneTintController {
  constructor(app) {
    this.app = app;
    this.selectedMaskTint = null;
  }

  bindEvents() {
    document.getElementById('chk-enable-blur').onchange = (e) => {
      this.app.enableBlur = e.target.checked;
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('slider-blur').oninput = (e) => {
      this.app.blurRadius = parseFloat(e.target.value);
      document.getElementById('lbl-blur-radius').textContent = `${this.app.blurRadius.toFixed(2)}px`;
      this.app.markDirty();
      this.app.render();
    };

    document.querySelectorAll('.btn-blur-step').forEach(btn => {
      btn.onclick = () => {
        this.app.blurRadius = Math.max(0, Math.min(10, Math.round((this.app.blurRadius + parseFloat(btn.dataset.delta)) * 100) / 100));
        document.getElementById('slider-blur').value = this.app.blurRadius;
        document.getElementById('lbl-blur-radius').textContent = `${this.app.blurRadius.toFixed(2)}px`;
        this.app.markDirty();
        this.app.render();
      };
    });

    document.getElementById('combo-tone-target').onchange = (e) => this.onToneTargetChanged(e.target.value);

    document.getElementById('chk-tone-override').onchange = (e) => {
      const sel = document.getElementById('combo-tone-target').value;
      if (sel !== '__ALL__') {
        if (!this.app.maskToneOverrides.has(sel)) {
          this.app.maskToneOverrides.set(sel, { ...this.app.globalTone, enabled: false });
        }
        this.app.maskToneOverrides.get(sel).enabled = e.target.checked;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('slider-min-dark').oninput = (e) => {
      this._getActiveTone().min_dark_pct = parseFloat(e.target.value);
      document.getElementById('lbl-min-dark').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('slider-max-bright').oninput = (e) => {
      this._getActiveTone().max_bright_pct = parseFloat(e.target.value);
      document.getElementById('lbl-max-bright').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('chk-enable-dodge').onchange = (e) => {
      this._getActiveTone().enable_dodge = e.target.checked;
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('slider-dodge-strength').oninput = (e) => {
      this._getActiveTone().dodge_max_strength = parseFloat(e.target.value);
      document.getElementById('lbl-dodge-strength').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('btn-pick-dark').onclick = async () => {
      const cfg = this._getActiveTone();
      const col = await this.app.colorPicker.open(cfg.dark_color_hex);
      if (col) {
        cfg.dark_color_hex = col;
        document.getElementById('dark-color-swatch').style.backgroundColor = col;
        document.getElementById('lbl-dark-color').textContent = col;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('btn-reset-dark').onclick = () => {
      const cfg = this._getActiveTone();
      cfg.dark_color_hex = '#000018';
      document.getElementById('dark-color-swatch').style.backgroundColor = '#000018';
      document.getElementById('lbl-dark-color').textContent = '#000018';
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('btn-pick-dodge').onclick = async () => {
      const cfg = this._getActiveTone();
      const col = await this.app.colorPicker.open(cfg.dodge_color_hex);
      if (col) {
        cfg.dodge_color_hex = col;
        document.getElementById('dodge-color-swatch').style.backgroundColor = col;
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('chk-enable-tint').onchange = (e) => {
      this.app.enableMaskTint = e.target.checked;
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('btn-pick-tint').onclick = async () => {
      if (!this.selectedMaskTint) return alert('マスク色を一覧から選択してください。');
      const cur = this.app.maskTintColors.get(this.selectedMaskTint) || this.selectedMaskTint;
      const col = await this.app.colorPicker.open(cur);
      if (col) {
        this.app.maskTintColors.set(this.selectedMaskTint, col);
        this.updateTintTable();
        this.app.markDirty();
        this.app.render();
      }
    };

    document.getElementById('btn-reset-tint').onclick = () => {
      if (!this.selectedMaskTint) return;
      this.app.maskTintColors.set(this.selectedMaskTint, this.selectedMaskTint);
      this.updateTintTable();
      this.app.markDirty();
      this.app.render();
    };

    document.getElementById('btn-reset-all-tints').onclick = () => {
      this.app.maskColors.forEach(({ hex }) => this.app.maskTintColors.set(hex, hex));
      this.updateTintTable();
      this.app.markDirty();
      this.app.render();
    };
  }

  // 一括文字列結合と件数上限により、数千〜数万色でもDOMフリーズを完全防止
  updateMaskCombos() {
    const comboLayer = document.getElementById('mask-color-combo');
    const comboTone = document.getElementById('combo-tone-target');
    if (!comboLayer || !comboTone) return;

    const totalColors = this.app.maskColors.length;
    const displayColors = this.app.maskColors.slice(0, MAX_UI_MASK_COLORS);

    const layerOpts = ['<option value="">(全体 / マスクなし)</option>'];
    const toneOpts = ['<option value="__ALL__">全体 (デフォルト)</option>'];

    for (let i = 0; i < displayColors.length; i++) {
      const { hex, count } = displayColors[i];
      const opt = `<option value="${hex}">${hex} (${count}px)</option>`;
      layerOpts.push(opt);
      toneOpts.push(opt);
    }

    if (totalColors > MAX_UI_MASK_COLORS) {
      const note = `<option value="" disabled>--- 他 ${totalColors - MAX_UI_MASK_COLORS} 色はスポイトで選択可 ---</option>`;
      layerOpts.push(note);
      toneOpts.push(note);
    }

    comboLayer.innerHTML = layerOpts.join('');
    comboTone.innerHTML = toneOpts.join('');
  }

  updateTintTable() {
    const tbody = document.querySelector('#tint-table tbody');
    const descEl = document.getElementById('lbl-tint-desc');
    if (!tbody) return;

    const totalColors = this.app.maskColors.length;
    const displayColors = this.app.maskColors.slice(0, MAX_UI_MASK_COLORS);

    if (descEl) {
      descEl.textContent = totalColors > MAX_UI_MASK_COLORS
        ? `各マスク色の範囲に指定カラーを乗算します（全${totalColors}色中、上位${MAX_UI_MASK_COLORS}色を表示）。`
        : '各マスク色の範囲に指定カラーを乗算します。';
    }

    const rowsHtml = displayColors.map(({ hex }) => {
      const tintHex = this.app.maskTintColors.get(hex) || hex;
      const selClass = hex === this.selectedMaskTint ? ' class="selected"' : '';
      return `<tr data-hex="${hex}"${selClass}><td><span class="color-swatch" style="background:${hex}"></span> ${hex}</td><td><span class="color-swatch" style="background:${tintHex}"></span> ${tintHex}</td></tr>`;
    });

    tbody.innerHTML = rowsHtml.join('');

    // イベント委譲で1つだけリスナー登録（行数に比例するメモリ消費を削減）
    tbody.onclick = (e) => {
      const tr = e.target.closest('tr');
      if (!tr || !tr.dataset.hex) return;
      const hex = tr.dataset.hex;
      const tintHex = this.app.maskTintColors.get(hex) || hex;

      tbody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      document.getElementById('sel-tint-swatch').style.backgroundColor = tintHex;
      document.getElementById('lbl-sel-tint-info').textContent = `${hex} -> ${tintHex}`;
      this.selectedMaskTint = hex;
    };
  }

  _getActiveTone() {
    const sel = document.getElementById('combo-tone-target').value;
    if (sel === '__ALL__') return this.app.globalTone;
    if (!this.app.maskToneOverrides.has(sel)) {
      this.app.maskToneOverrides.set(sel, { ...this.app.globalTone, enabled: false });
    }
    return this.app.maskToneOverrides.get(sel);
  }

  onToneTargetChanged(sel) {
    const chk = document.getElementById('chk-tone-override');
    if (sel === '__ALL__') {
      chk.disabled = true;
      chk.checked = false;
      this._loadToneToUI(this.app.globalTone);
    } else {
      chk.disabled = false;
      const cfg = this.app.maskToneOverrides.get(sel) || { ...this.app.globalTone, enabled: false };
      chk.checked = cfg.enabled;
      this._loadToneToUI(cfg);
    }
  }

  _loadToneToUI(cfg) {
    document.getElementById('dark-color-swatch').style.backgroundColor = cfg.dark_color_hex;
    document.getElementById('lbl-dark-color').textContent = cfg.dark_color_hex;
    document.getElementById('slider-min-dark').value = cfg.min_dark_pct;
    document.getElementById('lbl-min-dark').textContent = `${cfg.min_dark_pct.toFixed(1)}%`;
    document.getElementById('slider-max-bright').value = cfg.max_bright_pct;
    document.getElementById('lbl-max-bright').textContent = `${cfg.max_bright_pct.toFixed(1)}%`;
    document.getElementById('chk-enable-dodge').checked = cfg.enable_dodge;
    document.getElementById('dodge-color-swatch').style.backgroundColor = cfg.dodge_color_hex;
    document.getElementById('slider-dodge-strength').value = cfg.dodge_max_strength;
    document.getElementById('lbl-dodge-strength').textContent = `${cfg.dodge_max_strength.toFixed(1)}%`;
  }
}
