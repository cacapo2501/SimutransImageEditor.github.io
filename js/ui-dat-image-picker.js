// 編集中画像から Image 座標 (row.col) を GUI で指定するモーダル UI ＆ 形式別オプションパネル
import { IMAGE_FORMAT_OPTIONS } from './dat-image-formats.js';
import { getWayKeyHint } from './dat-way-hints.js';

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

  const isWay = objType === 'way';
  const isWayObj = objType === 'way-object';
  if (isWay || isWayObj) {
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
    appendCheck(container, 'Cursor / Icon を出力', Boolean(v.includeCursorIcon), (ck) => {
      v.includeCursorIcon = ck; onChange();
    });
    const legend = document.createElement('div');
    legend.className = 'info-text';
    legend.textContent = '方角目安: N=右上↗ / E=右下↘ / S=左下↙ / W=左上↖';
    container.appendChild(legend);
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
            <div id="dat-picker-items-wrap" class="dat-picker-items-wrap">
              <div class="dat-picker-items-header">
                <span>編集対象 (全形式同時編集)</span>
                <span id="lbl-dat-picker-items-count" style="font-weight:normal; color:#9bb4c8;"></span>
              </div>
              <div class="btn-group" id="dat-picker-bulk-actions">
                <button type="button" class="btn-sm" id="btn-dat-picker-seq-rows" title="上から順に開始行(Y)を連番に設定します">🔢 行(Y)連番</button>
                <button type="button" class="btn-sm" id="btn-dat-picker-align-cols" title="選択中アイテムの開始列(X)を全形式に揃えます">📐 列(X)統一</button>
              </div>
              <div id="dat-picker-items-list"></div>
            </div>
            <div class="dat-field">
              <label>クリック時の割当方法（下のキーを押しても個別指定になります）</label>
              <div class="dat-picker-mode-tabs" id="dat-picker-mode-tabs">
                <button type="button" class="dat-picker-mode-btn active" data-mode="origin" title="クリックしたセルを全体の開始位置(startRow, startCol)にします">📍 一括開始(Y,X)</button>
                <button type="button" class="dat-picker-mode-btn" data-mode="per_key" title="下のキーを選び1つずつ個別の行・列へ割り当てます">🎯 個別キー指定</button>
                <button type="button" class="dat-picker-mode-btn" data-mode="freight_row">📦 Freight行</button>
                <button type="button" class="dat-picker-mode-btn" data-mode="reverse_row">🔁 Reverse行</button>
              </div>
            </div>
            <p class="desc-text" id="lbl-dat-picker-guide">右のセルをクリックすると全体の開始位置 (Y, X) を設定します。独自配置PNGは下のキーをクリックするか「🎯 個別キー指定」で1つずつ指定できます。</p>
            <div id="dat-picker-format-options" class="dat-format-options-box" style="display:none;"></div>
            <div class="row" style="justify-content:space-between; align-items:center; margin-top:2px;">
              <span style="font-size:11px; font-weight:bold; color:#bbb;">出力イメージキー一覧</span>
              <button type="button" class="btn-sm" id="btn-dat-picker-pin-all" title="現在の自動座標を全キーへ個別固定し、そのまま独自編集できるようにします">📌 全キー個別固定</button>
            </div>
            <div class="dat-picker-perkey-bar" id="dat-picker-perkey-bar" style="display:none;">
              <div style="font-size:10px; color:#ffe885; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" id="lbl-dat-picker-active-key">選択キー: -</div>
              <div id="dat-picker-way-hint" class="dat-picker-way-hint" style="display:none;"></div>
              <div class="row" style="gap:4px; align-items:center;">
                <label style="font-size:10px; color:#bbb;">Y:</label>
                <input type="number" id="inp-dat-picker-key-row" min="0">
                <label style="font-size:10px; color:#bbb;">X:</label>
                <input type="number" id="inp-dat-picker-key-col" min="0">
                <button type="button" class="btn-sm" id="btn-dat-picker-key-clear" style="margin-left:auto;" title="選択中キーの個別指定だけ解除して自動位置に戻す">↺ 解除</button>
              </div>
              <label style="font-size:10px; color:#ccc; display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="checkbox" id="chk-dat-picker-auto-advance" checked> キャンバスクリック後に次のキーへ進む
              </label>
            </div>
            <div id="dat-picker-key-list"></div>
          </aside>
          <div id="dat-picker-viewport">
            <canvas id="dat-picker-canvas"></canvas>
          </div>
        </div>

        <footer class="dat-footer">
          <span class="info-text" id="lbl-dat-picker-selection">開始位置: row=0, col=0</span>
          <div class="row" style="margin-left:auto; width:auto;">
            <button type="button" id="btn-dat-picker-load-pattern" title="保存済みの画像指定パターン(JSON)を読み込みます">📂 パターン読込</button>
            <button type="button" id="btn-dat-picker-save-pattern" title="現在の画像指定パターンを別ファイル(JSON)に保存します">💾 パターン保存</button>
            <button type="button" id="btn-dat-picker-reset-custom">↺ 個別割当をリセット</button>
            <button type="button" id="btn-dat-picker-apply" class="btn-primary">✓ この形式と位置を反映</button>
            <button type="button" id="btn-dat-picker-cancel">キャンセル</button>
          </div>
        </footer>
      </div>
    </dialog>
  `);
}

// ピッカー内の全形式（複数編成・単体）リストを描画する
export function renderDatPickerItemsList(items, activeIdx, onSelect) {
  const wrap = document.getElementById('dat-picker-items-wrap');
  const listEl = document.getElementById('dat-picker-items-list');
  const countLbl = document.getElementById('lbl-dat-picker-items-count');
  const bulkEl = document.getElementById('dat-picker-bulk-actions');
  if (!wrap || !listEl) return;

  if (countLbl) countLbl.textContent = `${items.length}件`;
  if (bulkEl) bulkEl.style.display = items.length > 1 ? 'flex' : 'none';

  listEl.innerHTML = '';
  items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'dat-picker-item-row' + (idx === activeIdx ? ' active' : '');
    const name = item.common?.name || `Item_${idx + 1}`;
    const fmt = item.common?.imageFormat || 'auto';
    const shortFmt = fmt === 'vehicle_otrp_reverse' ? 'Rev'
      : (fmt === 'vehicle_otrp_reverse_only' ? 'Revのみ'
        : (fmt.startsWith('vehicle_freight') ? 'Frt' : fmt === 'auto' ? '標準' : fmt.replace('vehicle_', '')));
    const sr = item.common?.startRow || '0';
    const sc = item.common?.startCol || '0';
    row.innerHTML = `<span class="item-title">#${idx + 1} [${item.objType}] ${name}</span><span class="item-meta">${shortFmt} (${sr},${sc})</span>`;
    row.onclick = () => onSelect(idx);
    listEl.appendChild(row);
  });
}

const PICKER_MODE_GUIDES = {
  origin: 'セルをクリックすると全体の開始位置 (Y, X) を設定します。個別指定したい場合は下のキーをクリックするか「🎯 個別キー指定」を押してください。',
  per_key: '【個別指定中】一覧で選んだ黄枠のキーを、右のセルクリックまたは下の Y/X 入力で個別に配置します。',
  freight_row: 'セルをクリックするとその行を FreightImage 開始行 (Y) に設定します。',
  reverse_row: 'セルをクリックするとその行を OTRP Reverse 開始行 (Y) に設定します。'
};

// ピッカーの割当モードボタンとガイド文言を同期する
export function syncDatPickerModeUI(mode, objType) {
  document.querySelectorAll('.dat-picker-mode-btn').forEach(btn => {
    const m = btn.dataset.mode;
    btn.classList.toggle('active', m === mode);
    if (m === 'freight_row' || m === 'reverse_row') {
      btn.style.display = objType === 'vehicle' ? '' : 'none';
    }
  });
  const guide = document.getElementById('lbl-dat-picker-guide');
  if (guide) guide.textContent = PICKER_MODE_GUIDES[mode] || PICKER_MODE_GUIDES.origin;
}

// 選択中キーの個別Y/X座標編集バーを更新する
export function syncDatPickerPerKeyBar(activeItem, entries, selectedKeyIdx, mode) {
  const bar = document.getElementById('dat-picker-perkey-bar');
  if (!bar) return;
  const target = entries[selectedKeyIdx];
  if (!target || entries.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = '';
  const customCoords = activeItem?.common?.customImageCoords || {};
  const isCustom = Boolean(customCoords[target.key]);
  const lbl = document.getElementById('lbl-dat-picker-active-key');
  if (lbl) {
    lbl.textContent = `${mode === 'per_key' ? '🎯' : '🔎'} ${target.key}${isCustom ? ' [個別★]' : ' [自動]'}`;
  }
  const inpR = document.getElementById('inp-dat-picker-key-row');
  const inpC = document.getElementById('inp-dat-picker-key-col');
  if (inpR) inpR.value = String(target.row);
  if (inpC) inpC.value = String(target.col);
  const btnClr = document.getElementById('btn-dat-picker-key-clear');
  if (btnClr) btnClr.disabled = !isCustom;

  const hintEl = document.getElementById('dat-picker-way-hint');
  if (hintEl) {
    const isWayLike = activeItem?.objType === 'way' || activeItem?.objType === 'way-object';
    const hint = isWayLike ? getWayKeyHint(target.key, { large: true }) : null;
    if (hint) {
      hintEl.style.display = 'flex';
      hintEl.innerHTML = `${hint.svg}<span class="dat-way-hint-text">${hint.label}</span>`;
    } else {
      hintEl.style.display = 'none';
      hintEl.innerHTML = '';
    }
  }
}
