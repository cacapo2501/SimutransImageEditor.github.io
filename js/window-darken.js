import { hexToInt } from './color-utils.js';

// RamdomWindowDarken.py 準拠の標準窓発光色 (87,101,111)=#57656F, (77,77,77)=#4D4D4D
const DEFAULT_WINDOW_COLOR_INTS = new Set([
  (87 << 16) | (101 << 8) | 111,
  (77 << 16) | (77 << 8) | 77
]);

// シード付き擬似乱数 (Mulberry32)
function createSeededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 4近傍連結成分ラベリングによる窓グループ検出
function detectWindowGroups(pixels, width, height, targetColorInts) {
  const total = width * height;
  const groupIds = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  let groupCount = 0;

  for (let i = 0; i < total; i++) {
    if (groupIds[i] !== -1) continue;
    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;

    const rgbInt = (pixels[idx] << 16) | (pixels[idx + 1] << 8) | pixels[idx + 2];
    if (!targetColorInts.has(rgbInt)) continue;

    const gid = groupCount++;
    groupIds[i] = gid;
    let sp = 0;
    stack[sp++] = i;

    while (sp > 0) {
      const cur = stack[--sp];
      const cx = cur % width;
      const cy = (cur - cx) / width;

      // 左
      if (cx > 0) {
        const ni = cur - 1;
        if (groupIds[ni] === -1 && pixels[ni * 4 + 3] > 0) {
          const nRgb = (pixels[ni * 4] << 16) | (pixels[ni * 4 + 1] << 8) | pixels[ni * 4 + 2];
          if (targetColorInts.has(nRgb)) { groupIds[ni] = gid; stack[sp++] = ni; }
        }
      }
      // 右
      if (cx < width - 1) {
        const ni = cur + 1;
        if (groupIds[ni] === -1 && pixels[ni * 4 + 3] > 0) {
          const nRgb = (pixels[ni * 4] << 16) | (pixels[ni * 4 + 1] << 8) | pixels[ni * 4 + 2];
          if (targetColorInts.has(nRgb)) { groupIds[ni] = gid; stack[sp++] = ni; }
        }
      }
      // 上
      if (cy > 0) {
        const ni = cur - width;
        if (groupIds[ni] === -1 && pixels[ni * 4 + 3] > 0) {
          const nRgb = (pixels[ni * 4] << 16) | (pixels[ni * 4 + 1] << 8) | pixels[ni * 4 + 2];
          if (targetColorInts.has(nRgb)) { groupIds[ni] = gid; stack[sp++] = ni; }
        }
      }
      // 下
      if (cy < height - 1) {
        const ni = cur + width;
        if (groupIds[ni] === -1 && pixels[ni * 4 + 3] > 0) {
          const nRgb = (pixels[ni * 4] << 16) | (pixels[ni * 4 + 1] << 8) | pixels[ni * 4 + 2];
          if (targetColorInts.has(nRgb)) { groupIds[ni] = gid; stack[sp++] = ni; }
        }
      }
    }
  }

  return { groupIds, groupCount };
}

// 窓ピクセルのSpecialColor一部解除（暗転処理）
export function applyRandomWindowDarken(pixels, width, height, opts, specialColors = null) {
  if (!opts || !opts.enabled) return { totalGroups: 0, darkenedGroups: 0 };

  const ratio = Math.min(1.0, Math.max(0.0, (opts.ratio_pct || 0) / 100.0));
  const targetColorInts = new Set(DEFAULT_WINDOW_COLOR_INTS);

  if (opts.include_all_special && specialColors && specialColors.size > 0) {
    specialColors.forEach(hex => {
      const val = hexToInt(hex);
      if (val !== 0xE7FFFF) targetColorInts.add(val);
    });
  }

  const { groupIds, groupCount } = detectWindowGroups(pixels, width, height, targetColorInts);
  if (groupCount === 0 || ratio <= 0) {
    return { totalGroups: groupCount, darkenedGroups: 0 };
  }

  const rng = createSeededRandom(opts.seed || 12345);
  const darkenFlags = new Uint8Array(groupCount);
  let darkenedGroups = 0;

  for (let g = 0; g < groupCount; g++) {
    if (rng() < ratio) {
      darkenFlags[g] = 1;
      darkenedGroups++;
    }
  }

  if (darkenedGroups > 0) {
    const total = width * height;
    for (let i = 0; i < total; i++) {
      const gid = groupIds[i];
      if (gid !== -1 && darkenFlags[gid]) {
        const idx = i * 4;
        const r = pixels[idx];
        // R成分を -1 ずらして SpecialColor 判定から除外 (87->86, 77->76)
        pixels[idx] = r > 0 ? r - 1 : r + 1;
      }
    }
  }

  return { totalGroups: groupCount, darkenedGroups };
}