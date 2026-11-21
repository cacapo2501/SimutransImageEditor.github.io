import { DAT_OBJECT_TEMPLATES, BUILDING_PRESETS } from './dat-templates.js';
import { serializeDatObject } from './dat-serializer.js';
import { renderDatModalUI, bindDatModalEvents } from './ui-dat-modal.js';
import { renderDynamicDatFields } from './dat-dynamic-fields.js';
import { renderFormatOptionsPanel } from './ui-dat-image-picker.js';
import { DatAiController } from './dat-ai-controller.js';
import { DatCollectionManager, bindDatOutputActions } from './dat-collection-manager.js';
import {
  createDefaultDatCommon, cloneObjDefaults, serializeDatProjectState,
  restoreDatProjectState, applyPendingDatProjectUi, applyDefaultVehicleReverse
} from './dat-project-state.js';
import { DatImagePicker } from './dat-image-picker.js';
import { DatLiveryManager, buildMaskImagePrefix } from './dat-livery-manager.js';
import { computeSeasonPrefixes, renderSeasonMaskPanel } from './dat-season-masks.js';
import { populateImageFormatSelect } from './dat-image-formats.js';
import { renderDatAuxPanels } from './dat-factory-fields.js';
import { buildCompositeImagePrefix } from './composite-naming.js';
import { MakeobjDatBridge } from './makeobj-dat-bridge.js';
import { MakeobjModalController } from './makeobj-modal-controller.js';

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
    this.makeobjBridge = new MakeobjDatBridge(this);
    this.makeobjModalCtrl = new MakeobjModalController(app);
    this._pendingProjectUi = null;
    this._lastAutoPrefix = 'base_combined';
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
    this.common.imgPrefix = this._deriveImagePrefixFromApp();
    this._lastAutoPrefix = this.common.imgPrefix;
    this.common.name = this._deriveAddonNameFromApp(this.currentObjType);
    if (this.initialized) {
      this._applyControllerStateToForm();
      this.regenerateOutput();
    }
    const lbl = document.getElementById('lbl-dat-sidebar-status');
    if (lbl) lbl.textContent = '選択中: 未起動';
  }

  bindEvents() {
    document.getElementById('btn-open-dat-generator')?.addEventListener('click', () => this.open());
    this.makeobjModalCtrl.bindEvents();
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderDatModalUI();
    this._bindModalEvents();
    this.aiCtrl.bindEvents();
    this.collectionMgr.bindEvents();
    this.liveryMgr.bindEvents();
    this.makeobjBridge.bindEvents();
    this.aiCtrl.syncInitialUI();
    this.initialized = true;
    if (this._pendingProjectUi) applyPendingDatProjectUi(this);
  }

  _getObjState(objType) {
    if (!this.stateByObj[objType]) {
      this.stateByObj[objType] = cloneObjDefaults(DAT_OBJECT_TEMPLATES, objType);
    }
    return this.stateByObj[objType];
  }

  _deriveImagePrefixFromApp() {
    const activeMask = this.liveryMgr.getActiveMaskItem();
    if (activeMask) {
      return buildMaskImagePrefix(this.app, activeMask, this.liveryMgr.useBatchImgNaming);
    }
    const useCut = Boolean(this.app?.tileCutter?.shouldCutOnExport?.());
    return buildCompositeImagePrefix(this.app?.baseName || 'base.png', '', { useCut });
  }

  // 現在のベース画像・マスク・タイルカッター状態に合わせて指定画像名 (imgPrefix) を同期する
  syncImagePrefixWithApp({ force = false } = {}) {
    const nextPrefix = this._deriveImagePrefixFromApp();
    const isAuto = (v) => !v || v === 'base_combined' || v === 'image_combined'
      || /^new_\d+x\d+_(combined|cut)$/i.test(v) || v === this._lastAutoPrefix;

    let changed = false;
    if (force || isAuto(this.common.imgPrefix)) {
      if (this.common.imgPrefix !== nextPrefix) changed = true;
      this.common.imgPrefix = nextPrefix;
    }
    if (this.collectionMgr.hasCollection()) {
      this.collectionMgr.items.forEach((it) => {
        if (it?.common && (force || isAuto(it.common.imgPrefix))) {
          if (it.common.imgPrefix !== nextPrefix) changed = true;
          it.common.imgPrefix = nextPrefix;
        }
      });
    }
    this._lastAutoPrefix = nextPrefix;
    if (this.initialized && changed) {
      const inp = document.getElementById('inp-dat-img-prefix');
      if (inp) inp.value = this.common.imgPrefix;
      if (this.autoSync) this.regenerateOutput();
    }
    return nextPrefix;
  }

  _deriveAddonNameFromApp(objType) {
    const raw = (this.app && this.app.baseName) ? this.app.baseName : '';
    const cleaned = raw
      .replace(/\.png$/i, '')
      .replace(/(_combined|_cut|_s?def|_s?paint|_base)$/i, '')
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

    this.syncImagePrefixWithApp();
    const defaultObjName = DAT_OBJECT_TEMPLATES[this.currentObjType]?.defaults?.name;
    if (!this.hasOpenedOnce || !this.common.name || this.common.name === 'new_building' || this.common.name === defaultObjName) {
      this.common.name = this._deriveAddonNameFromApp(this.currentObjType);
    }
    if (!this.hasOpenedOnce) {
      const vehLen = document.getElementById('inp-vehicle-length')?.value;
      if (vehLen) this._getObjState('vehicle').length = vehLen;
      this.hasOpenedOnce = true;
    }

    this._applyControllerStateToForm();
    this.liveryMgr.refreshUI();
    if (this.autoSync) this.regenerateOutput();

    const modal = document.getElementById('modal-dat-generator');
    if (!modal) return;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  _syncCommonInputsFromState() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    setVal('inp-dat-name', this.common.name);
    setVal('inp-dat-ja-name', this.common.jaName);
    setVal('inp-dat-copyright', this.common.copyright);
    this.common.imageFormat = populateImageFormatSelect(
      document.getElementById('sel-dat-image-format'),
      this.currentObjType,
      this.common.imageFormat || 'auto'
    );
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
      this.makeobjBridge?.syncPakFilename?.(inpFilename.value);
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
        if (['way', 'way-object', 'tunnel', 'roadsign', 'field'].includes(this.currentObjType)) {
          this._renderDynamicFields();
          this._renderSeasonMaskPanel();
        }
        if (this.autoSync) this.regenerateOutput();
        this.app?.markDirty?.();
      }
    });
  }

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
    const setDisp = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };
    setDisp('dat-building-preset-row', this.currentObjType === 'building');
    setDisp('dat-tilecut-row', this.currentObjType === 'building' || this.currentObjType === 'factory');
    setDisp('lbl-dat-flip-directions', this.currentObjType === 'vehicle' || this.currentObjType === 'citycar');
    if (tpl) setDisp('fs-dat-image-settings', tpl.supportsImages !== false);
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
        if (prevCut !== nextCut) this.syncImagePrefixWithApp({ force: /(_combined|_cut)$/i.test(this.common.imgPrefix) });
      }
      if (['way', 'way-object', 'tunnel', 'roadsign', 'field'].includes(this.currentObjType)) {
        this._renderMainFormatOptions();
      }
      if (this.currentObjType === 'field') this._renderAuxPanels();
      this._renderSeasonMaskPanel();
      if (this.autoSync) this.regenerateOutput();
      this.app?.markDirty?.();
    });
  }

  _renderAuxPanels() {
    renderDatAuxPanels(this, () => { if (this.autoSync) this.regenerateOutput(); this.app?.markDirty?.(); });
  }

  _renderSeasonMaskPanel() {
    const box = document.getElementById('dat-season-masks-box');
    const state = this._getObjState(this.currentObjType);
    renderSeasonMaskPanel(box, this.app, this.currentObjType, state, () => {
      this.app?.tileCutter?.syncFromDat(this.currentObjType, state);
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
    this._renderSeasonMaskPanel();
    this._renderAuxPanels();
    this.app?.tileCutter?.syncUI?.();
  }

  // 生成AIの解析結果（単体または編成・形式複数件）をフォーム＆コレクションに適用する
  applyAiResult(parsed) {
    if (!parsed || !Array.isArray(parsed.objects) || parsed.objects.length === 0) return;
    this.autoSync = true;
    this._updateSyncBadge();
    this.liveryMgr.clearBaseNameCache();

    const appImgPrefix = this._deriveImagePrefixFromApp();
    this._lastAutoPrefix = appImgPrefix;

    if (parsed.objects.length > 1) {
      const list = parsed.objects.map((o, idx) => applyDefaultVehicleReverse({
        ...o,
        common: { ...o.common, imgPrefix: appImgPrefix || o.common.imgPrefix, customImageCoords: null },
        values: { ...o.values, ...(Array.isArray(o.values?.climates) ? { climates: [...o.values.climates] } : {}) }
      }, idx, parsed.objects.length));
      this.collectionMgr.setItems(list);
    } else {
      const raw = parsed.objects[0];
      const item = applyDefaultVehicleReverse({
        ...raw,
        common: { ...raw.common, imgPrefix: appImgPrefix || raw.common.imgPrefix },
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
      this.syncImagePrefixWithApp({ force: /(_combined|_cut)$/i.test(this.common.imgPrefix) });
    }
    this.liveryMgr.refreshUI();
    this.regenerateOutput();
    this.app?.markDirty?.();
  }

  buildCurrentText() {
    const state = this._getObjState(this.currentObjType);
    state._seasonPrefixes = computeSeasonPrefixes(this.app, state);
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
