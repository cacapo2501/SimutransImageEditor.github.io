export class ToneTintController {
  constructor(app) {
    this.app = app;
    this.selectedMaskTint = null;
  }

  bindEvents() {
    // ぼかし制御
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

    // トーン制御
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

    // マスクカラー乗算 (Tint) 制御
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

  updateMaskCombos() {
    const comboLayer = document.getElementById('mask-color-combo');
    const comboTone = document.getElementById('combo-tone-target');
    if (!comboLayer || !comboTone) return;
    comboLayer.innerHTML = '<option value="">(全体 / マスクなし)</option>';
    comboTone.innerHTML = '<option value="__ALL__">全体 (デフォルト)</option>';
    this.app.maskColors.forEach(({ hex, count }) => {
      const opt = `<option value="${hex}">${hex} (${count}px)</option>`;
      comboLayer.innerHTML += opt;
      comboTone.innerHTML += opt;
    });
  }

  updateTintTable() {
    const tbody = document.querySelector('#tint-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    this.app.maskColors.forEach(({ hex }) => {
      const tintHex = this.app.maskTintColors.get(hex) || hex;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="color-swatch" style="background:${hex}"></span> ${hex}</td>
                      <td><span class="color-swatch" style="background:${tintHex}"></span> ${tintHex}</td>`;
      tr.onclick = () => {
        document.querySelectorAll('#tint-table tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        document.getElementById('sel-tint-swatch').style.backgroundColor = tintHex;
        document.getElementById('lbl-sel-tint-info').textContent = `${hex} -> ${tintHex}`;
        this.selectedMaskTint = hex;
      };
      tbody.appendChild(tr);
    });
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
