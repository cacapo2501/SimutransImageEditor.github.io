// 編集中画像から Image 座標 (row.col) を GUI で指定するモーダル UI ＆ 形式別オプションパネル
import { IMAGE_FORMAT_OPTIONS } from './dat-image-formats.js';

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

// 画像指定形式に応じた詳細設定（FreightImage / OTRP Reverse / カスタム書式）を共通描画
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

  const isVehAuto = fmt === 'auto' && objType === 'vehicle';
  const showDirCount = isVehAuto || fmt === 'vehicle_freight';
  const showFreightRow = fmt === 'vehicle_freight' || fmt === 'vehicle_freight_typed' || (fmt === 'vehicle_otrp_reverse' && v.hasFreightImage);
  const showFreightType = fmt === 'vehicle_freight_typed' || (fmt === 'vehicle_otrp_reverse' && v.hasFreightImage);
  const showReverse = fmt === 'vehicle_otrp_reverse' || fmt === 'vehicle_otrp_reverse_only';

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
    appendCheck(container, '通常の積載画像 (FreightImage) も併用する', v.hasFreightImage, (ck) => {
      v.hasFreightImage = ck;
      rerenderAndNotify();
    });
  }

  if (showFreightType) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = '空=freight流用 (例: Passagiere, Reverse)';
    inp.value = v.freightTypeName || '';
    inp.oninput = () => { v.freightTypeName = inp.value; onChange(); };
    const wrap = appendField(container, '貨物タイプ名 (FreightImageType / カンマ複数可)', inp);

    const quickRow = document.createElement('div');
    quickRow.className = 'btn-group mt-05';
    ['Passagiere', 'Kohle', 'Reverse'].forEach(preset => {
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

export function renderDatImagePickerModalUI() {
  if (document.getElementById('modal-dat-image-picker')) return;
  const container = document.getElementById('modal-container') || document.body;
  const fmtOpts = IMAGE_FORMAT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-dat-image-picker">
      <div class="dat-picker-container">
        <header class="dat-header">
          <h3>🗺️ 編集中画像から Image 座標 (row.col) ＆ 形式を指定</h3>
          <span class="dat-status-badge" id="lbl-dat-picker-img-size">画像: 未読込</span>
          <button type="button" id="btn-dat-picker-close-top" style="margin-left:auto;">✕ 閉じる</button>
        </header>

        <div class="dat-picker-toolbar">
          <span style="font-size:11px; color:#ccc;">タイル:</span>
          <button type="button" class="btn-dat-picker-preset" data-w="32" data-h="32">32</button>
          <button type="button" class="btn-dat-picker-preset" data-w="64" data-h="64">64</button>
          <button type="button" class="btn-dat-picker-preset" data-w="96" data-h="96">96</button>
          <button type="button" class="btn-dat-picker-preset" data-w="128" data-h="128">128</button>
          <button type="button" class="btn-dat-picker-preset" data-w="192" data-h="192">192</button>
          <input type="number" id="inp-dat-picker-tw" value="64" min="8" max="1024" style="width:52px;">
          <span style="font-size:11px; color:#aaa;">×</span>
          <input type="number" id="inp-dat-picker-th" value="64" min="8" max="1024" style="width:52px;">
          <span style="font-size:11px; color:#aaa;">px</span>

          <span style="margin-left:6px; font-size:11px; color:#ccc;">形式:</span>
          <select id="sel-dat-picker-format">
            ${fmtOpts}
          </select>

          <div class="dat-picker-zoom-group">
            <button type="button" id="btn-dat-picker-z-out">－</button>
            <span id="lbl-dat-picker-zoom" class="val-badge">100%</span>
            <button type="button" id="btn-dat-picker-z-in">＋</button>
            <button type="button" id="btn-dat-picker-z-fit">全体</button>
          </div>
        </div>

        <div class="dat-picker-body">
          <aside class="dat-picker-sidebar">
            <div class="dat-field">
              <label>クリック時の割当先</label>
              <select id="sel-dat-picker-mode">
                <option value="origin">EmptyImage / 基本開始位置 (Y, X)</option>
                <option value="freight_row">FreightImage 開始行 (Y)</option>
                <option value="reverse_row">OTRP Reverse 開始行 (Y)</option>
                <option value="per_key">個別キーをクリックで1つずつ指定</option>
              </select>
            </div>
            <p class="desc-text" id="lbl-dat-picker-guide">右のキャンバスセルをクリックすると開始位置 (startRow, startCol) を設定します。</p>
            <div id="dat-picker-format-options" class="dat-format-options-box" style="display:none;"></div>
            <div style="font-size:11px; font-weight:bold; color:#bbb; margin-top:2px;">出力イメージキー一覧</div>
            <div id="dat-picker-key-list"></div>
          </aside>
          <div id="dat-picker-viewport">
            <canvas id="dat-picker-canvas"></canvas>
          </div>
        </div>

        <footer class="dat-footer">
          <span class="info-text" id="lbl-dat-picker-selection">開始位置: row=0, col=0</span>
          <div class="row" style="margin-left:auto; width:auto;">
            <button type="button" id="btn-dat-picker-reset-custom">↺ 個別割当をリセット</button>
            <button type="button" id="btn-dat-picker-apply" class="btn-primary">✓ この形式と位置を反映</button>
            <button type="button" id="btn-dat-picker-cancel">キャンセル</button>
          </div>
        </footer>
      </div>
    </dialog>
  `);
}

// ピッカーキャンバス上のグリッド線・座標ラベル・割当セルハイライトを描画する
export function drawDatPickerOverlay(ctx, { srcW, srcH, tileW, tileH, zoom, panX, panY, entries, mode, selectedKeyIdx }) {
  const cols = Math.max(1, Math.ceil(srcW / tileW));
  const rows = Math.max(1, Math.ceil(srcH / tileH));

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.font = '10px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let r = 0; r <= rows; r++) {
    const y = Math.round(panY + r * tileH * zoom) + 0.5;
    ctx.beginPath();
    ctx.moveTo(panX, y);
    ctx.lineTo(panX + cols * tileW * zoom, y);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(panX + c * tileW * zoom) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, panY);
    ctx.lineTo(x, panY + rows * tileH * zoom);
    ctx.stroke();
  }

  if (tileW * zoom >= 26 && tileH * zoom >= 16) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillText(`${r}.${c}`, panX + c * tileW * zoom + 3, panY + r * tileH * zoom + 2);
      }
    }
  }

  entries.forEach((entry, idx) => {
    const rx = panX + entry.col * tileW * zoom;
    const ry = panY + entry.row * tileH * zoom;
    const rw = tileW * zoom;
    const rh = tileH * zoom;
    const isFocused = mode === 'per_key' && idx === selectedKeyIdx;
    const isFreight = entry.key.startsWith('FreightImage');

    ctx.fillStyle = isFocused
      ? 'rgba(255, 210, 0, 0.28)'
      : (isFreight ? 'rgba(255, 153, 0, 0.16)' : 'rgba(0, 229, 255, 0.16)');
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = isFocused ? '#FFD200' : (isFreight ? '#FF9900' : '#00E5FF');
    ctx.lineWidth = isFocused ? 2.5 : 1.5;
    ctx.strokeRect(rx + 1, ry + 1, Math.max(1, rw - 2), Math.max(1, rh - 2));
  });
}
