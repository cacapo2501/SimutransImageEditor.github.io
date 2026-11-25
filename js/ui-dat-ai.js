import { PAKSET_OPTIONS, GEMINI_MODELS } from './dat-ai-service.js';

function buildPaksetOptions() {
  return PAKSET_OPTIONS.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
}

function buildGeminiModelOptions() {
  return GEMINI_MODELS.map(m => `<option value="${m.value}">${m.label}</option>`).join('') +
    '<option value="__custom__">カスタムモデル名を指定...</option>';
}

// 2. 生成AI連携パネル
export function renderDatAiSectionHtml() {
  return `
    <details class="sub-panel dat-ai-panel" id="details-dat-ai">
      <summary style="cursor:pointer; font-size:11px; font-weight:bold; color:#9cdcfe;">2. ✨ 生成AIでパラメータ自動設定 (Gemini)</summary>
      <div class="dat-ai-body">
        <div class="dat-field-grid">
          <div class="dat-field">
            <label>対象 pak バランス</label>
            <select id="sel-dat-ai-pakset">
              ${buildPaksetOptions()}
            </select>
          </div>
          <div class="dat-field" id="dat-ai-vehicle-mode-wrap">
            <label>車両・編成の取得単位</label>
            <select id="sel-dat-ai-vehicle-mode">
              <option value="consist" selected>編成・フル構成 (Constraint自動連結)</option>
              <option value="series">形式・車種単位 (主要車種＋Constraint)</option>
              <option value="single">単一車両のみ (1オブジェクト)</option>
            </select>
          </div>
        </div>

        <div class="dat-field-grid mt-05" id="dat-ai-vehicle-extra-wrap">
          <div class="dat-field">
            <label>希望両数 (空欄=実車/標準)</label>
            <input type="number" id="inp-dat-ai-car-count" min="1" max="30" placeholder="例: 10">
          </div>
          <div class="dat-field">
            <label>起動加速度 [km/h/s] (空欄=自動 / 最大4.5)</label>
            <input type="number" id="inp-dat-ai-accel" min="0" max="4.5" step="0.1" placeholder="自動 (0〜4.5)" title="起動加速度(km/h/s)に応じ 0(1.1倍)〜4.5(2.5倍) の連続値でStandard準拠のギア比を計算します（上限なし）">
          </div>
          <div class="dat-field full-width">
            <label class="dat-check-item" title="編集中画像の有効行数に合わせ、生成された複数車両の startRow を自動で割り当てます">
              <input type="checkbox" id="chk-dat-ai-seq-rows" checked> 画像行(Y)を自動連番/車種割当
            </label>
          </div>
        </div>

        <div class="dat-field mt-05">
          <div class="row" style="justify-content:space-between; align-items:center; gap:4px;">
            <label style="margin:0;">生成したい実車・建物・設備名や特徴</label>
            <div class="row" style="gap:4px; width:auto;">
              <select id="sel-dat-ai-history" style="max-width:155px; font-size:10px;" title="過去に保存・生成したAI指示を呼び出します">
                <option value="">-- 保存済み指示 (0件) --</option>
              </select>
              <button type="button" id="btn-dat-ai-save-history" class="btn-sm" title="現在の指示文・設定を履歴に保存します">💾</button>
              <button type="button" id="btn-dat-ai-del-history" class="btn-sm" style="color:#ff8888;" title="選択中の履歴を削除します">🗑️</button>
            </div>
          </div>
          <textarea id="inp-dat-ai-prompt" placeholder="例: JR東日本 E233系0番台 中央快速線 10両編成 / 国鉄 EF65形1000番台＋コキ104形 / いすゞエルガ 都営バス / B787-8 / 昭和レトロな木造駅舎"></textarea>
        </div>

        <div class="dat-field-grid mt-05" id="dat-ai-cost-options-wrap">
          <div class="dat-field full-width">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <label>作成・購入コスト倍率 (cost)</label>
              <span id="lbl-dat-ai-build-cost" class="val-badge" style="min-width:105px;">100% (1.00倍)</span>
            </div>
            <input type="range" id="rng-dat-ai-build-cost" min="25" max="300" step="5" value="100">
          </div>
          <div class="dat-field full-width">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <label>輸送・維持コスト倍率 (runningcost / maintenance)</label>
              <span id="lbl-dat-ai-maint-cost" class="val-badge" style="min-width:105px;">100% (1.00倍)</span>
            </div>
            <input type="range" id="rng-dat-ai-maint-cost" min="25" max="300" step="5" value="100">
          </div>
          <div class="dat-field full-width">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <label>積載・収容効率バランス (payload / capacity / 生産性)</label>
              <span id="lbl-dat-ai-payload-eff" class="val-badge" style="min-width:105px;">100% (1.00倍)</span>
            </div>
            <div class="row" style="gap:6px;">
              <input type="range" id="rng-dat-ai-payload-eff" min="50" max="200" step="5" value="100" style="flex:1;">
              <button type="button" id="btn-dat-ai-reset-balance" class="btn-sm" title="コスト・バランスをすべて100%(標準)に戻します">↺ 標準</button>
            </div>
          </div>
        </div>

        <details class="dat-ai-api-details mt-05" id="details-dat-ai-key">
          <summary style="cursor:pointer; font-size:10px; color:#bbb;">🔑 Gemini API 設定 (キー・モデル)</summary>
          <div class="dat-field mt-05">
            <label>Gemini API Key (Google AI Studio)</label>
            <input type="password" id="inp-dat-ai-apikey" placeholder="AIza...">
          </div>
          <label class="dat-check-item mt-05">
            <input type="checkbox" id="chk-dat-ai-save-key"> APIキーをブラウザ (localStorage) に保存する
          </label>
          <div class="dat-field mt-05">
            <label>使用モデル</label>
            <div class="row">
              <select id="sel-dat-ai-model" style="flex:1;">
                ${buildGeminiModelOptions()}
              </select>
              <button type="button" id="btn-dat-ai-fetch-models" title="入力中のAPIキーで利用可能な最新モデル一覧を取得します">🔄 取得</button>
            </div>
          </div>
          <div class="dat-field mt-05" id="dat-ai-custom-model-wrap" style="display:none;">
            <label>カスタムモデル名</label>
            <input type="text" id="inp-dat-ai-custom-model" placeholder="例: gemini-4-hydrogen">
          </div>
        </details>

        <div class="btn-group mt-05">
          <button type="button" id="btn-dat-ai-generate" class="btn-primary">✨ AIで生成・反映</button>
          <button type="button" id="btn-dat-ai-copy-prompt" title="APIキーを使わず外部AIチャットへ貼るプロンプトをコピー">📋 プロンプト</button>
          <button type="button" id="btn-dat-ai-toggle-json" title="外部AIから得たJSONを貼り付けて反映">📥 JSON貼付</button>
        </div>

        <div id="dat-ai-manual-json-wrap" style="display:none;" class="mt-05">
          <div class="dat-field">
            <label>AIが出力したJSONを貼り付けて「反映」を押してください</label>
            <textarea id="inp-dat-ai-manual-json" placeholder='{"summary":"...","objects":[...]}'></textarea>
          </div>
          <div class="btn-group mt-05">
            <button type="button" id="btn-dat-ai-paste-clip" title="クリップボードから貼り付け">📋 貼付</button>
            <button type="button" id="btn-dat-ai-apply-json" class="btn-primary">✓ JSONをフォームに反映</button>
            <button type="button" id="btn-dat-ai-cancel-json">閉じる</button>
          </div>
        </div>

        <div class="info-text mt-05" id="lbl-dat-ai-status">AI連携: 待機中</div>
      </div>
    </details>
  `;
}

// 複数オブジェクト / 編成車両切替バー
export function renderDatCollectionBarHtml() {
  return `
    <fieldset class="sub-panel" id="fs-dat-collection-bar" style="display:none;">
      <legend>🚃 編成・複数オブジェクト切替</legend>
      <div class="row" style="gap:4px;">
        <button type="button" id="btn-dat-obj-prev" class="btn-sm" title="前の車両/オブジェクトへ切替">◀</button>
        <select id="sel-dat-active-object" style="flex:1;"></select>
        <button type="button" id="btn-dat-obj-next" class="btn-sm" title="次の車両/オブジェクトへ切替">▶</button>
      </div>
      <div class="btn-group mt-05">
        <button type="button" id="btn-dat-obj-duplicate" title="現在のオブジェクトを複製追加">＋ 複製</button>
        <button type="button" id="btn-dat-obj-delete" style="color:#ff8888;" title="選択中のオブジェクトを削除">🗑️ 削除</button>
        <button type="button" id="btn-dat-obj-reset-single" title="複数編成リストを解除して単体編集に戻す">↺ 単体に戻す</button>
      </div>
      <label class="dat-check-item mt-05">
        <input type="checkbox" id="chk-dat-export-all-objects" checked> 全オブジェクトを「---」区切りで一括出力
      </label>
      <div class="dat-reverse-box mt-05">
        <div style="font-size:10px; color:#9cdcfe; font-weight:bold; margin-bottom:4px;">🔁 編成反転オプション (順序・Constraint・向き)</div>
        <label class="dat-check-item">
          <input type="checkbox" id="chk-dat-reverse-flip-img" checked> 反転時に画像向き (S↔N等) も180°反転する
        </label>
        <div class="btn-group mt-05">
          <button type="button" id="btn-dat-reverse-inplace" title="現在の編成順とconstraint[prev/next]を逆転させます">🔁 現在の編成を反転</button>
          <button type="button" id="btn-dat-reverse-append" title="末尾に_revを付けた逆向き編成を複製追加します">➕ 反転編成を追加</button>
        </div>
      </div>
    </fieldset>
  `;
}

// 6. マスク画像＝塗装バリエーション連携パネル
export function renderDatLiveryPanelHtml() {
  return `
    <details class="sub-panel" id="fs-dat-livery-panel">
      <summary style="cursor:pointer; font-size:11px; font-weight:bold; color:#e5c07b;">6. 🎭 マスク画像(塗装)バリエーション連携</summary>
      <div class="dat-ai-body">
        <div class="info-text" id="lbl-dat-livery-mask">選択中マスク: なし</div>
        <div class="dat-field mt-05">
          <label>このマスクの塗装名（鉄道車両は「会社_系列_形式(塗装名)」に反映）</label>
          <div class="row">
            <input type="text" id="inp-dat-livery-name" placeholder="例: Chuo / Standard" style="flex:1;" disabled>
            <button type="button" id="btn-dat-livery-apply-active" title="現在のマスク塗装名と画像名を反映（スペック・画像位置は引継）">反映</button>
          </div>
        </div>
        <label class="dat-check-item mt-05">
          <input type="checkbox" id="chk-dat-livery-follow" checked> マスク切替時にスペック・画像位置を引継ぎ塗装自動反映
        </label>
        <label class="dat-check-item mt-05">
          <input type="checkbox" id="chk-dat-livery-batch-img" checked> 画像名にマスク名を含める (一括PNG出力と一致)
        </label>
        <label class="dat-check-item mt-05" title="有効にすると、車両の constraint[prev/next] に登録済み全マスク（全塗装）の対応車両を展開し、異なる塗装同士を混結できるようにします">
          <input type="checkbox" id="chk-dat-livery-mix-consist"> 塗装を気にせず混結する (全マスク塗装を連結許可)
        </label>
        <button type="button" id="btn-dat-livery-expand-all" class="btn-primary w-100 mt-05">🎭 全マスクを一括 --- 出力</button>
      </div>
    </details>
  `;
}
