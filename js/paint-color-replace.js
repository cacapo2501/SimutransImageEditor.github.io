import { hexToRgb, rgbToHex } from './color-utils.js';
import { getCurrentPaletteColors } from './paint-palette-ui.js';

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

    this.replaceRules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.className = 'replace-rule-row';
      row.style.flexWrap = 'wrap';

      const paletteOpts = paletteColors.map(hex => {
        const sel = hex.toUpperCase() === rule.to.toUpperCase() ? ' selected' : '';
        return `<option value="${hex}"${sel}>${hex}</option>`;
      }).join('');

      row.innerHTML = `
        <span>元:</span>
        <button type="button" class="btn-color-pick btn-from" title="カラーピッカーで選択">
          <span class="color-swatch" style="background:${rule.from};"></span>
          <span>${rule.from}</span>
        </button>
        <button type="button" class="btn-pick-canvas-from" title="編集中の画像からカラーピッカー(スポイト)で取得">🎯 画像採取</button>
        <span class="arrow">➔</span>
        <span>先:</span>
        <span class="color-swatch swatch-to-preview" style="background:${rule.to};"></span>
        <select class="sel-to-palette" title="現在使用中のパレットから選択" style="background:#141414; border:1px solid #444; color:#eee; padding:3px; border-radius:3px; font-size:11px;">
          ${paletteOpts || `<option value="${rule.to}">${rule.to}</option>`}
        </select>
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

      const selTo = row.querySelector('.sel-to-palette');
      if (selTo) {
        if (!paletteColors.some(c => c.toUpperCase() === rule.to.toUpperCase()) && paletteColors.length > 0) {
          rule.to = paletteColors[0];
          selTo.value = rule.to;
          row.querySelector('.swatch-to-preview').style.backgroundColor = rule.to;
        }
        selTo.onchange = (e) => {
          rule.to = e.target.value;
          row.querySelector('.swatch-to-preview').style.backgroundColor = rule.to;
        };
      }

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
