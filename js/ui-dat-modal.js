import { DAT_OBJECT_CATEGORIES, DAT_OBJECT_TEMPLATES, BUILDING_PRESETS, CLIMATE_OPTIONS } from './dat-templates.js';
import { IMAGE_FORMAT_OPTIONS } from './dat-image-formats.js';
import { renderDatAiSectionHtml } from './ui-dat-ai.js';

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
              <label class="dat-check-item mt-05">
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
                <div class="dat-field full-width">
                  <div class="btn-group">
                    <button type="button" id="btn-dat-open-img-picker" class="btn-primary">🗺️ 編集中画像からGUIで指定</button>
                    <button type="button" id="btn-dat-clear-custom-img" style="display:none; flex:0 0 auto;">↺ 個別解除</button>
                  </div>
                  <div class="info-text" id="lbl-dat-custom-img-status">画像位置: 開始行列 (Y, X) から自動展開</div>
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

// テンプレート定義に従ってオブジェクト固有パラメータの入力欄を構築する
export function renderDynamicDatFields(container, tpl, state, onChanged) {
  if (!container || !tpl) return;
  container.innerHTML = '';

  tpl.fields.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'dat-field' + (field.fullWidth || field.type === 'checkbox' ? ' full-width' : '');

    if (field.type === 'checkbox') {
      const lbl = document.createElement('label');
      lbl.className = 'dat-check-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = Boolean(state[field.key]);
      cb.onchange = () => {
        state[field.key] = cb.checked;
        onChanged();
      };
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(field.label));
      wrap.appendChild(lbl);
      container.appendChild(wrap);
      return;
    }

    const lbl = document.createElement('label');
    lbl.textContent = field.label;
    wrap.appendChild(lbl);

    if (field.type === 'climates') {
      const grid = document.createElement('div');
      grid.className = 'dat-climate-grid';
      const selected = new Set(Array.isArray(state[field.key]) ? state[field.key] : []);
      CLIMATE_OPTIONS.forEach((opt) => {
        const item = document.createElement('label');
        item.className = 'dat-climate-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(opt.value);
        cb.onchange = () => {
          if (cb.checked) selected.add(opt.value);
          else selected.delete(opt.value);
          state[field.key] = CLIMATE_OPTIONS.map(o => o.value).filter(v => selected.has(v));
          onChanged();
        };
        item.appendChild(cb);
        item.appendChild(document.createTextNode(opt.label));
        grid.appendChild(item);
      });
      wrap.appendChild(grid);
      container.appendChild(wrap);
      return;
    }

    let inputEl;
    if (field.type === 'select') {
      inputEl = document.createElement('select');
      (field.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        inputEl.appendChild(o);
      });
      inputEl.value = state[field.key] ?? '';
      inputEl.onchange = () => {
        state[field.key] = inputEl.value;
        onChanged();
      };
    } else if (field.type === 'textarea') {
      inputEl = document.createElement('textarea');
      inputEl.placeholder = field.placeholder || '';
      inputEl.value = state[field.key] ?? '';
      inputEl.oninput = () => {
        state[field.key] = inputEl.value;
        onChanged();
      };
    } else {
      inputEl = document.createElement('input');
      inputEl.type = field.type === 'number' ? 'number' : 'text';
      if (field.min !== undefined) inputEl.min = String(field.min);
      if (field.max !== undefined) inputEl.max = String(field.max);
      if (field.placeholder) inputEl.placeholder = field.placeholder;
      inputEl.value = state[field.key] ?? '';
      inputEl.oninput = () => {
        state[field.key] = inputEl.value;
        onChanged();
      };
    }

    wrap.appendChild(inputEl);
    container.appendChild(wrap);
  });
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
      gen._syncCommonInputsFromState();
    }
    gen._updatePresetVisibility();
    gen.aiCtrl.updateObjTypeVisibility(gen.currentObjType);
    gen._renderMainFormatOptions();
    gen._renderDynamicFields();
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
        }
      }
      if (gen.autoSync) gen.regenerateOutput();
      gen.app?.markDirty?.();
    };
    el.addEventListener(isCheckbox ? 'change' : 'input', handler);
  };

  bindCommon('inp-dat-name', 'name');
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
    gen.common.imgPrefix = gen._deriveImagePrefixFromApp();
    document.getElementById('inp-dat-img-prefix').value = gen.common.imgPrefix;
    if (gen.autoSync) gen.regenerateOutput();
  };
  document.getElementById('btn-dat-open-img-picker').onclick = () => gen.imagePicker.open();
  document.getElementById('btn-dat-clear-custom-img').onclick = () => {
    gen.common.customImageCoords = null;
    gen._syncCustomImageStatus();
    if (gen.autoSync) gen.regenerateOutput();
  };

  bindDatOutputActions(gen);
}
