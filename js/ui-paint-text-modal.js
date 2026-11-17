// 文字入力・プレビュー編集モーダルのDOM生成
import { TEXT_FONT_PRESETS } from './paint-text-renderer.js';

export function renderPaintTextModalUI() {
  if (document.getElementById('modal-paint-text')) return;
  const container = document.getElementById('modal-container') || document.body;

  const fontOpts = TEXT_FONT_PRESETS
    .map(f => `<option value="${f.value.replace(/"/g, '&quot;')}">${f.label}</option>`)
    .join('');

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-paint-text">
      <div class="text-modal-content">
        <header class="replace-header">
          <h3>🔤 文字入力・スタイル編集</h3>
          <span id="lbl-paint-text-pos" class="val-badge" style="margin-left:8px;">配置位置: (0, 0)</span>
          <button type="button" id="btn-paint-text-close-top" style="margin-left:auto;">✕ 閉じる</button>
        </header>

        <div class="text-modal-body">
          <div class="text-form-grid">
            <div class="dat-field full-width">
              <label>挿入するテキスト（改行で複数行対応）</label>
              <textarea id="txt-paint-text-content" rows="2" placeholder="例: 8000 / JR EAST"></textarea>
            </div>

            <div class="dat-field">
              <label>フォント</label>
              <select id="sel-paint-text-font">${fontOpts}</select>
            </div>

            <div class="dat-field" id="wrap-paint-text-font-custom" style="display:none;">
              <label>カスタムフォント名</label>
              <input type="text" id="inp-paint-text-font-custom" placeholder="例: BIZ UDGothic, sans-serif">
            </div>

            <div class="dat-field">
              <label>フォントサイズ (px / 小数可)</label>
              <input type="number" id="inp-paint-text-size" value="10" min="1" max="256" step="0.1">
            </div>

            <div class="dat-field">
              <label>文字間の幅 (px / 小数可)</label>
              <input type="number" id="inp-paint-text-spacing" value="0" min="-50" max="100" step="0.1">
            </div>

            <div class="dat-field">
              <label>行間倍率 (複数行時)</label>
              <input type="number" id="inp-paint-text-lineheight" value="1.2" min="0.5" max="4.0" step="0.1">
            </div>

            <div class="dat-field">
              <label>スタイル・描画モード</label>
              <div class="row" style="gap:8px; flex-wrap:wrap;">
                <label class="inline-chk-lbl"><input type="checkbox" id="chk-paint-text-bold"> 太字</label>
                <label class="inline-chk-lbl"><input type="checkbox" id="chk-paint-text-italic"> 斜体</label>
                <label class="inline-chk-lbl"><input type="checkbox" id="chk-paint-text-sharp" checked> ドット二値化</label>
              </div>
            </div>

            <div class="dat-field" id="wrap-paint-text-threshold">
              <label>二値化しきい値 (1〜254 / 小さいほど太め)</label>
              <input type="number" id="inp-paint-text-threshold" value="64" min="1" max="254" step="1">
            </div>

            <div class="dat-field full-width">
              <label>文字色</label>
              <div class="row" style="gap:6px; align-items:center;">
                <input type="color" id="inp-paint-text-color" class="color-input-mini" value="#FFFFFF">
                <input type="text" id="inp-paint-text-hex" value="#FFFFFF" maxlength="7" style="width:84px; font-family:Consolas,monospace;">
                <button type="button" id="btn-paint-text-pick-color">🎨 カラーピッカー</button>
              </div>
              <div id="paint-text-palette-swatches" class="text-palette-swatches"></div>
            </div>
          </div>

          <div class="text-preview-panel">
            <div class="text-preview-header">
              <span>プレビュー:</span>
              <span id="lbl-paint-text-metrics" class="val-badge">幅: 0 px × 高さ: 0 px</span>
              <div class="row" style="gap:4px; margin-left:auto; width:auto;">
                <label style="font-size:10px; color:#aaa;">倍率:</label>
                <select id="sel-paint-text-preview-zoom" class="snap-select-mini">
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4" selected>4×</option>
                  <option value="8">8×</option>
                </select>
              </div>
            </div>
            <div class="text-preview-viewport">
              <canvas id="paint-text-preview-canvas"></canvas>
            </div>
          </div>
        </div>

        <footer class="replace-footer">
          <span class="info-text">配置後はドラッグ/矢印キーで位置移動でき、確定まで再編集できます</span>
          <button type="button" id="btn-paint-text-apply" class="btn-primary" style="margin-left:auto;">✓ 配置して位置調整</button>
          <button type="button" id="btn-paint-text-cancel">✕ キャンセル</button>
        </footer>
      </div>
    </dialog>
  `);
}
