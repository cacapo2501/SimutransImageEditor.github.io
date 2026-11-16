// 編集中画像から Image 座標 (row.col) を GUI で指定するモーダル UI

export function renderDatImagePickerModalUI() {
  if (document.getElementById('modal-dat-image-picker')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-dat-image-picker">
      <div class="dat-picker-container">
        <header class="dat-header">
          <h3>🗺️ 編集中画像から Image 座標 (row.col) を指定</h3>
          <span class="dat-status-badge" id="lbl-dat-picker-img-size">画像: 未読込</span>
          <button type="button" id="btn-dat-picker-close-top" style="margin-left:auto;">✕ 閉じる</button>
        </header>

        <div class="dat-picker-toolbar">
          <span style="font-size:11px; color:#ccc;">タイルサイズ:</span>
          <button type="button" class="btn-dat-picker-preset" data-w="32" data-h="32">32</button>
          <button type="button" class="btn-dat-picker-preset" data-w="64" data-h="64">64</button>
          <button type="button" class="btn-dat-picker-preset" data-w="96" data-h="96">96</button>
          <button type="button" class="btn-dat-picker-preset" data-w="128" data-h="128">128</button>
          <button type="button" class="btn-dat-picker-preset" data-w="192" data-h="192">192</button>
          <input type="number" id="inp-dat-picker-tw" value="64" min="8" max="1024" style="width:54px;">
          <span style="font-size:11px; color:#aaa;">×</span>
          <input type="number" id="inp-dat-picker-th" value="64" min="8" max="1024" style="width:54px;">
          <span style="font-size:11px; color:#aaa;">px</span>

          <span style="margin-left:8px; font-size:11px; color:#ccc;">指定モード:</span>
          <select id="sel-dat-picker-mode">
            <option value="origin">開始位置 (startRow, startCol) を一括指定</option>
            <option value="per_key">個別キーごとにセルをクリック割当</option>
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
            <div style="font-size:11px; font-weight:bold; color:#bbb; margin-bottom:4px;">画像キー割当プレビュー</div>
            <p class="desc-text" id="lbl-dat-picker-guide">キャンバス上のセルをクリックすると、そのセルを開始位置 (startRow, startCol) に設定します。</p>
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
            <button type="button" id="btn-dat-picker-apply" class="btn-primary">✓ この画像位置を反映</button>
            <button type="button" id="btn-dat-picker-cancel">キャンセル</button>
          </div>
        </footer>
      </div>
    </dialog>
  `);
}
