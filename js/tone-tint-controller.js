import { ColorSwatchDropdown } from './color-dropdown.js';

const MAX_UI_MASK_COLORS = 200;

export class ToneTintController {
  constructor(app) {
    this.app = app;
    this.selectedMaskTint = null;
    this.layerMaskDropdown = null;
    this.toneTargetDropdown = null;
  }

  bindEvents() {
    const layerMount = document.getElementById('mask-color-combo-wrap');
    const layerHidden = document.getElementById('mask-color-combo');
    if (layerMount) {
      this.layerMaskDropdown = new ColorSwatchDropdown(layerMount, layerHidden);
      this.layerMaskDropdown.setOptions([{ value: '', label: '(全体 / マスクなし)', colorHex: null }]);
    }

    const toneMount = document.getElementById('combo-tone-target-wrap');
    const toneHidden = document.getElementById('combo-tone-target');
    if (toneMount) {
      this.toneTargetDropdown = new ColorSwatchDropdown(toneMount, toneHidden);
      this.toneTargetDropdown.setOptions([{ value: '__ALL__', label: '全体 (デフォルト)', colorHex: null }]);
      this.toneTargetDropdown.onChange((val) => this.onToneTargetChanged(val));
    }

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

    document.getElementById('slider-tone-alpha').oninput = (e) => {
      this._getActiveTone().alpha_pct = parseFloat(e.target.value);
      document.getElementById('lbl-tone-alpha').textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
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

    const chkWin = document.getElementById('chk-window-darken');
    const sliderWin = document.getElementById('slider-window-darken-ratio');
    const btnReroll = document.getElementById('btn-window-darken-reroll');
    const chkAllSpec = document.getElementById('chk-window-darken-all-special');

    if (chkWin) {
      chkWin.onchange = (e) => {
        this.app.windowDarken.enabled = e.target.checked;
        this.app.markDirty();
        this.app.render();
      };
    }
    if (sliderWin) {
      sliderWin.oninput = (e) => {
        const val = parseInt(e.target.value, 10) || 0;
        this.app.windowDarken.ratio_pct = val;
        document.getElementById('lbl-window-darken-ratio').textContent = `${val}%`;
        this.app.markDirty();
        this.app.render();
      };
    }
    if (btnReroll) {
      btnReroll.onclick = () => {
        this.app.windowDarken.seed = Math.floor(Math.random() * 0x7FFFFFFF) + 1;
        this.app.markDirty();
        this.app.render();
      };
    }
    if (chkAllSpec) {
      chkAllSpec.onchange = (e) => {
        this.app.windowDarken.include_all_special = e.target.checked;
        this.app.markDirty();
        this.app.render();
      };
    }
  }

  setLayerMaskValue(hex) {
    if (!this.layerMaskDropdown) return;
    if (!hex) {
      this.layerMaskDropdown.setValue('');
    } else {
      this.layerMaskDropdown.addOptionIfMissing({
        value: hex,
        label: `${hex} (スポイト指定色)`,
        colorHex: hex
      });
    }
  }

  updateMaskCombos() {
    const totalColors = this.app.maskColors.length;
    const displayColors = this.app.maskColors.slice(0, MAX_UI_MASK_COLORS);

    const layerOpts = [{ value: '', label: '(全体 / マスクなし)', colorHex: null }];
    const toneOpts = [{ value: '__ALL__', label: '全体 (デフォルト)', colorHex: null }];

    for (let i = 0; i < displayColors.length; i++) {
      const { hex, count } = displayColors[i];
      const item = { value: hex, label: `${hex} (${count}px)`, colorHex: hex };
      layerOpts.push(item);
      toneOpts.push({ ...item });
    }

    if (totalColors > MAX_UI_MASK_COLORS) {
      const note = {
        value: '__MORE__',
        label: `--- 他 ${totalColors - MAX_UI_MASK_COLORS} 色はスポイトで選択可 ---`,
        colorHex: null,
        disabled: true
      };
      layerOpts.push(note);
      toneOpts.push({ ...note });
    }

    if (this.layerMaskDropdown) this.layerMaskDropdown.setOptions(layerOpts);
    if (this.toneTargetDropdown) this.toneTargetDropdown.setOptions(toneOpts);
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
    if (this.toneTargetDropdown && this.toneTargetDropdown.getValue() !== sel) {
      this.toneTargetDropdown.setValue(sel);
    }
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
    const alphaPct = cfg.alpha_pct !== undefined ? cfg.alpha_pct : 100.0;
    document.getElementById('dark-color-swatch').style.backgroundColor = cfg.dark_color_hex;
    document.getElementById('lbl-dark-color').textContent = cfg.dark_color_hex;
    document.getElementById('slider-min-dark').value = cfg.min_dark_pct;
    document.getElementById('lbl-min-dark').textContent = `${cfg.min_dark_pct.toFixed(1)}%`;
    document.getElementById('slider-max-bright').value = cfg.max_bright_pct;
    document.getElementById('lbl-max-bright').textContent = `${cfg.max_bright_pct.toFixed(1)}%`;
    document.getElementById('slider-tone-alpha').value = alphaPct;
    document.getElementById('lbl-tone-alpha').textContent = `${alphaPct.toFixed(1)}%`;
    document.getElementById('chk-enable-dodge').checked = cfg.enable_dodge;
    document.getElementById('dodge-color-swatch').style.backgroundColor = cfg.dodge_color_hex;
    document.getElementById('slider-dodge-strength').value = cfg.dodge_max_strength;
    document.getElementById('lbl-dodge-strength').textContent = `${cfg.dodge_max_strength.toFixed(1)}%`;
  }
}
