// dat生成モーダル内の Icon / Cursor 設定UIパネル（プレビュー・自動生成保存・外部カーソルPNG読込）
import { buildFormattedImages, resolveCursorIconModes } from './dat-image-formats.js';
import {
  supportsCursorIcon,
  generateAutoIconCanvas,
  resolveTargetPakSize,
  canvasToPngBytes
} from './dat-icon-generator.js';

function downloadBytesAsPng(bytes, filename) {
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Icon（自動32×32ボタン生成/シート指定/なし）＆ Cursor（なし/外部PNG/シート指定）UIを描画する
export function renderIconCursorPanel(container, { app, gen, objType, values, common, onChange }) {
  if (!container) return;
  if (!supportsCursorIcon(objType)) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = '';
  container.innerHTML = '';

  const v = values || {};
  const { iconMode, cursorMode } = resolveCursorIconModes(v);
  const basePrefix = String(common?.imgPrefix || 'addon').trim() || 'addon';
  const iconFileName = `${basePrefix}_icon.png`;

  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px; font-weight:bold; color:#8fd3ff; margin-bottom:2px;';
  title.textContent = '🖼️ Icon / 🖱️ Cursor 設定';
  container.appendChild(title);

  // 1. Icon モード選択
  const iconRow = document.createElement('div');
  iconRow.className = 'row';
  const lblI = document.createElement('label');
  lblI.style.cssText = 'font-size:10px; min-width:56px;';
  lblI.textContent = 'Icon指定:';
  const selI = document.createElement('select');
  [
    { value: 'auto', label: '自動ボタン生成 (32×32 ./icon.png使用)' },
    { value: 'sheet', label: '編集中画像のシート座標で指定' },
    { value: 'none', label: '指定しない (出力なし)' }
  ].forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label;
    selI.appendChild(opt);
  });
  selI.value = iconMode;
  selI.onchange = () => {
    v.iconMode = selI.value;
    v.includeCursorIcon = false;
    onChange(true);
  };
  iconRow.append(lblI, selI);
  container.appendChild(iconRow);

  // 2. Icon 自動生成時のサンプル元 & プレビュー & 保存
  if (iconMode === 'auto') {
    const sampleRow = document.createElement('div');
    sampleRow.className = 'row mt-05';
    const lblS = document.createElement('label');
    lblS.style.cssText = 'font-size:10px; min-width:56px;';
    lblS.textContent = '抽出元:';
    const selS = document.createElement('select');
    const sheetKeys = buildFormattedImages(objType, { ...v, iconMode: 'none', cursorMode: 'none', includeCursorIcon: false }, common)
      .entries.filter(e => !e.metaLine).slice(0, 24);
    const sampleOpts = [
      { value: 'auto', label: '自動選択（代表的なオブジェクト箇所）' },
      { value: 'full_view', label: '先頭ビュー全体（複数タイル建物推奨）' },
      { value: 'full_image', label: '画像全体から抽出' },
      ...sheetKeys.map(e => ({ value: `key:${e.key}`, label: `キー: ${e.key}` }))
    ];
    sampleOpts.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      selS.appendChild(opt);
    });
    selS.value = sampleOpts.some(o => o.value === (v.iconSampleMode || 'auto')) ? (v.iconSampleMode || 'auto') : 'auto';
    selS.onchange = () => { v.iconSampleMode = selS.value; updateIconPreview(); onChange(false); };
    sampleRow.append(lblS, selS);
    container.appendChild(sampleRow);

    const cropRow = document.createElement('div');
    cropRow.className = 'row mt-05';
    const lblCrop = document.createElement('label');
    lblCrop.style.cssText = 'font-size:10px; min-width:56px;';
    lblCrop.textContent = '抽出範囲:';
    const selCrop = document.createElement('select');
    [
      { value: 'bottom_left_40', label: '左下 40×40px を抽出して 28×28 へ縮小（既定）' },
      { value: 'fit_all', label: 'オブジェクト全体を 28×28 へ縮小' }
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      selCrop.appendChild(opt);
    });
    selCrop.value = v.iconCropMode || 'bottom_left_40';
    selCrop.onchange = () => { v.iconCropMode = selCrop.value; updateIconPreview(); onChange(false); };
    cropRow.append(lblCrop, selCrop);
    container.appendChild(cropRow);

    const targetPak = resolveTargetPakSize(app, objType);
    const prevWrap = document.createElement('div');
    prevWrap.className = 'row mt-05';
    prevWrap.style.gap = '8px';
    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = 64; prevCanvas.height = 64;
    prevCanvas.title = `自動生成 Icon プレビュー (左上32×32 / 出力${targetPak}×${targetPak}px)`;
    prevCanvas.style.cssText = 'width:48px; height:48px; image-rendering:pixelated; border:1px solid #49607a; background:#14181e; border-radius:3px; flex-shrink:0;';

    const infoCol = document.createElement('div');
    infoCol.style.cssText = 'display:flex; flex-direction:column; gap:3px; flex:1; min-width:0;';
    const fileTxt = document.createElement('div');
    fileTxt.className = 'info-text';
    fileTxt.textContent = `出力: Icon=> ${basePrefix}_icon.0.0 (${targetPak}×${targetPak}px / 左上32×32+余白#E7FFFF)`;
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.textContent = `💾 ${iconFileName} 保存`;
    btnSave.onclick = async () => {
      const pakNow = resolveTargetPakSize(app, objType);
      const generated = await generateAutoIconCanvas(app, objType, v, common, { pakSize: pakNow });
      const bytes = await canvasToPngBytes(generated);
      downloadBytesAsPng(bytes, iconFileName);
    };
    infoCol.append(fileTxt, btnSave);
    prevWrap.append(prevCanvas, infoCol);
    container.appendChild(prevWrap);

    const updateIconPreview = async () => {
      try {
        const pakNow = resolveTargetPakSize(app, objType);
        fileTxt.textContent = `出力: Icon=> ${basePrefix}_icon.0.0 (${pakNow}×${pakNow}px / 左上32×32+余白#E7FFFF)`;
        const iconCanvas = await generateAutoIconCanvas(app, objType, v, common, { pakSize: pakNow });
        const pCtx = prevCanvas.getContext('2d');
        pCtx.imageSmoothingEnabled = false;
        pCtx.clearRect(0, 0, 64, 64);
        pCtx.drawImage(iconCanvas, 0, 0, 32, 32, 0, 0, 64, 64);
      } catch (e) {}
    };
    updateIconPreview();
  }

  // 3. Cursor モード選択（未指定時は指定しない）
  const curRow = document.createElement('div');
  curRow.className = 'row mt-05';
  const lblC = document.createElement('label');
  lblC.style.cssText = 'font-size:10px; min-width:56px;';
  lblC.textContent = 'Cursor指定:';
  const selC = document.createElement('select');
  [
    { value: 'none', label: '指定しない（既定）' },
    { value: 'external', label: '外部PNG画像を指定' },
    { value: 'sheet', label: '編集中画像のシート座標で指定' }
  ].forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label;
    selC.appendChild(opt);
  });
  selC.value = cursorMode;
  selC.onchange = () => {
    v.cursorMode = selC.value;
    v.includeCursorIcon = false;
    onChange(true);
  };
  curRow.append(lblC, selC);
  container.appendChild(curRow);

  // 4. 外部カーソルPNG読込UI
  if (cursorMode === 'external') {
    const extBox = document.createElement('div');
    extBox.style.cssText = 'display:flex; flex-direction:column; gap:4px; margin-top:4px; padding:5px 6px; background:#141b23; border:1px solid #2e4156; border-radius:3px;';
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-group';
    const btnPick = document.createElement('button');
    btnPick.type = 'button';
    btnPick.textContent = v.cursorExternalName ? `📂 変更 (${v.cursorExternalName})` : '📂 カーソルPNG選択';
    btnPick.onclick = async () => {
      if (!gen?.pickFileFn) return;
      const f = await gen.pickFileFn('.png');
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        v.cursorExternalName = f.name;
        v.cursorExternalDataUrl = String(reader.result || '');
        v.cursorMode = 'external';
        onChange(true);
      };
      reader.readAsDataURL(f);
    };
    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.textContent = '✕ 解除';
    btnClear.onclick = () => {
      v.cursorExternalName = '';
      v.cursorExternalDataUrl = '';
      v.cursorMode = 'none';
      onChange(true);
    };
    btnRow.append(btnPick, btnClear);

    const coordRow = document.createElement('div');
    coordRow.className = 'row';
    const curPrefix = String(v.cursorExternalName || '').replace(/\.png$/i, '').trim();
    const lblCoord = document.createElement('span');
    lblCoord.className = 'info-text';
    lblCoord.style.flex = '1';
    lblCoord.textContent = curPrefix ? `Cursor=${curPrefix}.${v.cursorExternalRow || 0}.${v.cursorExternalCol || 0}` : '※ カーソルPNG未選択のため Cursor= は出力されません';
    const inpR = document.createElement('input');
    inpR.type = 'number'; inpR.min = '0'; inpR.value = v.cursorExternalRow ?? '0';
    inpR.style.width = '46px'; inpR.title = 'カーソル開始行 (Y)';
    inpR.oninput = () => { v.cursorExternalRow = inpR.value; lblCoord.textContent = curPrefix ? `Cursor=${curPrefix}.${v.cursorExternalRow || 0}.${v.cursorExternalCol || 0}` : ''; onChange(false); };
    const inpC = document.createElement('input');
    inpC.type = 'number'; inpC.min = '0'; inpC.value = v.cursorExternalCol ?? '0';
    inpC.style.width = '46px'; inpC.title = 'カーソル開始列 (X)';
    inpC.oninput = () => { v.cursorExternalCol = inpC.value; lblCoord.textContent = curPrefix ? `Cursor=${curPrefix}.${v.cursorExternalRow || 0}.${v.cursorExternalCol || 0}` : ''; onChange(false); };
    coordRow.append(lblCoord, inpR, inpC);
    extBox.append(btnRow, coordRow);
    container.appendChild(extBox);
  }
}

// DatGeneratorController から直接呼べるショートカット
export function renderIconCursorForGenerator(gen) {
  const box = document.getElementById('dat-icon-cursor-box');
  if (!box || !gen) return;
  const objType = gen.currentObjType;
  const values = gen._getObjState(objType);
  renderIconCursorPanel(box, {
    app: gen.app,
    gen,
    objType,
    values,
    common: gen.common,
    onChange: (rerender) => {
      if (rerender) renderIconCursorForGenerator(gen);
      if (gen.autoSync) gen.regenerateOutput();
      gen.app?.markDirty?.();
    }
  });
}
