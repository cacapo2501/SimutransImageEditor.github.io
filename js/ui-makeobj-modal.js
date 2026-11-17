// makeobj (.pak コンパイル ＆ ja.tab 生成 ＆ AI設定支援) 専用モーダル UI テンプレート

export function renderMakeobjCompileModalUI() {
  if (document.getElementById('modal-makeobj-compile')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-makeobj-compile">
      <div class="dat-modal-container">
        <header class="dat-header">
          <h3>⚙️ makeobj コンパイル ＆ ja.tab 出力</h3>
          <span class="dat-status-badge" id="lbl-mk-version-badge">makeobj: 確認中...</span>
          <button type="button" id="btn-mk-license-top">📜 ライセンス</button>
          <button type="button" id="btn-mk-close-top" style="margin-left:auto;">✕ 閉じる</button>
        </header>

        <div class="dat-main-body">
          <!-- 左ペイン: コンパイル設定 / AI支援 / ja.tab -->
          <div class="dat-form-pane">
            <fieldset class="sub-panel">
              <legend>pak コンパイル設定</legend>
              <div class="dat-field-grid">
                <div class="dat-field">
                  <label>pak サイズ指定</label>
                  <select id="sel-mk-pak-arg">
                    <option value="pak">pak (64px標準)</option>
                    <option value="pak32">pak32</option>
                    <option value="pak48">pak48</option>
                    <option value="pak64">pak64</option>
                    <option value="pak96">pak96</option>
                    <option value="pak128">pak128</option>
                    <option value="pak192">pak192</option>
                    <option value="pak256">pak256</option>
                  </select>
                </div>
                <div class="dat-field">
                  <label>出力 .pak ファイル名 (1ファイルに結合)</label>
                  <input type="text" id="inp-mk-pak-name" value="addon.pak" placeholder="例: E233_Chuo.pak">
                </div>
                <div class="dat-field full-width">
                  <label>入力 .dat ファイル名 (仮想FS上の名前)</label>
                  <input type="text" id="inp-mk-dat-name" value="addon.dat" placeholder="例: addon.dat">
                </div>
              </div>
              <div class="info-text mt-05" id="lbl-mk-obj-summary">検出オブジェクト: 0件</div>
              <div class="btn-group mt-05">
                <button type="button" id="btn-mk-sync-dat" title="dat生成エディタの最新内容を取り込みます">🔄 datエディタから取得</button>
                <button type="button" id="btn-mk-load-dat" title="ローカルの .dat ファイルを読み込みます">📂 .dat 読込</button>
                <button type="button" id="btn-mk-open-dat-editor" title="dat生成・編集エディタを開きます">📝 dat編集</button>
              </div>
              <div class="btn-group mt-05">
                <button type="button" id="btn-mk-add-png" title="datが参照する外部PNGを追加添付します">📎 追加PNG添付</button>
                <button type="button" id="btn-mk-clear-png" style="display:none; flex:0 0 auto;">✕ PNGクリア</button>
              </div>
              <div class="info-text" id="lbl-mk-extra-png">追加PNG: なし（編集中画像は自動添付）</div>
            </fieldset>

            <fieldset class="sub-panel dat-ai-panel">
              <legend>✨ AIによる設定支援 (pak診断・ja.tab日本語名生成)</legend>
              <div class="dat-ai-body">
                <div class="dat-field">
                  <label>補足メモ・車種/建物名などのヒント (任意)</label>
                  <input type="text" id="inp-mk-ai-hint" placeholder="例: JR東日本 E233系0番台 中央線 / pak128向け">
                </div>
                <div class="btn-group mt-05">
                  <button type="button" id="btn-mk-ai-assist" class="btn-primary">✨ AIで設定支援</button>
                  <button type="button" id="btn-mk-ai-copy-prompt" title="Gemini以外のAIにも使えるプロンプトをコピー">📋 プロンプト</button>
                  <button type="button" id="btn-mk-ai-toggle-json" title="AIから取得したJSONを貼付">📥 JSON貼付</button>
                </div>
                <div id="mk-ai-json-wrap" style="display:none;" class="mt-05">
                  <div class="dat-field">
                    <label>AIが出力したJSONを貼り付けて「反映」を押してください</label>
                    <textarea id="inp-mk-ai-json" placeholder='{"recommendedPakArg":"pak128","translations":{...}}'></textarea>
                  </div>
                  <div class="btn-group mt-05">
                    <button type="button" id="btn-mk-ai-paste-clip" title="クリップボードから貼り付け">📋 貼付</button>
                    <button type="button" id="btn-mk-ai-apply-json" class="btn-primary">✓ JSONを反映</button>
                    <button type="button" id="btn-mk-ai-cancel-json">閉じる</button>
                  </div>
                </div>
                <div class="info-text mt-05" id="lbl-mk-ai-advice" style="white-space:pre-wrap; line-height:1.4;">AI設定支援: 待機中（APIキーは「dat編集」内のGemini設定を共用）</div>
              </div>
            </fieldset>

            <fieldset class="sub-panel">
              <legend>🇯🇵 翻訳ファイル (ja.tab / UTF-8 LF)</legend>
              <div class="btn-group">
                <button type="button" id="btn-mk-rebuild-jatab" title="右側のdatテキストの name= から ja.tab 項目を再構築します">🔄 datから項目再生成</button>
                <button type="button" id="btn-mk-load-jatab" title="既存の ja.tab を読み込んで訳語を引き継ぎます">📂 ja.tab 読込</button>
              </div>
              <div class="dat-field mt-05">
                <textarea id="txt-mk-jatab" spellcheck="false" style="min-height:130px; font-family:Consolas, monospace;" placeholder="§#\nobject_name\n日本語表示名"></textarea>
              </div>
              <div class="btn-group mt-05">
                <button type="button" id="btn-mk-copy-jatab">📋 ja.tab コピー</button>
                <button type="button" id="btn-mk-save-jatab" class="btn-primary">💾 ja.tab 保存</button>
              </div>
            </fieldset>
          </div>

          <!-- 右ペイン: コンパイル対象 dat と実行ログ -->
          <div class="dat-preview-pane">
            <div class="dat-preview-toolbar">
              <span style="font-size:11px; color:#9cdcfe; font-weight:bold;">コンパイル対象 .dat（--- 区切りの複数車両も1つの .pak に出力）</span>
              <button type="button" id="btn-mk-save-dat" style="margin-left:auto;">💾 .dat 保存</button>
            </div>
            <textarea id="txt-mk-dat" spellcheck="false" placeholder="ここにコンパイル対象の .dat 内容が表示されます"></textarea>
            <div class="dat-makeobj-panel">
              <div class="info-text" id="lbl-mk-compile-status">実行ログ: 待機中</div>
              <pre id="pre-mk-log" class="dat-makeobj-log" style="display:none; max-height:120px;"></pre>
            </div>
          </div>
        </div>

        <footer class="dat-footer">
          <button type="button" id="btn-mk-license-foot">📜 Artistic License 1.0 / ソース情報</button>
          <div class="row" style="margin-left:auto; width:auto;">
            <button type="button" id="btn-mk-compile" class="btn-primary">⚙️ 1つの .pak にコンパイルして保存</button>
            <button type="button" id="btn-mk-close">閉じる</button>
          </div>
        </footer>
      </div>
    </dialog>
  `);
}
