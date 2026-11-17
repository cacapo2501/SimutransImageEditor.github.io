// way / way-object 用の方角・分岐・斜め・坂道の視覚的ヒント SVG 生成モジュール

// アイソメトリック菱形 (viewBox 0 0 64 44) の頂点と各辺中点
const EDGE_MID = {
  N: [46, 13], // 北: 右上辺
  E: [46, 31], // 東: 右下辺
  S: [18, 31], // 南: 左下辺
  W: [18, 13]  // 西: 左上辺
};

const CENTER = [32, 22];

const DIAGONAL_PAIRS = {
  NE: { edges: ['N', 'E'], desc: '斜め NE (右上辺↔右下辺 / 右側縦)' },
  SW: { edges: ['S', 'W'], desc: '斜め SW (左下辺↔左上辺 / 左側縦)' },
  NW: { edges: ['N', 'W'], desc: '斜め NW (右上辺↔左上辺 / 上側横)' },
  SE: { edges: ['S', 'E'], desc: '斜め SE (左下辺↔右下辺 / 下側横)' }
};

const SLOPE_INFO = {
  '3': { edge: [[4, 22], [32, 40]], arrow: [21, 29], desc: 'S側高 (左下↙側が高い坂)' },
  '6': { edge: [[32, 40], [60, 22]], arrow: [43, 29], desc: 'E側高 (右下↘側が高い坂)' },
  '9': { edge: [[4, 22], [32, 4]], arrow: [21, 15], desc: 'W側高 (左上↖側が高い坂)' },
  '12': { edge: [[32, 4], [60, 22]], arrow: [43, 15], desc: 'N側高 (右上↗側が高い坂)' }
};

const POINT_VARIANTS = {
  NSE1: { main: ['N', 'S'], branch: ['N', 'E'], label: '分岐 NSE1 (N↔S直進 + N↔E分岐 パターン1)' },
  NSE2: { main: ['N', 'S'], branch: ['S', 'E'], label: '分岐 NSE2 (N↔S直進 + S↔E分岐 パターン2)' },
  NSW1: { main: ['N', 'S'], branch: ['N', 'W'], label: '分岐 NSW1 (N↔S直進 + N↔W分岐 パターン1)' },
  NSW2: { main: ['N', 'S'], branch: ['S', 'W'], label: '分岐 NSW2 (N↔S直進 + S↔W分岐 パターン2)' },
  NEW1: { main: ['E', 'W'], branch: ['N', 'E'], label: '分岐 NEW1 (E↔W直進 + N↔E分岐 パターン1)' },
  NEW2: { main: ['E', 'W'], branch: ['N', 'W'], label: '分岐 NEW2 (E↔W直進 + N↔W分岐 パターン2)' },
  SEW1: { main: ['E', 'W'], branch: ['S', 'E'], label: '分岐 SEW1 (E↔W直進 + S↔E分岐 パターン1)' },
  SEW2: { main: ['E', 'W'], branch: ['S', 'W'], label: '分岐 SEW2 (E↔W直進 + S↔W分岐 パターン2)' },
  NSEW1: { main: ['N', 'S'], branch: ['E', 'W'], label: '交差 NSEW1 (十字分岐 パターン1)' },
  NSEW2: { main: ['E', 'W'], branch: ['N', 'S'], label: '交差 NSEW2 (十字分岐 パターン2)' }
};

const BASE_DESC_MAP = {
  NS: '直線 NS (右上↗ ⇔ 左下↙)',
  EW: '直線 EW (右下↘ ⇔ 左上↖)',
  NE: 'カーブ NE (右上↗ ⇔ 右下↘)',
  SE: 'カーブ SE (右下↘ ⇔ 左下↙)',
  NW: 'カーブ NW (右上↗ ⇔ 左上↖)',
  SW: 'カーブ SW (左下↙ ⇔ 左上↖)',
  N: '終端 N (右上↗のみ接続)',
  S: '終端 S (左下↙のみ接続)',
  E: '終端 E (右下↘のみ接続)',
  W: '終端 W (左上↖のみ接続)',
  NSE: 'T字分岐 NSE (N・S・E 3方向)',
  NSW: 'T字分岐 NSW (N・S・W 3方向)',
  NEW: 'T字分岐 NEW (N・E・W 3方向)',
  SEW: 'T字分岐 SEW (S・E・W 3方向)',
  NSEW: '十字交差 NSEW (全4方向)',
  '-': '単独 - (接続なし)'
};

function wrapSvg(inner, width = 28, height = 19, showCompass = false) {
  const compass = showCompass
    ? `<text x="49" y="10" fill="#7fa8c9" font-size="7" font-family="sans-serif">N</text>`
      + `<text x="49" y="39" fill="#7fa8c9" font-size="7" font-family="sans-serif">E</text>`
      + `<text x="9" y="39" fill="#7fa8c9" font-size="7" font-family="sans-serif">S</text>`
      + `<text x="9" y="10" fill="#7fa8c9" font-size="7" font-family="sans-serif">W</text>`
    : '';
  return `<svg viewBox="0 0 64 44" width="${width}" height="${height}" class="dat-way-hint-svg" aria-hidden="true">`
    + `<polygon points="32,4 60,22 32,40 4,22" fill="#17202a" stroke="#45586c" stroke-width="2"/>`
    + compass
    + inner
    + `</svg>`;
}

function renderDirPaths(dirToken) {
  if (dirToken === '-') {
    return `<circle cx="${CENTER[0]}" cy="${CENTER[1]}" r="4.5" fill="#00E5FF"/>`;
  }
  const dirs = ['N', 'S', 'E', 'W'].filter(d => dirToken.includes(d));
  if (dirs.length === 2) {
    const [a, b] = [EDGE_MID[dirs[0]], EDGE_MID[dirs[1]]];
    // 対辺なら直線、隣接辺なら中心を通るカーブとして描画
    const isStraight = (dirToken === 'NS' || dirToken === 'EW');
    if (isStraight) {
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#00E5FF" stroke-width="5" stroke-linecap="round"/>`;
    }
    return `<path d="M ${a[0]} ${a[1]} Q ${CENTER[0]} ${CENTER[1]} ${b[0]} ${b[1]}" fill="none" stroke="#00E5FF" stroke-width="5" stroke-linecap="round"/>`;
  }
  let svg = '';
  dirs.forEach(d => {
    const p = EDGE_MID[d];
    svg += `<line x1="${CENTER[0]}" y1="${CENTER[1]}" x2="${p[0]}" y2="${p[1]}" stroke="#00E5FF" stroke-width="4.5" stroke-linecap="round"/>`;
  });
  if (dirs.length === 1) {
    svg += `<circle cx="${CENTER[0]}" cy="${CENTER[1]}" r="4" fill="#FFD200"/>`;
  } else if (dirs.length >= 3) {
    svg += `<circle cx="${CENTER[0]}" cy="${CENTER[1]}" r="3.5" fill="#FFFFFF"/>`;
  }
  return svg;
}

function renderPointPaths(variantKey) {
  const pv = POINT_VARIANTS[variantKey];
  if (!pv) return '';
  const m0 = EDGE_MID[pv.main[0]];
  const m1 = EDGE_MID[pv.main[1]];
  const b0 = EDGE_MID[pv.branch[0]];
  const b1 = EDGE_MID[pv.branch[1]];
  const isNum2 = variantKey.endsWith('2');
  const branchColor = isNum2 ? '#FF77CC' : '#FFD200';
  const badge = isNum2 ? '2' : '1';
  const isCross = variantKey.startsWith('NSEW');
  const branchPath = isCross
    ? `<line x1="${b0[0]}" y1="${b0[1]}" x2="${b1[0]}" y2="${b1[1]}" stroke="${branchColor}" stroke-width="4.5" stroke-linecap="round"/>`
    : `<path d="M ${b0[0]} ${b0[1]} Q ${CENTER[0]} ${CENTER[1]} ${b1[0]} ${b1[1]}" fill="none" stroke="${branchColor}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `<line x1="${m0[0]}" y1="${m0[1]}" x2="${m1[0]}" y2="${m1[1]}" stroke="#00E5FF" stroke-width="4.5" stroke-linecap="round"/>`
    + branchPath
    + `<rect x="46" y="1" width="16" height="14" rx="3" fill="${branchColor}"/>`
    + `<text x="54" y="11" text-anchor="middle" fill="#111" font-size="10" font-weight="bold" font-family="sans-serif">${badge}</text>`;
}

/**
 * way / way-object の画像キーに対する視覚的SVGと日本語ヒント文を返す
 */
export function getWayKeyHint(key, { large = false } = {}) {
  const w = large ? 64 : 28;
  const h = large ? 44 : 19;
  const k = String(key || '');

  if (k === 'Cursor') {
    return {
      label: 'Cursor (建設メニュー選択カーソル画像)',
      svg: wrapSvg(`<rect x="20" y="12" width="24" height="20" rx="3" fill="none" stroke="#9CDCFE" stroke-width="3"/>`, w, h)
    };
  }
  if (k === 'Icon') {
    return {
      label: 'Icon (ツールバーアイコン画像)',
      svg: wrapSvg(`<circle cx="32" cy="22" r="9" fill="#9CDCFE"/>`, w, h)
    };
  }

  let m = k.match(/^Diagonal\[(NE|SE|NW|SW)\]/);
  if (m) {
    const info = DIAGONAL_PAIRS[m[1]];
    const p0 = EDGE_MID[info.edges[0]];
    const p1 = EDGE_MID[info.edges[1]];
    const inner = `<line x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}" stroke="#66FFB2" stroke-width="5" stroke-linecap="round"/>`;
    return { label: info.desc, svg: wrapSvg(inner, w, h, large) };
  }

  m = k.match(/^(ImageUp2?)\[(3|6|9|12)\]/);
  if (m) {
    const isUp2 = m[1] === 'ImageUp2';
    const info = SLOPE_INFO[m[2]];
    const [e0, e1] = info.edge;
    const color = isUp2 ? '#FF88DD' : '#FFAA44';
    let inner = `<line x1="${e0[0]}" y1="${e0[1]}" x2="${e1[0]}" y2="${e1[1]}" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/>`
      + `<circle cx="${info.arrow[0]}" cy="${info.arrow[1]}" r="4" fill="${color}"/>`;
    if (isUp2) {
      inner += `<rect x="42" y="1" width="20" height="14" rx="3" fill="#FF88DD"/>`
        + `<text x="52" y="11" text-anchor="middle" fill="#111" font-size="9" font-weight="bold" font-family="sans-serif">×2</text>`;
    }
    const prefix = isUp2 ? '2段坂 ImageUp2: ' : '坂道 ImageUp: ';
    return { label: `${prefix}${info.desc}`, svg: wrapSvg(inner, w, h, large) };
  }

  m = k.match(/^(?:Image|FrontImage)\[([A-Z0-9-]+)\]/);
  if (m) {
    const token = m[1];
    if (POINT_VARIANTS[token]) {
      return {
        label: POINT_VARIANTS[token].label,
        svg: wrapSvg(renderPointPaths(token), w, h, large)
      };
    }
    return {
      label: BASE_DESC_MAP[token] || `接続方向: ${token}`,
      svg: wrapSvg(renderDirPaths(token), w, h, large)
    };
  }

  return null;
}
