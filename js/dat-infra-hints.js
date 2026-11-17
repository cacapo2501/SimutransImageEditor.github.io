// bridge / tunnel / roadsign 用 Image 座標指定の視覚的ヒント SVG 生成モジュール
import { getWayKeyHint } from './dat-way-hints.js';

const EDGE_MID = {
  N: [46, 13],
  E: [46, 31],
  S: [18, 31],
  W: [18, 13]
};

const EDGE_SEG = {
  N: [[32, 4], [60, 22]],
  E: [[60, 22], [32, 40]],
  S: [[4, 22], [32, 40]],
  W: [[4, 22], [32, 4]]
};

const DIR_JP = {
  N: '北 N (右上↗側)',
  E: '東 E (右下↘側)',
  S: '南 S (左下↙側)',
  W: '西 W (左上↖側)'
};

const PART_JP = {
  l: '左端 (l)',
  m: '中央 (m)',
  r: '右端 (r)'
};

function wrapDiamondSvg(inner, width = 28, height = 19, showCompass = false) {
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

function renderBridgeHint(k, w, h, large) {
  let m = k.match(/^(Back|Front)Image\[(NS|EW)\]$/);
  if (m) {
    const isFront = m[1] === 'Front';
    const color = isFront ? '#FFAA44' : '#00E5FF';
    const p0 = m[2] === 'NS' ? EDGE_MID.N : EDGE_MID.W;
    const p1 = m[2] === 'NS' ? EDGE_MID.S : EDGE_MID.E;
    const inner = `<line x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/>`
      + (isFront ? `<circle cx="32" cy="22" r="3.5" fill="#111" stroke="${color}" stroke-width="2"/>` : '');
    const dirDesc = m[2] === 'NS' ? 'NS (右上↗⇔左下↙)' : 'EW (左上↖⇔右下↘)';
    const layerDesc = isFront ? '前面(手前欄干)' : '背面(奥・桁面)';
    return { label: `橋梁本体 ${layerDesc} ${dirDesc}`, svg: wrapDiamondSvg(inner, w, h, large) };
  }

  m = k.match(/^(Back|Front)(Start|Ramp)\[([NSEW])\]$/);
  if (m) {
    const isFront = m[1] === 'Front';
    const kind = m[2];
    const dir = m[3];
    const color = kind === 'Start' ? '#66FFB2' : '#FFD200';
    const [e0, e1] = EDGE_SEG[dir];
    const mid = EDGE_MID[dir];
    let inner = `<line x1="${e0[0]}" y1="${e0[1]}" x2="${e1[0]}" y2="${e1[1]}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`
      + `<line x1="32" y1="22" x2="${mid[0]}" y2="${mid[1]}" stroke="${isFront ? '#FFAA44' : '#00E5FF'}" stroke-width="4" stroke-linecap="round"/>`;
    if (kind === 'Ramp') {
      inner += `<circle cx="${mid[0]}" cy="${mid[1]}" r="4" fill="#FFD200"/>`;
    } else {
      inner += `<rect x="${mid[0] - 4}" y="${mid[1] - 4}" width="8" height="8" rx="1.5" fill="#66FFB2"/>`;
    }
    const kindLabel = kind === 'Start' ? '橋台/斜面始点 Start' : '平地接続ランプ Ramp';
    return { label: `${kindLabel} (${isFront ? '前面' : '背面'}) ${DIR_JP[dir]}`, svg: wrapDiamondSvg(inner, w, h, large) };
  }

  m = k.match(/^(Back|Front)Pillar\[([SW])\]$/);
  if (m) {
    const dir = m[2];
    const p0 = dir === 'S' ? EDGE_MID.N : EDGE_MID.W;
    const p1 = dir === 'S' ? EDGE_MID.S : EDGE_MID.E;
    const inner = `<line x1="${p0[0]}" y1="${p0[1] - 5}" x2="${p1[0]}" y2="${p1[1] - 5}" stroke="#7fa8c9" stroke-width="3" stroke-linecap="round"/>`
      + `<line x1="26" y1="18" x2="26" y2="35" stroke="#FF88DD" stroke-width="4.5" stroke-linecap="round"/>`
      + `<line x1="38" y1="18" x2="38" y2="35" stroke="#FF88DD" stroke-width="4.5" stroke-linecap="round"/>`;
    const axisDesc = dir === 'S' ? 'S (NS橋の橋脚)' : 'W (EW橋の橋脚)';
    return { label: `橋脚 Pillar ${axisDesc}`, svg: wrapDiamondSvg(inner, w, h, large) };
  }

  return null;
}

function renderTunnelHint(k, w, h, large) {
  const m = k.match(/^(Back|Front)Image\[([NSEW])([lmr])?\]$/);
  if (!m) return null;
  const isFront = m[1] === 'Front';
  const dir = m[2];
  const part = m[3] || '';
  const color = isFront ? '#FFAA44' : '#00E5FF';
  const [e0, e1] = EDGE_SEG[dir];
  const mid = EDGE_MID[dir];

  // 複線以上(l/m/r)の場合は辺上の位置を少しずらして左・中央・右を明示
  const t = part === 'l' ? 0.25 : (part === 'r' ? 0.75 : 0.5);
  const px = Math.round(e0[0] + (e1[0] - e0[0]) * t);
  const py = Math.round(e0[1] + (e1[1] - e0[1]) * t);

  let inner = `<line x1="${e0[0]}" y1="${e0[1]}" x2="${e1[0]}" y2="${e1[1]}" stroke="#557799" stroke-width="4" stroke-linecap="round"/>`
    + `<line x1="32" y1="22" x2="${mid[0]}" y2="${mid[1]}" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/>`
    + `<circle cx="${px}" cy="${py}" r="5" fill="${color}" stroke="#111" stroke-width="1.5"/>`;

  if (part) {
    const badgeColor = part === 'l' ? '#66FFB2' : (part === 'm' ? '#FFD200' : '#FF77CC');
    inner += `<rect x="46" y="1" width="16" height="14" rx="3" fill="${badgeColor}"/>`
      + `<text x="54" y="11" text-anchor="middle" fill="#111" font-size="10" font-weight="bold" font-family="sans-serif">${part.toUpperCase()}</text>`;
  }

  const layerText = isFront ? '坑口・前面(手前アーチ)' : '坑口・背面(奥側)';
  const partText = part ? ` / 複線以上 ${PART_JP[part]}` : '';
  return {
    label: `${layerText} ${DIR_JP[dir]}${partText}`,
    svg: wrapDiamondSvg(inner, w, h, large)
  };
}

function renderRoadsignHint(k, w, h, large) {
  let m = k.match(/^Diagonal\[(\d+)\]$/);
  if (m) {
    const inner = `<line x1="18" y1="13" x2="46" y2="31" stroke="#66FFB2" stroke-width="4.5" stroke-linecap="round"/>`
      + `<circle cx="32" cy="22" r="4.5" fill="#FFD200"/>`;
    return { label: `斜め画像 Diagonal[${m[1]}]`, svg: wrapDiamondSvg(inner, w, h, large) };
  }
  m = k.match(/^Image\[(\d+)\]$/);
  if (m) {
    const inner = `<circle cx="32" cy="22" r="6" fill="#00E5FF"/>`;
    return { label: `標識/信号コマ Image[${m[1]}]`, svg: wrapDiamondSvg(inner, w, h, large) };
  }
  return null;
}

// オブジェクト種別に応じた Image キーの視覚的ヒントを返す
export function getImageKeyHint(objType, key, { large = false } = {}) {
  const k = String(key || '');
  if (objType === 'way' || objType === 'way-object') {
    return getWayKeyHint(k, { large });
  }
  const w = large ? 64 : 28;
  const h = large ? 44 : 19;
  if (k === 'Cursor' || k === 'Icon') {
    return getWayKeyHint(k, { large });
  }
  if (objType === 'bridge') return renderBridgeHint(k, w, h, large);
  if (objType === 'tunnel') return renderTunnelHint(k, w, h, large);
  if (objType === 'roadsign') return renderRoadsignHint(k, w, h, large);
  return null;
}
