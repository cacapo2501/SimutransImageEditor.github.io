// Simutrans dat 生成AIサービス（Gemini API通信・JSON抽出・画像設定整合＆レスポンス正規化）
import { DAT_OBJECT_TEMPLATES } from './dat-templates.js';
import { getImageFormatOptionsForObjType } from './dat-image-formats.js';
import { PAKSET_OPTIONS, describeFieldsSchema, buildDatAiPrompt } from './dat-ai-prompts.js';
import { applyStandardGearBalance } from './dat-ai-gear.js';

export { PAKSET_OPTIONS, describeFieldsSchema, buildDatAiPrompt };

const STORAGE_KEY = 'simutrans_editor_gemini_cfg_v1';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export const GEMINI_MODELS = [
  { value: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen (最新・高速推奨)' },
  { value: 'gemini-4-carbon', label: 'gemini-4-carbon (最新・高精度推論)' },
  { value: 'gemini-4-argon', label: 'gemini-4-argon (最新・フラッグシップ推論)' },
  { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash (Flash 高速)' },
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash' },
  { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (超軽量)' },
  { value: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (旧世代)' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (旧世代)' }
];

export function loadGeminiConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { apiKey: '', model: DEFAULT_GEMINI_MODEL, saveKey: false };
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed.apiKey || ''),
      model: String(parsed.model || DEFAULT_GEMINI_MODEL),
      saveKey: Boolean(parsed.apiKey)
    };
  } catch (e) {
    return { apiKey: '', model: DEFAULT_GEMINI_MODEL, saveKey: false };
  }
}

export function saveGeminiConfig({ apiKey, model, saveKey }) {
  try {
    if (saveKey && apiKey) localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, model }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* localStorage 利用不可時は無視 */ }
}

export function extractJsonText(rawText) {
  const trimmed = String(rawText || '').replace(/^\uFEFF/, '').trim();
  if (!trimmed) return '';
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch (e) { /* 抽出へ進む */ }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const firstObj = trimmed.indexOf('{');
  const firstArr = trimmed.indexOf('[');
  if (firstArr >= 0 && (firstObj < 0 || firstArr < firstObj)) {
    const lastArr = trimmed.lastIndexOf(']');
    if (lastArr > firstArr) {
      const candidate = trimmed.slice(firstArr, lastArr + 1);
      try { JSON.parse(candidate); return candidate; } catch (e) { /* 次へ */ }
    }
  }
  const lastObj = trimmed.lastIndexOf('}');
  if (firstObj >= 0 && lastObj > firstObj) {
    return trimmed.slice(firstObj, lastObj + 1);
  }
  return trimmed;
}

export async function pasteClipboardIntoTextarea(textarea, onStatus) {
  if (!textarea) return false;
  textarea.focus();
  textarea.scrollIntoView?.({ block: 'nearest' });
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        onStatus?.('クリップボードからJSONを貼り付けました');
        return true;
      }
    }
  } catch (e) {
    // 権限拒否時等は手動ペースト案内へフォールバック
  }
  onStatus?.('入力欄にJSONを貼り付けてください (Ctrl+V / 長押し貼付)');
  return false;
}

function normalizeStringList(val) {
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean).join('\n');
  if (val === undefined || val === null) return '';
  return String(val);
}

// フォームで設定済みの画像構成系パラメータを退避・初期値として引き継ぐキー一覧
const IMAGE_LAYOUT_VALUE_KEYS = [
  'directions', 'hasFreightImage', 'freightRow', 'freightTypeName',
  'reverseRowMode', 'reverseRow', 'reverseFlipDir', 'includeNoElectric', 'noElectricRow',
  'dimsW', 'dimsH', 'dimsViews', 'heightTiles', 'frames', 'seasons', 'imageLayer',
  'includePoints', 'includeDiagonal', 'includeSlopes', 'includeSlopes2', 'includeCursorIcon',
  'includeFrontImage', 'includeFrontDiagonal', 'signalStates', 'diagonalStates',
  'tunnelPortalMode', 'way', 'ageCount', 'has_snow', 'iconMode', 'iconSampleMode', 'iconCropMode', 'cursorMode', 'cursorExternalName', 'cursorExternalDataUrl', 'cursorExternalRow', 'cursorExternalCol'
];

function applyPreservedImageValues(values, fallbackValues) {
  if (!fallbackValues || typeof fallbackValues !== 'object') return;
  IMAGE_LAYOUT_VALUE_KEYS.forEach((k) => {
    if (fallbackValues[k] !== undefined) {
      values[k] = fallbackValues[k];
    }
  });
  if (fallbackValues.seasonMasks && typeof fallbackValues.seasonMasks === 'object') {
    values.seasonMasks = { ...fallbackValues.seasonMasks };
  }
  if (Array.isArray(fallbackValues.fieldRefs)) {
    values.fieldRefs = fallbackValues.fieldRefs.map(f => ({ ...f }));
  }
}

// 建物・インフラ等の画像構成が編集中画像のグリッド寸法を超える場合に現在の安全な画像構成へ戻す
function clampImageLayoutToGrid(objType, values, fallbackValues, gridRows, gridCols) {
  if (!fallbackValues || gridRows <= 0 || gridCols <= 0) return;

  if (objType === 'building' || objType === 'factory') {
    const w = Math.max(1, parseInt(values.dimsW, 10) || 1);
    const h = Math.max(1, parseInt(values.dimsH, 10) || 1);
    const views = Math.max(1, parseInt(values.dimsViews, 10) || 1);
    const ht = Math.max(1, parseInt(values.heightTiles, 10) || 1);
    const fr = objType === 'factory' ? 1 : Math.max(1, parseInt(values.frames, 10) || 1);
    const se = Math.max(1, parseInt(values.seasons, 10) || 1);
    const needCols = views * w * h;
    const needRows = se * fr * ht;
    if (needCols > gridCols || needRows > gridRows) {
      ['dimsW', 'dimsH', 'dimsViews', 'heightTiles', 'frames', 'seasons', 'imageLayer'].forEach((k) => {
        if (fallbackValues[k] !== undefined) values[k] = fallbackValues[k];
      });
    }
  } else if (['way', 'way-object', 'bridge', 'tunnel', 'roadsign', 'tree', 'groundobj', 'field'].includes(objType)) {
    ['includePoints', 'includeDiagonal', 'includeSlopes', 'includeSlopes2', 'includeCursorIcon',
      'includeFrontImage', 'includeFrontDiagonal', 'tunnelPortalMode', 'signalStates', 'diagonalStates',
      'seasons', 'ageCount', 'has_snow'].forEach((k) => {
      if (fallbackValues[k] !== undefined) values[k] = fallbackValues[k];
    });
  }
}

// 複数車両時の画像行 (startRow) を編集中画像の有効行数 (gridRows) と車種構成に合わせてスマートに割り当てる
function resolveSmartStartRows(items, { baseRow = 0, autoSeqRows = true, gridRows = 0 }) {
  const total = items.length;
  if (total === 0) return;

  if (!autoSeqRows) {
    const fixedRow = gridRows > 0 ? Math.min(baseRow, gridRows - 1) : baseRow;
    items.forEach(it => { it.common.startRow = String(fixedRow); });
    return;
  }

  if (total === 1) {
    const r0 = parseInt(items[0].common.startRow, 10);
    const validR0 = Number.isFinite(r0) && r0 >= 0 ? r0 : baseRow;
    items[0].common.startRow = String(gridRows > 0 ? Math.min(validR0, gridRows - 1) : validR0);
    return;
  }

  // 画像が1行のみの場合は全車両 row=0 とする
  if (gridRows === 1) {
    items.forEach((it) => { it.common.startRow = '0'; });
    return;
  }

  const parsedRows = items.map(it => {
    const n = parseInt(it.common.startRow, 10);
    return Number.isFinite(n) && n >= 0 ? n : -1;
  });
  const allSameRow = parsedRows.every(r => r === parsedRows[0]);
  const allWithinGrid = gridRows > 0 && parsedRows.every(r => r >= 0 && r < gridRows);

  // AIが既に画像の有効行数内で車種別に異なる行を割り振っている場合はそれを尊重する
  if (gridRows > 1 && allWithinGrid && !allSameRow) {
    items.forEach((it, i) => { it.common.startRow = String(parsedRows[i]); });
    return;
  }

  // 車両数が画像の行数以下（または画像未読込）の場合
  if (gridRows <= 0 || total <= gridRows) {
    if (!allSameRow && gridRows <= 0 && parsedRows.every(r => r >= 0)) {
      items.forEach((it, i) => { it.common.startRow = String(parsedRows[i]); });
    } else {
      items.forEach((it, i) => {
        const nextR = baseRow + i;
        it.common.startRow = String(gridRows > 0 ? Math.min(gridRows - 1, nextR) : nextR);
      });
    }
    return;
  }

  // 車両数が画像の行数より多い場合: 先頭車=0, 中間車=1..gridRows-2(形式/動力別), 後尾車=gridRows-1
  const midSlots = Math.max(1, gridRows - 2);
  const typeGroupMap = new Map();
  let nextGroupIdx = 0;

  items.forEach((it, idx) => {
    if (idx === 0) {
      it.common.startRow = '0';
    } else if (idx === total - 1) {
      it.common.startRow = String(gridRows - 1);
    } else if (gridRows === 2) {
      it.common.startRow = (parseInt(it.values?.power, 10) || 0) > 0 ? '1' : '0';
    } else {
      const rawName = String(it.common.name || '').replace(/\([^()]*\)$/, '').replace(/_\d+$/, '');
      const pwrTag = (parseInt(it.values?.power, 10) || 0) > 0 ? 'M' : 'T';
      const groupKey = `${rawName}:${pwrTag}`;
      if (!typeGroupMap.has(groupKey)) typeGroupMap.set(groupKey, nextGroupIdx++);
      it.common.startRow = String(1 + (typeGroupMap.get(groupKey) % midSlots));
    }
  });
}

// AI返却JSONを検証・正規化してアプリ内部フォーマットに変換する
export function parseAiDatResponse(rawText, fallbackObjType = 'building', fallbackCommon = {}, options = {}) {
  const jsonStr = extractJsonText(rawText);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('AIの応答をJSONとして解析できませんでした: ' + err.message);
  }

  const rawObjects = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed.objects) ? parsed.objects : (parsed.obj ? [parsed] : []));
  if (rawObjects.length === 0) {
    throw new Error('AIの応答に有効な objects 配列が含まれていません。');
  }

  const fallbackValues = options.fallbackValues || null;
  const autoSeqRows = options.autoSeqRows !== undefined ? Boolean(options.autoSeqRows) : true;
  const gridRows = Math.max(0, parseInt(options.gridRows, 10) || 0);
  const gridCols = Math.max(0, parseInt(options.gridCols, 10) || 0);
  const baseRow = Math.max(0, parseInt(fallbackCommon.startRow, 10) || 0);
  const baseCol = Math.max(0, parseInt(fallbackCommon.startCol, 10) || 0);
  const activeImgPrefix = String(fallbackCommon.imgPrefix || '').trim();

  const normalized = rawObjects.map((item, idx) => {
    const objType = DAT_OBJECT_TEMPLATES[item.obj] ? item.obj : fallbackObjType;
    const tpl = DAT_OBJECT_TEMPLATES[objType];
    const defaults = tpl ? { ...tpl.defaults } : {};
    const values = { ...defaults };

    if (objType === fallbackObjType) applyPreservedImageValues(values, fallbackValues);

    if (item.values && typeof item.values === 'object') {
      Object.entries(item.values).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (k === 'climates') {
          values[k] = Array.isArray(v)
            ? v.map(c => String(c).trim()).filter(Boolean)
            : String(v).split(',').map(c => c.trim()).filter(Boolean);
        } else if (k === 'constraintsPrev' || k === 'constraintsNext') {
          values[k] = normalizeStringList(v);
        } else if (typeof defaults[k] === 'boolean') {
          values[k] = v === true || v === 'true' || v === '1' || v === 1;
        } else {
          values[k] = String(v);
        }
      });
    }

    if (objType === fallbackObjType) {
      clampImageLayoutToGrid(objType, values, fallbackValues, gridRows, gridCols);
    }

    const rawCommon = item.common && typeof item.common === 'object' ? item.common : {};
    const allowedFmts = getImageFormatOptionsForObjType(objType).map(o => o.value);
    const curFmt = String(fallbackCommon.imageFormat || 'auto');
    const isExplicitEmptyFmt = curFmt === 'vehicle_empty_8' || curFmt === 'vehicle_empty_4' || curFmt === 'vehicle_image_8';
    const baseFmt = curFmt === 'vehicle_otrp_reverse' ? 'auto' : curFmt;
    const aiFmt = String(rawCommon.imageFormat || '').trim();
    const resolvedFmt = isExplicitEmptyFmt
      ? curFmt
      : ((aiFmt && allowedFmts.includes(aiFmt)) ? aiFmt : (allowedFmts.includes(baseFmt) ? baseFmt : 'auto'));

    // 画像プレフィックスは現在のエディタ出力名(activeImgPrefix)を最優先し、AIの架空ファイル名によるリンク切れを防ぐ
    const rawPrefix = String(rawCommon.imgPrefix || '').trim();
    const resolvedPrefix = (activeImgPrefix && activeImgPrefix !== 'base_combined')
      ? activeImgPrefix
      : (rawPrefix || activeImgPrefix || 'base_combined');

    const rawCol = parseInt(rawCommon.startCol, 10);
    const resolvedCol = (baseCol > 0)
      ? baseCol
      : (Number.isFinite(rawCol) && rawCol >= 0 ? (gridCols > 0 ? Math.min(rawCol, gridCols - 1) : rawCol) : baseCol);
    const resolvedOffset = String(rawCommon.imgOffset || fallbackCommon.imgOffset || '').trim();
    const resolvedFlip = rawCommon.flipDirections !== undefined
      ? (rawCommon.flipDirections === true || rawCommon.flipDirections === 'true' || rawCommon.flipDirections === 1)
      : Boolean(fallbackCommon.flipDirections);

    const common = {
      name: String(rawCommon.name || `${defaults.name || 'addon'}_${idx + 1}`),
      jaName: String(rawCommon.jaName || ''),
      copyright: String(rawCommon.copyright || fallbackCommon.copyright || ''),
      includeImages: fallbackCommon.includeImages !== undefined ? Boolean(fallbackCommon.includeImages) : true,
      imageFormat: resolvedFmt,
      customImgFormat: String(fallbackCommon.customImgFormat || 'EmptyImage[{dir}][0]={prefix}.{row}.{col}{offset}'),
      flipDirections: resolvedFlip,
      imgPrefix: resolvedPrefix,
      startRow: String(rawCommon.startRow ?? (baseRow + idx)),
      startCol: String(resolvedCol),
      imgOffset: resolvedOffset,
      customImageCoords: (rawObjects.length === 1 && fallbackCommon.customImageCoords)
        ? JSON.parse(JSON.stringify(fallbackCommon.customImageCoords))
        : null,
      extraLines: String(rawCommon.extraLines || fallbackCommon.extraLines || '')
    };

    return { objType, common, values };
  });

  resolveSmartStartRows(normalized, { baseRow, autoSeqRows, gridRows });
  const gearInfo = applyStandardGearBalance(normalized, { parsed, options });
  const baseSummary = String(parsed.summary || `${normalized.length}件のオブジェクトを生成しました`);
  return {
    summary: gearInfo.applied ? `${baseSummary} ${gearInfo.summaryNote}` : baseSummary,
    objects: normalized
  };
}

async function readGeminiError(res, prefix) {
  let errMsg = `HTTP ${res.status}`;
  try {
    const errJson = await res.json();
    if (errJson?.error?.message) errMsg = errJson.error.message;
  } catch (e) {}
  throw new Error(`${prefix}: ${errMsg}`);
}

// Gemini API から利用可能な最新モデル一覧を取得する
export async function fetchAvailableGeminiModels(apiKey) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) throw new Error('モデル一覧を取得するには Gemini API Key を入力してください。');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
  const res = await fetch(url);
  if (!res.ok) await readGeminiError(res, 'モデル一覧取得エラー');
  const data = await res.json();
  const list = Array.isArray(data.models) ? data.models : [];
  return list
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => {
      const id = String(m.name || '').replace(/^models\//, '');
      return { value: id, label: m.displayName ? `${id} (${m.displayName})` : id };
    })
    .filter(m => m.value.includes('gemini'))
    .sort((a, b) => b.value.localeCompare(a.value));
}

// Gemini API を呼び出して dat パラメータ JSON を取得する
export async function requestDatFromGemini({ apiKey, model = DEFAULT_GEMINI_MODEL, prompt }) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) throw new Error('Gemini API Key を入力してください。');
  const cleanModel = String(model || DEFAULT_GEMINI_MODEL).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    })
  });
  if (!res.ok) await readGeminiError(res, 'Gemini API エラー');

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini API から空の応答が返されました。');
  return text;
}
