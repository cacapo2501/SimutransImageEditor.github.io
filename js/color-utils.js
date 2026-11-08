// RGB -> HEX
export function rgbToHex(r, g, b) {
  const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// HEX -> RGB
export function hexToRgb(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// RGB (0-255) -> HSV (H:0-360, S:0-100, V:0-100)
export function rgbToHsv(r, g, b) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case rf: h = (gf - bf) / d + (gf < bf ? 6 : 0); break;
      case gf: h = (bf - rf) / d + 2; break;
      case bf: h = (rf - gf) / d + 4; break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(v * 100)];
}

// HSV (H:0-360, S:0-100, V:0-100) -> HEX
export function hsvToHex(h, s, v) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

// HSV (H:0-360, S:0-100, V:0-100) -> RGB (0-255)
export function hsvToRgb(h, s, v) {
  s = s / 100;
  v = v / 100;
  const hi = Math.floor((h / 60) % 6);
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (hi) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// SpecialColors.csv パース
export function parseSpecialColorsCsv(csvText) {
  const specialColors = new Set();
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(',');
    if (parts.length >= 3) {
      const r = parseInt(parts[0].trim(), 10);
      const g = parseInt(parts[1].trim(), 10);
      const b = parseInt(parts[2].trim(), 10);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        specialColors.add(rgbToHex(r, g, b));
      }
    }
  }
  return specialColors;
}

// ★ 出力時SpecialColor衝突回避（ベース画像で元々SpecialColorのピクセルは完全保護） ★
export function resolveSpecialColorConflicts(pixels, width, height, specialColors, isBaseSpecialColor = null) {
  if (!specialColors || specialColors.size === 0) return 0;
  let conflicts = 0;
  const total = width * height;

  for (let i = 0; i < total; i++) {
    // ベース画像の元々のSpecialColorピクセルはR成分変更の対象外
    if (isBaseSpecialColor && isBaseSpecialColor[i]) {
      continue;
    }

    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;

    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const hex = rgbToHex(r, g, b);

    // 編集の結果、偶然SpecialColorと一致してしまったピクセルのみ補正
    if (specialColors.has(hex)) {
      pixels[idx] = r > 0 ? r - 1 : r + 1;
      conflicts++;
    }
  }
  return conflicts;
}