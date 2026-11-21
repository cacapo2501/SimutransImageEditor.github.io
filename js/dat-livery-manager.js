import { serializeDatObject } from './dat-serializer.js';
import {
  stripLiverySuffix,
  deriveLiveryName,
  applyLiveryToName,
  buildMaskImagePrefix,
  buildLiveryConstraintMaps,
  replaceConstraintNames
} from './dat-livery-helpers.js';

export { deriveLiveryName, applyLiveryToName, buildMaskImagePrefix };

export class DatLiveryManager {
  constructor(datGenerator) {
    this.gen = datGenerator;
    this.liveryByMaskId = new Map();
    this.baseNameByKey = new Map();
    this.followMaskChange = true;
    this.useBatchImgNaming = true;
    this.mixLiveryConsist = false;
  }

  getActiveMaskItem() {
    return this.gen.app?.maskMgr?.getActive() || null;
  }

  getLiveryNameForMask(maskItem, idx = 0, { allowEmpty = false } = {}) {
    if (!maskItem) return '';
    if (this.liveryByMaskId.has(maskItem.id)) {
      return this.liveryByMaskId.get(maskItem.id);
    }
    return deriveLiveryName(maskItem.name, this.gen.app?.baseName, idx, { allowEmpty });
  }

  getActiveLiveryName({ forPrompt = false } = {}) {
    const maskMgr = this.gen.app?.maskMgr;
    const active = maskMgr?.getActive();
    if (!active) return '';
    const allowEmpty = forPrompt || (maskMgr.items.length <= 1);
    return this.getLiveryNameForMask(active, maskMgr.activeIndex, { allowEmpty });
  }

  _rememberBaseNames(items) {
    items.forEach((it, idx) => {
      const key = `${idx}:${it.objType}`;
      if (!this.baseNameByKey.has(key)) {
        this.baseNameByKey.set(key, String(it.common?.name || '').replace(/\([^()]*\)$/, '').trim());
      }
      const jaKey = `ja:${idx}:${it.objType}`;
      if (!this.baseNameByKey.has(jaKey) && it.common?.jaName) {
        this.baseNameByKey.set(jaKey, String(it.common.jaName).replace(/\([^()]*\)$/, '').trim());
      }
    });
  }

  clearBaseNameCache() {
    this.baseNameByKey.clear();
  }

  bindEvents() {
    document.getElementById('inp-dat-livery-name')?.addEventListener('input', (e) => {
      const maskMgr = this.gen.app?.maskMgr;
      const active = maskMgr?.getActive();
      if (active) {
        this.liveryByMaskId.set(active.id, e.target.value);
      }
      this.applyActiveMaskLivery({ regenerate: true });
    });

    document.getElementById('chk-dat-livery-follow')?.addEventListener('change', (e) => {
      this.followMaskChange = e.target.checked;
    });

    document.getElementById('chk-dat-livery-batch-img')?.addEventListener('change', (e) => {
      this.useBatchImgNaming = e.target.checked;
      this.applyActiveMaskLivery({ regenerate: true });
    });

    document.getElementById('chk-dat-livery-mix-consist')?.addEventListener('change', (e) => {
      this.mixLiveryConsist = e.target.checked;
      this.applyActiveMaskLivery({ regenerate: this.gen.autoSync });
      this.gen.app?.markDirty?.();
    });

    document.getElementById('btn-dat-livery-apply-active')?.addEventListener('click', () => {
      this.applyActiveMaskLivery({ regenerate: true });
    });

    document.getElementById('btn-dat-livery-expand-all')?.addEventListener('click', () => {
      this.expandAllMasksToOutput();
    });
  }

  refreshUI() {
    const maskMgr = this.gen.app?.maskMgr;
    const active = maskMgr?.getActive();
    const lblMask = document.getElementById('lbl-dat-livery-mask');
    const inpLivery = document.getElementById('inp-dat-livery-name');
    const btnAll = document.getElementById('btn-dat-livery-expand-all');

    const count = maskMgr ? maskMgr.items.length : 0;
    if (lblMask) {
      lblMask.textContent = active
        ? `選択中マスク: ${active.name} (${maskMgr.activeIndex + 1}/${count})`
        : '選択中マスク: なし';
    }
    if (inpLivery) {
      inpLivery.disabled = !active;
      inpLivery.value = active ? this.getLiveryNameForMask(active, maskMgr.activeIndex, { allowEmpty: count <= 1 }) : '';
    }
    if (btnAll) {
      btnAll.disabled = count === 0;
      btnAll.textContent = count > 0
        ? `🎭 全マスク(${count}塗装)を一括 --- 出力`
        : '🎭 全マスクを一括 --- 出力';
    }
    this.gen._renderSeasonMaskPanel?.();
  }

  onAppMaskChanged() {
    this.refreshUI();
    if (this.followMaskChange && this.gen.hasOpenedOnce) {
      this.applyActiveMaskLivery({ regenerate: this.gen.autoSync });
    } else {
      this.gen.syncImagePrefixWithApp?.();
    }
  }

  // アクティブマスクの塗装名と画像プレフィックスを現在のdat状態へ適用（スペックと画像座標は維持）
  applyActiveMaskLivery({ regenerate = true } = {}) {
    const maskMgr = this.gen.app?.maskMgr;
    const active = maskMgr?.getActive();
    if (!active) return;

    const maskItems = maskMgr.items || [];
    const count = maskItems.length;
    const liveryName = this.getLiveryNameForMask(active, maskMgr.activeIndex, { allowEmpty: count <= 1 });
    const nextImgPrefix = buildMaskImagePrefix(this.gen.app, active, this.useBatchImgNaming);
    const mixAll = Boolean(this.mixLiveryConsist && count > 1);
    const getLivFn = (m, i, opts) => this.getLiveryNameForMask(m, i, opts);

    if (this.gen.collectionMgr.hasCollection()) {
      this.gen.collectionMgr.saveActiveFromController();
      const items = this.gen.collectionMgr.items;
      this._rememberBaseNames(items);
      const { allNamesByStrip, singleStripMap } = buildLiveryConstraintMaps(
        items, maskItems, getLivFn, this.baseNameByKey, liveryName
      );

      const nameMap = new Map();
      items.forEach((it, idx) => {
        const oldName = it.common.name;
        const baseHint = this.baseNameByKey.get(`${idx}:${it.objType}`) || oldName;
        const nextName = applyLiveryToName(oldName, liveryName, it.objType, baseHint);
        nameMap.set(oldName, nextName);
        it.common.name = nextName;
        const jaHint = this.baseNameByKey.get(`ja:${idx}:${it.objType}`) || it.common.jaName;
        if (jaHint) it.common.jaName = applyLiveryToName(it.common.jaName, liveryName, it.objType, jaHint);
        it.common.imgPrefix = nextImgPrefix;
      });

      items.forEach(it => {
        if (it.objType === 'vehicle') {
          const opts = { mixAll, allNamesByStrip, singleStripMap };
          it.values.constraintsPrev = replaceConstraintNames(it.values.constraintsPrev, nameMap, opts);
          it.values.constraintsNext = replaceConstraintNames(it.values.constraintsNext, nameMap, opts);
        }
      });

      const cur = items[this.gen.collectionMgr.activeIndex];
      if (cur) this.gen.collectionMgr._loadItemIntoController(cur);
      this.gen.collectionMgr.refreshUI();
    } else {
      const objType = this.gen.currentObjType;
      const state = this.gen._getObjState(objType);
      const key = `single:${objType}`;
      if (!this.baseNameByKey.has(key)) {
        this.baseNameByKey.set(key, stripLiverySuffix(this.gen.common.name || ''));
      }
      const baseHint = this.baseNameByKey.get(key);
      const singleList = [{ objType, common: { ...this.gen.common }, values: { ...state } }];
      const { allNamesByStrip, singleStripMap } = buildLiveryConstraintMaps(
        singleList, maskItems, getLivFn, this.baseNameByKey, liveryName
      );
      const oldName = this.gen.common.name;
      const nextName = applyLiveryToName(oldName, liveryName, objType, baseHint);
      const nameMap = new Map([[oldName, nextName]]);
      this.gen.common.name = nextName;
      const jaKey = `ja:single:${objType}`;
      if (!this.baseNameByKey.has(jaKey) && this.gen.common.jaName) {
        this.baseNameByKey.set(jaKey, stripLiverySuffix(this.gen.common.jaName));
      }
      if (this.baseNameByKey.has(jaKey)) {
        this.gen.common.jaName = applyLiveryToName(this.gen.common.jaName, liveryName, objType, this.baseNameByKey.get(jaKey));
      }
      this.gen.common.imgPrefix = nextImgPrefix;
      if (objType === 'vehicle') {
        const opts = { mixAll, allNamesByStrip, singleStripMap };
        state.constraintsPrev = replaceConstraintNames(state.constraintsPrev, nameMap, opts);
        state.constraintsNext = replaceConstraintNames(state.constraintsNext, nameMap, opts);
        this.gen._renderDynamicFields?.();
      }
      this.gen._syncCommonInputsFromState();
    }

    this.refreshUI();
    if (regenerate) this.gen.regenerateOutput();
  }

  // 全登録マスク（塗装）分をベーススペック・画像位置を維持したまま --- 区切りで一括出力
  expandAllMasksToOutput() {
    const app = this.gen.app;
    const maskMgr = app?.maskMgr;
    if (!maskMgr || maskMgr.items.length === 0) {
      alert('マスク画像が登録されていません。');
      return;
    }

    let baseItems;
    if (this.gen.collectionMgr.hasCollection()) {
      this.gen.collectionMgr.saveActiveFromController();
      baseItems = this.gen.collectionMgr.items.map(it => ({
        objType: it.objType,
        common: { ...it.common },
        values: { ...it.values }
      }));
    } else {
      const objType = this.gen.currentObjType;
      baseItems = [{
        objType,
        common: { ...this.gen.common },
        values: { ...this.gen._getObjState(objType) }
      }];
    }
    this._rememberBaseNames(baseItems);

    const maskItems = maskMgr.items;
    const mixAll = Boolean(this.mixLiveryConsist && maskItems.length > 1);
    const getLivFn = (m, i, opts) => this.getLiveryNameForMask(m, i, opts);
    const { allNamesByStrip } = buildLiveryConstraintMaps(baseItems, maskItems, getLivFn, this.baseNameByKey, '');

    const blocks = [];
    maskItems.forEach((maskItem, mIdx) => {
      const liveryName = this.getLiveryNameForMask(maskItem, mIdx, { allowEmpty: maskItems.length <= 1 });
      const imgPrefix = buildMaskImagePrefix(app, maskItem, this.useBatchImgNaming);
      const { singleStripMap } = buildLiveryConstraintMaps(baseItems, maskItems, getLivFn, this.baseNameByKey, liveryName);

      const nameMap = new Map();
      const cloned = baseItems.map((src, sIdx) => {
        const key = baseItems.length > 1 ? `${sIdx}:${src.objType}` : `single:${src.objType}`;
        const baseHint = this.baseNameByKey.get(key) || src.common.name;
        const nextName = applyLiveryToName(src.common.name, liveryName, src.objType, baseHint);
        nameMap.set(src.common.name, nextName);
        const jaKey = baseItems.length > 1 ? `ja:${sIdx}:${src.objType}` : `ja:single:${src.objType}`;
        const jaHint = this.baseNameByKey.get(jaKey) || src.common.jaName;
        const nextJaName = jaHint ? applyLiveryToName(src.common.jaName, liveryName, src.objType, jaHint) : '';
        return {
          objType: src.objType,
          common: { ...src.common, name: nextName, jaName: nextJaName, imgPrefix },
          values: { ...src.values }
        };
      });

      cloned.forEach(item => {
        if (item.objType === 'vehicle') {
          const opts = { mixAll, allNamesByStrip, singleStripMap };
          item.values.constraintsPrev = replaceConstraintNames(item.values.constraintsPrev, nameMap, opts);
          item.values.constraintsNext = replaceConstraintNames(item.values.constraintsNext, nameMap, opts);
        }
        blocks.push(serializeDatObject(item.objType, item.values, item.common).trimEnd());
      });
    });

    const txt = document.getElementById('txt-dat-output');
    if (txt) txt.value = blocks.join('\n---\n') + '\n';
    this.gen.autoSync = false;
    this.gen._updateSyncBadge(
      mixAll ? `全${maskItems.length}塗装 混結対応で一括生成済み` : `全${maskItems.length}塗装 一括生成済み`
    );
  }

  exportState() {
    const maskItems = this.gen.app?.maskMgr?.items || [];
    const liveries = maskItems.map((m, idx) => ({
      index: idx,
      name: m.name,
      livery: this.liveryByMaskId.has(m.id) ? this.liveryByMaskId.get(m.id) : null
    })).filter(e => e.livery !== null);

    return {
      liveries,
      baseNameByKey: Array.from(this.baseNameByKey.entries()),
      followMaskChange: this.followMaskChange,
      useBatchImgNaming: this.useBatchImgNaming,
      mixLiveryConsist: this.mixLiveryConsist
    };
  }

  importState(data) {
    this.liveryByMaskId.clear();
    this.baseNameByKey.clear();
    if (!data) {
      this.followMaskChange = true;
      this.useBatchImgNaming = true;
      this.mixLiveryConsist = false;
    } else {
      this.followMaskChange = data.followMaskChange !== undefined ? Boolean(data.followMaskChange) : true;
      this.useBatchImgNaming = data.useBatchImgNaming !== undefined ? Boolean(data.useBatchImgNaming) : true;
      this.mixLiveryConsist = Boolean(data.mixLiveryConsist);
      if (Array.isArray(data.baseNameByKey)) this.baseNameByKey = new Map(data.baseNameByKey);

      const maskItems = this.gen.app?.maskMgr?.items || [];
      if (Array.isArray(data.liveries)) {
        data.liveries.forEach((entry) => {
          const byIdx = typeof entry.index === 'number' ? maskItems[entry.index] : null;
          const target = (byIdx && byIdx.name === entry.name)
            ? byIdx
            : (maskItems.find(m => m.name === entry.name) || byIdx);
          if (target && entry.livery !== undefined && entry.livery !== null) {
            this.liveryByMaskId.set(target.id, String(entry.livery));
          }
        });
      }
    }

    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    setChk('chk-dat-livery-follow', this.followMaskChange);
    setChk('chk-dat-livery-batch-img', this.useBatchImgNaming);
    setChk('chk-dat-livery-mix-consist', this.mixLiveryConsist);
    this.refreshUI();
  }
}
