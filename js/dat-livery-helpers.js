// マスク塗装名抽出・画像プレフィックス解決・混結対応 constraint 変換ヘルパー
import { buildCompositeImagePrefix } from './composite-naming.js';

export function stripLiverySuffix(name) {
  return String(name || '').replace(/\([^()]*\)$/, '').trim();
}

// マスクファイル名から塗装名候補を抽出する（ベース画像と同名の自動生成マスク時は空文字を返す）
export function deriveLiveryName(maskName, baseName = '', idx = 0, { allowEmpty = false } = {}) {
  let clean = String(maskName || '').replace(/\.png$/i, '').replace(/(_s?paint|_mask)$/i, '').trim();
  const baseRaw = String(baseName || '').replace(/\.png$/i, '').trim();
  const baseRoot = baseRaw
    .replace(/(_combined|_cut|_s?def|_s?paint|_base|_mask)$/i, '')
    .replace(/_[sc][0-9A]$/i, '')
    .trim();

  const lowerClean = clean.toLowerCase();
  if ((baseRaw && lowerClean === baseRaw.toLowerCase()) || (baseRoot && lowerClean === baseRoot.toLowerCase())) {
    clean = '';
  } else if (baseRaw && lowerClean.startsWith(baseRaw.toLowerCase() + '_')) {
    clean = clean.slice(baseRaw.length + 1);
  } else if (baseRoot && lowerClean.startsWith(baseRoot.toLowerCase() + '_')) {
    clean = clean.slice(baseRoot.length + 1);
  }

  clean = clean.replace(/^_+/, '').trim();
  if (/^(base|mask|paint|default|combined|cut)$/i.test(clean) || /^new_\d+x\d+$/i.test(clean)) {
    clean = '';
  }
  if (allowEmpty) return clean;
  return clean || `Livery${idx + 1}`;
}

// 塗装名をオブジェクト名へ適用する（車両は 鉄道会社略称_系列名_形式(塗装名) 形式）
export function applyLiveryToName(rawName, liveryName, objType, baseNameHint = '') {
  const cleanLivery = String(liveryName || '').trim();
  const base = String(baseNameHint || rawName || 'addon').trim();
  if (!cleanLivery) return base;

  if (objType === 'vehicle') {
    const stripped = stripLiverySuffix(base);
    return `${stripped}(${cleanLivery})`;
  }
  const stripped = stripLiverySuffix(base);
  return `${stripped}_${cleanLivery}`;
}

// BatchExporter と同一規則でマスクごとの画像ファイル名プレフィックスを生成
export function buildMaskImagePrefix(app, maskItem, useBatchNaming = true) {
  const useCut = Boolean(app?.tileCutter?.shouldCutOnExport?.());
  const maskName = (useBatchNaming && maskItem) ? maskItem.name : '';
  return buildCompositeImagePrefix(app?.baseName || 'base.png', maskName, { useCut });
}

// 全登録マスク分のベース車両名→塗装別名一覧および単一塗装マップを構築する
export function buildLiveryConstraintMaps(baseItems, maskItems, getLiveryFn, baseNameByKey, singleLiveryName) {
  const allNamesByStrip = new Map();
  const singleStripMap = new Map();
  const addAll = (k, v) => {
    if (!k || !v) return;
    if (!allNamesByStrip.has(k)) allNamesByStrip.set(k, []);
    const arr = allNamesByStrip.get(k);
    if (!arr.includes(v)) arr.push(v);
  };

  baseItems.forEach((src, sIdx) => {
    const key = baseItems.length > 1 ? `${sIdx}:${src.objType}` : `single:${src.objType}`;
    const baseHint = baseNameByKey.get(key) || stripLiverySuffix(src.common?.name);
    const stripHint = stripLiverySuffix(baseHint);
    const stripCur = stripLiverySuffix(src.common?.name);
    const singleName = applyLiveryToName(src.common?.name, singleLiveryName, src.objType, baseHint);
    if (stripHint) singleStripMap.set(stripHint, singleName);
    if (stripCur) singleStripMap.set(stripCur, singleName);

    (maskItems || []).forEach((m, mIdx) => {
      const liv = getLiveryFn(m, mIdx, { allowEmpty: maskItems.length <= 1 });
      const cand = applyLiveryToName(src.common?.name, liv, src.objType, baseHint);
      addAll(stripHint, cand);
      addAll(stripCur, cand);
    });
  });

  return { allNamesByStrip, singleStripMap };
}

// constraint[prev/next] を単一塗装または混結（全マスク塗装展開）形式へ変換する
export function replaceConstraintNames(rawText, exactNameMap, { mixAll = false, allNamesByStrip = null, singleStripMap = null } = {}) {
  const out = [];
  const seen = new Set();
  const pushUnique = (val) => {
    if (!val || seen.has(val)) return;
    seen.add(val);
    out.push(val);
  };

  String(rawText || '').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t) return;
    if (t.toLowerCase() === 'none') {
      pushUnique('none');
      return;
    }
    const stripped = stripLiverySuffix(t);
    if (mixAll && allNamesByStrip && allNamesByStrip.has(stripped)) {
      allNamesByStrip.get(stripped).forEach(pushUnique);
      return;
    }
    const mapped = exactNameMap?.get(t) || singleStripMap?.get(stripped) || t;
    pushUnique(mapped);
  });
  return out.join('\n');
}
