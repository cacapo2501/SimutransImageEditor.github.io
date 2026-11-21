// 編集中画像から Image 座標 (row.col) を GUI で指定するモーダル UI ＆ 形式別オプションパネル
import { IMAGE_FORMAT_OPTIONS } from './dat-image-formats.js';
import { getImageKeyHint } from './dat-infra-hints.js';
export { renderFormatOptionsPanel } from './dat-format-options-ui.js';

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
          <span class="dat-picker-tb-lbl">タイル:</span>
          <button type="button" class="btn-dat-picker-preset" data-w="32" data-h="32">32</button>
          <button type="button" class="btn-dat-picker-preset" data-w="64" data-h="64">64</button>
          <button type="button" class="btn-dat-picker-preset" data-w="96" data-h="96">96</button>
          <button type="button" class="btn-dat-picker-preset" data-w="128" data-h="128">128</button>
          <button type="button" class="btn-dat-picker-preset" data-w="192" data-h="192">192</button>
          <input type="number" id="inp-dat-picker-tw" class="dat-picker-tile-input" value="64" min="8" max="1024">
          <span class="dat-picker-tb-unit">×</span>
          <input type="number" id="inp-dat-picker-th" class="dat-picker-tile-input" value="64" min="8" max="1024">
          <span class="dat-picker-tb-unit">px</span>

          <span class="dat-picker-tb-lbl" style="margin-left:4px;">形式:</span>
          <select id="sel-dat-picker-format">
            ${fmtOpts}
          </select>

          <div class="dat-picker-zoom-group">
            <button type="button" id="btn-dat-picker-pan" title="オンの間、左ドラッグでプレビュー画像を移動します（通常時もドラッグ・Space+ドラッグ・タッチ2本指で移動/拡縮可）">✋ 移動</button>
            <button type="button" id="btn-dat-picker-z-out" title="縮小">－</button>
            <span id="lbl-dat-picker-zoom" class="val-badge">100%</span>
            <button type="button" id="btn-dat-picker-z-in" title="拡大">＋</button>
            <button type="button" id="btn-dat-picker-z-100" title="等倍 (100%)">100%</button>
            <button type="button" id="btn-dat-picker-z-fit" title="画像全体を画面に収める">全体</button>
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
            <div class="dat-picker-key-header">
              <span>出力イメージキー一覧</span>
              <button type="button" class="btn-sm" id="btn-dat-picker-pin-all" title="現在の自動座標を全キーへ個別固定し、そのまま独自編集できるようにします">📌 全キー個別固定</button>
            </div>
            <div class="dat-picker-perkey-bar" id="dat-picker-perkey-bar" style="display:none;">
              <div class="dat-picker-active-key-lbl" id="lbl-dat-picker-active-key">選択キー: -</div>
              <div id="dat-picker-way-hint" class="dat-picker-way-hint" style="display:none;"></div>
              <div class="dat-picker-perkey-inputs">
                <label>Y:</label>
                <input type="number" id="inp-dat-picker-key-row" min="0">
                <label>X:</label>
                <input type="number" id="inp-dat-picker-key-col" min="0">
                <button type="button" class="btn-sm" id="btn-dat-picker-key-clear" title="選択中キーの個別指定だけ解除して自動位置に戻す">↺ 解除</button>
              </div>
              <label class="dat-picker-perkey-check">
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
          <div class="dat-picker-footer-actions">
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
    const hint = getImageKeyHint(activeItem?.objType, target.key, { large: true });
    if (hint) {
      hintEl.style.display = 'flex';
      hintEl.innerHTML = `${hint.svg}<span class="dat-way-hint-text">${hint.label}</span>`;
    } else {
      hintEl.style.display = 'none';
      hintEl.innerHTML = '';
    }
  }
}

// タイルサイズプリセットボタンの選択状態を同期する
export function syncDatPickerPresetUI(tileW, tileH) {
  document.querySelectorAll('.btn-dat-picker-preset').forEach((btn) => {
    const bw = parseInt(btn.dataset.w, 10);
    const bh = parseInt(btn.dataset.h, 10);
    btn.classList.toggle('active', bw === tileW && bh === tileH);
  });
}

// ピッカーのビューポートカーソル状態を同期する
export function updateDatPickerCursor({ isPanning, panMode, spacePressed }) {
  const vp = document.getElementById('dat-picker-viewport');
  if (!vp) return;
  if (isPanning) vp.style.cursor = 'grabbing';
  else if (panMode || spacePressed) vp.style.cursor = 'grab';
  else vp.style.cursor = 'crosshair';
}

// ピッカー内の出力イメージキー一覧を描画する
export function renderDatPickerKeyList(activeItem, entries, selectedKeyIdx, onSelectKey) {
  const listEl = document.getElementById('dat-picker-key-list');
  if (!listEl || !activeItem) return;
  listEl.innerHTML = '';
  if (entries.length === 0) {
    listEl.innerHTML = '<div class="info-text">このオブジェクト種別には画像キーがありません。</div>';
    return;
  }

  const customCoords = activeItem.common.customImageCoords || {};
  entries.forEach((entry, idx) => {
    const rowEl = document.createElement('div');
    const isSelected = idx === selectedKeyIdx;
    const isCustom = Boolean(customCoords[entry.key]);
    const hint = getImageKeyHint(activeItem.objType, entry.key, { large: false });
    rowEl.className = 'dat-picker-key-item' + (isSelected ? ' active' : '') + (isCustom ? ' custom' : '');
    if (hint) rowEl.title = hint.label;
    rowEl.innerHTML = `<span class="k-left">${hint ? hint.svg : ''}<span class="k-name">${entry.key}</span></span><span class="k-coord">.${entry.row}.${entry.col}${isCustom ? ' ★' : ''}</span>`;
    rowEl.onclick = () => onSelectKey(idx);
    listEl.appendChild(rowEl);
  });
}
