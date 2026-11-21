import { DAT_OBJECT_CATEGORIES, DAT_OBJECT_TEMPLATES, BUILDING_PRESETS } from './dat-templates.js';
import { IMAGE_FORMAT_OPTIONS } from './dat-image-formats.js';
import { renderDatAiSectionHtml } from './ui-dat-ai.js';
import { ProjectIO } from './project-io.js';
import { bindPatternFileButtons } from './dat-image-pattern-io.js';

function buildImageFormatOptions() {
  return IMAGE_FORMAT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function buildObjectSelectOptions() {
  return DAT_OBJECT_CATEGORIES.map(group => {
    const opts = group.items.map(key => {
      const tpl = DAT_OBJECT_TEMPLATES[key];
      return `<option value="${key}">${tpl ? tpl.label : key}</option>`;
    }).join('');
    return `<optgroup label="${group.groupLabel}">${opts}</optgroup>`;
  }).join('');
}

function buildBuildingPresetOptions() {
  return Object.entries(BUILDING_PRESETS).map(([key, p]) => {
    return `<option value="${key}">${p.label}</option>`;
  }).join('');
}

export function renderDatModalUI() {
  if (document.getElementById('modal-dat-generator')) return;
  const container = document.getElementById('modal-container') || document.body;

  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-dat-generator">
      <div class="dat-modal-container">
        <header class="dat-header">
          <h3>📄 Simutrans datファイル生成 (makeobj用)</h3>
          <span class="dat-status-badge" id="lbl-dat-mode-status">フォーム連動中</span>
          <button type="button" id="btn-close-dat-top" style="margin-left:auto;">✕ 閉じる</button>
        </header>

        <div class="dat-main-body">
          <!-- 左ペイン: 設定フォーム -->
          <div class="dat-form-pane">
            <fieldset class="sub-panel">
              <legend>オブジェクト種別＆プリセット</legend>
              <div class="dat-field">
                <label>オブジェクト種別 (obj=)</label>
                <select id="sel-dat-obj-type">
                  ${buildObjectSelectOptions()}
                </select>
              </div>
              <div class="dat-field mt-05" id="dat-building-preset-row">
                <label>建物用途プリセット (選択でtype等を一括設定)</label>
                <div class="row">
                  <select id="sel-dat-building-preset" style="flex:1;">
                    ${buildBuildingPresetOptions()}
                  </select>
                  <button type="button" id="btn-dat-apply-preset">適用</button>
                </div>
              </div>
            </fieldset>

            ${renderDatAiSectionHtml()}

            <fieldset class="sub-panel">
              <legend>共通パラメータ</legend>
              <div class="dat-field-grid">
                <div class="dat-field">
                  <label id="lbl-dat-name-field">アドオン識別名 (name=)</label>
                  <input type="text" id="inp-dat-name" value="new_building" placeholder="車両例: 会社_系列_形式(塗装)">
                </div>
                <div class="dat-field">
                  <label>作者名 (copyright=)</label>
                  <input type="text" id="inp-dat-copyright" value="" placeholder="任意">
                </div>
                <div class="dat-field full-width">
                  <label>日本語表示名 (ja.tab 用 / 省略可)</label>
                  <input type="text" id="inp-dat-ja-name" value="" placeholder="例: JR東日本 E233系0番台 クハE233 (中央線)">
                </div>
              </div>
            </fieldset>

            <fieldset class="sub-panel" id="fs-dat-image-settings">
              <legend>画像参照設定 (Image / BackImage / EmptyImage)</legend>
              <label class="dat-check-item">
                <input type="checkbox" id="chk-dat-include-images" checked> 画像指定行を自動生成する
              </label>
              <div class="dat-field mt-05">
                <label>画像指定形式 (切替可)</label>
                <select id="sel-dat-image-format">
                  ${buildImageFormatOptions()}
                </select>
              </div>
              <div id="dat-main-format-options" class="dat-format-options-box mt-05" style="display:none;"></div>
              <label class="dat-check-item mt-05" id="lbl-dat-flip-directions">
                <input type="checkbox" id="chk-dat-flip-directions"> 車両・車の向きを180°反転 (S↔N, E↔W, SE↔NW, SW↔NE)
              </label>
              <div class="dat-field mt-05">
                <label>画像ファイル名 (拡張子 .png なし)</label>
                <div class="row">
                  <input type="text" id="inp-dat-img-prefix" value="base_combined" placeholder="例: my_addon_combined" style="flex:1;">
                  <button type="button" id="btn-dat-sync-img-name" title="現在開いているベース画像名から取得">🖼️ 取得</button>
                </div>
              </div>
              <div class="dat-field-grid mt-05">
                <div class="dat-field">
                  <label>開始行 (Y)</label>
                  <input type="number" id="inp-dat-start-row" value="0" min="0">
                </div>
                <div class="dat-field">
                  <label>開始列 (X)</label>
                  <input type="number" id="inp-dat-start-col" value="0" min="0">
                </div>
                <div class="dat-field full-width" id="dat-tilecut-row" style="display:none; background:#1c2530; padding:6px 8px; border:1px solid #354759; border-radius:4px;">
                  <label class="dat-check-item">
                    <input type="checkbox" id="chk-dat-tilecut-enable"> 🧱 複数タイル建物: PNG出力時にタイルカッターで分割 (_cut.png)
                  </label>
                  <div class="row mt-05" style="gap:6px;">
                    <label style="font-size:11px; white-space:nowrap;">タイルサイズ:</label>
                    <select id="sel-dat-tilecut-size" style="width:110px;">
                      <option value="64">64px (pak64)</option>
                      <option value="96">96px (pak96)</option>
                      <option value="128">128px (pak128)</option>
                      <option value="192">192px (pak192)</option>
                      <option value="256">256px</option>
                    </select>
                    <button type="button" id="btn-dat-tilecut-export" style="margin-left:auto;">✂️ カットPNG保存</button>
                  </div>
                </div>
                <div class="dat-field full-width" id="dat-season-masks-box" style="display:none; background:#1c2530; padding:6px 8px; border:1px solid #354759; border-radius:4px;"></div>
                <div class="dat-field full-width">
                  <div class="btn-group">
                    <button type="button" id="btn-dat-open-img-picker" class="btn-primary">🗺️ GUIで画像位置を指定 (一括 / 個別)</button>
                    <button type="button" id="btn-dat-clear-custom-img" style="display:none; flex:0 0 auto;">↺ 個別解除</button>
                  </div>
                  <div class="btn-group mt-05">
                    <button type="button" id="btn-dat-save-pattern" title="現在の画像指定パターンを別ファイル(JSON)に保存します">💾 パターン保存</button>
                    <button type="button" id="btn-dat-load-pattern" title="保存済みの画像指定パターン(JSON)を読み込みます">📂 パターン読込</button>
                  </div>
                  <div class="info-text" id="lbl-dat-custom-img-status">画像位置: 開始行列 (Y, X) から自動展開（独自配置PNGは上のGUIから個別指定）</div>
                </div>
                <div class="dat-field full-width">
                  <label>画像オフセット (,x,y 形式 / 省略可)</label>
                  <input type="text" id="inp-dat-img-offset" value="" placeholder="例: ,0,0 または -16,8">
                </div>
              </div>
            </fieldset>

            <fieldset class="sub-panel">
              <legend>オブジェクト固有パラメータ</legend>
              <div id="dat-dynamic-fields" class="dat-field-grid"></div>
              <div id="dat-tunnel-way-box" class="dat-field full-width mt-05" style="display:none; background:#1c2530; padding:6px 8px; border:1px solid #354759; border-radius:4px;"></div>
              <div id="dat-factory-fields-box" class="dat-field full-width mt-05" style="display:none; background:#1c2530; padding:6px 8px; border:1px solid #354759; border-radius:4px;"></div>
            </fieldset>

            <fieldset class="sub-panel">
              <legend>追加パラメータ (自由記述)</legend>
              <div class="dat-field">
                <label>任意の key=value 行を追加（1行1項目）</label>
                <textarea id="inp-dat-extra-lines" placeholder="# コメントや追加キーを自由に入力"></textarea>
              </div>
            </fieldset>
          </div>

          <!-- 右ペイン: datプレビュー＆エディタ -->
          <div class="dat-preview-pane">
            <div class="dat-preview-toolbar">
              <label class="dat-check-item" title="フォーム変更時に右側のテキストを自動で更新します">
                <input type="checkbox" id="chk-dat-auto-sync" checked> フォーム変更を自動反映
              </label>
              <button type="button" id="btn-dat-regenerate" class="btn-primary">🔄 フォームから生成</button>
              <button type="button" id="btn-dat-append" title="現在のテキスト末尾に区切り線(---)付きで追記します">➕ 末尾に追記 (---)</button>
              <button type="button" id="btn-dat-clear" style="margin-left:auto;">🗑️ クリア</button>
            </div>
            <textarea id="txt-dat-output" spellcheck="false" placeholder="ここに生成された .dat の内容が表示されます"></textarea>
            <div class="dat-makeobj-panel" id="dat-makeobj-panel">
              <div class="dat-makeobj-row">
                <span class="dat-makeobj-title">⚙️ makeobj (.pak コンパイル)</span>
                <select id="sel-dat-makeobj-pak" title="コンパイル対象のタイルサイズ (pak)">
                  <option value="pak">pak (64px標準)</option>
                  <option value="pak32">pak32</option>
                  <option value="pak48">pak48</option>
                  <option value="pak64">pak64</option>
                  <option value="pak96">pak96</option>
                  <option value="pak128">pak128</option>
                  <option value="pak192">pak192</option>
                  <option value="pak256">pak256</option>
                </select>
                <input type="text" id="inp-dat-pak-filename" value="new_building.pak" placeholder="出力.pak名" style="width:145px;">
                <button type="button" id="btn-dat-makeobj-add-png" title="datが参照する別PNG画像があれば追加添付">📎 追加PNG</button>
                <button type="button" id="btn-dat-makeobj-clear-png" style="display:none;" title="追加PNG添付をクリア">✕</button>
                <button type="button" id="btn-dat-makeobj-compile" class="btn-primary">⚙️ .pak コンパイル</button>
                <button type="button" id="btn-dat-open-makeobj-modal" title="ja.tab生成・AI設定支援付きのmakeobj画面を開きます">🇯🇵 ja.tab / 詳細画面</button>
                <button type="button" id="btn-dat-makeobj-license" title="makeobjのバージョンとArtistic License 1.0情報を表示">📜 ライセンス</button>
              </div>
              <div class="info-text" id="lbl-dat-makeobj-extra-png">追加PNG: なし（編集中画像は自動添付）</div>
              <pre id="pre-dat-makeobj-log" class="dat-makeobj-log" style="display:none;"></pre>
            </div>
          </div>
        </div>

        <footer class="dat-footer">
          <button type="button" id="btn-dat-load-file">📂 .dat 読込</button>
          <div class="row" style="margin-left:auto; width:auto;">
            <label style="font-size:11px; color:#bbb; white-space:nowrap;">出力ファイル名:</label>
            <input type="text" id="inp-dat-filename" value="new_building.dat" style="width:180px;">
            <button type="button" id="btn-dat-copy">📋 コピー</button>
            <button type="button" id="btn-dat-save-file" class="btn-primary">💾 .dat 保存</button>
            <button type="button" id="btn-dat-close">閉じる</button>
          </div>
        </footer>
      </div>
    </dialog>
  `);
}

// DAT生成モーダル内の主要フォーム・出力関連イベントを一括バインドする
export function bindDatModalEvents(gen, { DAT_OBJECT_TEMPLATES, BUILDING_PRESETS, bindDatOutputActions }) {
  const modal = document.getElementById('modal-dat-generator');
  const closeModal = () => modal.close();
  document.getElementById('btn-close-dat-top').onclick = closeModal;
  document.getElementById('btn-dat-close').onclick = closeModal;

  document.getElementById('sel-dat-obj-type').onchange = (e) => {
    const prevDefault = DAT_OBJECT_TEMPLATES[gen.currentObjType]?.defaults?.name;
    gen.currentObjType = e.target.value;
    if (!gen.common.name || gen.common.name === prevDefault) {
      gen.common.name = gen._deriveAddonNameFromApp(gen.currentObjType);
    }
    gen._applyControllerStateToForm();
    if (gen.autoSync) gen.regenerateOutput();
    gen._updateSidebarStatus();
    gen.app?.markDirty?.();
  };

  document.getElementById('btn-dat-apply-preset').onclick = () => {
    const presetKey = document.getElementById('sel-dat-building-preset')?.value;
    const preset = BUILDING_PRESETS[presetKey];
    if (!preset) return;
    const state = gen._getObjState('building');
    Object.assign(state, preset.values);
    gen._renderDynamicFields();
    if (gen.autoSync) gen.regenerateOutput();
  };

  const bindCommon = (id, key, isCheckbox = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => {
      gen.common[key] = isCheckbox ? el.checked : el.value;
      if (key === 'name') {
        gen.liveryMgr.clearBaseNameCache();
        const inpFilename = document.getElementById('inp-dat-filename');
        if (inpFilename && !inpFilename.dataset.userEdited) {
          const base = (gen.common.name || 'addon').trim();
          inpFilename.value = base.toLowerCase().endsWith('.dat') ? base : `${base}.dat`;
          gen.makeobjBridge?.syncPakFilename?.(inpFilename.value);
        }
      }
      if (gen.autoSync) gen.regenerateOutput();
      gen.app?.markDirty?.();
    };
    el.addEventListener(isCheckbox ? 'change' : 'input', handler);
  };

  bindCommon('inp-dat-name', 'name');
  bindCommon('inp-dat-ja-name', 'jaName');
  bindCommon('inp-dat-copyright', 'copyright');
  bindCommon('chk-dat-include-images', 'includeImages', true);
  bindCommon('chk-dat-flip-directions', 'flipDirections', true);
  bindCommon('inp-dat-img-prefix', 'imgPrefix');
  bindCommon('inp-dat-start-row', 'startRow');
  bindCommon('inp-dat-start-col', 'startCol');
  bindCommon('inp-dat-img-offset', 'imgOffset');
  bindCommon('inp-dat-extra-lines', 'extraLines');

  document.getElementById('sel-dat-image-format')?.addEventListener('change', (e) => {
    const fmt = e.target.value;
    gen.common.imageFormat = fmt;
    const st = gen._getObjState(gen.currentObjType);
    // FreightImage と OTRP Reverse の排他性を維持する
    if (fmt === 'vehicle_otrp_reverse' || fmt === 'vehicle_otrp_reverse_only' || fmt.startsWith('vehicle_empty')) {
      st.hasFreightImage = false;
    } else if (fmt === 'vehicle_freight' || fmt === 'vehicle_freight_typed') {
      st.hasFreightImage = true;
    }
    gen._renderMainFormatOptions();
    if (gen.autoSync) gen.regenerateOutput();
    gen.app?.markDirty?.();
  });

  document.getElementById('btn-dat-sync-img-name').onclick = () => {
    gen.syncImagePrefixWithApp({ force: true });
    document.getElementById('inp-dat-img-prefix').value = gen.common.imgPrefix;
    if (gen.autoSync) gen.regenerateOutput();
    gen.app?.markDirty?.();
  };
  document.getElementById('btn-dat-open-img-picker').onclick = () => gen.imagePicker.open();
  document.getElementById('btn-dat-open-makeobj-modal')?.addEventListener('click', () => {
    modal.close();
    gen.makeobjModalCtrl?.open({ forceSyncFromDat: true });
  });
  document.getElementById('btn-dat-clear-custom-img').onclick = () => {
    gen.common.customImageCoords = null;
    gen._syncCustomImageStatus();
    if (gen.autoSync) gen.regenerateOutput();
  };
  bindPatternFileButtons({
    saveBtnId: 'btn-dat-save-pattern',
    loadBtnId: 'btn-dat-load-pattern',
    getTarget: () => ({ objType: gen.currentObjType, common: gen.common, values: gen._getObjState(gen.currentObjType) }),
    pickFileFn: gen.pickFileFn,
    onApplied: () => {
      gen._applyControllerStateToForm();
      if (gen.autoSync) gen.regenerateOutput();
      gen.app?.markDirty?.();
    }
  });

  document.getElementById('chk-dat-tilecut-enable')?.addEventListener('change', (e) => {
    const tc = gen.app?.tileCutter;
    if (!tc) return;
    tc.enabled = Boolean(e.target.checked);
    tc.manualOverride = tc.enabled;
    tc.pushToDatState(gen.currentObjType);
    tc.syncUI();
    gen.app?.markDirty?.();
  });
  document.getElementById('sel-dat-tilecut-size')?.addEventListener('change', (e) => {
    const tc = gen.app?.tileCutter;
    if (!tc) return;
    tc.tileSize = parseInt(e.target.value, 10) || 64;
    tc.syncUI();
    gen.app?.markDirty?.();
  });
  document.getElementById('btn-dat-tilecut-export')?.addEventListener('click', () => {
    const tc = gen.app?.tileCutter;
    if (tc && !tc.enabled) {
      tc.enabled = true;
      tc.manualOverride = true;
      tc.pushToDatState(gen.currentObjType);
      tc.syncUI();
    }
    ProjectIO.exportPng(gen.app);
  });

  bindDatOutputActions(gen);
}
