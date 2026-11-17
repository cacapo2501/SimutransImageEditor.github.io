export function renderSidebarToolAccordions() {
  return `
    <!-- セクション5: 窓色ランダム暗転 (独立アコーディオン) -->
    <details class="accordion-panel">
      <summary>🪟 窓色ランダム暗転 (SpecialColor一部解除)</summary>
      <div class="panel-body">
        <label><input type="checkbox" id="chk-window-darken"> 連結した窓ブロックをランダムに暗転させる</label>
        <div class="row mt-05">
          <span>暗転比率:</span>
          <span class="val-badge" id="lbl-window-darken-ratio">50%</span>
          <input type="range" id="slider-window-darken-ratio" min="0" max="100" step="1" value="50">
          <button type="button" id="btn-window-darken-reroll" style="flex-shrink:0;">🎲 再抽選</button>
        </div>
        <label class="mt-05"><input type="checkbox" id="chk-window-darken-all-special"> 標準窓色(#57656F/#4D4D4D)以外の特殊色も対象にする</label>
        <div class="info-text" id="lbl-window-darken-info">対象窓グループ: 未実行</div>
      </div>
    </details>

    <!-- セクション6: pak64車両画像 圧縮・標準配置変換 -->
    <details class="accordion-panel">
      <summary>🚃 pak64車両画像 圧縮・標準配置変換</summary>
      <div class="panel-body">
        <p class="desc-text">ベース画像とマスク画像を同時にpak64車両用の圧縮配置（_c）または標準配置（_s / 512×64倍数）へ相互変換します。</p>
        <div class="row mt-05">
          <label style="min-width: 85px;">車体長 (Length):</label>
          <select id="inp-vehicle-length">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8" selected>8 (標準)</option>
            <option value="9">9</option>
            <option value="10">A (10)</option>
            <option value="11">11</option>
            <option value="12">12</option>
          </select>
        </div>
        <label class="mt-05"><input type="checkbox" id="chk-vehicle-compress-bg"> 圧縮時の1px区切り余白を背景色(#E7FFFF/#FFFFFF)で埋める</label>
        <div class="btn-group mt-05">
          <button id="btn-vehicle-compress" class="btn-primary">🗜️ 圧縮配置に変換 (_c)</button>
          <button id="btn-vehicle-expand" class="btn-primary">📐 標準配置に展開 (_s)</button>
        </div>
        <div class="info-text" id="lbl-vehicle-status">変換状態: 待機中</div>
      </div>
    </details>

    <!-- セクション7: 飛行機平面図 8方向展開 -->
    <details class="accordion-panel">
      <summary>✈️ 飛行機平面図 8方向展開 (3D分類・マスク生成)</summary>
      <div class="panel-body">
        <p class="desc-text">平面定義画像を直接読み込み・編集してから、8方向(768×96px)のベース画像＆マスク画像を生成します。</p>
        <div class="btn-group">
          <button id="btn-aircraft-load-plan" class="btn-primary">📂 平面定義画像を開く</button>
          <button id="btn-aircraft-new-plan">🆕 新規平面図</button>
        </div>
        <div class="btn-group mt-05">
          <button id="btn-aircraft-edit-plan" class="btn-primary">✏️ 平面定義画像を編集</button>
          <button id="btn-aircraft-save-plan">💾 平面図保存</button>
        </div>
        <div class="info-text" id="lbl-aircraft-plan-info">平面定義画像: 未読込</div>

        <div class="row mt-05">
          <label style="min-width: 65px;">全長 (m):</label>
          <input type="number" id="inp-aircraft-length" value="39.5" step="0.1" min="1" max="200" style="background:#1e1e1e; border:1px solid #444; color:#eee; padding:3px 6px;">
        </div>
        <div class="row mt-05">
          <label style="min-width: 65px;">全高 (m):</label>
          <input type="number" id="inp-aircraft-height" value="12.5" step="0.1" min="0.1" max="100" style="background:#1e1e1e; border:1px solid #444; color:#eee; padding:3px 6px;">
        </div>
        <div class="row mt-05">
          <label style="min-width: 65px;">縮尺係数:</label>
          <input type="number" id="inp-aircraft-coeff" value="0.8" step="0.05" min="0.1" max="2.0" style="background:#1e1e1e; border:1px solid #444; color:#eee; padding:3px 6px;">
        </div>
        <fieldset class="sub-panel mt-05">
          <legend>基準グレースケール色設定</legend>
          <div class="row">
            <label style="min-width: 110px;">上水平面:</label>
            <input type="color" id="inp-aircraft-col-top" value="#CCCCCC" class="color-input-mini">
            <span style="font-size:10px; color:#aaa;">#CCCCCC</span>
          </div>
          <div class="row mt-05">
            <label style="min-width: 110px;">左斜め前垂直壁:</label>
            <input type="color" id="inp-aircraft-col-left" value="#B2B2B2" class="color-input-mini">
            <span style="font-size:10px; color:#aaa;">#B2B2B2</span>
          </div>
          <div class="row mt-05">
            <label style="min-width: 110px;">右斜め前垂直壁:</label>
            <input type="color" id="inp-aircraft-col-right" value="#808080" class="color-input-mini">
            <span style="font-size:10px; color:#aaa;">#808080</span>
          </div>
          <div class="row mt-05">
            <label style="min-width: 110px;">60°左斜め前光源:</label>
            <input type="color" id="inp-aircraft-col-sun" value="#FFFFFF" class="color-input-mini">
            <span style="font-size:10px; color:#aaa;">#FFFFFF</span>
          </div>
        </fieldset>
        <button id="btn-aircraft-map" class="btn-primary w-100 mt-05">✈️ 8方向ベース＆マスクを生成</button>
        <div class="info-text" id="lbl-aircraft-status">展開状態: 待機中</div>
      </div>
    </details>

    <!-- セクション8: 制御点グラデーション生成 -->
    <details class="accordion-panel">
      <summary>🌈 制御点グラデーション生成 (ベース画像)</summary>
      <div class="panel-body">
        <p class="desc-text">ベース画像内のHSV彩度制御点（S=100%制御点・S=50%塗り領域）からグレースケールグラデーションを生成します。</p>
        <label class="mt-05"><input type="checkbox" id="chk-gradient-split8" checked> 横8分割（8方向別々）にグラデーションを計算する</label>
        <button id="btn-gradient-generate" class="btn-primary w-100 mt-05">🌈 ベース画像にグラデーション生成</button>
        <div class="info-text" id="lbl-gradient-status">生成状態: 待機中</div>
      </div>
    </details>

    <!-- セクション9: CityCar画像 圧縮・展開変換 -->
    <details class="accordion-panel">
      <summary>🚗 CityCar画像 圧縮・展開変換</summary>
      <div class="panel-body">
        <p class="desc-text">CityCar用の512×64標準配置と黒(0,0,0)1px縦区切りの圧縮配置を相互変換します（ベース・マスク同時対応）。</p>
        <div class="btn-group mt-05">
          <button id="btn-citycar-compress" class="btn-primary">🗜️ 圧縮配置に変換</button>
          <button id="btn-citycar-expand" class="btn-primary">📐 512×64へ展開</button>
        </div>
        <div class="info-text" id="lbl-citycar-status">変換状態: 待機中</div>
      </div>
    </details>

    <!-- セクション10: 結合画像の連続出力 -->
    <details class="accordion-panel">
      <summary>📦 結合画像の連続出力</summary>
      <div class="panel-body">
        <p class="desc-text">登録されている全マスク画像のバリエーション一括出力、または連番バリエーション連続出力を行います。</p>
        <div class="btn-group mt-05">
          <button id="btn-batch-export-masks" class="btn-primary">📦 全マスク一括出力</button>
          <button id="btn-batch-export-masks-dir" title="ローカルフォルダを選んで一括保存">📁 フォルダへ一括保存</button>
        </div>
        <div class="row mt-05">
          <label style="min-width: 65px;">連番枚数:</label>
          <input type="number" id="inp-batch-variant-count" value="4" min="1" max="100" style="width:55px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:3px 6px;">
          <span style="font-size:11px;">枚</span>
          <button id="btn-batch-export-variants" class="btn-primary" style="margin-left:auto;">🔁 連番出力</button>
        </div>
        <label class="mt-05"><input type="checkbox" id="chk-batch-reroll-window" checked> 連番出力時に1枚ごとに窓ランダム暗転を再抽選する</label>
        <div class="info-text" id="lbl-batch-export-status">連続出力: 待機中</div>
      </div>
    </details>

    <!-- セクション10.5: 複数タイル建物 タイルカッター出力 -->
    <details class="accordion-panel">
      <summary>🧱 複数タイル建物 タイルカッター出力</summary>
      <div class="panel-body">
        <p class="desc-text">2×2等の複数タイル建物画像を、PNG出力時に pakサイズ単位のタイルシートへ切り出して並べ替えます。</p>
        <label class="mt-05"><input type="checkbox" id="chk-tilecut-enable"> PNG出力・一括出力時にタイルカッターで分割する</label>
        <div class="row mt-05">
          <label style="min-width: 75px;">タイルサイズ:</label>
          <select id="sel-tilecut-size" style="flex:1;">
            <option value="64" selected>64px (pak64)</option>
            <option value="96">96px (pak96)</option>
            <option value="128">128px (pak128)</option>
            <option value="192">192px (pak192)</option>
            <option value="256">256px</option>
          </select>
        </div>
        <div class="row mt-05" style="gap:4px;">
          <label style="font-size:11px;">幅(W):</label>
          <input type="number" id="inp-tilecut-w" value="1" min="1" max="16" style="width:44px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px 4px;">
          <label style="font-size:11px;">奥(H):</label>
          <input type="number" id="inp-tilecut-h" value="1" min="1" max="16" style="width:44px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px 4px;">
          <label style="font-size:11px;">高:</label>
          <input type="number" id="inp-tilecut-height" value="1" min="1" max="16" style="width:44px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px 4px;">
        </div>
        <div class="row mt-05" style="gap:4px;">
          <label style="font-size:11px;">向き:</label>
          <select id="sel-tilecut-views" style="width:65px;">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4" selected>4</option>
          </select>
          <label style="font-size:11px;">ずらしX/Y:</label>
          <input type="number" id="inp-tilecut-ox" value="0" style="width:44px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px 4px;">
          <input type="number" id="inp-tilecut-oy" value="0" style="width:44px; background:#1e1e1e; border:1px solid #444; color:#eee; padding:2px 4px;">
        </div>
        <label class="mt-05"><input type="checkbox" id="chk-tilecut-mask-v" checked> 底面菱形の下端外側を #E7FFFF で切り抜く</label>
        <button type="button" id="btn-tilecut-sync-dat" class="w-100 mt-05">🔄 datの建物設定から取得</button>
        <div class="info-text" id="lbl-tilecut-status">OFF (通常結合出力)</div>
      </div>
    </details>

    <!-- セクション11: Simutrans datファイル生成 -->
    <details class="accordion-panel">
      <summary>📄 datファイル生成 (makeobj用)</summary>
      <div class="panel-body">
        <p class="desc-text">建物・車両・CityCar・インフラ・自然物・工場等のテンプレートから pak 生成用の .dat ファイルを作成・編集します。</p>
        <button id="btn-open-dat-generator" class="btn-primary w-100 mt-05">📝 dat生成・編集エディタを開く</button>
        <div class="info-text" id="lbl-dat-sidebar-status">選択中: 未起動</div>
      </div>
    </details>

    <!-- セクション12: 特殊色・外部連携設定 -->
    <details class="accordion-panel">
      <summary>特殊色・外部連携設定</summary>
      <div class="panel-body">
        <fieldset class="sub-panel">
          <legend>特殊色CSV (1列目読込・編集除外・衝突回避)</legend>
          <div class="row">
            <input type="file" id="file-csv" accept=".csv">
          </div>
          <div class="info-text mt-05" id="lbl-csv-info">特殊色: 0件登録済</div>
        </fieldset>

        <fieldset class="sub-panel mt-05">
          <legend>Google Drive 認証設定</legend>
          <label>API Key:</label>
          <input type="text" id="gdrive-api-key" placeholder="AIzaSy...">
          <label class="mt-05">Client ID:</label>
          <input type="text" id="gdrive-client-id" placeholder="xxxx.apps.googleusercontent.com">
          <p class="desc-text">※GitHub Pages等の環境では、ご自身のGoogle Cloudで発行したクライアント情報を入力して利用します。</p>
        </fieldset>
      </div>
    </details>
  `;
}