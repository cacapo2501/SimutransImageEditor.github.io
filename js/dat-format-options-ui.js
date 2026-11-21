// 画像指定形式に応じた詳細設定パネル（way / tunnel / roadsign / vehicle / field / custom_template）

function appendField(parent, labelText, inputEl) {
  const wrap = document.createElement('div');
  wrap.className = 'dat-field';
  const lbl = document.createElement('label');
  lbl.textContent = labelText;
  wrap.appendChild(lbl);
  wrap.appendChild(inputEl);
  parent.appendChild(wrap);
  return wrap;
}

function appendCheck(parent, labelText, checked, onChange) {
  const lbl = document.createElement('label');
  lbl.className = 'dat-check-item';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = Boolean(checked);
  cb.onchange = () => onChange(cb.checked);
  lbl.appendChild(cb);
  lbl.appendChild(document.createTextNode(labelText));
  parent.appendChild(lbl);
}

// 画像指定形式に応じた詳細設定パネルを描画する
export function renderFormatOptionsPanel(container, { objType, common, values, onChange }) {
  if (!container) return;
  container.innerHTML = '';
  const fmt = common?.imageFormat || 'auto';
  const v = values || {};

  const rerenderAndNotify = () => {
    renderFormatOptionsPanel(container, { objType, common, values, onChange });
    onChange();
  };

  if (fmt === 'custom_template') {
    const ta = document.createElement('textarea');
    ta.placeholder = 'EmptyImage[{dir}][0]={prefix}.{row}.{col}{offset}';
    ta.value = common.customImgFormat || '';
    ta.oninput = () => { common.customImgFormat = ta.value; onChange(); };
    appendField(container, 'カスタム画像書式 ({dir}, {prefix}, {row}, {col}, {offset})', ta);
    container.style.display = '';
    return;
  }

  if (objType === 'way' || objType === 'way-object') {
    const isWay = objType === 'way';
    container.style.display = '';
    if (isWay) {
      appendCheck(container, '分岐ポイント画像 (NSE1〜NSEW2) を出力', Boolean(v.includePoints), (ck) => {
        v.includePoints = ck; onChange();
      });
    }
    appendCheck(container, '斜め画像 (Diagonal) を出力', v.includeDiagonal !== false, (ck) => {
      v.includeDiagonal = ck; onChange();
    });
    if (isWay) {
      appendCheck(container, '坂道画像 (ImageUp) を出力', Boolean(v.includeSlopes), (ck) => {
        v.includeSlopes = ck; onChange();
      });
      appendCheck(container, '2段坂画像 (ImageUp2) を出力', Boolean(v.includeSlopes2), (ck) => {
        v.includeSlopes2 = ck; onChange();
      });
    }
    const legend = document.createElement('div');
    legend.className = 'info-text';
    legend.textContent = '方角目安: N=右上↗ / E=右下↘ / S=左下↙ / W=左上↖';
    container.appendChild(legend);
    return;
  }

  if (objType === 'tunnel') {
    container.style.display = '';
    const sel = document.createElement('select');
    [
      { v: 'single', l: '単線のみ (N, S, E, W)' },
      { v: 'double', l: '単線 + 複線 (N..W + Nl,Nr等)' },
      { v: 'multi', l: '単線 + 3線以上 (N..W + Nl,Nm,Nr等)' },
      { v: 'wide_only', l: '複線・3線以上のみ (Nl,Nm,Nr等)' }
    ].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.l;
      sel.appendChild(opt);
    });
    sel.value = v.tunnelPortalMode || 'single';
    sel.onchange = () => { v.tunnelPortalMode = sel.value; onChange(); };
    appendField(container, '坑口パターン (単線 / Nl,Nm,Nr複線以上)', sel);
    const legend = document.createElement('div');
    legend.className = 'info-text';
    legend.textContent = '方角目安: N=右上↗ / E=右下↘ / S=左下↙ / W=左上↖ (l=左, m=中央, r=右)';
    container.appendChild(legend);
    return;
  }

  if (objType === 'roadsign') {
    container.style.display = '';
    const baseCount = Math.max(1, Math.min(64, parseInt(v.signalStates, 10) || 4));
    appendCheck(container, `前面画像 (FrontImage[0..${baseCount - 1}]) を出力`, Boolean(v.includeFrontImage), (ck) => {
      v.includeFrontImage = ck; rerenderAndNotify();
    });
    appendCheck(container, '斜め画像 (Diagonal[0..M-1]) を出力', Boolean(v.includeDiagonal), (ck) => {
      v.includeDiagonal = ck;
      if (ck && !v.diagonalStates) v.diagonalStates = String(baseCount * 2);
      rerenderAndNotify();
    });
    appendCheck(container, '斜め前面画像 (FrontDiagonal[0..M-1]) を出力', Boolean(v.includeFrontDiagonal), (ck) => {
      v.includeFrontDiagonal = ck;
      if (ck && !v.diagonalStates) v.diagonalStates = String(baseCount * 2);
      rerenderAndNotify();
    });
    if (v.includeDiagonal || v.includeFrontDiagonal) {
      const inpDiag = document.createElement('input');
      inpDiag.type = 'number';
      inpDiag.min = '4';
      inpDiag.max = '128';
      inpDiag.value = v.diagonalStates ?? String(baseCount * 2);
      inpDiag.oninput = () => { v.diagonalStates = inpDiag.value; onChange(); };
      appendField(container, `斜め画像コマ数 (makeobj推奨 Image×2 = ${baseCount * 2})`, inpDiag);
    }
    return;
  }

  if (objType === 'field') {
    container.style.display = '';
    appendCheck(container, '雪画像あり (has_snow=1 / 末尾を雪画像として追加)', Boolean(v.has_snow), (ck) => {
      v.has_snow = ck; onChange();
    });
    return;
  }

  const isVeh = objType === 'vehicle';
  const isVehAuto = fmt === 'auto' && isVeh;
  const showDirCount = isVeh && (isVehAuto || fmt === 'vehicle_freight');
  const showFreightRow = isVeh && (fmt === 'vehicle_freight' || fmt === 'vehicle_freight_typed');
  const showFreightType = isVeh && fmt === 'vehicle_freight_typed';
  const showReverse = isVeh && (fmt === 'vehicle_otrp_reverse' || fmt === 'vehicle_otrp_reverse_only');

  if (!isVehAuto && !showFreightRow && !showReverse) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  if (showDirCount) {
    const sel = document.createElement('select');
    [{ v: '8', l: '8方向 (S,E,SE,SW,N,W,NW,NE)' }, { v: '4', l: '4方向 (S,E,N,W)' }].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.l;
      sel.appendChild(opt);
    });
    sel.value = String(v.directions || '8');
    sel.onchange = () => { v.directions = sel.value; onChange(); };
    appendField(container, '車両方向数', sel);
  }

  if (isVehAuto) {
    const tip = document.createElement('div');
    tip.className = 'info-text';
    tip.textContent = '※ FreightImage や OTRP Reverse.pak を使う場合は上の「画像指定形式」から選択してください。';
    container.appendChild(tip);
    return;
  }

  if (fmt === 'vehicle_otrp_reverse') {
    const note = document.createElement('div');
    note.className = 'info-text mt-05';
    note.textContent = '※ OTRP Reverse は通常の FreightImage と同時指定できません（Empty + Reverse 構成）。';
    container.appendChild(note);
  }

  if (showFreightType) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = '空=freight流用 (例: Passagiere, Kohle)';
    inp.value = v.freightTypeName || '';
    inp.oninput = () => { v.freightTypeName = inp.value; onChange(); };
    const wrap = appendField(container, '貨物タイプ名 (FreightImageType / カンマ複数可)', inp);

    const quickRow = document.createElement('div');
    quickRow.className = 'btn-group mt-05';
    ['Passagiere', 'Post', 'Kohle', 'Goods'].forEach(preset => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = preset;
      b.onclick = () => { v.freightTypeName = preset; inp.value = preset; onChange(); };
      quickRow.appendChild(b);
    });
    wrap.appendChild(quickRow);
  }

  if (showFreightRow) {
    const inpF = document.createElement('input');
    inpF.type = 'number';
    inpF.min = '0';
    inpF.placeholder = '空欄=開始行(Y)+1';
    inpF.value = v.freightRow ?? '';
    inpF.oninput = () => { v.freightRow = inpF.value; onChange(); };
    appendField(container, 'FreightImage 開始行 (Y / 空欄=自動 Y+1)', inpF);
  }

  if (showReverse) {
    const selMode = document.createElement('select');
    [
      { v: 'same_row', l: '同一行 (Y) を180°反転流用 (S↔N等)' },
      { v: 'next_row', l: '次の行 (Y+1) を反転専用行とする' },
      { v: 'custom_row', l: '指定した行番号 (reverseRow) を使用' }
    ].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.l;
      selMode.appendChild(opt);
    });
    selMode.value = v.reverseRowMode || 'same_row';
    selMode.onchange = () => { v.reverseRowMode = selMode.value; rerenderAndNotify(); };
    appendField(container, 'OTRP 反転画像の参照方法', selMode);

    if (selMode.value === 'custom_row') {
      const inpR = document.createElement('input');
      inpR.type = 'number';
      inpR.min = '0';
      inpR.value = v.reverseRow ?? '0';
      inpR.oninput = () => { v.reverseRow = inpR.value; onChange(); };
      appendField(container, 'OTRP 反転画像の開始行 (Y)', inpR);
    }
    if (selMode.value !== 'same_row') {
      appendCheck(container, '別行でも方向列を180°反転する (S↔N等)', v.reverseFlipDir, (ck) => {
        v.reverseFlipDir = ck;
        onChange();
      });
    }
    appendCheck(container, '非電化対応 (No_Electric / Reverse_No_Electric) も出力', v.includeNoElectric, (ck) => {
      v.includeNoElectric = ck;
      rerenderAndNotify();
    });
    if (v.includeNoElectric) {
      const inpNE = document.createElement('input');
      inpNE.type = 'number';
      inpNE.min = '0';
      inpNE.placeholder = '空欄=開始行(Y)';
      inpNE.value = v.noElectricRow ?? '';
      inpNE.oninput = () => { v.noElectricRow = inpNE.value; onChange(); };
      appendField(container, 'No_Electric 開始行 (Y / 空欄=Y)', inpNE);
    }
  }
}
