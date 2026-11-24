// 生成AIへの指示プロンプト・設定ドラフト・履歴および makeobj メモの永続化モジュール

const DRAFT_STORAGE_KEY = 'simutrans_editor_dat_ai_draft_v1';
const HISTORY_STORAGE_KEY = 'simutrans_editor_dat_ai_history_v1';
const MAKEOBJ_HINT_STORAGE_KEY = 'simutrans_editor_mk_ai_hint_v1';
const MAX_HISTORY_ITEMS = 20;

export function loadDatAiDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && typeof p === 'object') ? p : null;
  } catch (e) {
    return null;
  }
}

export function saveDatAiDraft(draft) {
  if (!draft || typeof draft !== 'object') return;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      userPrompt: String(draft.userPrompt || ''),
      pakset: String(draft.pakset || 'pak64'),
      vehicleMode: String(draft.vehicleMode || 'consist'),
      accelProfile: String(draft.accelProfile || 'auto'),
      carCount: String(draft.carCount || ''),
      autoSeqRows: draft.autoSeqRows !== undefined ? Boolean(draft.autoSeqRows) : true,
      buildCostPct: Number(draft.buildCostPct) || 100,
      maintCostPct: Number(draft.maintCostPct) || 100,
      payloadPct: Number(draft.payloadPct) || 100
    }));
  } catch (e) {
    // localStorage 利用不可時は無視
  }
}

export function loadDatAiHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(x => x && typeof x.userPrompt === 'string' && x.userPrompt.trim()) : [];
  } catch (e) {
    return [];
  }
}

export function saveDatAiHistoryEntry(entry) {
  const promptText = String(entry?.userPrompt || '').trim();
  if (!promptText) return loadDatAiHistory();

  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    savedAt: Date.now(),
    objType: String(entry.objType || 'vehicle'),
    userPrompt: promptText,
    pakset: String(entry.pakset || 'pak64'),
    vehicleMode: String(entry.vehicleMode || 'consist'),
    accelProfile: String(entry.accelProfile || 'auto'),
    carCount: String(entry.carCount || ''),
    autoSeqRows: entry.autoSeqRows !== undefined ? Boolean(entry.autoSeqRows) : true,
    buildCostPct: Number(entry.buildCostPct) || 100,
    maintCostPct: Number(entry.maintCostPct) || 100,
    payloadPct: Number(entry.payloadPct) || 100
  };

  try {
    const prev = loadDatAiHistory();
    // 同一条件・同一指示文の重複を取り除いて先頭に追加
    const filtered = prev.filter(p => !(
      p.userPrompt === item.userPrompt &&
      p.objType === item.objType &&
      p.pakset === item.pakset &&
      p.vehicleMode === item.vehicleMode &&
      p.carCount === item.carCount
    ));
    const next = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    return loadDatAiHistory();
  }
}

export function deleteDatAiHistoryEntry(id) {
  try {
    const prev = loadDatAiHistory();
    const next = prev.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    return [];
  }
}

export function loadMakeobjAiHint() {
  try {
    return String(localStorage.getItem(MAKEOBJ_HINT_STORAGE_KEY) || '');
  } catch (e) {
    return '';
  }
}

export function saveMakeobjAiHint(text) {
  try {
    localStorage.setItem(MAKEOBJ_HINT_STORAGE_KEY, String(text || ''));
  } catch (e) {
    // 無視
  }
}
