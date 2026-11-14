export function renderPaintModalUI() {
  if (document.getElementById('modal-paint-editor')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-paint-editor">
      <div id="paint-editor-container">
        <header id="paint-toolbar">
          <div class="paint-tool-group">
            <button class="paint-tool-btn active" data-tool="pencil" title="ドットブラシ">✏️ ドット</button>
            <button class="paint-tool-btn" data-tool="line" title="直線 (連続)">📏 直線</button>
            <button class="paint-tool-btn" data-tool="rectFill" title="矩形塗りつぶし">⬛ 矩形塗潰</button>
            <button class="paint-tool-btn" data-tool="bucket" title="塗りつぶし">🪣 塗潰</button>
            <button class="paint-tool-btn" data-tool="picker" title="スポイト (色取得)">🎯 スポイト</button>
            <button class="paint-tool-btn" data-tool="rectSelect" title="矩形選択">🔲 矩形選択</button>
            <button class="paint-tool-btn" data-tool="polySelect" title="多角形選択 (ダブルクリック/始点クリック/Enterで確定)">📐 多角形選択</button>
            <button class="paint-tool-btn" data-tool="wand" title="自動選択 (Magic Wand)">🪄 自動選択</button>
            <button class="paint-tool-btn" data-tool="colorSelect" title="同色選択">🎯 同色選択</button>
            <button class="paint-tool-btn" data-tool="text" title="テキスト挿入">🔤 文字</button>
            <button id="btn-open-color-replace" title="色置換・複数色置換">🔄 色置換</button>
            <button id="btn-paint-resize" title="ベース画像の大きさ変更（マスク画像も連動）">📐 画像サイズ変更</button>
          </div>

          <div class="paint-tool-group sel-mode-group" title="選択ツールの演算モード">
            <span style="font-size:10px; color:#aaa;">選択:</span>
            <button class="sel-mode-btn active" data-sel-mode="replace" title="新規選択">新規</button>
            <button class="sel-mode-btn" data-sel-mode="add" title="現在の選択範囲に追加">＋追加</button>
            <button class="sel-mode-btn" data-sel-mode="subtract" title="現在の選択範囲から一部削除">－削除</button>
            <button class="sel-mode-btn" data-sel-mode="intersect" title="現在の選択範囲と重なる部分のみ残す（乗算）">×乗算</button>
            <button id="btn-paint-clear-sel" title="選択解除 (Esc / Ctrl+D)">✕ 解除</button>
          </div>

          <div class="paint-tool-group guide-control-group" title="選択範囲内を描画編集した際、選択範囲外の上方指定pxおきに指定回数同じ編集を繰り返します">
            <label class="inline-chk-lbl">
              <input type="checkbox" id="chk-paint-repeat-up"> 🔁 上方リピート:
            </label>
            <span style="font-size:10px; color:#aaa;">間隔</span>
            <input type="number" id="inp-paint-repeat-step" class="num-input-mini" value="8" min="1" max="512">
            <span style="font-size:10px; color:#aaa;">px ×</span>
            <input type="number" id="inp-paint-repeat-count" class="num-input-mini" value="3" min="1" max="64">
            <span style="font-size:10px; color:#aaa;">回</span>
          </div>

          <div class="paint-tool-group">
            <button id="btn-paint-copy" title="選択範囲をコピー (Ctrl+C)">📋 コピー</button>
            <button id="btn-paint-paste" title="貼り付け (Ctrl+V)">📌 貼付</button>
            <button id="btn-paint-import-img" title="外部画像を取り込んで貼り付け">🖼️ 画像貼付</button>
            <button id="btn-paint-flip-h" title="左右反転 (貼付中/選択範囲/全体)">↔ 左右反転</button>
            <button id="btn-paint-flip-v" title="上下反転 (貼付中/選択範囲/全体)">↕ 上下反転</button>
          </div>

          <div class="paint-tool-group floating-bar" id="floating-action-bar" style="display:none;">
            <span style="font-size:10px; color:#00ff88; font-weight:bold;">貼付調整中:</span>
            <button id="btn-commit-floating" class="btn-primary">✓ 確定 (Enter)</button>
            <button id="btn-cancel-floating">✕ 破棄 (Esc)</button>
          </div>

          <div class="paint-tool-group guide-control-group">
            <label class="inline-chk-lbl" title="等間隔の直交補助線を表示">
              <input type="checkbox" id="chk-paint-grid"> 補助線:
            </label>
            <input type="number" id="inp-paint-grid-step" class="num-input-mini" value="8" min="1" max="256">
            <span style="font-size:10px; color:#aaa;">px</span>
            <input type="color" id="inp-paint-grid-color" class="color-input-mini" value="#00FF66" title="補助線の色を選択">

            <label class="inline-chk-lbl" style="margin-left:6px;" title="ベースタイルのアイソメトリック菱形を表示">
              <input type="checkbox" id="chk-paint-iso"> タイル菱形:
            </label>
            <span style="font-size:10px; color:#aaa;">幅</span>
            <input type="number" id="inp-paint-iso-w" class="num-input-mini" value="64" min="4" max="512">
            <span style="font-size:10px; color:#aaa;">×高</span>
            <input type="number" id="inp-paint-iso-h" class="num-input-mini" value="32" min="2" max="512">
            <span style="font-size:10px; color:#aaa;">px</span>
            <input type="color" id="inp-paint-iso-color" class="color-input-mini" value="#FFAA00" title="タイル菱形の色を選択">
          </div>

          <div class="paint-tool-group">
            <button id="btn-paint-undo" title="元に戻す (Ctrl+Z)">↩ Undo</button>
            <button id="btn-paint-redo" title="やり直し (Ctrl+Y)">↪ Redo</button>
            <button id="btn-paint-keybindings" title="キーバインド設定">⌨️ キー設定</button>
          </div>
          <div class="paint-tool-group ml-auto">
            <span id="paint-lbl-zoom" class="val-badge">100%</span>
            <button id="btn-paint-apply" class="btn-primary">✓ 完了(反映)</button>
            <button id="btn-paint-cancel">キャンセル</button>
          </div>
        </header>

        <div id="paint-main-body">
          <aside id="paint-sidebar">
            <div class="sub-panel">
              <legend>描画色</legend>
              <div class="color-preview-row">
                <span id="paint-current-color-swatch" class="color-swatch"></span>
                <strong id="paint-current-color-hex">#FFFFFF</strong>
              </div>
            </div>

            <fieldset class="sub-panel">
              <legend>🧅 オニオンスキン (位置目安)</legend>
              <div class="btn-group">
                <button id="btn-onion-add" class="btn-primary">＋ 画像重ね(複数可)</button>
                <button id="btn-onion-clear">全削除</button>
              </div>
              <div id="onion-skin-list" style="max-height:95px; overflow-y:auto; display:flex; flex-direction:column; gap:3px;">
                <div class="info-text" style="text-align:center; padding:4px 0;">未登録（保存時には出力されません）</div>
              </div>
              <div id="onion-selected-controls" style="display:none; border-top:1px solid #3a3a3a; padding-top:5px;">
                <div class="step-row">
                  <span style="font-size:11px; width:20px;">X:</span>
                  <button type="button" id="btn-onion-x-minus" style="padding:2px 6px;">-1</button>
                  <input type="number" id="inp-onion-x" class="num-input-mini" value="0" style="width:52px;">
                  <button type="button" id="btn-onion-x-plus" style="padding:2px 6px;">+1</button>
                </div>
                <div class="step-row mt-05">
                  <span style="font-size:11px; width:20px;">Y:</span>
                  <button type="button" id="btn-onion-y-minus" style="padding:2px 6px;">-1</button>
                  <input type="number" id="inp-onion-y" class="num-input-mini" value="0" style="width:52px;">
                  <button type="button" id="btn-onion-y-plus" style="padding:2px 6px;">+1</button>
                </div>
                <div class="row mt-05">
                  <span style="font-size:11px;">濃さ:</span>
                  <span id="lbl-onion-opacity" class="val-badge" style="min-width:36px;">45%</span>
                  <input type="range" id="slider-onion-opacity" min="0.05" max="1" step="0.05" value="0.45">
                </div>
                <label class="mt-05"><input type="checkbox" id="chk-onion-trans-e7ffff" checked> #E7FFFF を透過</label>
              </div>
            </fieldset>

            <fieldset class="sub-panel" id="base-palette-tools">
              <legend>グレースケール生成設定</legend>
              <div class="row">
                <span>明色:</span>
                <input type="text" id="inp-gray-max" value="#FEFEFE" style="width:70px;">
              </div>
              <div class="row mt-05">
                <span>暗色:</span>
                <input type="text" id="inp-gray-min" value="#404040" style="width:70px;">
              </div>
              <div class="row mt-05">
                <span>段階:</span>
                <input type="number" id="inp-gray-steps" value="16" min="2" max="64" style="width:50px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px;">
              </div>
              <button id="btn-gen-base-palette" class="w-100 mt-05">パレット再生成 (SpecialColor回避)</button>
            </fieldset>

            <fieldset class="sub-panel" id="mask-palette-tools" style="display:none;">
              <legend>マスクパレット設定</legend>
              <div class="btn-group">
                <button id="btn-add-mask-custom-color" class="btn-primary">＋ 任意色を追加</button>
                <button id="btn-open-image-sampler">🖼️ 画像からスポイト</button>
              </div>
              <span class="info-text">※右クリックでパレットから色を削除</span>
            </fieldset>

            <fieldset class="sub-panel">
              <legend>カラーパレット一覧</legend>
              <div id="paint-palette-slots"></div>
              <div id="paint-palette-empty-msg" class="info-text" style="display:none; text-align:center; padding:10px 0;">
                パレットは空です。<br>「＋ 任意色を追加」または「画像からスポイト」で色を追加してください。
              </div>
            </fieldset>
          </aside>

          <div id="paint-viewport">
            <div id="paint-canvas-wrapper">
              <canvas id="paint-canvas"></canvas>
              <canvas id="paint-overlay-canvas"></canvas>
            </div>
          </div>
        </div>

        <footer id="paint-footer">
          <span id="paint-lbl-tool">ツール: ドット</span>
          <span id="paint-lbl-hint" style="margin-left:16px; color:#aaa;"></span>
          <span id="paint-lbl-coord" style="margin-left:auto;">X: 0, Y: 0</span>
        </footer>
      </div>
    </dialog>
  `);
}