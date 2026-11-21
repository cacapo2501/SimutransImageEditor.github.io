// パレットの色追加・削除・高さ段階生成・JSON入出力・イベントバインド
import { rgbToHsv, hsvToHex, normalizeColorHex } from './color-utils.js';
import {
  getCurrentPaletteColors,
  addColorToCurrentPalette,
  renderEditorPaletteUI,
  getAircraftTotalHeightMeters,
  syncAircraftRampUI,
  isAlphaSupportedTarget
} from './paint-palette-ui.js';

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// 単位切替(% ↔ m)時に最大値・最小値を基準全高に合わせて相互変換する
function convertAircraftRampUnit(newUnit) {
  const totalH = getAircraftTotalHeightMeters();
  const maxInp = document.getElementById('inp-aircraft-ramp-max');
  const minInp = document.getElementById('inp-aircraft-ramp-min');
  if (!maxInp || !minInp) return;

  const prevUnit = maxInp.dataset.unit || '%';
  if (prevUnit === newUnit) {
    syncAircraftRampUI();
    return;
  }

  const convertVal = (raw) => {
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return newUnit === 'm' ? totalH : 100;
    if (newUnit === 'm') {
      return Number(clamp((num / 100) * totalH, 0, totalH).toFixed(2));
    }
    return Math.round(clamp((num / totalH) * 100, 0, 100));
  };

  maxInp.value = String(convertVal(maxInp.value));
  minInp.value = String(convertVal(minInp.value));
  maxInp.dataset.unit = newUnit;
  minInp.dataset.unit = newUnit;
  syncAircraftRampUI();
}

// 平面定義図パレットの高さ段階生成（段階数・最大値・最小値・m/%両対応）
export function generateAircraftHeightRamp(editor) {
  if (editor.targetType !== 'aircraftPlan') return;
  const ac = editor.app.aircraftCtrl;
  if (!ac) return;

  const cur = editor.currentColor || '#FF0000';
  const r = parseInt(cur.slice(1, 3), 16) || 0;
  const g = parseInt(cur.slice(3, 5), 16) || 0;
  const b = parseInt(cur.slice(5, 7), 16) || 0;
  const [h, s] = rgbToHsv(r, g, b);
  const useS = s >= 15 ? s : 90;

  const totalH = getAircraftTotalHeightMeters();
  const unit = document.getElementById('sel-aircraft-ramp-unit')?.value || '%';
  const rawMax = parseFloat(document.getElementById('inp-aircraft-ramp-max')?.value);
  const rawMin = parseFloat(document.getElementById('inp-aircraft-ramp-min')?.value);
  const rawSteps = parseInt(document.getElementById('inp-aircraft-ramp-steps')?.value, 10);
  const steps = clamp(Number.isFinite(rawSteps) ? rawSteps : 10, 1, 64);

  let maxPct = Number.isFinite(rawMax) ? rawMax : (unit === 'm' ? totalH : 100);
  let minPct = Number.isFinite(rawMin) ? rawMin : (unit === 'm' ? totalH * 0.1 : 10);
  if (unit === 'm') {
    maxPct = (maxPct / totalH) * 100;
    minPct = (minPct / totalH) * 100;
  }
  maxPct = clamp(maxPct, 0, 100);
  minPct = clamp(minPct, 0, 100);

  const hiPct = Math.max(maxPct, minPct);
  const loPct = Math.min(maxPct, minPct);

  const ramp = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const vPct = Math.round(hiPct + (loPct - hiPct) * t);
    const hex = hsvToHex(h, useS, vPct);
    if (!ramp.includes(hex)) ramp.push(hex);
  }

  const merged = [...ramp];
  (ac.planPalette || []).forEach((c) => {
    if (!merged.includes(c)) merged.push(c);
  });
  ac.planPalette = merged;
  if (ramp.length > 0) editor.currentColor = ramp[0];
  renderEditorPaletteUI(editor);

  const rangeLabel = unit === 'm'
    ? `${((hiPct / 100) * totalH).toFixed(2)}m〜${((loPct / 100) * totalH).toFixed(2)}m`
    : `${Math.round(hiPct)}%〜${Math.round(loPct)}%`;
  const lowWarn = loPct < 4 ? ' ※V<4%は抽出対象外' : '';
  editor._showHint(`🌈 色相 H=${h}° で ${ramp.length}色 (${rangeLabel}) を生成しました${lowWarn}`);
}

export function exportPaletteToFile(editor) {
  const colors = getCurrentPaletteColors(editor);
  const payload = {
    type: 'simutrans_paint_palette',
    version: '1.0',
    target_type: editor.targetType,
    colors
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `palette_${editor.targetType}.json`;
  a.click();
}

export function importPaletteFromFile(editor) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const rawColors = Array.isArray(parsed) ? parsed : (parsed.colors || []);
        const validColors = rawColors
          .map(c => (typeof c === 'string' ? normalizeColorHex(c) : null))
          .filter(Boolean);

        if (validColors.length === 0) {
          alert('有効なカラーコード (#RRGGBB / #RRGGBBAA) が含まれていません。');
          return;
        }

        const modal = document.getElementById('modal-palette-import');
        const info = document.getElementById('lbl-palette-import-info');
        if (!modal) return;

        if (info) {
          info.textContent = `「${file.name}」から ${validColors.length} 色を読み込みました。現在のパレットを置き換えますか、追加しますか？`;
        }

        const applyImport = (mode) => {
          const pm = editor.app.paletteManager;
          if (editor.targetType === 'aircraftPlan') {
            const ac = editor.app.aircraftCtrl;
            if (ac) {
              if (mode === 'replace') ac.planPalette = [...validColors];
              else {
                const merged = [...(ac.planPalette || [])];
                validColors.forEach(c => { if (!merged.includes(c)) merged.push(c); });
                ac.planPalette = merged;
              }
            }
          } else if (editor.targetType === 'deftile') {
            if (mode === 'replace') editor.customDeftilePalette = [...validColors];
            else {
              const merged = [...getCurrentPaletteColors(editor)];
              validColors.forEach(c => { if (!merged.includes(c)) merged.push(c); });
              editor.customDeftilePalette = merged;
            }
          } else if (mode === 'replace') {
            pm.replacePalette(editor.targetType, validColors);
          } else {
            pm.appendPalette(editor.targetType, validColors);
          }
          renderEditorPaletteUI(editor);
          modal.close();
        };

        document.getElementById('btn-palette-import-replace').onclick = () => applyImport('replace');
        document.getElementById('btn-palette-import-append').onclick = () => applyImport('append');
        document.getElementById('btn-palette-import-cancel').onclick = () => modal.close();

        modal.showModal();
      } catch (err) {
        alert('パレットJSONの読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

// パレット関連ボタン・入力イベントを一括バインドする
export function bindPaletteControls(editor) {
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  const pickAndAddColor = async () => {
    const picked = await editor.app.colorPicker.open(editor.currentColor || '#FFFFFF', {
      enableAlpha: isAlphaSupportedTarget(editor.targetType)
    });
    if (picked) {
      const added = addColorToCurrentPalette(editor, picked);
      editor._showHint(added ? `🎨 ${picked.toUpperCase()} をパレットに追加しました` : `ℹ️ ${picked.toUpperCase()} は既にパレットに登録されています`);
    }
  };

  bindClick('btn-palette-add-picked', pickAndAddColor);
  bindClick('btn-palette-add-current', () => {
    const cur = editor.currentColor || '#FFFFFF';
    const added = addColorToCurrentPalette(editor, cur);
    editor._showHint(added ? `🎨 現在の色 ${cur.toUpperCase()} をパレットに登録しました` : `ℹ️ ${cur.toUpperCase()} は既にパレットに登録されています`);
  });
  bindClick('btn-add-mask-custom-color', pickAndAddColor);
  bindClick('btn-add-aircraft-custom-color', pickAndAddColor);

  bindClick('btn-export-palette', () => exportPaletteToFile(editor));
  bindClick('btn-import-palette', () => importPaletteFromFile(editor));
  bindClick('btn-open-palette-blend', () => editor.dialogs.openPaletteBlendDialog());

  const selUnit = document.getElementById('sel-aircraft-ramp-unit');
  if (selUnit) {
    selUnit.onchange = () => convertAircraftRampUnit(selUnit.value);
  }
  bindClick('btn-gen-aircraft-height-ramp', () => generateAircraftHeightRamp(editor));

  bindClick('btn-gen-base-palette', () => {
    const pm = editor.app.paletteManager;
    pm.basePaletteConfig.brightestHex = document.getElementById('inp-gray-max').value.trim() || '#FEFEFE';
    pm.basePaletteConfig.darkestHex = document.getElementById('inp-gray-min').value.trim() || '#404040';
    pm.basePaletteConfig.steps = parseInt(document.getElementById('inp-gray-steps').value, 10) || 16;
    pm.generateBasePalette({ keepAlphaColors: true });
    editor.customDeftilePalette = null;
    editor._renderPaletteUI();
  });
}
