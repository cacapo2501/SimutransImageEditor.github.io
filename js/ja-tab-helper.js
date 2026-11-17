// Simutrans 翻訳ファイル (ja.tab) 生成・dat内複数オブジェクト解析ユーティリティ

/**
 * dat テキスト内の --- 区切りブロックを解析し、各オブジェクトの obj / name を抽出する
 */
export function parseDatObjectsSummary(datText) {
  const blocks = String(datText || '')
    .split(/^\s*---+\s*$/m)
    .map(b => b.trim())
    .filter(Boolean);

  const objects = [];
  blocks.forEach((block, idx) => {
    let objType = '';
    let name = '';
    let waytype = '';
    let copyright = '';

    block.split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq < 0) return;
      const k = line.slice(0, eq).trim().toLowerCase();
      const v = line.slice(eq + 1).trim();
      if (k === 'obj') objType = v;
      else if (k === 'name') name = v;
      else if (k === 'waytype') waytype = v;
      else if (k === 'copyright') copyright = v;
    });

    if (objType || name) {
      objects.push({ index: idx, objType: objType || 'unknown', name, waytype, copyright });
    }
  });
  return objects;
}

/**
 * dat テキストと既知の日本語名マップから ja.tab 用のペア配列を構築する
 */
export function collectJaTabEntries(datText, jaNameMap = new Map()) {
  const objects = parseDatObjectsSummary(datText);
  const seen = new Set();
  const entries = [];

  objects.forEach((o) => {
    const key = (o.name || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const mapped = jaNameMap.get(key);
    entries.push({
      key,
      objType: o.objType,
      jaName: mapped !== undefined ? mapped : key
    });
  });
  return entries;
}

/**
 * Simutrans 標準形式（UTF-8 BOMなし・LF改行・1行目 §#・2行1組）で ja.tab テキストを生成する
 */
export function buildJaTabText(entries) {
  const lines = ['§#'];
  (entries || []).forEach((e) => {
    const k = String(e.key || '').replace(/\r?\n/g, ' ').trim();
    const v = String(e.jaName || k).replace(/\r?\n/g, ' ').trim();
    if (!k) return;
    lines.push(k);
    lines.push(v || k);
  });
  return lines.join('\n') + '\n';
}

/**
 * 既存の ja.tab テキストから key -> jaName の Map を読み取る
 */
export function parseJaTabText(tabText) {
  const map = new Map();
  const rawLines = String(tabText || '')
    .split(/\r?\n/)
    .map(l => l.trimEnd());

  const contentLines = [];
  rawLines.forEach((line, idx) => {
    if (idx === 0 && line.startsWith('§')) return;
    if (!line.trim() || line.trim().startsWith('#')) return;
    contentLines.push(line.trim());
  });

  for (let i = 0; i + 1 < contentLines.length; i += 2) {
    map.set(contentLines[i], contentLines[i + 1]);
  }
  return map;
}

/**
 * UTF-8 (BOMなし) / LF 改行で ja.tab ファイルをダウンロード保存する
 */
export function downloadJaTabText(text, filename = 'ja.tab') {
  const normalized = String(text || '§#\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const clean = String(filename || 'ja.tab').trim() || 'ja.tab';
  const outName = clean.toLowerCase().endsWith('.tab') ? clean : `${clean}.tab`;
  const blob = new Blob([normalized], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * 複数車両を含む dat でも単一の .pak ファイル名になるよう出力名を決定する
 */
export function deriveSinglePakFilename(datFilename, baseName = '', objects = []) {
  const df = String(datFilename || '').trim();
  if (df && df.toLowerCase() !== 'addon.dat' && !/^new_[a-z]+\.dat$/i.test(df)) {
    return df.replace(/\.dat$/i, '') + '.pak';
  }
  const cleanBase = String(baseName || '')
    .replace(/\.png$/i, '')
    .replace(/(_combined|_cut|_def|_paint|_base)$/i, '')
    .trim();
  if (cleanBase && cleanBase !== 'base') {
    return `${cleanBase}.pak`;
  }
  const firstName = objects[0]?.name ? objects[0].name.replace(/\([^()]*\)$/, '').trim() : '';
  return `${firstName || 'addon'}.pak`;
}

/**
 * ベース画像の識別部分から ja_(識別名).tab 形式のデフォルト保存ファイル名を生成する
 */
export function deriveJaTabFilename(baseName = '', fallbackName = '') {
  const ignored = new Set(['def', 'paint', 'combined', 'cut', 'base']);
  const tokens = String(baseName || '')
    .replace(/\.png$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .split('_')
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => !ignored.has(t.toLowerCase()));

  let ident = tokens.join('_');
  if (!ident && fallbackName) {
    ident = String(fallbackName)
      .replace(/\.(dat|pak|png)$/i, '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim();
  }
  return ident ? `ja_${ident}.tab` : 'ja.tab';
}
