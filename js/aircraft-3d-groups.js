import { rgbToHsv } from './color-utils.js';

function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return Math.min(d, 360 - d);
}

// 離散頂点ドットを含む有彩色ピクセルを「色相 ±2° 以内」のみでグループ化（連結不要）
export function extractChromaticGroups(srcData, imgW, imgH) {
  const groups = [];

  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      const idx = (y * imgW + x) * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      const a = srcData[idx + 3];

      if (a === 0) continue;
      if (r === 255 && g === 255 && b === 255) continue;
      if (r === 231 && g === 255 && b === 255) continue;

      const [h, sPct, vPct] = rgbToHsv(r, g, b);
      // 黒・暗赤系 (V >= 4% かつ S >= 10%) を有彩色頂点として抽出
      if (sPct < 10 || vPct < 4) continue;

      let matched = null;
      let bestDiff = 999;
      for (const grp of groups) {
        const diff = hueDistance(grp.seedHue, h);
        if (diff <= 2.0 && diff < bestDiff) {
          bestDiff = diff;
          matched = grp;
        }
      }

      if (!matched) {
        matched = {
          id: groups.length,
          seedHue: h,
          pixels: [],
          partType: 'wing',
          quads3d: [],
          hullPts3d: [],
          hullNormal: [0, 1, 0]
        };
        groups.push(matched);
      }
      matched.pixels.push({ x, y, h, s: sPct / 100.0, v: vPct / 100.0 });
    }
  }

  return groups;
}

// 横向き平面図（画像X軸＝機体前後軸：左が機首・右が尾翼、画像Y軸＝機体左右軸Z）での5分類
// 垂直尾翼 / プロペラ / 胴体 / エンジン / 主翼・水平尾翼
export function classifyAircraftGroups(groups, imgW, imgH, pixelLength, pixelHeight) {
  const scaleX = pixelLength / Math.max(1, imgW);
  const scaleZ = pixelLength / Math.max(1, imgH);

  groups.forEach((grp) => {
    let minX = imgW, maxX = -1, minZ = imgH, maxZ = -1;
    let minV = 1.0, maxV = 0.0;
    for (const p of grp.pixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minZ) minZ = p.y;
      if (p.y > maxZ) maxZ = p.y;
      if (p.v < minV) minV = p.v;
      if (p.v > maxV) maxV = p.v;
    }
    grp.bounds2d = { minX, maxX, minZ, maxZ };
    grp.spanX = (maxX - minX + 1) * scaleX;
    grp.spanZ = (maxZ - minZ + 1) * scaleZ;
    grp.spanY = (maxV - minV) * pixelHeight;
    grp.minV = minV;
    grp.maxV = maxV;
    grp.centerZ = ((minZ + maxZ) / 2.0 - imgH / 2.0) * scaleZ;
    grp.partType = null;
  });

  // 1. 垂直尾翼: 左右幅 spanZ が極薄く、高さ変化 spanY が大きい縦板
  const thinZThresh = Math.max(2.2, pixelLength * 0.065);
  const tallYThresh = Math.max(2.2, pixelHeight * 0.22);
  for (const grp of groups) {
    if (grp.spanZ <= thinZThresh && grp.spanY >= tallYThresh && grp.spanY > grp.spanZ * 1.25) {
      grp.partType = 'vertical_stabilizer';
    }
  }

  // 2. プロペラ: 前後厚み spanX が極薄く（1〜2px程度）、左右 spanZ または上下 spanY に広がっている円盤/ブレード
  const thinXPropThresh = Math.max(2.0, pixelLength * 0.055);
  for (const grp of groups) {
    if (grp.partType !== null) continue;
    if (grp.spanX <= thinXPropThresh && (grp.spanZ >= grp.spanX * 1.35 || grp.spanY >= grp.spanX * 1.35)) {
      grp.partType = 'propeller';
    }
  }

  // 3. 胴体: 未分類のうち前後長 spanX が最も長く、機体中心線付近にある円筒形
  const fuselageCands = groups.filter(g => g.partType === null && g.spanX >= g.spanZ * 1.2);
  if (fuselageCands.length > 0) {
    fuselageCands.sort((a, b) => (b.spanX - a.spanX) || (Math.abs(a.centerZ) - Math.abs(b.centerZ)));
    fuselageCands[0].partType = 'fuselage';
  } else {
    const rest = groups.filter(g => g.partType === null);
    if (rest.length > 0) {
      rest.sort((a, b) => b.spanX - a.spanX);
      rest[0].partType = 'fuselage';
    }
  }

  // 4. エンジン vs 主翼・水平尾翼
  const fuselage = groups.find(g => g.partType === 'fuselage');
  const fuselageZ = fuselage ? fuselage.spanZ : pixelLength * 0.14;

  for (const grp of groups) {
    if (grp.partType !== null) continue;
    if (grp.spanX > grp.spanZ * 1.2 && grp.spanZ <= Math.max(fuselageZ * 1.35, pixelLength * 0.14)) {
      grp.partType = 'engine';
    } else {
      grp.partType = 'wing';
    }
  }
}

// 部品種別ごとの3D立体形状（胴体/エンジン=円筒丸み自動補完、その他=離散頂点ポリゴン）構築
export function buildGroup3DGeometry(groups, imgW, imgH, pixelLength, pixelHeight) {
  const scaleX = pixelLength / Math.max(1, imgW);
  const scaleZ = pixelLength / Math.max(1, imgH);
  const halfW = imgW / 2.0;
  const halfH = imgH / 2.0;

  for (const grp of groups) {
    if (grp.partType === 'fuselage' || grp.partType === 'engine') {
      grp.quads3d = buildHorizontalCylinderQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight);
    } else if (grp.partType === 'propeller') {
      grp.quads3d = buildPropellerQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight);
    } else {
      // 主翼・水平尾翼・垂直尾翼：離散頂点から3D頂点群と代表法線を構築（投影後に凸包で塗りつぶし）
      const pts3d = grp.pixels.map(p => [
        (p.x - halfW) * scaleX,
        p.v * pixelHeight,
        (p.y - halfH) * scaleZ
      ]);
      grp.hullPts3d = pts3d;
      grp.hullNormal = estimateGroupNormal(pts3d, grp.partType);
      grp.quads3d = [];
    }
  }
}

function estimateGroupNormal(pts3d, partType) {
  if (partType === 'vertical_stabilizer') {
    return [0, 0.25, 1.0];
  }
  if (pts3d.length < 3) return [0, 1, 0];

  let cx = 0, cy = 0, cz = 0;
  for (const [x, y, z] of pts3d) { cx += x; cy += y; cz += z; }
  cx /= pts3d.length; cy /= pts3d.length; cz /= pts3d.length;

  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts3d.length; i++) {
    const [x0, y0, z0] = pts3d[i];
    const [x1, y1, z1] = pts3d[(i + 1) % pts3d.length];
    const ax = x0 - cx, ay = y0 - cy, az = z0 - cz;
    const bx = x1 - cx, by = y1 - cy, bz = z1 - cz;
    nx += ay * bz - az * by;
    ny += az * bx - ax * bz;
    nz += ax * by - ay * bx;
  }

  const mag = Math.hypot(nx, ny, nz);
  if (mag < 1e-5) return [0, 1, 0];
  nx /= mag; ny /= mag; nz /= mag;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return [nx, ny, nz];
}

// 横向き円筒（胴体・エンジン）の丸み自動補完メッシュ（X軸方向にスライス分割＋円筒断面補間）
function buildHorizontalCylinderQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight) {
  const colMap = new Map();
  for (const p of grp.pixels) {
    if (!colMap.has(p.x)) colMap.set(p.x, { minZ: p.y, maxZ: p.y, maxV: p.v });
    const col = colMap.get(p.x);
    if (p.y < col.minZ) col.minZ = p.y;
    if (p.y > col.maxZ) col.maxZ = p.y;
    if (p.v > col.maxV) col.maxV = p.v;
  }

  const xs = Array.from(colMap.keys()).sort((a, b) => a - b);
  const rawSlices = xs.map(x => {
    const c = colMap.get(x);
    const zc = ((c.minZ + c.maxZ) / 2.0 - halfH) * scaleZ;
    const rad = Math.max(0.65, ((c.maxZ - c.minZ + 1) * scaleZ) / 2.0);
    const topY = c.maxV * pixelHeight;
    const axisY = Math.max(rad * 0.35, topY - rad);
    return { x: (x - halfW) * scaleX, zc, rad, axisY };
  });

  // 離散点しかない場合は X 方向に細分補間して滑らかな円筒にする
  const slices = [];
  if (rawSlices.length === 1) {
    const s = rawSlices[0];
    slices.push({ ...s, x: s.x - 0.5 * scaleX });
    slices.push({ ...s, x: s.x + 0.5 * scaleX });
  } else {
    for (let i = 0; i < rawSlices.length - 1; i++) {
      const s0 = rawSlices[i];
      const s1 = rawSlices[i + 1];
      const subSteps = Math.max(1, Math.min(8, Math.round(Math.abs(s1.x - s0.x) / Math.max(0.5, scaleX))));
      for (let st = 0; st < subSteps; st++) {
        const t = st / subSteps;
        slices.push({
          x: s0.x + (s1.x - s0.x) * t,
          zc: s0.zc + (s1.zc - s0.zc) * t,
          rad: s0.rad + (s1.rad - s0.rad) * t,
          axisY: s0.axisY + (s1.axisY - s0.axisY) * t
        });
      }
    }
    slices.push(rawSlices[rawSlices.length - 1]);
  }

  const quads = [];
  const arcSteps = 10;
  const angMin = (-135 * Math.PI) / 180;
  const angMax = (135 * Math.PI) / 180;

  for (let i = 0; i < slices.length - 1; i++) {
    const s0 = slices[i];
    const s1 = slices[i + 1];
    const dx = Math.max(0.1, s1.x - s0.x);

    for (let k = 0; k < arcSteps; k++) {
      const a0 = angMin + ((angMax - angMin) * k) / arcSteps;
      const a1 = angMin + ((angMax - angMin) * (k + 1)) / arcSteps;
      const aMid = (a0 + a1) / 2;

      const sin0 = Math.sin(a0), cos0 = Math.cos(a0);
      const sin1 = Math.sin(a1), cos1 = Math.cos(a1);
      const sinM = Math.sin(aMid), cosM = Math.cos(aMid);

      const p00 = [s0.x, s0.axisY + s0.rad * cos0, s0.zc + s0.rad * sin0];
      const p01 = [s0.x, s0.axisY + s0.rad * cos1, s0.zc + s0.rad * sin1];
      const p11 = [s1.x, s1.axisY + s1.rad * cos1, s1.zc + s1.rad * sin1];
      const p10 = [s1.x, s1.axisY + s1.rad * cos0, s1.zc + s1.rad * sin0];

      const rDiff = (s1.rad - s0.rad) / dx;
      const yDiff = (s1.axisY - s0.axisY) / dx;
      const nxSlope = -(rDiff + cosM * yDiff);

      quads.push({
        verts: [p00, p01, p11, p10],
        normal: [nxSlope, cosM, sinM]
      });
    }
  }
  return quads;
}

// プロペラ回転円盤メッシュ（Y-Z平面上の円盤＋厚み）
function buildPropellerQuads(grp, halfW, halfH, scaleX, scaleZ, pixelHeight) {
  const { minX, maxX, minZ, maxZ } = grp.bounds2d;
  const xc = ((minX + maxX) / 2.0 - halfW) * scaleX;
  const zc = ((minZ + maxZ) / 2.0 - halfH) * scaleZ;
  const radZ = Math.max(1.2, ((maxZ - minZ + 1) * scaleZ) / 2.0);
  const topY = grp.maxV * pixelHeight;
  const yc = grp.spanY > 1.0 ? ((grp.minV + grp.maxV) / 2.0) * pixelHeight : Math.max(radZ * 0.6, topY - radZ * 0.4);
  const radY = grp.spanY > 1.0 ? Math.max(radZ, grp.spanY / 2.0) : radZ;

  const quads = [];
  const segs = 12;
  const halfThick = Math.max(0.25, scaleX * 0.25);

  for (let k = 0; k < segs; k++) {
    const a0 = (k * 2 * Math.PI) / segs;
    const a1 = ((k + 1) * 2 * Math.PI) / segs;
    const y0 = yc + radY * Math.cos(a0);
    const z0 = zc + radZ * Math.sin(a0);
    const y1 = yc + radY * Math.cos(a1);
    const z1 = zc + radZ * Math.sin(a1);

    // 前面（-X方向）
    quads.push({
      verts: [[xc - halfThick, yc, zc], [xc - halfThick, y0, z0], [xc - halfThick, y1, z1], [xc - halfThick, yc, zc]],
      normal: [-1, 0.3, 0]
    });
    // 後面（+X方向）
    quads.push({
      verts: [[xc + halfThick, yc, zc], [xc + halfThick, y1, z1], [xc + halfThick, y0, z0], [xc + halfThick, yc, zc]],
      normal: [1, 0.3, 0]
    });
  }
  return quads;
}