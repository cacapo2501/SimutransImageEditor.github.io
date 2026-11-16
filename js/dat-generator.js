import { DAT_OBJECT_TEMPLATES, BUILDING_PRESETS } from './dat-templates.js';
import { serializeDatObject, downloadDatText } from './dat-serializer.js';
import { renderDatModalUI, renderDynamicDatFields } from './ui-dat-modal.js';

function cloneDefaults(objType) {
  const tpl = DAT_OBJECT_TEMPLATES[objType];
  if (!tpl) return {};
  const copy = { ...tpl.defaults };
  if (Array.isArray(copy.climates)) copy.climates = [...copy.climates];
  return copy;
}

export class DatGeneratorController {
  constructor(app, pickFileFn) {
    this.app = app;
    this.pickFileFn = pickFileFn;
    this.initialized = false;
    this.hasOpenedOnce = false;
    this.currentObjType = 'building';
    this.autoSync = true;
    this.stateByObj = {};

    this.common = {
      name: 'new_building',
      copyright: '',
      includeImages: true,
      imgPrefix: 'base_combined',
      startRow: '0',
      startCol: '0',
      imgOffset: '',
      extraLines: ''
    };
  }

  bindEvents() {
    document.getElementById('btn-open-dat-generator')?.addEventListener('click', () => {
      const quickSel = document.getElementById('sel-dat-quick-obj');
      if (quickSel && quickSel.value && DAT_OBJECT_TEMPLATES[quickSel.value]) {
        this.open(quickSel.value);
      } else {
        this.open();
      }
    });
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderDatModalUI();
    this._bindModalEvents();
    this.initialized = true;
  }

  _getObjState(objType) {
    if (!this.stateByObj[objType]) {
      this.stateByObj[objType] = cloneDefaults(objType);
    }
    return this.stateByObj[objType];
  }

  _deriveImagePrefixFromApp() {
    const raw = (this.app && this.app.baseName) ? this.app.baseName : 'base.png';
    const noExt = raw.replace(/\.png$/i, '');
    if (/_combined$/i.test(noExt)) return noExt;
    return `${noExt}_combined`;
  }

  _deriveAddonNameFromApp(objType) {
    const raw = (this.app && this.app.baseName) ? this.app.baseName : '';
    const cleaned = raw
      .replace(/\.png$/i, '')
      .replace(/(_combined|_def|_base)$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    if (cleaned && cleaned !== 'base' && !/^new_\d+x\d+$/i.test(cleaned)) {
      return cleaned;
    }
    return DAT_OBJECT_TEMPLATES[objType]?.defaults?.name || `new_${objType}`;
  }

  open(initialObjType = null) {
    this._ensureInitialized();

    if (initialObjType && DAT_OBJECT_TEMPLATES[initialObjType]) {
      this.currentObjType = initialObjType;
    }

    if (!this.hasOpenedOnce) {
      this.common.imgPrefix = this._deriveImagePrefixFromApp();
      this.common.name = this._deriveAddonNameFromApp(this.currentObjType);

      // 車両長入力欄があれば初期同期
      const vehLen = document.getElementById('inp-vehicle-length')?.value;
      if (vehLen) {
        this._getObjState('vehicle').length = vehLen;
      }
      this.hasOpenedOnce = true;
    }

    const selObj = document.getElementById('sel-dat-obj-type');
    if (selObj) selObj.value = this.currentObjType;

    this._syncCommonInputsFromState();
    this._updatePresetVisibility();
    this._renderDynamicFields();
    if (this.autoSync) {
      this.regenerateOutput();
    }

    const modal = document.getElementById('modal-dat-generator');
    if (!modal) return;
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  _syncCommonInputsFromState() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    setVal('inp-dat-name', this.common.name);
    setVal('inp-dat-copyright', this.common.copyright);
    setVal('inp-dat-img-prefix', this.common.imgPrefix);
    setVal('inp-dat-start-row', this.common.startRow);
    setVal('inp-dat-start-col', this.common.startCol);
    setVal('inp-dat-img-offset', this.common.imgOffset);
    setVal('inp-dat-extra-lines', this.common.extraLines);

    const chkImg = document.getElementById('chk-dat-include-images');
    if (chkImg) chkImg.checked = Boolean(this.common.includeImages);

    const inpFilename = document.getElementById('inp-dat-filename');
    if (inpFilename && !inpFilename.dataset.userEdited) {
      const base = (this.common.name || 'addon').trim();
      inpFilename.value = base.toLowerCase().endsWith('.dat') ? base : `${base}.dat`;
    }
  }

  _updatePresetVisibility() {
    const tpl = DAT_OBJECT_TEMPLATES[this.currentObjType];
    const presetRow = document.getElementById('dat-building-preset-row');
    if (presetRow) {
      presetRow.style.display = this.currentObjType === 'building' ? '' : 'none';
    }
    const imgFieldset = document.getElementById('fs-dat-image-settings');
    if (imgFieldset && tpl) {
      imgFieldset.style.display = tpl.supportsImages === false ? 'none' : '';
    }
  }

  _updateSyncBadge(statusText = null) {
    const badge = document.getElementById('lbl-dat-mode-status');
    const chk = document.getElementById('chk-dat-auto-sync');
    if (chk) chk.checked = this.autoSync;
    if (badge) {
      badge.textContent = statusText || (this.autoSync ? 'フォーム連動中' : '手動編集中 (保護)');
    }
  }

  _renderDynamicFields() {
    const container = document.getElementById('dat-dynamic-fields');
    const tpl = DAT_OBJECT_TEMPLATES[this.currentObjType];
    if (!container || !tpl) return;
    const state = this._getObjState(this.currentObjType);
    renderDynamicDatFields(container, tpl, state, () => {
      if (this.autoSync) this.regenerateOutput();
    });
  }

  buildCurrentText() {
    const state = this._getObjState(this.currentObjType);
    return serializeDatObject(this.currentObjType, state, this.common);
  }

  regenerateOutput() {
    const txt = document.getElementById('txt-dat-output');
    if (!txt) return;
    txt.value = this.buildCurrentText();
    this._updateSidebarStatus();
  }

  appendCurrentObject() {
    const txt = document.getElementById('txt-dat-output');
    if (!txt) return;
    const block = this.buildCurrentText().trimEnd();
    const cur = txt.value.trimEnd();
    txt.value = cur ? `${cur}\n---\n${block}\n` : `${block}\n`;
    this.autoSync = false;
    this._updateSyncBadge('複数/手動編集中');
    this._updateSidebarStatus();
  }

  _updateSidebarStatus() {
    const lbl = document.getElementById('lbl-dat-sidebar-status');
    if (lbl) {
      const tpl = DAT_OBJECT_TEMPLATES[this.currentObjType];
      lbl.textContent = `選択中: ${tpl ? tpl.label : this.currentObjType} / ${this.common.name || '未設定'}`;
    }
  }

  _bindModalEvents() {
    const modal = document.getElementById('modal-dat-generator');
    const closeModal = () => modal.close();
    document.getElementById('btn-close-dat-top').onclick = closeModal;
    document.getElementById('btn-dat-close').onclick = closeModal;

    document.getElementById('sel-dat-obj-type').onchange = (e) => {
      const prevDefault = DAT_OBJECT_TEMPLATES[this.currentObjType]?.defaults?.name;
      this.currentObjType = e.target.value;
      if (!this.common.name || this.common.name === prevDefault) {
        this.common.name = this._deriveAddonNameFromApp(this.currentObjType);
        this._syncCommonInputsFromState();
      }
      this._updatePresetVisibility();
      this._renderDynamicFields();
      if (this.autoSync) this.regenerateOutput();
      this._updateSidebarStatus();
    };

    document.getElementById('btn-dat-apply-preset').onclick = () => {
      const presetKey = document.getElementById('sel-dat-building-preset')?.value;
      const preset = BUILDING_PRESETS[presetKey];
      if (!preset) return;
      const state = this._getObjState('building');
      Object.assign(state, preset.values);
      this._renderDynamicFields();
      if (this.autoSync) this.regenerateOutput();
    };

    const bindCommon = (id, key, isCheckbox = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = () => {
        this.common[key] = isCheckbox ? el.checked : el.value;
        if (key === 'name') {
          const inpFilename = document.getElementById('inp-dat-filename');
          if (inpFilename && !inpFilename.dataset.userEdited) {
            const base = (this.common.name || 'addon').trim();
            inpFilename.value = base.toLowerCase().endsWith('.dat') ? base : `${base}.dat`;
          }
        }
        if (this.autoSync) this.regenerateOutput();
      };
      el.addEventListener(isCheckbox ? 'change' : 'input', handler);
    };

    bindCommon('inp-dat-name', 'name');
    bindCommon('inp-dat-copyright', 'copyright');
    bindCommon('chk-dat-include-images', 'includeImages', true);
    bindCommon('inp-dat-img-prefix', 'imgPrefix');
    bindCommon('inp-dat-start-row', 'startRow');
    bindCommon('inp-dat-start-col', 'startCol');
    bindCommon('inp-dat-img-offset', 'imgOffset');
    bindCommon('inp-dat-extra-lines', 'extraLines');

    document.getElementById('btn-dat-sync-img-name').onclick = () => {
      this.common.imgPrefix = this._deriveImagePrefixFromApp();
      document.getElementById('inp-dat-img-prefix').value = this.common.imgPrefix;
      if (this.autoSync) this.regenerateOutput();
    };

    document.getElementById('inp-dat-filename').oninput = (e) => {
      e.target.dataset.userEdited = '1';
    };

    document.getElementById('chk-dat-auto-sync').onchange = (e) => {
      this.autoSync = e.target.checked;
      this._updateSyncBadge();
      if (this.autoSync) this.regenerateOutput();
    };

    document.getElementById('txt-dat-output').oninput = () => {
      if (this.autoSync) {
        this.autoSync = false;
        this._updateSyncBadge();
      }
    };

    document.getElementById('btn-dat-regenerate').onclick = () => {
      this.autoSync = true;
      this._updateSyncBadge();
      this.regenerateOutput();
    };

    document.getElementById('btn-dat-append').onclick = () => this.appendCurrentObject();

    document.getElementById('btn-dat-clear').onclick = () => {
      const txt = document.getElementById('txt-dat-output');
      if (txt) txt.value = '';
      this.autoSync = false;
      this._updateSyncBadge('手動編集中 (空)');
    };

    document.getElementById('btn-dat-load-file').onclick = async () => {
      if (!this.pickFileFn) return;
      const f = await this.pickFileFn('.dat,.txt');
      if (!f) return;
      const content = await f.text();
      const txt = document.getElementById('txt-dat-output');
      if (txt) txt.value = content;
      const inpFilename = document.getElementById('inp-dat-filename');
      if (inpFilename) {
        inpFilename.value = f.name;
        inpFilename.dataset.userEdited = '1';
      }
      this.autoSync = false;
      this._updateSyncBadge('読込ファイル編集中');
    };

    document.getElementById('btn-dat-copy').onclick = async () => {
      const txt = document.getElementById('txt-dat-output');
      if (!txt || !txt.value) return;
      try {
        await navigator.clipboard.writeText(txt.value);
        this._updateSyncBadge('コピーしました！');
        setTimeout(() => this._updateSyncBadge(), 1500);
      } catch (err) {
        txt.select();
        document.execCommand('copy');
      }
    };

    document.getElementById('btn-dat-save-file').onclick = () => {
      const txt = document.getElementById('txt-dat-output')?.value || '';
      if (!txt.trim()) {
        alert('保存するdatテキストが空です。');
        return;
      }
      const filename = document.getElementById('inp-dat-filename')?.value || 'addon.dat';
      downloadDatText(txt, filename);
    };
  }
}
