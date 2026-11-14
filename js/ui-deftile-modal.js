export function renderDeftileModalUI() {
  const container = document.getElementById('modal-container') || document.body;

  if (!document.getElementById('modal-deftile-builder')) {
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-deftile-builder">
        <div class="deftile-builder-container">
          <header class="deftile-header">
            <h3>🏗️ DEFTILEから立体ベース画像生成 (EasyBuildingCreator)</h3>
            <span id="lbl-deftile-out-size" class="val-badge" style="margin-left:12px;">出力: 256×63px</span>
            <button id="btn-close-deftile" style="margin-left:auto;">✕ 閉じる</button>
          </header>

          <div class="deftile-main-body">
            <aside class="deftile-sidebar">
              <fieldset class="sub-panel">
                <legend>1. DEFTILE画像の用意・単独編集</legend>
                <div class="btn-group">
                  <button id="btn-deftile-load">📂 DEFTILEを開く</button>
                  <button id="btn-deftile-save">💾 DEFTILE保存</button>
                </div>
                <div class="btn-group mt-05">
                  <button id="btn-deftile-paint" class="btn-primary">✏️ DEFTILEをペイント編集</button>
                </div>
                <div class="row mt-05">
                  <span style="font-size:11px;">新規サイズ:</span>
                  <button type="button" class="btn-deftile-preset" data-w="16" data-h="16">16×16</button>
                  <button type="button" class="btn-deftile-preset" data-w="32" data-h="16">32×16</button>
                  <button type="button" class="btn-deftile-preset" data-w="16" data-h="32">16×32</button>
                  <button type="button" class="btn-deftile-preset" data-w="32" data-h="32">32×32</button>
                </div>
                <div class="row mt-05">
                  <input type="number" id="inp-deftile-new-w" value="16" min="1" max="256" style="width:48px; background:#141414; border:1px solid #444; color:#eee; padding:2px 4px;">
                  <span>×</span>
                  <input type="number" id="inp-deftile-new-h" value="16" min="1" max="256" style="width:48px; background:#141414; border:1px solid #444; color:#eee; padding:2px 4px;">
                  <button id="btn-deftile-new-create" style="margin-left:auto;">🆕 新規作成＆編集</button>
                </div>
                <div class="info-text" id="lbl-deftile-info">DEFTILE: new_16x16.png (16×16)</div>
              </fieldset>

              <fieldset class="sub-panel">
                <legend>2. 建物プロパティ設定</legend>
                <div class="row">
                  <label style="width:110px;">フロア数:</label>
                  <input type="number" id="inp-deftile-floors" value="4" min="1" max="64" style="background:#141414; border:1px solid #444; color:#eee; padding:3px 6px;">
                </div>
                <div class="row mt-05">
                  <label style="width:110px;">1フロアのpx数:</label>
                  <input type="number" id="inp-deftile-px-height" value="8" min="1" max="64" style="background:#141414; border:1px solid #444; color:#eee; padding:3px 6px;">
                </div>
                <div class="row mt-05">
                  <label style="width:110px;">天面の色:</label>
                  <input type="color" id="inp-deftile-top-col" value="#CCCCCC" class="color-input-mini">
                  <span id="lbl-deftile-top-hex" style="font-family:Consolas,monospace; font-size:11px;">#CCCCCC</span>
                </div>
                <div class="row mt-05">
                  <label style="width:110px;">南面の色 / 境界:</label>
                  <input type="color" id="inp-deftile-south-col" value="#B2B2B2" class="color-input-mini">
                  <input type="color" id="inp-deftile-south-sep" value="#999999" class="color-input-mini" title="南面フロア境界色">
                </div>
                <div class="row mt-05">
                  <label style="width:110px;">東面の色 / 境界:</label>
                  <input type="color" id="inp-deftile-east-col" value="#808080" class="color-input-mini">
                  <input type="color" id="inp-deftile-east-sep" value="#666666" class="color-input-mini" title="東面フロア境界色">
                </div>
                <label class="mt-05"><input type="checkbox" id="chk-deftile-sep"> フロア境界を描く</label>
                <label class="mt-05"><input type="checkbox" id="chk-deftile-smooth"> フロアを滑らかにする</label>
                <div class="row mt-05">
                  <label style="width:80px;">出力形式:</label>
                  <select id="sel-deftile-layout">
                    <option value="4dir" selected>4方向結合 (S / E / N / W)</option>
                    <option value="1dir">単一方向 (Sのみ)</option>
                  </select>
                </div>
              </fieldset>
            </aside>

            <div class="deftile-preview-area">
              <div class="deftile-preview-toolbar">
                <button id="btn-deftile-zoom-out">－</button>
                <span id="lbl-deftile-zoom" class="val-badge">200%</span>
                <button id="btn-deftile-zoom-in">＋</button>
                <button id="btn-deftile-zoom-fit">全体表示</button>
                <span class="guide-text">ドラッグで移動 | ホイールで拡縮</span>
              </div>
              <div id="deftile-preview-viewport">
                <canvas id="deftile-preview-canvas"></canvas>
              </div>
            </div>
          </div>

          <footer class="deftile-footer">
            <span class="info-text">※グレースケール値(黒=0階 〜 白=最上階)からアイソメトリック建物を生成します</span>
            <div class="btn-group" style="width:320px; margin-left:auto;">
              <button id="btn-deftile-apply-base" class="btn-primary">✓ ベース画像として適用</button>
              <button id="btn-deftile-cancel">キャンセル</button>
            </div>
          </footer>
        </div>
      </dialog>
    `);
  }

  const paintViewport = document.getElementById('paint-viewport');
  if (paintViewport && !document.getElementById('paint-deftile-live-preview')) {
    paintViewport.insertAdjacentHTML('beforeend', `
      <div id="paint-deftile-live-preview" style="display:none;">
        <div class="live-preview-header">
          <span>🏢 リアルタイム生成プレビュー</span>
          <button type="button" id="btn-toggle-live-preview-size" title="拡大/標準切替">🔍</button>
        </div>
        <div class="live-preview-canvas-wrap">
          <canvas id="paint-deftile-live-canvas"></canvas>
        </div>
      </div>
    `);
  }
}