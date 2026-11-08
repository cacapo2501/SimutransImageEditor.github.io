export function rgbToHex(r, g, b) {
  const toHex = (c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return [0, 0, 0];
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0
  ];
}

export function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : Math.round((diff / max) * 100), v: Math.round(max * 100) };
}

export function hsvToHex(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function parseSpecialColorsCsv(csvText) {
  const set = new Set();
  csvText.split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.includes('SpecialColor')) return;
    const hex = (t.split(',')[0].trim().startsWith('#') ? t.split(',')[0].trim() : `#${t.split(',')[0].trim()}`).toUpperCase();
    if (/^#[0-9A-F]{6}$/i.test(hex)) set.add(hex);
  });
  return set;
}

export function resolveSpecialColorConflicts(rgbaArray, width, height, specialColorSet) {
  let count = 0;
  for (let i = 0; i < rgbaArray.length; i += 4) {
    if (rgbaArray[i + 3] === 0) continue;
    const hex = rgbToHex(rgbaArray[i], rgbaArray[i + 1], rgbaArray[i + 2]);
    if (specialColorSet.has(hex)) {
      count++;
      rgbaArray[i] = rgbaArray[i] > 0 ? rgbaArray[i] - 1 : rgbaArray[i] + 1;
    }
  }
  return count;
}