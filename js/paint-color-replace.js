import { parseHexColor, rgbaToHex, colorHexToCss, normalizeColorHex } from './color-utils.js';
import { getCurrentPaletteColors, isAlphaSupportedTarget } from './paint-palette-ui.js';
import { ColorSwatchDropdown } from './color-dropdown.js';

export class PaintColorReplaceController {
  constructor(editor) {
    this.editor = editor;
    this.replaceModal = document.getElementById('modal-color-replace');
    this.replaceRules = [];
    this.pickingRuleIdx = null;
    this.pickSubMode = 'hand'; // 'hand' (デフォルト) | 'pick'
    this.candidateHex = null;
    this._bindEvents();
  }

  isPicking() {
    return this.pickingRuleIdx !== null;
  }

  isHandMode() {
    return this.pickingRuleIdx !== null && this.pickSubMode === 'hand';
  }

  openDialog() {
    if (!this.replaceModal) {
      this.replaceModal = document.getElementById('modal-color-replace');
      this._bindEvents();
    }
    this.pickingRuleIdx = null;
    this._updatePickBarUI();
    const paletteColors = getCurrentPaletteColors(this.editor);
    const defaultTo = paletteColors.length > 0 ? paletteColors[0] : '#FFFFFF';
    this.replaceRules = [{ from: this.editor.currentColor || '#000000', to: defaultTo }];
    this._renderRulesUI();
    this.replaceModal.showModal();
  }

  _startCanvasPick(ruleIdx) {
    this.pickingRuleIdx = ruleIdx;
    this.pickSubMode = 'hand'; // 明示的なハンドスクロールをデフォルトに設定
    this.candidateHex = this.replaceRules[ruleIdx]?.from || '#000000';
    this.replaceModal.close();
    this._updatePickBarUI();
    this.editor.updateCursor();
    this.editor._showHint('✋ ハンドスクロールで位置を調整し、「🎯 色取得」に切り替えて色を選択後「✓ OK」を押してください');
  }

  _setPickSubMode(mode) {
    this.pickSubMode = mode;
    this._updatePickBarUI();
    this.editor.updateCursor();
    if (mode === 'hand') {
      this.editor._showHint('✋ ハンドスクロール中: ドラッグで画像を移動できます');
    } else {
      this.editor._showHint('🎯 色取得中: 画像をクリック/タップして色をプレビューし、「✓ OK」で確定します');
    }
  }

  _updatePickBarUI() {
    const bar = document.getElementById('color-replace-pick-bar');
    if (!bar) return;
    if (this.pickingRuleIdx === null) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    const btnHand = document.getElementById('btn-replace-pick-hand');
    const btnEye = document.getElementById('btn-replace-pick-eyedropper');
    if (btnHand) btnHand.classList.toggle('active', this.pickSubMode === 'hand');
    if (btnEye) btnEye.classList.toggle('active', this.pickSubMode === 'pick');

    const sw = document.getElementById('replace-pick-preview-swatch');
    const lbl = document.getElementById('replace-pick-preview-hex');
    if (sw) sw.style.background = colorHexToCss(this.candidateHex || '#000000');
    if (lbl) lbl.textContent = this.candidateHex || '#000000';
  }

  // 編集中キャンバスから色を取得してプレビュー更新（すぐには閉じない）
  handleCanvasPick(px, py) {
    if (this.pickingRuleIdx === null) return false;
    if (this.pickSubMode !== 'pick') return false;

    const ed = this.editor;
    if (px >= 0 && px < ed.width && py >= 0 && py < ed.height) {
      const p = ed.ctx.getImageData(px, py, 1, 1).data;
      const allowAlpha = isAlphaSupportedTarget(ed.targetType);
      this.candidateHex = (allowAlpha && p[3] === 0)
        ? '#00000000'
        : rgbaToHex(p[0], p[1], p[2], allowAlpha ? p[3] : 255);
      this._updatePickBarUI();
      ed._showHint(`🎯 プレビュー中: ${this.candidateHex} （「✓ OK」で取り込み）`);
    }
    return true;
  }

  confirmCanvasPick() {
    if (this.pickingRuleIdx === null) return false;
    if (this.candidateHex && this.replaceRules[this.pickingRuleIdx]) {
      this.replaceRules[this.pickingRuleIdx].from = this.candidateHex;
    }
    this.pickingRuleIdx = null;
    this._updatePickBarUI();
    this.editor._updateStatus();
    this._renderRulesUI();
    this.replaceModal.showModal();
    return true;
  }

  cancelCanvasPick() {
    if (this.pickingRuleIdx === null) return false;
    this.pickingRuleIdx = null;
    this._updatePickBarUI();
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
      colorHex: colorHexToCss(hex)
    }));

    this.replaceRules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.className = 'replace-rule-row';
      row.style.flexWrap = 'wrap';

      row.innerHTML = `
        <span>元:</span>
        <button type="button" class="btn-color-pick btn-from" title="カラーピッカーで選択">
          <span class="color-swatch" style="background:${colorHexToCss(rule.from)};"></span>
          <span>${rule.from}</span>
        </button>
        <button type="button" class="btn-pick-canvas-from" title="編集中の画像からスクロール・プレビュー付きで色を取得">🎯 画像から取得</button>
        <span class="arrow">➔</span>
        <span>先:</span>
        <div class="to-palette-dd-mount" style="min-width:125px; flex:1;"></div>
        <button type="button" class="btn-del-rule" style="margin-left:auto; color:#ff6b6b;">✕</button>
      `;

      row.querySelector('.btn-from').onclick = async () => {
        const picked = await this.editor.app.colorPicker.open(rule.from, {
          enableAlpha: isAlphaSupportedTarget(this.editor.targetType)
        });
        if (picked) {
          rule.from = normalizeColorHex(picked) || picked;
          this._renderRulesUI();
        }
      };

      row.querySelector('.btn-pick-canvas-from').onclick = () => {
        this._startCanvasPick(idx);
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

    // 色取得フローティングバーのイベント
    document.getElementById('btn-replace-pick-hand')?.addEventListener('click', () => this._setPickSubMode('hand'));
    document.getElementById('btn-replace-pick-eyedropper')?.addEventListener('click', () => this._setPickSubMode('pick'));
    document.getElementById('btn-replace-pick-ok')?.addEventListener('click', () => this.confirmCanvasPick());
    document.getElementById('btn-replace-pick-cancel')?.addEventListener('click', () => this.cancelCanvasPick());
  }

  execute() {
    if (this.replaceRules.length === 0) return;

    const ed = this.editor;
    const selectionOnly = document.getElementById('chk-replace-selection-only').checked;
    const mask = selectionOnly ? ed.selectionMask : null;

    const preparedRules = this.replaceRules.map(r => ({
      fromRgba: parseHexColor(r.from),
      toRgba: parseHexColor(r.to)
    }));

    const beforeSnap = ed._captureHistoryState ? ed._captureHistoryState() : null;
    const before = (selectionOnly && ed.repeatMgr) ? ed.repeatMgr.snapshotBefore() : null;
    const imgData = ed.ctx.getImageData(0, 0, ed.width, ed.height);
    const d = imgData.data;
    let replacedCount = 0;

    for (let y = 0; y < ed.height; y++) {
      for (let x = 0; x < ed.width; x++) {
        const pIdx = y * ed.width + x;
        if (mask && !mask[pIdx]) continue;

        const idx = pIdx * 4;
        const r = d[idx], g = d[idx + 1], b = d[idx + 2], a = d[idx + 3];

        for (const rule of preparedRules) {
          const fr = rule.fromRgba;
          if (r === fr[0] && g === fr[1] && b === fr[2] && a === fr[3]) {
            const tr = rule.toRgba;
            d[idx] = tr[0];
            d[idx + 1] = tr[1];
            d[idx + 2] = tr[2];
            d[idx + 3] = tr[3];
            replacedCount++;
            break;
          }
        }
      }
    }

    if (replacedCount > 0) {
      if (beforeSnap) ed._pushHistory(beforeSnap);
      else ed._pushHistory();
      ed.ctx.putImageData(imgData, 0, 0);
      if (selectionOnly && ed.repeatMgr && before) ed.repeatMgr.applyDiff(before);
    }
    ed._drawOverlay();
    this.replaceModal.close();
    alert(`色置換が完了しました。（${replacedCount} ピクセルを置換）`);
  }
}
