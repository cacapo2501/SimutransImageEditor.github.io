export function renderEditorPaletteUI(editor) {
  const container = document.getElementById('paint-palette-slots');
  const emptyMsg = document.getElementById('paint-palette-empty-msg');
  if (!container) return;
  container.innerHTML = '';

  const pm = editor.app.paletteManager;
  let colors = [];

  const baseTools = document.getElementById('base-palette-tools');
  const maskTools = document.getElementById('mask-palette-tools');

  if (editor.targetType === 'deftile') {
    if (baseTools) baseTools.style.display = 'block';
    if (maskTools) maskTools.style.display = 'none';
    const maxFloors = editor.app.deftileBuilder?.getOptions().maxFloors || 4;
    const steps = maxFloors + 1;
    for (let i = 0; i < steps; i++) {
      const v = Math.round((i / Math.max(1, steps - 1)) * 255);
      const hex = `#${v.toString(16).padStart(2, '0').toUpperCase().repeat(3)}`;
      colors.push(hex);
    }
    colors.reverse();
  } else if (editor.targetType === 'base') {
    if (baseTools) baseTools.style.display = 'block';
    if (maskTools) maskTools.style.display = 'none';
    if (pm.basePalette.length === 0) pm.generateBasePalette();
    colors = [...pm.basePalette];
    if (editor.app.specialColors && editor.app.specialColors.size > 0) {
      colors.push(...Array.from(editor.app.specialColors));
    }
  } else {
    if (baseTools) baseTools.style.display = 'none';
    if (maskTools) maskTools.style.display = 'block';
    colors = [...pm.maskPalette];
  }

  if (emptyMsg) emptyMsg.style.display = colors.length === 0 ? 'block' : 'none';

  const maxFloors = editor.app.deftileBuilder?.getOptions().maxFloors || 4;
  colors.forEach(hex => {
    const btn = document.createElement('button');
    btn.className = 'palette-color-btn';
    btn.style.backgroundColor = hex;
    if (editor.targetType === 'deftile') {
      const val = parseInt(hex.slice(1, 3), 16);
      const fl = ((val / 255) * maxFloors).toFixed(1);
      btn.title = `${hex} (${fl}階相当)`;
    } else {
      btn.title = hex + (editor.targetType === 'mask' ? ' (右クリックで削除)' : '');
    }
    btn.onclick = () => {
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