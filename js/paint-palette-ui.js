import { rgbToHsv } from './color-utils.js';

export function getAircraftTotalHeightMeters() {
  const raw = parseFloat(document.getElementById('inp-aircraft-height')?.value);
  return Number.isFinite(raw) && raw > 0 ? raw : 12.5;
}

// 平面定義図パレットの基準全高表示と単位suffix/step/maxを現在値へ合わせる
export function syncAircraftRampUI() {
  const totalH = getAircraftTotalHeightMeters();
  const refLbl = document.getElementById('lbl-aircraft-ramp-ref-height');
  if (refLbl) refLbl.textContent = `基準全高: ${totalH.toFixed(1)} m (100% = 全高)`;

  const unit = document.getElementById('sel-aircraft-ramp-unit')?.value || '%';
  const maxInp = document.getElementById('inp-aircraft-ramp-max');
  const minInp = document.getElementById('inp-aircraft-ramp-min');
  const isMeters = unit === 'm';

  document.querySelectorAll('.aircraft-ramp-unit-suffix').forEach((el) => {
    el.textContent = isMeters ? 'm' : '%';
  });

  [maxInp, minInp].forEach((inp) => {
    if (!inp) return;
    inp.min = '0';
    inp.max = isMeters ? String(totalH) : '100';
    inp.step = isMeters ? '0.1' : '1';
  });
}

const DEFAULT_AIRCRAFT_PALETTE = [
  '#FF0000', // 胴体用 (Hue 0)
  '#00E600', // 主翼用 (Hue 120)
  '#0044FF', // 垂直尾翼用 (Hue 224)
  '#E6E600', // 水平尾翼用 (Hue 60)
  '#E600E6', // エンジン用 (Hue 300)
  '#00D4E6'  // その他部品用 (Hue 185)
];

export function getCurrentPaletteColors(editor) {
  const pm = editor.app.paletteManager;
  if (editor.targetType === 'aircraftPlan') {
    const ac = editor.app.aircraftCtrl;
    if (ac) {
      if (!ac.planPalette || ac.planPalette.length === 0) {
        ac.planPalette = [...DEFAULT_AIRCRAFT_PALETTE];
      }
      return [...ac.planPalette];
    }
    return [...DEFAULT_AIRCRAFT_PALETTE];
  }
  if (editor.targetType === 'deftile') {
    if (editor.customDeftilePalette && editor.customDeftilePalette.length > 0) {
      return [...editor.customDeftilePalette];
    }
    const maxFloors = editor.app.deftileBuilder?.getOptions().maxFloors || 4;
    const steps = maxFloors + 1;
    const cols = [];
    for (let i = 0; i < steps; i++) {
      const v = Math.round((i / Math.max(1, steps - 1)) * 255);
      cols.push(`#${v.toString(16).padStart(2, '0').toUpperCase().repeat(3)}`);
    }
    return cols.reverse();
  }
  if (editor.targetType === 'base') {
    if (pm.basePalette.length === 0) pm.generateBasePalette();
    const cols = [...pm.basePalette];
    if (editor.app.specialColors && editor.app.specialColors.size > 0) {
      cols.push(...Array.from(editor.app.specialColors));
    }
    return cols;
  }
  return [...pm.maskPalette];
}

// 現在の編集対象パレットへ任意の色を追加する
export function addColorToCurrentPalette(editor, hex) {
  const up = String(hex || '').trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(up)) return false;
  const pm = editor.app.paletteManager;
  let added = false;

  if (editor.targetType === 'aircraftPlan') {
    const ac = editor.app.aircraftCtrl;
    if (ac) {
      if (!ac.planPalette) ac.planPalette = [...DEFAULT_AIRCRAFT_PALETTE];
      if (!ac.planPalette.includes(up)) {
        ac.planPalette.push(up);
        added = true;
      }
    }
  } else if (editor.targetType === 'deftile') {
    if (!editor.customDeftilePalette || editor.customDeftilePalette.length === 0) {
      editor.customDeftilePalette = getCurrentPaletteColors(editor);
    }
    if (!editor.customDeftilePalette.includes(up)) {
      editor.customDeftilePalette.push(up);
      added = true;
    }
  } else if (editor.targetType === 'mask') {
    added = pm.addColorToMaskPalette(up);
  } else {
    added = pm.addColorToBasePalette(up);
  }

  editor.currentColor = up;
  renderEditorPaletteUI(editor);
  return added;
}

// 現在の編集対象パレットから色を削除する
export function removeColorFromCurrentPalette(editor, hex) {
  const up = String(hex || '').trim().toUpperCase();
  const pm = editor.app.paletteManager;
  if (editor.targetType === 'mask') {
    pm.removeColorFromMaskPalette(up);
  } else if (editor.targetType === 'base') {
    pm.removeColorFromBasePalette(up);
  } else if (editor.targetType === 'deftile') {
    if (!editor.customDeftilePalette || editor.customDeftilePalette.length === 0) {
      editor.customDeftilePalette = getCurrentPaletteColors(editor);
    }
    editor.customDeftilePalette = editor.customDeftilePalette.filter(c => c !== up);
  } else if (editor.targetType === 'aircraftPlan' && editor.app.aircraftCtrl) {
    editor.app.aircraftCtrl.planPalette = (editor.app.aircraftCtrl.planPalette || []).filter(c => c !== up);
  }
  renderEditorPaletteUI(editor);
}

export function renderEditorPaletteUI(editor) {
  const container = document.getElementById('paint-palette-slots');
  const emptyMsg = document.getElementById('paint-palette-empty-msg');
  if (!container) return;
  container.innerHTML = '';

  const pm = editor.app.paletteManager;
  const baseTools = document.getElementById('base-palette-tools');
  const maskTools = document.getElementById('mask-palette-tools');
  const aircraftTools = document.getElementById('aircraft-palette-tools');

  if (baseTools) baseTools.style.display = editor.targetType === 'base' ? 'block' : 'none';
  if (maskTools) maskTools.style.display = editor.targetType === 'mask' ? 'block' : 'none';
  if (aircraftTools) {
    aircraftTools.style.display = editor.targetType === 'aircraftPlan' ? 'block' : 'none';
    if (editor.targetType === 'aircraftPlan') syncAircraftRampUI();
  }

  const colors = getCurrentPaletteColors(editor);
  if (emptyMsg) emptyMsg.style.display = colors.length === 0 ? 'block' : 'none';

  const maxFloors = editor.app.deftileBuilder?.getOptions().maxFloors || 4;
  const totalHeightM = parseFloat(document.getElementById('inp-aircraft-height')?.value) || 12.5;
  const editableLimit = editor.targetType === 'base' ? pm.basePalette.length : colors.length;

  colors.forEach((hex, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-color-btn';
    btn.style.backgroundColor = hex;

    const isEditable = idx < editableLimit;
    if (editor.targetType === 'aircraftPlan') {
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      const [h, , v] = rgbToHsv(r, g, b);
      const meters = ((v / 100) * totalHeightM).toFixed(2);
      btn.title = `${hex} (色相H=${h}° / 高さV=${v}% ≈ ${meters}m | ダブルクリック・長タップで編集 / 右クリックで削除)`;
    } else if (editor.targetType === 'deftile') {
      const val = parseInt(hex.slice(1, 3), 16);
      const fl = ((val / 255) * maxFloors).toFixed(1);
      btn.title = `${hex} (${fl}階相当 / ダブルクリック・長タップで編集 / 右クリックで削除)`;
    } else if (editor.targetType === 'mask') {
      btn.title = `${hex} (ダブルクリック・長タップで編集 / 右クリックで削除)`;
    } else {
      btn.title = isEditable ? `${hex} (ダブルクリック・長タップで編集 / 右クリックで削除)` : `${hex} (特殊色)`;
    }

    const openColorEdit = async () => {
      if (!isEditable) return;
      const picked = await editor.app.colorPicker.open(hex);
      if (!picked) return;
      const up = picked.toUpperCase();
      if (editor.targetType === 'aircraftPlan') {
        const ac = editor.app.aircraftCtrl;
        if (ac && ac.planPalette) ac.planPalette[idx] = up;
      } else if (editor.targetType === 'deftile') {
        const list = getCurrentPaletteColors(editor);
        list[idx] = up;
        editor.customDeftilePalette = list;
      } else {
        pm.updatePaletteColorAt(editor.targetType, idx, up);
      }
      editor.currentColor = up;
      renderEditorPaletteUI(editor);
    };

    btn.ondblclick = (e) => {
      e.preventDefault();
      openColorEdit();
    };

    let pressTimer = null;
    let longPressed = false;
    let startPos = [0, 0];
    const cancelPress = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      longPressed = false;
      startPos = [e.clientX, e.clientY];
      cancelPress();
      pressTimer = setTimeout(() => { longPressed = true; openColorEdit(); }, 500);
    });
    btn.addEventListener('pointermove', (e) => {
      if (pressTimer && Math.hypot(e.clientX - startPos[0], e.clientY - startPos[1]) > 8) cancelPress();
    });
    btn.addEventListener('pointerup', cancelPress);
    btn.addEventListener('pointercancel', cancelPress);
    btn.addEventListener('pointerleave', cancelPress);

    btn.onclick = (e) => {
      if (longPressed) { longPressed = false; e.preventDefault(); return; }
      editor.currentColor = hex;
      updateEditorCurrentColorUI(editor);
    };

    if (isEditable) {
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (confirm(`パレットから色 ${hex} を削除しますか？`)) {
          removeColorFromCurrentPalette(editor, hex);
        }
      };
    }

    container.appendChild(btn);
  });

  if (colors.length > 0 && !colors.includes(editor.currentColor)) {
    editor.currentColor = colors[0];
  }
  updateEditorCurrentColorUI(editor);
}

export function updateEditorCurrentColorUI(editor) {
  const sw = document.getElementById('paint-current-color-swatch');
  const hx = document.getElementById('paint-current-color-hex');
  if (sw) sw.style.backgroundColor = editor.currentColor;
  if (hx) hx.textContent = editor.currentColor;
}
