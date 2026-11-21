export function renderSubModalsUI() {
  const container = document.getElementById('modal-container') || document.body;

  if (!document.getElementById('modal-copy-layer')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-copy-layer">
        <div class="picker-content" style="width:380px;">
          <h3 style="font-size:13px; margin-bottom:8px;">📋 レイヤーのコピー先マスク選択</h3>
          <p class="desc-text" style="margin-bottom:8px;">コピーしたテクスチャ・ストラクチャを適用するマスク画像を選択してください。</p>
          <div class="row">
            <label style="width:85px;">コピー先:</label>
            <select id="sel-copy-target-mask" style="flex:1;"></select>
          </div>
          <label class="mt-05" style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
            <input type="checkbox" id="chk-copy-switch-mask" checked> 別マスクへコピーした場合、そのマスクへ表示を切り替える
          </label>
          <div class="btn-group mt-1">
            <button type="button" id="btn-copy-layer-ok" class="btn-primary">✓ コピーを実行</button>
            <button type="button" id="btn-copy-layer-cancel">キャンセル</button>
          </div>
        </div>
      </dialog>
    `);
  }

  if (!document.getElementById('modal-palette-blend')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-palette-blend">
        <div class="picker-content" style="width:410px;">
          <h3 style="font-size:13px; margin-bottom:8px;">🎨 パレット2色から中間色を作成</h3>
          <div class="row">
            <label style="width:75px;">開始色 (色1):</label>
            <div id="blend-color1-mount" style="flex:1; min-width:0;"></div>
          </div>
          <div class="row mt-05">
            <label style="width:75px;">終了色 (色2):</label>
            <div id="blend-color2-mount" style="flex:1; min-width:0;"></div>
          </div>
          <div class="row mt-05">
            <label style="width:75px;">中間色数:</label>
            <input type="number" id="inp-blend-steps" value="3" min="1" max="16" style="width:65px; background:#1a1a1a; border:1px solid #444; color:#eee; padding:4px; border-radius:3px;">
            <span style="font-size:11px; color:#aaa;">色</span>
            <select id="sel-blend-space" style="margin-left:auto;">
              <option value="rgb" selected>RGB線形補間</option>
              <option value="hsv">HSV色相補間</option>
            </select>
          </div>
          <label class="mt-05" style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
            <input type="checkbox" id="chk-blend-avoid-special" checked> SpecialColor と #E7FFFF の重複を自動回避
          </label>
          <fieldset class="sub-panel mt-05">
            <legend>生成プレビュー (両端が選択色・中央が生成される中間色)</legend>
            <div id="blend-preview-swatches" style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center; padding:4px 0;"></div>
          </fieldset>
          <div class="btn-group mt-1">
            <button type="button" id="btn-blend-apply" class="btn-primary">✓ パレットに追加する</button>
            <button type="button" id="btn-blend-cancel">キャンセル</button>
          </div>
        </div>
      </dialog>
    `);
  }

  if (!document.getElementById('modal-palette-import')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-palette-import">
        <div class="picker-content" style="width:360px;">
          <h3 style="font-size:13px; margin-bottom:8px;">パレットの読み込み方法を選択</h3>
          <p class="desc-text" id="lbl-palette-import-info" style="margin-bottom:10px;">読み込んだパレットの適用方法を選択してください。</p>
          <div class="btn-group">
            <button type="button" id="btn-palette-import-replace" class="btn-primary">🔄 置き換える</button>
            <button type="button" id="btn-palette-import-append" class="btn-primary">➕ 追加する</button>
            <button type="button" id="btn-palette-import-cancel">キャンセル</button>
          </div>
        </div>
      </dialog>
    `);
  }

  if (!document.getElementById('modal-new-image')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-new-image">
        <div class="picker-content" style="width:360px;">
          <h3 style="font-size:13px; margin-bottom:8px;">新規画像作成 (#E7FFFF 背景塗りつぶし)</h3>
          <p class="desc-text" style="margin-bottom:8px;">指定した大きさの #E7FFFF 塗りつぶしベース画像を新規作成します。</p>
          <div class="btn-group" style="margin-bottom:8px;">
            <button type="button" class="btn-preset-size" data-w="64" data-h="64">64×64</button>
            <button type="button" class="btn-preset-size" data-w="64" data-h="96">64×96</button>
            <button type="button" class="btn-preset-size" data-w="64" data-h="128">64×128</button>
            <button type="button" class="btn-preset-size" data-w="128" data-h="128">128×128</button>
          </div>
          <div class="row">
            <label style="width:70px;">幅 (px):</label>
            <input type="number" id="inp-new-width" value="64" min="1" max="2048" style="background:#1a1a1a; border:1px solid #444; color:#eee; padding:4px; border-radius:3px;">
          </div>
          <div class="row mt-05">
            <label style="width:70px;">高さ (px):</label>
            <input type="number" id="inp-new-height" value="96" min="1" max="2048" style="background:#1a1a1a; border:1px solid #444; color:#eee; padding:4px; border-radius:3px;">
          </div>
          <label class="mt-05" style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
            <input type="checkbox" id="chk-new-open-paint" checked> 作成後すぐにペイントエディタを開く
          </label>
          <div class="btn-group mt-1">
            <button id="btn-new-img-ok" class="btn-primary">作成する</button>
            <button id="btn-new-img-cancel">キャンセル</button>
          </div>
        </div>
      </dialog>
    `);
  }

  if (!document.getElementById('modal-resize-image')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-resize-image">
        <div class="picker-content" style="width:380px;">
          <h3 style="font-size:13px; margin-bottom:6px;">画像サイズの変更（マスク画像も連動変更）</h3>
          <div class="info-text" id="lbl-resize-current" style="margin-bottom:8px;">現在のサイズ: 64 × 96 px</div>
          <div class="row">
            <label style="width:80px;">新しい幅:</label>
            <input type="number" id="inp-resize-width" value="64" min="1" max="2048" style="background:#1a1a1a; border:1px solid #444; color:#eee; padding:4px; border-radius:3px;">
            <span style="font-size:11px;">px</span>
          </div>
          <div class="row mt-05">
            <label style="width:80px;">新しい高さ:</label>
            <input type="number" id="inp-resize-height" value="96" min="1" max="2048" style="background:#1a1a1a; border:1px solid #444; color:#eee; padding:4px; border-radius:3px;">
            <span style="font-size:11px;">px</span>
          </div>
          <fieldset class="sub-panel mt-05">
            <legend>変更方法</legend>
            <label><input type="radio" name="resize-mode" value="canvas" checked> キャンバス拡張・切抜（ドット等倍維持）</label>
            <label><input type="radio" name="resize-mode" value="scale"> 画像全体を拡大・縮小（ニアレストネイバー補間）</label>
            <div class="row mt-05" id="row-resize-anchor">
              <label style="width:80px;">配置基準:</label>
              <select id="sel-resize-anchor">
                <option value="bottom-center" selected>下中央 (Simutrans建物基準)</option>
                <option value="center">中央</option>
                <option value="top-left">左上</option>
              </select>
            </div>
            <div class="row mt-05" id="row-resize-fill">
              <label style="width:80px;">余白の色:</label>
              <select id="sel-resize-fill">
                <option value="#E7FFFF" selected>#E7FFFF (透過色)</option>
                <option value="#000000">#000000 (黒)</option>
              </select>
            </div>
          </fieldset>
          <div class="btn-group mt-1">
            <button id="btn-resize-ok" class="btn-primary">サイズ変更を適用</button>
            <button id="btn-resize-cancel">キャンセル</button>
          </div>
        </div>
      </dialog>
    `);
  }

  if (!document.getElementById('modal-color-replace')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-color-replace">
        <div class="replace-modal-content">
          <header class="replace-header">
            <h3>色置換・複数色置換</h3>
            <button id="btn-close-replace" style="margin-left:auto;">✕ 閉じる</button>
          </header>
          <div class="replace-body">
            <p class="desc-text">置換元は「🎯画像から取得」で編集中画像から取得、置換先は現在使用中のパレットから選択できます。</p>
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
    `);
  }

  if (!document.getElementById('modal-image-sampler')) {
    container.insertAdjacentHTML('beforeend', `
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
    `);
  }

  if (!document.getElementById('modal-keybindings')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-keybindings">
        <div class="picker-content" style="width:380px;">
          <h3 style="font-size:13px; margin-bottom:8px;">ペイントツール キーバインド設定</h3>
          <div class="btn-group" style="margin-bottom:8px;">
            <button type="button" id="btn-export-keybindings">💾 キー設定出力</button>
            <button type="button" id="btn-import-keybindings">📂 キー設定入力</button>
          </div>
          <table id="table-keybindings" style="width:100%; font-size:11px; margin-bottom:12px;">
            <thead><tr><th>ツール名</th><th>キー</th></tr></thead>
            <tbody></tbody>
          </table>
          <button id="btn-close-keybindings" class="btn-primary w-100">閉じる</button>
        </div>
      </dialog>
    `);
  }

  if (!document.getElementById('modal-color-picker')) {
    container.insertAdjacentHTML('beforeend', `
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
            <div class="rgb-row" id="picker-alpha-row" style="display:none;">
              <span style="width:30px; color:#e0b0ff; font-weight:bold;">A:</span>
              <input type="range" id="picker-a" min="0" max="255" step="1" value="255">
              <input type="number" id="picker-a-val" min="0" max="255" value="255">
              <span id="picker-a-pct" style="width:36px; text-align:right; color:#bbb;">100%</span>
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
}