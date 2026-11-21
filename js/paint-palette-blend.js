import {
  parseHexColor, rgbaToHex, colorHexToCss, rgbToHsv, hsvToRgb, hexToInt
} from './color-utils.js';
import { getCurrentPaletteColors, renderEditorPaletteUI, isAlphaSupportedTarget } from './paint-palette-ui.js';
import { ColorSwatchDropdown } from './color-dropdown.js';

export function computeIntermediateColors(hex1, hex2, steps, space = 'rgb', avoidSpecialSet = null, enableAlpha = true) {
  const count = Math.max(1, Math.min(16, parseInt(steps, 10) || 1));
  const [r1, g1, b1, a1] = parseHexColor(hex1);
  const [r2, g2, b2, a2] = parseHexColor(hex2);
  const [h1, s1, v1] = rgbToHsv(r1, g1, b1);
  const [h2, s2, v2] = rgbToHsv(r2, g2, b2);

  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;

  const specialInts = new Set([0xE7FFFF]);
  if (avoidSpecialSet) {
    avoidSpecialSet.forEach(h => specialInts.add(hexToInt(h)));
  }

  const results = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    let r, g, b;
    const a = enableAlpha ? Math.round(a1 + (a2 - a1) * t) : 255;

    if (space === 'hsv') {
      const h = (h1 + dh * t + 360) % 360;
      const s = s1 + (s2 - s1) * t;
      const v = v1 + (v2 - v1) * t;
      [r, g, b] = hsvToRgb(h, s, v);
    } else {
      r = Math.round(r1 + (r2 - r1) * t);
      g = Math.round(g1 + (g2 - g1) * t);
      b = Math.round(b1 + (b2 - b1) * t);
    }

    if (avoidSpecialSet && a === 255) {
      let rgbInt = (r << 16) | (g << 8) | b;
      let guard = 0;
      while (specialInts.has(rgbInt) && guard < 10) {
        r = r > 0 ? r - 1 : r + 1;
        rgbInt = (r << 16) | (g << 8) | b;
        guard++;
      }
    }

    results.push(rgbaToHex(r, g, b, a));
  }
  return results;
}

export class PaintPaletteBlendController {
  constructor(editor) {
    this.editor = editor;
    this.modal = null;
    this.ddColor1 = null;
    this.ddColor2 = null;
    this.generatedColors = [];
    this.bound = false;
  }

  _ensureBound() {
    this.modal = document.getElementById('modal-palette-blend');
    if (!this.modal || this.bound) return;
    this.bound = true;

    this.ddColor1 = new ColorSwatchDropdown(document.getElementById('blend-color1-mount'));
    this.ddColor2 = new ColorSwatchDropdown(document.getElementById('blend-color2-mount'));

    this.ddColor1.onChange(() => this._updatePreview());
    this.ddColor2.onChange(() => this._updatePreview());

    const inpSteps = document.getElementById('inp-blend-steps');
    const selSpace = document.getElementById('sel-blend-space');
    const chkAvoid = document.getElementById('chk-blend-avoid-special');

    if (inpSteps) inpSteps.oninput = () => this._updatePreview();
    if (selSpace) selSpace.onchange = () => this._updatePreview();
    if (chkAvoid) chkAvoid.onchange = () => this._updatePreview();

    document.getElementById('btn-blend-apply').onclick = () => this._applyToPalette();
    document.getElementById('btn-blend-cancel').onclick = () => this.modal.close();
  }

  openDialog() {
    this._ensureBound();
    if (!this.modal) return;

    const colors = getCurrentPaletteColors(this.editor);
    if (colors.length < 2) {
      alert('中間色を作成するにはパレットに2色以上登録されている必要があります。');
      return;
    }

    const opts = colors.map((hex, idx) => ({
      value: hex,
      label: `${idx + 1}: ${hex}`,
      colorHex: colorHexToCss(hex)
    }));

    this.ddColor1.setOptions(opts);
    this.ddColor2.setOptions(opts);

    const curIdx = colors.indexOf(this.editor.currentColor);
    const idx1 = curIdx >= 0 ? curIdx : 0;
    const idx2 = idx1 + 1 < colors.length ? idx1 + 1 : 0;

    this.ddColor1.setValue(colors[idx1]);
    this.ddColor2.setValue(colors[idx2]);

    const chkAvoid = document.getElementById('chk-blend-avoid-special');
    if (chkAvoid) {
      chkAvoid.checked = this.editor.targetType === 'base';
    }

    this._updatePreview();
    this.modal.showModal();
  }

  _updatePreview() {
    const c1 = this.ddColor1.getValue() || '#FFFFFF';
    const c2 = this.ddColor2.getValue() || '#000000';
    const steps = parseInt(document.getElementById('inp-blend-steps')?.value, 10) || 1;
    const space = document.getElementById('sel-blend-space')?.value || 'rgb';
    const avoid = Boolean(document.getElementById('chk-blend-avoid-special')?.checked);

    const avoidSet = avoid ? this.editor.app.specialColors : null;
    const allowAlpha = isAlphaSupportedTarget(this.editor.targetType);
    this.generatedColors = computeIntermediateColors(c1, c2, steps, space, avoidSet, allowAlpha);

    const wrap = document.getElementById('blend-preview-swatches');
    if (!wrap) return;

    const allSeq = [c1, ...this.generatedColors, c2];
    wrap.innerHTML = allSeq.map((hex, idx) => {
      const isEnd = idx === 0 || idx === allSeq.length - 1;
      const border = isEnd ? '1px solid #888' : '2px solid #00ff88';
      const tag = isEnd ? '端色' : `中間${idx}`;
      const css = colorHexToCss(hex);
      return `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
        <span style="display:inline-block; width:30px; height:22px; background-color:#242424; background-image:linear-gradient(${css},${css}),conic-gradient(#777 90deg,#444 90deg 180deg,#777 180deg 270deg,#444 270deg); background-size:100% 100%,8px 8px; border:${border}; border-radius:3px;" title="${hex} (${tag})"></span>
        <span style="font-size:9px; font-family:Consolas,monospace; color:${isEnd ? '#999' : '#55ffaa'};">${hex}</span>
      </div>`;
    }).join('');
  }

  _applyToPalette() {
    if (this.generatedColors.length === 0) return;
    const ed = this.editor;
    const pm = ed.app.paletteManager;

    if (ed.targetType === 'aircraftPlan') {
      const ac = ed.app.aircraftCtrl;
      if (ac) {
        const merged = [...(ac.planPalette || [])];
        this.generatedColors.forEach(c => { if (!merged.includes(c)) merged.push(c); });
        ac.planPalette = merged;
      }
    } else if (ed.targetType === 'deftile') {
      const cur = getCurrentPaletteColors(ed);
      const merged = [...cur];
      this.generatedColors.forEach(c => { if (!merged.includes(c)) merged.push(c); });
      ed.customDeftilePalette = merged;
    } else {
      pm.appendPalette(ed.targetType, this.generatedColors);
    }

    ed.currentColor = this.generatedColors[0];
    renderEditorPaletteUI(ed);
    this.modal.close();
    ed._showHint(`🎨 中間色を ${this.generatedColors.length} 色パレットに追加しました`);
  }
}