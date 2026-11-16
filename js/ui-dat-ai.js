import { PAKSET_OPTIONS, GEMINI_MODELS } from './dat-ai-service.js';

function buildPaksetOptions() {
  return PAKSET_OPTIONS.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
}

function buildGeminiModelOptions() {
  return GEMINI_MODELS.map(m => `<option value="${m.value}">${m.label}</option>`).join('') +
    '<option value="__custom__">カスタムモデル名を指定...</option>';
}

export function renderDatAiSectionHtml() {
  return `
    <!-- 生成AI連携パネル -->
    <details class="sub-panel dat-ai-panel" id="details-dat-ai">
      <summary style="cursor:pointer; font-size:11px; font-weight:bold; color:#9cdcfe;">✨ 生成AIでパラメータ自動設定 (Gemini)</summary>
      <div class="dat-ai-body">
        <div class="dat-field-grid">
          <div class="dat-field">
            <label>対象 pak バランス</label>
            <select id="sel-dat-ai-pakset">
              ${buildPaksetOptions()}
            </select>
          </div>
          <div class="dat-field" id="dat-ai-vehicle-mode-wrap">
            <label>鉄道車両の取得単位</label>
            <select id="sel-dat-ai-vehicle-mode">
              <option value="consist" selected>編成単位 (Constraint自動連結)</option>
              <option value="series">形式単位 (代表車種＋Constraint)</option>
              <option value="single">単一車両のみ</option>
            </select>
          </div>
        </div>

        <div class="dat-field-grid mt-05" id="dat-ai-vehicle-extra-wrap">
          <div class="dat-field">
            <label>希望両数 (空欄=実車/標準)</label>
            <input type="number" id="inp-dat-ai-car-count" min="1" max="30" placeholder="例: 10">
          </div>
          <div class="dat-field" style="justify-content:flex-end;">
            <label class="dat-check-item" title="生成された複数車両の startRow を 0, 1, 2... に連番設定します">
              <input type="checkbox" id="chk-dat-ai-seq-rows" checked> 画像行(Y)を0から連番
            </label>
          </div>
        </div>

        <div class="dat-field mt-05">
          <label>生成したい実車・建物・設備名や特徴</label>
          <textarea id="inp-dat-ai-prompt" placeholder="例: JR東日本 E233系0番台 中央線 10両編成 / または 昭和レトロな木造駅舎"></textarea>
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
            <button type="button" id="btn-dat-ai-apply-json" class="btn-primary">✓ JSONをフォームに反映</button>
            <button type="button" id="btn-dat-ai-cancel-json">閉じる</button>
          </div>
        </div>

        <div class="info-text mt-05" id="lbl-dat-ai-status">AI連携: 待機中</div>
      </div>
    </details>

    <!-- 複数オブジェクト / 編成車両切替バー -->
    <fieldset class="sub-panel" id="fs-dat-collection-bar" style="display:none;">
      <legend>🚃 編成・複数オブジェクト一覧</legend>
      <div class="row">
        <select id="sel-dat-active-object" style="flex:1;"></select>
      </div>
      <div class="btn-group mt-05">
        <button type="button" id="btn-dat-obj-duplicate" title="現在のオブジェクトを複製追加">＋ 複製</button>
        <button type="button" id="btn-dat-obj-delete" style="color:#ff8888;" title="選択中のオブジェクトを削除">🗑️ 削除</button>
        <button type="button" id="btn-dat-obj-reset-single" title="複数編成リストを解除して単体編集に戻す">↺ 単体に戻す</button>
      </div>
      <label class="dat-check-item mt-05">
        <input type="checkbox" id="chk-dat-export-all-objects" checked> 全オブジェクトを「---」区切りで一括出力
      </label>
    </fieldset>

    <!-- マスク画像＝塗装バリエーション連携パネル -->
    <details class="sub-panel" id="fs-dat-livery-panel">
      <summary style="cursor:pointer; font-size:11px; font-weight:bold; color:#e5c07b;">🎭 マスク画像(塗装)バリエーション連携</summary>
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
        <button type="button" id="btn-dat-livery-expand-all" class="btn-primary w-100 mt-05">🎭 全マスクを一括 --- 出力</button>
      </div>
    </details>
  `;
}
