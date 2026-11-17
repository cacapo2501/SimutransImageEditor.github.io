// 季節違い画像（色違いマスクからの選択・画像プレフィックス解決・UI描画）
import { buildMaskImagePrefix } from './dat-livery-manager.js';

const SEASON_SUPPORTED_OBJS = new Set(['building', 'factory', 'tree', 'groundobj', 'field']);
const SEASON_LABELS_4 = ['通常 / 夏 [0]', '雪・秋 [1]', '冬 [2]', '春 [3]', '季節 [4]'];

// 季節参照キーからマスクアイテムを解決する
export function resolveSeasonMaskItem(app, ref) {
  if (!ref || ref === '__self__') return null;
  const items = app?.maskMgr?.items || [];
  return items.find(m => m.name === ref) || null;
}

// 季節ごとの画像プレフィックスマップを構築する（別マスク選択時はそのマスク出力名を使用）
export function computeSeasonPrefixes(app, values) {
  const map = values?.seasonMasks;
  const prefixes = {};
  if (!map || typeof map !== 'object') return prefixes;
  Object.entries(map).forEach(([sKey, ref]) => {
    const maskItem = resolveSeasonMaskItem(app, ref);
    if (maskItem) {
      prefixes[sKey] = buildMaskImagePrefix(app, maskItem, true);
    }
  });
  return prefixes;
}

// 季節違い画像（色違いマスクからの割当）UIを描画する
export function renderSeasonMaskPanel(container, app, objType, state, onChanged) {
  if (!container) return;
  const seasons = Math.max(1, parseInt(state?.seasons, 10) || 1);
  const isFieldWithSnow = objType === 'field' && Boolean(state?.has_snow);
  const totalSlots = isFieldWithSnow ? seasons + 1 : seasons;
  if (!SEASON_SUPPORTED_OBJS.has(objType) || totalSlots <= 1) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = '';
  container.innerHTML = '';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px; font-weight:bold; color:#9cdcfe; margin-bottom:4px;';
  title.textContent = '❄️ 季節ごとの画像割当（色違いマスクから選択）';
  container.appendChild(title);

  if (!state.seasonMasks || typeof state.seasonMasks !== 'object') {
    state.seasonMasks = {};
  }
  const maskItems = app?.maskMgr?.items || [];

  for (let s = 0; s < totalSlots; s++) {
    const row = document.createElement('div');
    row.className = 'row mt-05';
    row.style.gap = '6px';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'min-width:110px; font-size:11px; color:#ccc;';
    if (isFieldWithSnow && s === totalSlots - 1) {
      lbl.textContent = `雪画像 [${s}] (has_snow):`;
    } else if (totalSlots === 2 && !isFieldWithSnow) {
      lbl.textContent = s === 0 ? '季節[0] (通常):' : '季節[1] (雪):';
    } else if (isFieldWithSnow && seasons === 1) {
      lbl.textContent = '季節[0] (通常):';
    } else {
      lbl.textContent = SEASON_LABELS_4[s] || `季節[${s}]:`;
    }

    const sel = document.createElement('select');
    sel.style.flex = '1';
    const defOpt = document.createElement('option');
    defOpt.value = '__self__';
    defOpt.textContent = '(同一画像内の別行/別列を使用)';
    sel.appendChild(defOpt);

    maskItems.forEach((m, mIdx) => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = `🎭 ${m.name} (#${mIdx + 1}: ${buildMaskImagePrefix(app, m, true)})`;
      sel.appendChild(opt);
    });

    const curRef = state.seasonMasks[String(s)] || '__self__';
    sel.value = Array.from(sel.options).some(o => o.value === curRef) ? curRef : '__self__';
    sel.onchange = () => {
      state.seasonMasks[String(s)] = sel.value;
      onChanged();
    };
    row.appendChild(lbl);
    row.appendChild(sel);
    container.appendChild(row);
  }

  const note = document.createElement('div');
  note.className = 'info-text mt-05';
  note.textContent = maskItems.length > 1
    ? '※色違いを選択した季節は、そのマスク出力画像(全マスク一括PNG出力と一致)の開始位置を参照します。'
    : '※色違いを選ぶにはメイン画面「マスク画像管理」で季節用の別マスクを追加してください。';
  container.appendChild(note);
}
