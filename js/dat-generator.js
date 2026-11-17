import { DAT_OBJECT_TEMPLATES, BUILDING_PRESETS } from './dat-templates.js';
import { serializeDatObject } from './dat-serializer.js';
import { renderDatModalUI, renderDynamicDatFields, bindDatModalEvents } from './ui-dat-modal.js';
import { renderFormatOptionsPanel } from './ui-dat-image-picker.js';
import { DatAiController } from './dat-ai-controller.js';
import { DatCollectionManager, bindDatOutputActions } from './dat-collection-manager.js';
import {
  createDefaultDatCommon,
  serializeDatProjectState,
  restoreDatProjectState,
  applyPendingDatProjectUi,
  applyDefaultVehicleReverse
} from './dat-project-state.js';
import { DatImagePicker } from './dat-image-picker.js';
import { DatLiveryManager, buildMaskImagePrefix } from './dat-livery-manager.js';

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
    this.aiCtrl = new DatAiController(this);
    this.collectionMgr = new DatCollectionManager(this);
    this.imagePicker = new DatImagePicker(this);
    this.liveryMgr = new DatLiveryManager(this);
    this._pendingProjectUi = null;
    this.common = createDefaultDatCommon();
  }

  exportProjectState() { return serializeDatProjectState(this); }
  importProjectState(data) { restoreDatProjectState(this, data); }

  // ベース画像を開き直した際にdat編集状態と出力を初期化する
  resetState() {
    this._pendingProjectUi = null;
    this.liveryMgr.clearBaseNameCache();
    const inpFile = document.getElementById('inp-dat-filename');
    if (inpFile) delete inpFile.dataset.userEdited;
    restoreDatProjectState(this, null);
    if (this.initialized) {
      this.common.imgPrefix = this._deriveImagePrefixFromApp();
      this.common.name = this._deriveAddonNameFromApp(this.currentObjType);
      this._applyControllerStateToForm();
      this.regenerateOutput();
    }
    const lbl = document.getElementById('lbl-dat-sidebar-status');
    if (lbl) lbl.textContent = '選択中: 未起動';
  }

  bindEvents() {
    // サイドバーから開く際は現在保持している currentObjType を維持する
    document.getElementById('btn-open-dat-generator')?.addEventListener('click', () => {
      this.open();
    });
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderDatModalUI();
    this._bindModalEvents();
    this.aiCtrl.bindEvents();
    this.collectionMgr.bindEvents();
    this.liveryMgr.bindEvents();
    this.aiCtrl.syncInitialUI();
    this.initialized = true;
    if (this._pendingProjectUi) applyPendingDatProjectUi(this);
  }

  _getObjState(objType) {
    if (!this.stateByObj[objType]) {
      this.stateByObj[objType] = cloneDefaults(objType);
    }
    return this.stateByObj[objType];
  }

  _deriveImagePrefixFromApp() {
    const activeMask = this.liveryMgr.getActiveMaskItem();
    if (activeMask) {
      return buildMaskImagePrefix(this.app, activeMask, this.liveryMgr.useBatchImgNaming);
    }
    const raw = (this.app && this.app.baseName) ? this.app.baseName : 'base.png';
    const noExt = raw.replace(/\.png$/i, '');
    const suffix = this.app?.tileCutter?.shouldCutOnExport?.() ? '_cut' : '_combined';
    return /(_combined|_cut)$/i.test(noExt) ? noExt.replace(/(_combined|_cut)$/i, suffix) : `${noExt}${suffix}`;
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

    this._applyControllerStateToForm();
    this.liveryMgr.refreshUI();
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
    setVal('sel-dat-image-format', this.common.imageFormat || 'auto');
    setVal('inp-dat-img-prefix', this.common.imgPrefix);
    setVal('inp-dat-start-row', this.common.startRow);
    setVal('inp-dat-start-col', this.common.startCol);
    setVal('inp-dat-img-offset', this.common.imgOffset);
    setVal('inp-dat-extra-lines', this.common.extraLines);

    const chkImg = document.getElementById('chk-dat-include-images');
    if (chkImg) chkImg.checked = Boolean(this.common.includeImages);
    const chkFlip = document.getElementById('chk-dat-flip-directions');
    if (chkFlip) chkFlip.checked = Boolean(this.common.flipDirections);
    this._renderMainFormatOptions();

    const inpFilename = document.getElementById('inp-dat-filename');
    if (inpFilename && !inpFilename.dataset.userEdited) {
      const base = (this.common.name || 'addon').trim();
      inpFilename.value = base.toLowerCase().endsWith('.dat') ? base : `${base}.dat`;
    }
    this._syncCustomImageStatus();
  }

  _syncCustomImageStatus() {
    const custom = this.common.customImageCoords;
    const count = custom ? Object.keys(custom).length : 0;
    const lbl = document.getElementById('lbl-dat-custom-img-status');
    const btnClear = document.getElementById('btn-dat-clear-custom-img');
    if (lbl) {
      lbl.textContent = count > 0
        ? `画像位置: 個別セル指定中 (${count}件 / 未指定は Y,X 自動展開)`
        : '画像位置: 開始行列 (Y, X) から自動展開';
    }
    if (btnClear) btnClear.style.display = count > 0 ? '' : 'none';
  }

  _renderMainFormatOptions() {
    const box = document.getElementById('dat-main-format-options');
    renderFormatOptionsPanel(box, {
      objType: this.currentObjType,
      common: this.common,
      values: this._getObjState(this.currentObjType),
      onChange: () => {
        if (this.autoSync) this.regenerateOutput();
        this.app?.markDirty?.();
      }
    });
  }

  // ピッカーで編集した単体または全編成アイテムを一括反映する
  applyImagePickerResult({ items, activeIndex = 0, commonPatch, valuesPatch }) {
    if (Array.isArray(items) && items.length > 0) {
      if (this.collectionMgr.hasCollection() || items.length > 1) {
        this.collectionMgr.setItems(items);
        if (activeIndex > 0 && activeIndex < items.length) {
          this.collectionMgr.selectItem(activeIndex);
        }
      } else {
        const single = items[0];
        this.currentObjType = single.objType;
        this.common = { ...single.common };
        this.stateByObj[single.objType] = { ...single.values };
        this._applyControllerStateToForm();
      }
    } else {
      if (commonPatch) Object.assign(this.common, commonPatch);
      if (valuesPatch) Object.assign(this._getObjState(this.currentObjType), valuesPatch);
      this._syncCommonInputsFromState();
    }
    if (this.autoSync) this.regenerateOutput();
    this.app?.markDirty?.();
  }

  _updatePresetVisibility() {
    const tpl = DAT_OBJECT_TEMPLATES[this.currentObjType];
    const presetRow = document.getElementById('dat-building-preset-row');
    if (presetRow) {
      presetRow.style.display = this.currentObjType === 'building' ? '' : 'none';
    }
    const tileCutRow = document.getElementById('dat-tilecut-row');
    if (tileCutRow) {
      tileCutRow.style.display = (this.currentObjType === 'building' || this.currentObjType === 'factory') ? '' : 'none';
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
      if (this.currentObjType === 'building' || this.currentObjType === 'factory') {
        const prevCut = this.app?.tileCutter?.shouldCutOnExport?.();
        this.app?.tileCutter?.syncFromDat(this.currentObjType, state);
        const nextCut = this.app?.tileCutter?.shouldCutOnExport?.();
        if (prevCut !== nextCut && (!this.common.imgPrefix || /(_combined|_cut)$/i.test(this.common.imgPrefix))) {
          this.common.imgPrefix = this._deriveImagePrefixFromApp();
          this._syncCommonInputsFromState();
        }
      }
      if (this.autoSync) this.regenerateOutput();
      this.app?.markDirty?.();
    });
  }

  _applyControllerStateToForm() {
    const selObj = document.getElementById('sel-dat-obj-type');
    if (selObj) selObj.value = this.currentObjType;
    this._syncCommonInputsFromState();
    this._updatePresetVisibility();
    this.aiCtrl.updateObjTypeVisibility(this.currentObjType);
    this._renderMainFormatOptions();
    this._renderDynamicFields();
    this.app?.tileCutter?.syncUI?.();
  }

  // 生成AIの解析結果（単体または編成・形式複数件）をフォーム＆コレクションに適用する
  applyAiResult(parsed) {
    if (!parsed || !Array.isArray(parsed.objects) || parsed.objects.length === 0) return;
    this.autoSync = true;
    this._updateSyncBadge();
    this.liveryMgr.clearBaseNameCache();

    const activeMask = this.liveryMgr.getActiveMaskItem();
    const maskImgPrefix = activeMask
      ? buildMaskImagePrefix(this.app, activeMask, this.liveryMgr.useBatchImgNaming)
      : null;

    if (parsed.objects.length > 1) {
      const list = parsed.objects.map((o, idx) => applyDefaultVehicleReverse({
        ...o,
        common: { ...o.common, imgPrefix: maskImgPrefix || o.common.imgPrefix, customImageCoords: null },
        values: { ...o.values, ...(Array.isArray(o.values?.climates) ? { climates: [...o.values.climates] } : {}) }
      }, idx, parsed.objects.length));
      this.collectionMgr.setItems(list);
    } else {
      const raw = parsed.objects[0];
      const item = applyDefaultVehicleReverse({
        ...raw,
        common: { ...raw.common, imgPrefix: maskImgPrefix || raw.common.imgPrefix, customImageCoords: null },
        values: { ...raw.values, ...(Array.isArray(raw.values?.climates) ? { climates: [...raw.values.climates] } : {}) }
      }, 0, 1);
      this.collectionMgr.items = [];
      this.collectionMgr.activeIndex = -1;
      this.collectionMgr.refreshUI();
      this.currentObjType = item.objType;
      this.common = item.common;
      this.stateByObj[item.objType] = item.values;
      this._applyControllerStateToForm();
    }
    if (this.currentObjType === 'building' || this.currentObjType === 'factory') {
      this.app?.tileCutter?.syncFromDat(this.currentObjType, this._getObjState(this.currentObjType));
      if (this.app?.tileCutter?.shouldCutOnExport?.() && (!this.common.imgPrefix || /(_combined|_cut)$/i.test(this.common.imgPrefix))) {
        this.common.imgPrefix = this._deriveImagePrefixFromApp();
        this._syncCommonInputsFromState();
      }
    }
    this.liveryMgr.refreshUI();
    this.regenerateOutput();
    this.app?.markDirty?.();
  }

  buildCurrentText() {
    const state = this._getObjState(this.currentObjType);
    return serializeDatObject(this.currentObjType, state, this.common);
  }

  regenerateOutput() {
    const txt = document.getElementById('txt-dat-output');
    if (!txt) return;
    const combined = this.collectionMgr.buildCombinedText();
    txt.value = combined !== null ? combined : this.buildCurrentText();
    this.collectionMgr.updateActiveOptionLabel();
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
    bindDatModalEvents(this, { DAT_OBJECT_TEMPLATES, BUILDING_PRESETS, bindDatOutputActions });
  }
}
