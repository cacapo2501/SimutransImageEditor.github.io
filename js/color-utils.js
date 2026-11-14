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

// HEX -> 24bit整数キー (高速ルックアップ用)
export function hexToInt(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return isNaN(num) ? 0xFFFFFF : (num & 0xFFFFFF);
}

// 24bit整数キー -> HEX
export function intToHex(val) {
  return `#${(val & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase()}`;
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

// special_colors.csv パース
export function parseSpecialColorsCsv(csvText) {
  const specialColors = new Set();
  if (!csvText) return specialColors;

  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hexMatches = trimmed.match(/#[0-9A-Fa-f]{6}\b/g);
    if (hexMatches && hexMatches.length > 0) {
      for (const h of hexMatches) {
        specialColors.add(h.toUpperCase());
      }
      continue;
    }

    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const parts = trimmed.split(/[,;\t]+/).map(s => s.trim());
    for (let i = 0; i <= parts.length - 3; i++) {
      if (/^\d{1,3}$/.test(parts[i]) && /^\d{1,3}$/.test(parts[i + 1]) && /^\d{1,3}$/.test(parts[i + 2])) {
        const r = parseInt(parts[i], 10);
        const g = parseInt(parts[i + 1], 10);
        const b = parseInt(parts[i + 2], 10);
        if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
          specialColors.add(rgbToHex(r, g, b));
          break;
        }
      }
    }
  }
  return specialColors;
}

// 出力時SpecialColor衝突回避
export function resolveSpecialColorConflicts(pixels, width, height, specialColors, isBaseSpecialColor = null) {
  if (!specialColors || specialColors.size === 0) return 0;
  let conflicts = 0;
  const total = width * height;
  const specialInts = new Set();
  specialColors.forEach(hex => specialInts.add(hexToInt(hex)));

  for (let i = 0; i < total; i++) {
    if (isBaseSpecialColor && isBaseSpecialColor[i]) continue;

    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;

    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const rgbInt = (r << 16) | (g << 8) | b;

    if (specialInts.has(rgbInt)) {
      pixels[idx] = r > 0 ? r - 1 : r + 1;
      conflicts++;
    }
  }
  return conflicts;
}
