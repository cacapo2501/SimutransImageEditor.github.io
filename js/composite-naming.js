// 合成画像および参照画像プレフィックスの統一命名ヘルパー

const IGNORED_NAME_TOKENS = new Set(['def', 'paint', 'combined', 'cut']);

function tokenizeImageName(rawName) {
  return String(rawName || '')
    .replace(/\.png$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .split('_')
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => !IGNORED_NAME_TOKENS.has(t.toLowerCase()));
}

/**
 * ベース画像名とマスク画像名をアンダースコア区切りで分割し、
 * 重複要素および _def / _paint 等を除去したうえで _combined（または _cut）を付与する。
 */
export function buildCompositeImagePrefix(baseName, maskName = '', { useCut = false, extraTag = '' } = {}) {
  const baseTokens = tokenizeImageName(baseName);
  const maskTokens = tokenizeImageName(maskName);
  const extraTokens = tokenizeImageName(extraTag);

  const seen = new Set();
  const merged = [];

  for (const token of [...baseTokens, ...maskTokens]) {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(token);
    }
  }

  for (const token of extraTokens) {
    merged.push(token);
  }

  const root = merged.length > 0 ? merged.join('_') : 'image';
  const suffix = useCut ? '_cut' : '_combined';
  return `${root}${suffix}`;
}

export function buildCompositeImageFilename(baseName, maskName = '', opts = {}) {
  return `${buildCompositeImagePrefix(baseName, maskName, opts)}.png`;
}
