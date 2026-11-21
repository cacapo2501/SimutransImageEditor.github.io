// DAT画像指定パターン（配置座標・形式・way/vehicle画像オプション等）の別ファイル保存・読込モジュール

const PATTERN_FILE_TYPE = 'simutrans_dat_image_pattern';

const IMAGE_FORMAT_VALUE_KEYS = [
  'includePoints', 'includeDiagonal', 'includeSlopes', 'includeSlopes2', 'includeCursorIcon',
  'directions', 'hasFreightImage', 'freightRow', 'freightTypeName',
  'reverseRowMode', 'reverseRow', 'reverseFlipDir', 'includeNoElectric', 'noElectricRow',
  'imageLayer', 'dimsW', 'dimsH', 'dimsViews', 'heightTiles', 'frames', 'seasons',
  'signalStates', 'ageCount', 'has_snow',
  'iconMode', 'iconSampleMode', 'cursorMode', 'cursorExternalName', 'cursorExternalDataUrl', 'cursorExternalRow', 'cursorExternalCol'
];

export function buildImagePatternData({ objType, common, values, tileW = null, tileH = null }) {
  const c = common || {};
  const v = values || {};
  const formatValues = {};
  IMAGE_FORMAT_VALUE_KEYS.forEach((k) => {
    if (v[k] !== undefined) formatValues[k] = v[k];
  });

  return {
    type: PATTERN_FILE_TYPE,
    version: 1,
    objType: objType || 'building',
    tileW: tileW || null,
    tileH: tileH || null,
    imageSettings: {
      includeImages: c.includeImages !== undefined ? Boolean(c.includeImages) : true,
      imageFormat: c.imageFormat || 'auto',
      customImgFormat: c.customImgFormat || 'EmptyImage[{dir}][0]={prefix}.{row}.{col}{offset}',
      flipDirections: Boolean(c.flipDirections),
      startRow: String(c.startRow ?? '0'),
      startCol: String(c.startCol ?? '0'),
      imgOffset: String(c.imgOffset ?? ''),
      customImageCoords: c.customImageCoords ? JSON.parse(JSON.stringify(c.customImageCoords)) : null
    },
    formatValues
  };
}

export function downloadImagePatternFile(patternData, nameHint = 'image_pattern') {
  const clean = String(nameHint || 'image_pattern')
    .replace(/\.(imgpattern\.)?json$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || 'image_pattern';
  const filename = `${clean}.imgpattern.json`;
  const json = JSON.stringify(patternData, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function parseImagePatternJson(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error('JSONの解析に失敗しました: ' + err.message);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('有効な画像指定パターンファイルではありません。');
  }
  if (parsed.type && parsed.type !== PATTERN_FILE_TYPE) {
    throw new Error('未対応のファイル形式です (type=' + parsed.type + ')。');
  }
  if (!parsed.imageSettings && !parsed.customImageCoords) {
    throw new Error('画像指定パターン (imageSettings) が含まれていません。');
  }
  return parsed;
}

export function applyImagePatternToTarget(pattern, target) {
  if (!pattern || !target) return false;
  if (pattern.objType && pattern.objType !== target.objType) {
    const ok = confirm(
      `このパターンは "${pattern.objType}" 用に保存されています。\n現在編集中の "${target.objType}" に画像配置・設定を適用しますか？`
    );
    if (!ok) return false;
  }

  const img = pattern.imageSettings || pattern;
  if (!target.common) target.common = {};
  if (img.includeImages !== undefined) target.common.includeImages = Boolean(img.includeImages);
  if (img.imageFormat !== undefined) target.common.imageFormat = String(img.imageFormat || 'auto');
  if (img.customImgFormat !== undefined) target.common.customImgFormat = String(img.customImgFormat);
  if (img.flipDirections !== undefined) target.common.flipDirections = Boolean(img.flipDirections);
  if (img.startRow !== undefined) target.common.startRow = String(img.startRow);
  if (img.startCol !== undefined) target.common.startCol = String(img.startCol);
  if (img.imgOffset !== undefined) target.common.imgOffset = String(img.imgOffset);
  if (img.customImageCoords !== undefined) {
    target.common.customImageCoords = img.customImageCoords
      ? JSON.parse(JSON.stringify(img.customImageCoords))
      : null;
  }

  if (pattern.formatValues && typeof pattern.formatValues === 'object' && target.values) {
    Object.entries(pattern.formatValues).forEach(([k, v]) => {
      if (IMAGE_FORMAT_VALUE_KEYS.includes(k)) {
        target.values[k] = v;
      }
    });
  }
  return true;
}

export async function pickAndParseImagePatternFile(pickFileFn) {
  if (!pickFileFn) return null;
  const file = await pickFileFn('.json,.imgpattern.json');
  if (!file) return null;
  const text = await file.text();
  return parseImagePatternJson(text);
}

/**
 * DAT生成モーダル・GUIピッカー共通の画像指定パターン保存/読込ボタンバインド
 */
export function bindPatternFileButtons({
  saveBtnId,
  loadBtnId,
  getTarget,
  getTileSize = null,
  pickFileFn,
  onApplied
}) {
  document.getElementById(saveBtnId)?.addEventListener('click', () => {
    const target = getTarget();
    if (!target) return;
    const tile = getTileSize ? getTileSize() : null;
    const data = buildImagePatternData({
      ...target,
      tileW: tile?.tileW || null,
      tileH: tile?.tileH || null
    });
    downloadImagePatternFile(data, `${target.common?.name || target.objType}_pattern`);
  });

  document.getElementById(loadBtnId)?.addEventListener('click', async () => {
    const target = getTarget();
    if (!target) return;
    try {
      const pattern = await pickAndParseImagePatternFile(pickFileFn);
      if (!pattern || !applyImagePatternToTarget(pattern, target)) return;
      onApplied?.(pattern);
    } catch (err) {
      alert('パターン読込エラー: ' + (err.message || err));
    }
  });
}
