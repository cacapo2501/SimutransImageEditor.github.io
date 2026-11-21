export function renderPaintModalUI() {
  if (document.getElementById('modal-paint-editor')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-paint-editor">
      <div id="paint-editor-container">
        <header id="paint-toolbar">
          <div id="paint-toolbar-topbar" class="paint-toolbar-row">
            <div class="paint-tool-group">
              <button id="btn-paint-undo" title="元に戻す (Ctrl+Z)">↩ Undo</button>
              <button id="btn-paint-redo" title="やり直し (Ctrl+Y)">↪ Redo</button>
              <button id="btn-paint-copy" title="選択範囲をコピー (Ctrl+C)">📋 コピー</button>
              <button id="btn-paint-paste" title="貼り付け (Ctrl+V)">📌 貼付</button>
              <button id="btn-paint-import-img" title="外部画像を取り込んで貼り付け">🖼️ 画像貼付</button>
              <button id="btn-paint-reimport-img" title="前回貼り付けた外部画像をもう一度貼り付け" disabled>🔁 再貼付</button>
              <button id="btn-paint-clear-sel" title="選択解除 (Esc / Ctrl+D)">✕ 選択解除</button>
            </div>
            <div class="paint-tool-group">
              <button type="button" id="btn-paint-toggle-tools" class="paint-toggle-btn active" title="描画・選択ツール行の表示/折りたたみを切り替えます">🛠️ ツール ▾</button>
              <button type="button" id="btn-paint-toggle-extra" class="paint-toggle-btn" title="補助線・タイル菱形・スナップ・上方リピート等の詳細パネルを開閉します">🔧 ガイド・設定 ▸</button>
              <button type="button" id="btn-paint-toggle-sidebar" class="paint-toggle-btn active" title="左側パレット・カラー編集ペインの表示/非表示を切り替えます">🎨 パレット</button>
            </div>
            <div class="paint-tool-group ml-auto">
              <span id="paint-lbl-zoom" class="val-badge">100%</span>
              <button id="btn-paint-apply" class="btn-primary">✓ 完了(反映)</button>
              <button id="btn-paint-cancel">キャンセル</button>
            </div>
          </div>

          <div id="paint-toolbar-tools" class="paint-toolbar-row">
            <div class="paint-tool-group">
              <button class="paint-tool-btn" data-tool="hand" title="描画・選択を解除してハンドスクロール (手のひら移動)">✋ スクロール</button>
              <button class="paint-tool-btn active" data-tool="pencil" title="ドットブラシ (右クリック: スポイト)">✏️ ドット</button>
              <button class="paint-tool-btn" data-tool="line" title="直線 (右クリック: スポイト)">📏 直線</button>
              <button class="paint-tool-btn" data-tool="rectFill" title="矩形塗りつぶし (右クリック: スポイト)">⬛ 矩形塗潰</button>
              <button class="paint-tool-btn" data-tool="bucket" title="塗りつぶし (右クリック: スポイト)">🪣 塗潰</button>
              <button class="paint-tool-btn" data-tool="picker" title="スポイト (色取得後、前のツールに自動で戻ります)">🎯 スポイト</button>
              <button class="paint-tool-btn" data-tool="rectSelect" title="矩形選択 (新規時は範囲内ドラッグで移動・範囲外クリックで解除)">🔲 矩形選択</button>
              <button class="paint-tool-btn" data-tool="polySelect" title="多角形選択 (ダブルクリック/始点クリック/Enterで確定)">📐 多角形選択</button>
              <button class="paint-tool-btn" data-tool="wand" title="自動選択 (Magic Wand)">🪄 自動選択</button>
              <button class="paint-tool-btn" data-tool="colorSelect" title="同色選択">🎯 同色選択</button>
              <button class="paint-tool-btn" data-tool="moveSel" title="選択範囲の移動（中のピクセルを移動）">↔️ 選択移動</button>
              <button class="paint-tool-btn" data-tool="text" title="テキスト挿入 (右クリック: スポイト)">🔤 文字</button>
              <button id="btn-open-color-replace" title="色置換・複数色置換">🔄 色置換</button>
              <button id="btn-paint-resize" title="ベース画像の大きさ変更（マスク画像も連動）">📐 サイズ</button>
            </div>

            <div class="paint-tool-group sel-mode-group" title="選択ツールの演算モード">
              <span style="font-size:10px; color:#aaa;">選択:</span>
              <button class="sel-mode-btn active" data-sel-mode="replace" title="新規選択">新規</button>
              <button class="sel-mode-btn" data-sel-mode="add" title="現在の選択範囲に追加">＋追加</button>
              <button class="sel-mode-btn" data-sel-mode="subtract" title="現在の選択範囲から一部削除">－削除</button>
              <button class="sel-mode-btn" data-sel-mode="intersect" title="現在の選択範囲と重なる部分のみ残す（乗算）">×乗算</button>
            </div>

            <div class="paint-tool-group">
              <button id="btn-paint-flip-h" title="左右反転 (貼付中/選択範囲/全体)">↔ 左右反転</button>
              <button id="btn-paint-flip-v" title="上下反転 (貼付中/選択範囲/全体)">↕ 上下反転</button>
            </div>
          </div>

          <div id="paint-toolbar-extra" class="paint-toolbar-row">
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

            <div class="paint-tool-group guide-control-group" title="塗潰し以外の描画ツール・選択ツール・選択移動/貼付移動を指定グリッドにスナップします">
              <label class="inline-chk-lbl">
                <input type="checkbox" id="chk-paint-snap-grid"> 🧲 スナップ:
              </label>
              <select id="sel-paint-snap-preset" class="snap-select-mini" title="スナップグリッドサイズ プリセット">
                <option value="8x8">8×8</option>
                <option value="16x16" selected>16×16</option>
                <option value="32x32">32×32</option>
                <option value="64x32">64×32</option>
                <option value="64x64">64×64</option>
                <option value="128x128">128×128</option>
                <option value="custom">カスタム</option>
              </select>
              <input type="number" id="inp-paint-snap-w" class="num-input-mini" value="16" min="1" max="512" title="スナップ幅(px)">
              <span style="font-size:10px; color:#aaa;">×</span>
              <input type="number" id="inp-paint-snap-h" class="num-input-mini" value="16" min="1" max="512" title="スナップ高さ(px)">
              <span style="font-size:10px; color:#aaa;">px</span>
            </div>

            <div class="paint-tool-group">
              <button id="btn-paint-keybindings" title="キーバインド設定">⌨️ キー設定</button>
            </div>
          </div>

          <div class="paint-tool-group floating-bar" id="floating-action-bar" style="display:none;">
            <span style="font-size:10px; color:#00ff88; font-weight:bold;">貼付調整中:</span>
            <button type="button" id="btn-edit-floating-text" style="display:none;" title="確定前に文字入力ウィンドウへ戻って再編集します">✏️ 文字編集</button>
            <button id="btn-commit-floating" class="btn-primary">✓ 確定 (Enter)</button>
            <button id="btn-cancel-floating">✕ 破棄 (Esc)</button>
          </div>

          <!-- 色置換用：画像からの色取得フローティングバー -->
          <div class="paint-tool-group floating-bar" id="color-replace-pick-bar" style="display:none; border-color:#ffaa00;">
            <span style="font-size:10px; color:#ffcc44; font-weight:bold;">🔄 置換元色の取得:</span>
            <button type="button" id="btn-replace-pick-hand" class="paint-tool-btn active" title="ドラッグで画像をスクロール移動">✋ ハンドスクロール</button>
            <button type="button" id="btn-replace-pick-eyedropper" class="paint-tool-btn" title="クリック/タップで画像から色を取得">🎯 色取得</button>
            <span style="font-size:10px; color:#ccc; margin-left:4px;">プレビュー:</span>
            <span id="replace-pick-preview-swatch" class="color-swatch" style="background:#000000;"></span>
            <strong id="replace-pick-preview-hex" style="font-family:Consolas,monospace; font-size:11px; color:#fff;">#000000</strong>
            <button type="button" id="btn-replace-pick-ok" class="btn-primary">✓ OK (取り込む)</button>
            <button type="button" id="btn-replace-pick-cancel">✕ キャンセル</button>
          </div>
        </header>

        <div id="paint-main-body">
          <aside id="paint-sidebar">
            <details class="accordion-panel paint-accordion">
              <summary>🧅 オニオンスキン (位置目安)</summary>
              <div class="paint-accordion-body">
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
              </div>
            </details>

            <details class="accordion-panel paint-accordion" id="base-palette-tools">
              <summary>グレースケール生成設定</summary>
              <div class="paint-accordion-body">
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
              </div>
            </details>

            <details class="accordion-panel paint-accordion" id="mask-palette-tools" style="display:none;">
              <summary>マスクパレット設定</summary>
              <div class="paint-accordion-body">
                <div class="btn-group">
                  <button id="btn-add-mask-custom-color" class="btn-primary">＋ 任意色を追加</button>
                  <button id="btn-open-image-sampler">🖼️ 画像からスポイト</button>
                </div>
                <button id="btn-paint-regen-mask" class="w-100 mt-05" title="現在のベース画像からマスク画像を再生成してキャンバスへ反映します">🔄 ベースからマスク再生成</button>
                <span class="info-text">※右クリックでパレットから色を削除</span>
              </div>
            </details>

            <details class="accordion-panel paint-accordion" id="aircraft-palette-tools" style="display:none;">
              <summary>✈️ 平面定義図パレット設定</summary>
              <div class="paint-accordion-body">
                <p class="desc-text">色相(H)＝部品グループ、明度(V)＝高さ(100%=全高, 0%=0m)</p>
                <div class="info-text" id="lbl-aircraft-ramp-ref-height">基準全高: 12.5 m</div>
                <div class="row mt-05">
                  <span>単位:</span>
                  <select id="sel-aircraft-ramp-unit" class="snap-select-mini" style="flex:1;">
                    <option value="%">% (全高比 0〜100%)</option>
                    <option value="m">m (メートル)</option>
                  </select>
                </div>
                <div class="row mt-05">
                  <span>最大値:</span>
                  <input type="number" id="inp-aircraft-ramp-max" value="100" min="0" max="100" step="1" class="num-input-mini" style="width:62px;">
                  <span class="aircraft-ramp-unit-suffix" style="font-size:10px; color:#aaa;">%</span>
                </div>
                <div class="row mt-05">
                  <span>最小値:</span>
                  <input type="number" id="inp-aircraft-ramp-min" value="10" min="0" max="100" step="1" class="num-input-mini" style="width:62px;">
                  <span class="aircraft-ramp-unit-suffix" style="font-size:10px; color:#aaa;">%</span>
                </div>
                <div class="row mt-05">
                  <span>段階数:</span>
                  <input type="number" id="inp-aircraft-ramp-steps" value="10" min="1" max="64" step="1" class="num-input-mini" style="width:62px;">
                  <span style="font-size:10px; color:#aaa;">段階</span>
                </div>
                <div class="btn-group mt-05">
                  <button id="btn-add-aircraft-custom-color" class="btn-primary">＋ 任意色追加</button>
                  <button id="btn-gen-aircraft-height-ramp" class="btn-primary" title="現在選択中の色の色相で指定範囲・段階数の高さパレットを生成">🌈 高さ段階生成</button>
                </div>
                <span class="info-text">※白(#FFFFFF)は余白扱い / 右クリックで削除</span>
              </div>
            </details>

            <details class="accordion-panel paint-accordion" id="palette-io-tools">
              <summary>🎨 中間色生成・パレット入出力</summary>
              <div class="paint-accordion-body">
                <div class="btn-group">
                  <button id="btn-open-palette-blend" class="btn-primary" title="パレットの2色から中間色を作成して追加">🎨 中間色作成</button>
                </div>
                <div class="btn-group mt-05">
                  <button id="btn-export-palette" title="現在のパレットをJSONファイルに出力">💾 パレット出力</button>
                  <button id="btn-import-palette" title="パレットJSONファイルを読み込み（置換/追加）">📂 パレット入力</button>
                </div>
              </div>
            </details>

            <fieldset class="sub-panel" id="paint-current-color-panel">
              <legend>現在の描画色</legend>
              <div class="color-preview-row">
                <span id="paint-current-color-swatch" class="color-swatch"></span>
                <strong id="paint-current-color-hex">#FFFFFF</strong>
              </div>
            </fieldset>

            <fieldset class="sub-panel" id="paint-palette-list-panel">
              <legend>カラーパレット一覧</legend>
              <div class="btn-group" style="margin-bottom:4px;">
                <button type="button" id="btn-palette-add-picked" class="btn-primary" title="カラーピッカーで任意の色を選んで現在のパレットに追加">＋ 色を追加</button>
                <button type="button" id="btn-palette-add-current" title="現在の描画色（スポイト等で取得した色）を現在のパレットに登録">＋ 現在色登録</button>
              </div>
              <span class="info-text">※ダブルクリック/長タップで色編集 / 右クリックで削除</span>
              <div id="paint-palette-slots"></div>
              <div id="paint-palette-empty-msg" class="info-text" style="display:none; text-align:center; padding:10px 0;">
                パレットは空です。<br>「＋ 色を追加」または「画像からスポイト」で色を追加してください。
              </div>
            </fieldset>
          </aside>

          <div id="paint-viewport">
            <div id="paint-canvas-wrapper">
              <canvas id="paint-canvas"></canvas>
              <canvas id="paint-overlay-canvas"></canvas>
            </div>
            <div id="paint-rect-handles" style="display:none;">
              <div class="paint-rect-handle" data-corner="tl"></div>
              <div class="paint-rect-handle" data-corner="tr"></div>
              <div class="paint-rect-handle" data-corner="bl"></div>
              <div class="paint-rect-handle" data-corner="br"></div>
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
