import { hexToRgb, rgbToHex } from './color-utils.js';
import { getCurrentPaletteColors } from './paint-palette-ui.js';
import { ColorSwatchDropdown } from './color-dropdown.js';

export class PaintColorReplaceController {
  constructor(editor) {
    this.editor = editor;
    this.replaceModal = document.getElementById('modal-color-replace');
    this.replaceRules = [];
    this.pickingRuleIdx = null;
    this._bindEvents();
  }

  openDialog() {
    if (!this.replaceModal) {
      this.replaceModal = document.getElementById('modal-color-replace');
      this._bindEvents();
    }
    this.pickingRuleIdx = null;
    const paletteColors = getCurrentPaletteColors(this.editor);
    const defaultTo = paletteColors.length > 0 ? paletteColors[0] : '#FFFFFF';
    this.replaceRules = [{ from: this.editor.currentColor || '#000000', to: defaultTo }];
    this._renderRulesUI();
    this.replaceModal.showModal();
  }

  handleCanvasPick(px, py) {
    if (this.pickingRuleIdx === null) return false;
    const ed = this.editor;
    if (px >= 0 && px < ed.width && py >= 0 && py < ed.height) {
      const p = ed.ctx.getImageData(px, py, 1, 1).data;
      const hex = rgbToHex(p[0], p[1], p[2]);
      if (this.replaceRules[this.pickingRuleIdx]) {
        this.replaceRules[this.pickingRuleIdx].from = hex;
      }
    }
    this.pickingRuleIdx = null;
    ed._updateStatus();
    this._renderRulesUI();
    this.replaceModal.showModal();
    return true;
  }

  cancelCanvasPick() {
    if (this.pickingRuleIdx === null) return false;
    this.pickingRuleIdx = null;
    this.editor._updateStatus();
    this._renderRulesUI();
    this.replaceModal.showModal();
    return true;
  }

  _renderRulesUI() {
    const container = document.getElementById('replace-rules-container');
    if (!container) return;
    container.innerHTML = '';

    const paletteColors = getCurrentPaletteColors(this.editor);
    const paletteOptions = paletteColors.map(hex => ({
      value: hex,
      label: hex,
      colorHex: hex
    }));

    this.replaceRules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.className = 'replace-rule-row';
      row.style.flexWrap = 'wrap';

      row.innerHTML = `
        <span>元:</span>
        <button type="button" class="btn-color-pick btn-from" title="カラーピッカーで選択">
          <span class="color-swatch" style="background:${rule.from};"></span>
          <span>${rule.from}</span>
        </button>
        <button type="button" class="btn-pick-canvas-from" title="編集中の画像からスポイトで取得">🎯 画像採取</button>
        <span class="arrow">➔</span>
        <span>先:</span>
        <div class="to-palette-dd-mount" style="min-width:125px; flex:1;"></div>
        <button type="button" class="btn-del-rule" style="margin-left:auto; color:#ff6b6b;">✕</button>
      `;

      row.querySelector('.btn-from').onclick = async () => {
        const picked = await this.editor.app.colorPicker.open(rule.from);
        if (picked) {
          rule.from = picked;
          this._renderRulesUI();
        }
      };

      row.querySelector('.btn-pick-canvas-from').onclick = () => {
        this.pickingRuleIdx = idx;
        this.replaceModal.close();
        this.editor._showHint('🎯【色置換】置換前の色にしたいピクセルを編集中の画像上でクリック/タップしてください (Escでキャンセル)');
      };

      const ddMount = row.querySelector('.to-palette-dd-mount');
      const dd = new ColorSwatchDropdown(ddMount);
      if (paletteOptions.length > 0) {
        dd.setOptions(paletteOptions);
        if (paletteColors.some(c => c.toUpperCase() === rule.to.toUpperCase())) {
          dd.setValue(rule.to.toUpperCase());
        } else {
          rule.to = paletteOptions[0].value;
          dd.setValue(rule.to);
        }
      } else {
        dd.setOptions([{ value: rule.to, label: rule.to, colorHex: rule.to }]);
        dd.setValue(rule.to);
      }
      dd.onChange((val) => {
        rule.to = val;
      });

      row.querySelector('.btn-del-rule').onclick = () => {
        if (this.replaceRules.length > 1) {
          this.replaceRules.splice(idx, 1);
          this._renderRulesUI();
        }
      };

      container.appendChild(row);
    });
  }

  _bindEvents() {
    if (!this.replaceModal || this.replaceModal.dataset.bound === '1') return;
    this.replaceModal.dataset.bound = '1';

    document.getElementById('btn-close-replace').onclick = () => this.replaceModal.close();
    document.getElementById('btn-cancel-replace').onclick = () => this.replaceModal.close();

    document.getElementById('btn-add-replace-rule').onclick = () => {
      const paletteColors = getCurrentPaletteColors(this.editor);
      const defaultTo = paletteColors.length > 0 ? paletteColors[0] : '#FFFFFF';
      this.replaceRules.push({ from: this.editor.currentColor || '#000000', to: defaultTo });
      this._renderRulesUI();
    };

    document.getElementById('btn-execute-replace').onclick = () => this.execute();
  }

  execute() {
    if (this.replaceRules.length === 0) return;

    const ed = this.editor;
    const selectionOnly = document.getElementById('chk-replace-selection-only').checked;
    const mask = selectionOnly ? ed.selectionMask : null;

    const preparedRules = this.replaceRules.map(r => ({
      fromRgb: hexToRgb(r.from),
      toRgb: hexToRgb(r.to)
    }));

    ed._pushHistory();
    const before = (selectionOnly && ed.repeatMgr) ? ed.repeatMgr.snapshotBefore() : null;
    const imgData = ed.ctx.getImageData(0, 0, ed.width, ed.height);
    const d = imgData.data;
    let replacedCount = 0;

    for (let y = 0; y < ed.height; y++) {
      for (let x = 0; x < ed.width; x++) {
        const pIdx = y * ed.width + x;
        if (mask && !mask[pIdx]) continue;

        const idx = pIdx * 4;
        if (d[idx + 3] === 0) continue;

        const r = d[idx], g = d[idx + 1], b = d[idx + 2];

        for (const rule of preparedRules) {
          if (r === rule.fromRgb[0] && g === rule.fromRgb[1] && b === rule.fromRgb[2]) {
            d[idx] = rule.toRgb[0];
            d[idx + 1] = rule.toRgb[1];
            d[idx + 2] = rule.toRgb[2];
            replacedCount++;
            break;
          }
        }
      }
    }

    ed.ctx.putImageData(imgData, 0, 0);
    if (selectionOnly && ed.repeatMgr && before) ed.repeatMgr.applyDiff(before);
    ed._drawOverlay();
    this.replaceModal.close();
    alert(`色置換が完了しました。（${replacedCount} ピクセルを置換）`);
  }
}
