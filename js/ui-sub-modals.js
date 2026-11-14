export function renderSubModalsUI() {
  if (document.getElementById('modal-color-picker')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <!-- 色置換・複数色置換モーダル -->
    <dialog id="modal-color-replace">
      <div class="replace-modal-content">
        <header class="replace-header">
          <h3>色置換・複数色置換</h3>
          <button id="btn-close-replace" style="margin-left:auto;">✕ 閉じる</button>
        </header>
        <div class="replace-body">
          <p class="desc-text">置換元（変換前）の色を置換先（変換後）の色へ一括置換します。</p>
          <div id="replace-rules-container"></div>
          <button id="btn-add-replace-rule" class="w-100 mt-05">＋ 置換ルールを追加</button>
          <div class="row mt-1">
            <label><input type="checkbox" id="chk-replace-selection-only" checked> 現在の選択範囲内のみに適用</label>
          </div>
        </div>
        <footer class="replace-footer">
          <button id="btn-execute-replace" class="btn-primary" style="flex:2;">✓ 置換を実行</button>
          <button id="btn-cancel-replace" style="flex:1;">キャンセル</button>
        </footer>
      </div>
    </dialog>

    <!-- 画像スポイト採取モーダル -->
    <dialog id="modal-image-sampler">
      <div class="sampler-container">
        <header class="sampler-header">
          <h3>画像からピクセル色をスポイト採取</h3>
          <div class="sampler-zoom-toolbar">
            <button id="btn-sampler-zoom-out">－</button>
            <span id="sampler-lbl-zoom" class="val-badge">100%</span>
            <button id="btn-sampler-zoom-in">＋</button>
            <button id="btn-sampler-zoom-reset">等倍</button>
            <button id="btn-sampler-zoom-fit">全体</button>
          </div>
          <button id="btn-close-sampler" style="margin-left:auto;">✕ 閉じる</button>
        </header>
        <div class="sampler-inputs">
          <input type="text" id="inp-sampler-url" placeholder="https://example.com/image.png (画像URL)">
          <button id="btn-sampler-load-url">URLから読込</button>
          <span style="color:#888;">または</span>
          <button id="btn-sampler-local-file">📁 ローカル画像を選択</button>
          <span class="guide-text" style="margin-left:auto;">操作: ドラッグで平行移動 | ホイールで拡縮 | クリックで色採取</span>
        </div>
        <div id="sampler-viewport">
          <canvas id="sampler-canvas"></canvas>
        </div>
        <footer class="sampler-footer">
          <div class="sampler-picked-list-wrap">
            <span style="font-size:11px; color:#bbb;">採取した色 (クリックで解除):</span>
            <div id="sampler-picked-swatches"></div>
          </div>
          <div class="btn-group" style="width:280px; margin-left:auto;">
            <button id="btn-sampler-apply" class="btn-primary">✓ 採取した色をパレットに追加</button>
            <button id="btn-sampler-clear">クリア</button>
          </div>
        </footer>
      </div>
    </dialog>

    <!-- キーバインド設定ダイアログ -->
    <dialog id="modal-keybindings">
      <div class="picker-content" style="width:360px;">
        <h3 style="font-size:13px; margin-bottom:8px;">ペイントツール キーバインド設定</h3>
        <table id="table-keybindings" style="width:100%; font-size:11px; margin-bottom:12px;">
          <thead><tr><th>ツール名</th><th>キー</th></tr></thead>
          <tbody></tbody>
        </table>
        <button id="btn-close-keybindings" class="btn-primary w-100">閉じる</button>
      </div>
    </dialog>

    <!-- HSV + RGB カラーピッカーモーダル -->
    <dialog id="modal-color-picker">
      <div class="picker-content">
        <h3 style="font-size:13px; margin-bottom:8px;">カラーピッカー (HSV / RGB)</h3>
        <div class="swatch-compare">
          <span>元色: <i id="picker-old-swatch"></i></span>
          <span>新色: <i id="picker-new-swatch"></i></span>
          <strong id="picker-hex-label">#FFFFFF</strong>
          <button id="btn-picker-eyedropper" style="margin-left:auto;">🎯 画面から採取</button>
        </div>

        <div class="hsv-sliders">
          <div class="hsv-row">
            <span style="width:50px;">色相(H):</span>
            <input type="range" id="picker-h" min="0" max="360" step="1">
            <span id="picker-h-val" style="width:35px; text-align:right;">0°</span>
          </div>
          <div class="hsv-row">
            <span style="width:50px;">彩度(S):</span>
            <input type="range" id="picker-s" min="0" max="100" step="1">
            <span id="picker-s-val" style="width:35px; text-align:right;">0%</span>
          </div>
          <div class="hsv-row">
            <span style="width:50px;">明度(V):</span>
            <input type="range" id="picker-v" min="0" max="100" step="1">
            <span id="picker-v-val" style="width:35px; text-align:right;">100%</span>
          </div>
        </div>

        <div class="rgb-sliders">
          <div class="rgb-row">
            <span style="width:30px; color:#ff7b7b; font-weight:bold;">R:</span>
            <input type="range" id="picker-r" min="0" max="255" step="1" value="255">
            <input type="number" id="picker-r-val" min="0" max="255" value="255">
          </div>
          <div class="rgb-row">
            <span style="width:30px; color:#7bff7b; font-weight:bold;">G:</span>
            <input type="range" id="picker-g" min="0" max="255" step="1" value="255">
            <input type="number" id="picker-g-val" min="0" max="255" value="255">
          </div>
          <div class="rgb-row">
            <span style="width:30px; color:#7bb5ff; font-weight:bold;">B:</span>
            <input type="range" id="picker-b" min="0" max="255" step="1" value="255">
            <input type="number" id="picker-b-val" min="0" max="255" value="255">
          </div>
        </div>

        <div class="quick-palette" id="picker-palette"></div>
        <div class="btn-group mt-1">
          <button id="btn-picker-ok" class="btn-primary">決定 (OK)</button>
          <button id="btn-picker-cancel">キャンセル</button>
        </div>
      </div>
    </dialog>
  `);
}
