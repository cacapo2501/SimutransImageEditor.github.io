import { serializeDatObject } from './dat-serializer.js';

function sanitizeTag(name) {
  return String(name || '')
    .replace(/\.png$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_');
}

// マスクファイル名から塗装名候補を抽出する
export function deriveLiveryName(maskName, baseName = '', idx = 0) {
  let clean = String(maskName || '').replace(/\.png$/i, '').replace(/(_paint|_mask)$/i, '');
  const baseRoot = String(baseName || '').replace(/\.png$/i, '').replace(/(_combined|_def|_base)$/i, '');
  if (baseRoot && clean.toLowerCase().startsWith(baseRoot.toLowerCase() + '_')) {
    clean = clean.slice(baseRoot.length + 1);
  }
  clean = clean.replace(/^_+/, '').trim();
  return clean || `Livery${idx + 1}`;
}

// 塗装名をオブジェクト名へ適用する（車両は 鉄道会社略称_系列名_形式(塗装名) 形式）
export function applyLiveryToName(rawName, liveryName, objType, baseNameHint = '') {
  const cleanLivery = String(liveryName || '').trim();
  const base = String(baseNameHint || rawName || 'addon').trim();
  if (!cleanLivery) return base;

  if (objType === 'vehicle') {
    const stripped = base.replace(/\([^()]*\)$/, '').trim();
    return `${stripped}(${cleanLivery})`;
  }
  const stripped = base.replace(/\([^()]*\)$/, '').trim();
  return `${stripped}_${cleanLivery}`;
}

// BatchExporter と同一規則でマスクごとの画像ファイル名プレフィックスを生成
export function buildMaskImagePrefix(app, maskItem, useBatchNaming = true) {
  const cleanBase = String(app?.baseName || 'base.png').replace(/\.png$/i, '');
  const suffix = app?.tileCutter?.shouldCutOnExport?.() ? '_cut' : '_combined';
  if (!useBatchNaming || !maskItem) return `${cleanBase}${suffix}`;
  const cleanTag = sanitizeTag(maskItem.name);
  return cleanTag ? `${cleanBase}_${cleanTag}${suffix}` : `${cleanBase}${suffix}`;
}

function replaceConstraintNames(rawText, nameMap) {
  const lines = String(rawText || '').split(/\r?\n/);
  return lines.map(line => {
    const t = line.trim();
    if (!t || t === 'none') return t;
    return nameMap.get(t) || t;
  }).filter(Boolean).join('\n');
}

export class DatLiveryManager {
  constructor(datGenerator) {
    this.gen = datGenerator;
    this.liveryByMaskId = new Map();
    this.baseNameByKey = new Map();
    this.followMaskChange = true;
    this.useBatchImgNaming = true;
  }

  getActiveMaskItem() {
    return this.gen.app?.maskMgr?.getActive() || null;
  }

  getLiveryNameForMask(maskItem, idx = 0) {
    if (!maskItem) return '';
    if (this.liveryByMaskId.has(maskItem.id)) {
      return this.liveryByMaskId.get(maskItem.id);
    }
    const derived = deriveLiveryName(maskItem.name, this.gen.app?.baseName, idx);
    this.liveryByMaskId.set(maskItem.id, derived);
    return derived;
  }

  getActiveLiveryName() {
    const maskMgr = this.gen.app?.maskMgr;
    const active = maskMgr?.getActive();
    if (!active) return '';
    return this.getLiveryNameForMask(active, maskMgr.activeIndex);
  }

  _rememberBaseNames(items) {
    items.forEach((it, idx) => {
      const key = `${idx}:${it.objType}`;
      if (!this.baseNameByKey.has(key)) {
        this.baseNameByKey.set(key, String(it.common?.name || '').replace(/\([^()]*\)$/, '').trim());
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
      inpLivery.value = active ? this.getLiveryNameForMask(active, maskMgr.activeIndex) : '';
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
    }
  }

  // アクティブマスクの塗装名と画像プレフィックスを現在のdat状態へ適用（スペックと画像座標は維持）
  applyActiveMaskLivery({ regenerate = true } = {}) {
    const maskMgr = this.gen.app?.maskMgr;
    const active = maskMgr?.getActive();
    if (!active) return;

    const liveryName = this.getLiveryNameForMask(active, maskMgr.activeIndex);
    const nextImgPrefix = buildMaskImagePrefix(this.gen.app, active, this.useBatchImgNaming);

    if (this.gen.collectionMgr.hasCollection()) {
      this.gen.collectionMgr.saveActiveFromController();
      const items = this.gen.collectionMgr.items;
      this._rememberBaseNames(items);

      const nameMap = new Map();
      items.forEach((it, idx) => {
        const oldName = it.common.name;
        const baseHint = this.baseNameByKey.get(`${idx}:${it.objType}`) || oldName;
        const nextName = applyLiveryToName(oldName, liveryName, it.objType, baseHint);
        nameMap.set(oldName, nextName);
        it.common.name = nextName;
        it.common.imgPrefix = nextImgPrefix;
      });

      items.forEach(it => {
        if (it.objType === 'vehicle') {
          it.values.constraintsPrev = replaceConstraintNames(it.values.constraintsPrev, nameMap);
          it.values.constraintsNext = replaceConstraintNames(it.values.constraintsNext, nameMap);
        }
      });

      const cur = items[this.gen.collectionMgr.activeIndex];
      if (cur) this.gen.collectionMgr._loadItemIntoController(cur);
      this.gen.collectionMgr.refreshUI();
    } else {
      const objType = this.gen.currentObjType;
      const key = `single:${objType}`;
      if (!this.baseNameByKey.has(key)) {
        this.baseNameByKey.set(key, String(this.gen.common.name || '').replace(/\([^()]*\)$/, '').trim());
      }
      const baseHint = this.baseNameByKey.get(key);
      this.gen.common.name = applyLiveryToName(this.gen.common.name, liveryName, objType, baseHint);
      this.gen.common.imgPrefix = nextImgPrefix;
      this.gen._syncCommonInputsFromState();
    }

    this.refreshUI();
    if (regenerate) {
      this.gen.regenerateOutput();
    }
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

    const blocks = [];
    maskMgr.items.forEach((maskItem, mIdx) => {
      const liveryName = this.getLiveryNameForMask(maskItem, mIdx);
      const imgPrefix = buildMaskImagePrefix(app, maskItem, this.useBatchImgNaming);

      const nameMap = new Map();
      const cloned = baseItems.map((src, sIdx) => {
        const key = baseItems.length > 1 ? `${sIdx}:${src.objType}` : `single:${src.objType}`;
        const baseHint = this.baseNameByKey.get(key) || src.common.name;
        const nextName = applyLiveryToName(src.common.name, liveryName, src.objType, baseHint);
        nameMap.set(src.common.name, nextName);
        return {
          objType: src.objType,
          common: { ...src.common, name: nextName, imgPrefix },
          values: { ...src.values }
        };
      });

      cloned.forEach(item => {
        if (item.objType === 'vehicle') {
          item.values.constraintsPrev = replaceConstraintNames(item.values.constraintsPrev, nameMap);
          item.values.constraintsNext = replaceConstraintNames(item.values.constraintsNext, nameMap);
        }
        blocks.push(serializeDatObject(item.objType, item.values, item.common).trimEnd());
      });
    });

    const txt = document.getElementById('txt-dat-output');
    if (txt) {
      txt.value = blocks.join('\n---\n') + '\n';
    }
    this.gen.autoSync = false;
    this.gen._updateSyncBadge(`全${maskMgr.items.length}塗装 一括生成済み`);
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
      useBatchImgNaming: this.useBatchImgNaming
    };
  }

  importState(data) {
    this.liveryByMaskId.clear();
    this.baseNameByKey.clear();
    if (!data) {
      this.followMaskChange = true;
      this.useBatchImgNaming = true;
      return;
    }

    this.followMaskChange = data.followMaskChange !== undefined ? Boolean(data.followMaskChange) : true;
    this.useBatchImgNaming = data.useBatchImgNaming !== undefined ? Boolean(data.useBatchImgNaming) : true;
    if (Array.isArray(data.baseNameByKey)) {
      this.baseNameByKey = new Map(data.baseNameByKey);
    }

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

    const chkFollow = document.getElementById('chk-dat-livery-follow');
    if (chkFollow) chkFollow.checked = this.followMaskChange;
    const chkBatch = document.getElementById('chk-dat-livery-batch-img');
    if (chkBatch) chkBatch.checked = this.useBatchImgNaming;
    this.refreshUI();
  }
}
