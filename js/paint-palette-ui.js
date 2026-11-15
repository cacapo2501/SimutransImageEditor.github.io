export function getCurrentPaletteColors(editor) {
  const pm = editor.app.paletteManager;
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

export function renderEditorPaletteUI(editor) {
  const container = document.getElementById('paint-palette-slots');
  const emptyMsg = document.getElementById('paint-palette-empty-msg');
  if (!container) return;
  container.innerHTML = '';

  const pm = editor.app.paletteManager;
  const baseTools = document.getElementById('base-palette-tools');
  const maskTools = document.getElementById('mask-palette-tools');

  if (editor.targetType === 'mask') {
    if (baseTools) baseTools.style.display = 'none';
    if (maskTools) maskTools.style.display = 'block';
  } else {
    if (baseTools) baseTools.style.display = 'block';
    if (maskTools) maskTools.style.display = 'none';
  }

  const colors = getCurrentPaletteColors(editor);
  if (emptyMsg) emptyMsg.style.display = colors.length === 0 ? 'block' : 'none';

  const maxFloors = editor.app.deftileBuilder?.getOptions().maxFloors || 4;
  const editableLimit = editor.targetType === 'base' ? pm.basePalette.length : colors.length;

  colors.forEach((hex, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-color-btn';
    btn.style.backgroundColor = hex;

    const isEditable = idx < editableLimit;
    if (editor.targetType === 'deftile') {
      const val = parseInt(hex.slice(1, 3), 16);
      const fl = ((val / 255) * maxFloors).toFixed(1);
      btn.title = `${hex} (${fl}階相当 / ダブルクリック・長タップで編集)`;
    } else if (editor.targetType === 'mask') {
      btn.title = `${hex} (ダブルクリック・長タップで編集 / 右クリックで削除)`;
    } else {
      btn.title = isEditable ? `${hex} (ダブルクリック・長タップで編集)` : `${hex} (特殊色)`;
    }

    const openColorEdit = async () => {
      if (!isEditable) return;
      const picked = await editor.app.colorPicker.open(hex);
      if (!picked) return;
      if (editor.targetType === 'deftile') {
        const list = getCurrentPaletteColors(editor);
        list[idx] = picked.toUpperCase();
        editor.customDeftilePalette = list;
      } else {
        pm.updatePaletteColorAt(editor.targetType, idx, picked);
      }
      editor.currentColor = picked.toUpperCase();
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
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      longPressed = false;
      startPos = [e.clientX, e.clientY];
      cancelPress();
      pressTimer = setTimeout(() => {
        longPressed = true;
        openColorEdit();
      }, 500);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!pressTimer) return;
      if (Math.hypot(e.clientX - startPos[0], e.clientY - startPos[1]) > 8) {
        cancelPress();
      }
    });

    btn.addEventListener('pointerup', cancelPress);
    btn.addEventListener('pointercancel', cancelPress);
    btn.addEventListener('pointerleave', cancelPress);

    btn.onclick = (e) => {
      if (longPressed) {
        longPressed = false;
        e.preventDefault();
        return;
      }
      editor.currentColor = hex;
      updateEditorCurrentColorUI(editor);
    };

    if (editor.targetType === 'mask') {
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (confirm(`マスクパレットから色 ${hex} を削除しますか？`)) {
          pm.removeColorFromMaskPalette(hex);
          renderEditorPaletteUI(editor);
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
          .filter(c => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.trim()))
          .map(c => c.trim().toUpperCase());

        if (validColors.length === 0) {
          alert('有効なカラーコード (#RRGGBB) が含まれていません。');
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
          if (editor.targetType === 'deftile') {
            if (mode === 'replace') {
              editor.customDeftilePalette = [...validColors];
            } else {
              const cur = getCurrentPaletteColors(editor);
              const merged = [...cur];
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
