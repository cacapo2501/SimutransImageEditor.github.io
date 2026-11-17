// Simutrans 画像指定形式定義とエントリ生成・方向反転ユーティリティ

export const DIRS_8 = ['S', 'E', 'SE', 'SW', 'N', 'W', 'NW', 'NE'];
export const DIRS_4 = ['S', 'E', 'N', 'W'];

export const DIR_180_MAP = {
  S: 'N',
  N: 'S',
  E: 'W',
  W: 'E',
  SE: 'NW',
  NW: 'SE',
  SW: 'NE',
  NE: 'SW'
};

export const IMAGE_FORMAT_OPTIONS = [
  { value: 'auto', label: '自動 (オブジェクト種別標準)' },
  { value: 'vehicle_empty_8', label: '車両: 8方向 EmptyImage' },
  { value: 'vehicle_empty_4', label: '車両: 4方向 EmptyImage' },
  { value: 'vehicle_freight', label: '車両: 空荷 + FreightImage[dir]' },
  { value: 'vehicle_freight_typed', label: '車両: 空荷 + FreightImageType[0] + [0][dir]' },
  { value: 'vehicle_otrp_reverse', label: '車両: OTRP逆転対応 (Empty + Reverse)' },
  { value: 'vehicle_image_8', label: '車両/車: 8方向 Image[dir]' },
  { value: 'building_back', label: '建物: BackImage のみ' },
  { value: 'building_front', label: '建物: FrontImage のみ' },
  { value: 'building_both', label: '建物: BackImage + FrontImage' },
  { value: 'custom_template', label: 'カスタムテンプレート書式' }
];

function buildBuildingEntries(objType, v, startRow, startCol, forcedLayer = null) {
  const entries = [];
  const dimsW = Math.max(1, parseInt(v.dimsW, 10) || 1);
  const dimsH = Math.max(1, parseInt(v.dimsH, 10) || 1);
  const views = Math.max(1, parseInt(v.dimsViews, 10) || 1);
  const heightTiles = Math.max(1, parseInt(v.heightTiles, 10) || 1);
  const frames = objType === 'factory' ? 1 : Math.max(1, parseInt(v.frames, 10) || 1);
  const seasons = Math.max(1, parseInt(v.seasons, 10) || 1);
  const layerMode = forcedLayer || (objType === 'factory' ? 'back' : (v.imageLayer || 'back'));

  const pushLayer = (layerPrefix) => {
    for (let s = 0; s < seasons; s++) {
      for (let a = 0; a < frames; a++) {
        for (let view = 0; view < views; view++) {
          for (let y = 0; y < dimsH; y++) {
            for (let x = 0; x < dimsW; x++) {
              for (let h = 0; h < heightTiles; h++) {
                // 下段(h=0)が画像の下行になるよう逆順に割り当て
                const row = startRow + s * (heightTiles * frames) + a * heightTiles + (heightTiles - 1 - h);
                const col = startCol + view * (dimsW * dimsH) + y * dimsW + x;
                entries.push({ key: `${layerPrefix}[${view}][${y}][${x}][${h}][${a}][${s}]`, row, col });
              }
            }
          }
        }
      }
    }
  };

  if (layerMode === 'back' || layerMode === 'both') pushLayer('BackImage');
  if (layerMode === 'front' || layerMode === 'both') pushLayer('FrontImage');
  return entries;
}

function buildInfraEntries(objType, v, startRow, startCol) {
  const entries = [];
  if (objType === 'way') {
    const dirs = ['-', 'N', 'S', 'NS', 'E', 'NE', 'SE', 'NSE', 'W', 'NW', 'SW', 'NSW', 'EW', 'NEW', 'SEW', 'NSEW'];
    dirs.forEach((d, i) => entries.push({ key: `Image[${d}]`, row: startRow, col: startCol + i }));
    if (v.includeDiagonal) {
      ['NE', 'SE', 'NW', 'SW'].forEach((d, i) => entries.push({ key: `Diagonal[${d}]`, row: startRow + 1, col: startCol + i }));
    }
    if (v.includeSlopes) {
      ['3', '6', '9', '12'].forEach((d, i) => entries.push({ key: `ImageUp[${d}]`, row: startRow + 2, col: startCol + i }));
    }
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: startRow + 3, col: startCol });
      entries.push({ key: 'Icon', row: startRow + 3, col: startCol + 1, isIcon: true });
    }
  } else if (objType === 'way-object') {
    const dirs = ['NS', 'EW', 'NE', 'SE', 'NW', 'SW', 'N', 'S', 'E', 'W'];
    dirs.forEach((d, i) => entries.push({ key: `FrontImage[${d}]`, row: startRow, col: startCol + i }));
    ['NE', 'SE', 'NW', 'SW'].forEach((d, i) => entries.push({ key: `Diagonal[${d}]`, row: startRow + 1, col: startCol + i }));
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: startRow + 2, col: startCol });
      entries.push({ key: 'Icon', row: startRow + 2, col: startCol + 1, isIcon: true });
    }
  } else if (objType === 'bridge') {
    entries.push({ key: 'BackImage[NS]', row: startRow, col: startCol });
    entries.push({ key: 'BackImage[EW]', row: startRow, col: startCol + 1 });
    ['N', 'S', 'E', 'W'].forEach((d, i) => entries.push({ key: `BackStart[${d}]`, row: startRow + 1, col: startCol + i }));
    ['N', 'S', 'E', 'W'].forEach((d, i) => entries.push({ key: `BackRamp[${d}]`, row: startRow + 2, col: startCol + i }));
    entries.push({ key: 'BackPillar[S]', row: startRow + 3, col: startCol });
    entries.push({ key: 'BackPillar[W]', row: startRow + 3, col: startCol + 1 });
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: startRow + 3, col: startCol + 2 });
      entries.push({ key: 'Icon', row: startRow + 3, col: startCol + 3, isIcon: true });
    }
  } else if (objType === 'tunnel') {
    DIRS_4.forEach((d, i) => entries.push({ key: `BackImage[${d}]`, row: startRow, col: startCol + i }));
    DIRS_4.forEach((d, i) => entries.push({ key: `FrontImage[${d}]`, row: startRow + 1, col: startCol + i }));
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: startRow + 2, col: startCol });
      entries.push({ key: 'Icon', row: startRow + 2, col: startCol + 1, isIcon: true });
    }
  } else if (objType === 'crossing') {
    entries.push({ key: 'openimage[NS][0]', row: startRow, col: startCol });
    entries.push({ key: 'openimage[EW][0]', row: startRow, col: startCol + 1 });
    entries.push({ key: 'closedimage[NS][0]', row: startRow + 1, col: startCol });
    entries.push({ key: 'closedimage[EW][0]', row: startRow + 1, col: startCol + 1 });
  } else if (objType === 'roadsign') {
    const count = Math.max(1, Math.min(32, parseInt(v.signalStates, 10) || 4));
    for (let i = 0; i < count; i++) {
      entries.push({ key: `Image[${i}]`, row: startRow, col: startCol + i });
    }
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: startRow + 1, col: startCol });
      entries.push({ key: 'Icon', row: startRow + 1, col: startCol + 1, isIcon: true });
    }
  }
  return entries;
}

function buildDirectionalSlots(prefixKey, dirs, row, startCol, flip180 = false) {
  return dirs.map((d, i) => {
    const colDir = flip180 ? (DIR_180_MAP[d] || d) : d;
    const colIdx = dirs.indexOf(colDir);
    const col = startCol + (colIdx >= 0 ? colIdx : i);
    return { key: `${prefixKey}[${d}]`, row, col };
  });
}

function parseOptionalRow(rawVal, fallback) {
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') return fallback;
  const n = parseInt(rawVal, 10);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// 選択中の画像指定形式からメタ行と画像エントリ一覧を構築する
export function buildFormattedImages(objType, values, common) {
  const v = values || {};
  const c = common || {};
  if (objType === 'good') return { metaLines: [], entries: [] };

  const format = c.imageFormat && c.imageFormat !== 'auto' ? c.imageFormat : null;
  const startRow = Math.max(0, parseInt(c.startRow, 10) || 0);
  const startCol = Math.max(0, parseInt(c.startCol, 10) || 0);
  const flipBase = Boolean(c.flipDirections);
  const fRow = parseOptionalRow(v.freightRow, startRow + 1);
  const freightName = String(v.freightTypeName || v.freight || 'Passagiere').trim() || 'Passagiere';

  // OTRP 反転行と向き反転の解決
  const revMode = v.reverseRowMode || 'same_row';
  let revRow = startRow;
  let revFlip = true;
  if (revMode === 'next_row') {
    revRow = startRow + 1;
    revFlip = Boolean(v.reverseFlipDir);
  } else if (revMode === 'custom_row') {
    revRow = parseOptionalRow(v.reverseRow, startRow);
    revFlip = Boolean(v.reverseFlipDir);
  }
  const actualRevFlip = flipBase ? !revFlip : revFlip;

  let entries = [];

  if (format === 'custom_template') {
    const tplRaw = String(c.customImgFormat || 'EmptyImage[{dir}][0]={prefix}.{row}.{col}{offset}');
    const tplLines = tplRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    DIRS_8.forEach((d, i) => {
      const colDir = flipBase ? (DIR_180_MAP[d] || d) : d;
      const colIdx = DIRS_8.indexOf(colDir);
      const col = startCol + (colIdx >= 0 ? colIdx : i);
      tplLines.forEach((line) => {
        const eqIdx = line.indexOf('=');
        const keyTpl = eqIdx >= 0 ? line.slice(0, eqIdx).trim() : `Image[${d}]`;
        const valTpl = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : line;
        const key = keyTpl.replace(/\{dir\}/gi, d);
        entries.push({ key, row: startRow, col, customValTpl: valTpl, dir: d });
      });
    });
  } else if (format === 'vehicle_empty_8' || (!format && objType === 'vehicle' && String(v.directions) !== '4' && !v.hasFreightImage)) {
    entries = buildDirectionalSlots('EmptyImage', DIRS_8, startRow, startCol, flipBase);
  } else if (format === 'vehicle_empty_4' || (!format && objType === 'vehicle' && String(v.directions) === '4' && !v.hasFreightImage)) {
    entries = buildDirectionalSlots('EmptyImage', DIRS_4, startRow, startCol, flipBase);
  } else if (format === 'vehicle_freight' || (!format && objType === 'vehicle' && v.hasFreightImage)) {
    const dirs = String(v.directions) === '4' ? DIRS_4 : DIRS_8;
    entries = [
      ...buildDirectionalSlots('EmptyImage', dirs, startRow, startCol, flipBase),
      ...buildDirectionalSlots('FreightImage', dirs, fRow, startCol, flipBase)
    ];
  } else if (format === 'vehicle_freight_typed') {
    entries = buildDirectionalSlots('EmptyImage', DIRS_8, startRow, startCol, flipBase);
    entries.push({ metaLine: `FreightImageType[0]=${freightName}` });
    entries.push(...buildDirectionalSlots('FreightImage[0]', DIRS_8, fRow, startCol, flipBase));
  } else if (format === 'vehicle_otrp_reverse') {
    entries = buildDirectionalSlots('EmptyImage', DIRS_8, startRow, startCol, flipBase);
    let idx = 0;
    if (v.hasFreightImage) {
      entries.push({ metaLine: `FreightImageType[${idx}]=${freightName}` });
      entries.push(...buildDirectionalSlots(`FreightImage[${idx}]`, DIRS_8, fRow, startCol, flipBase));
      idx++;
    }
    entries.push({ metaLine: `FreightImageType[${idx}]=Reverse` });
    entries.push(...buildDirectionalSlots(`FreightImage[${idx}]`, DIRS_8, revRow, startCol, actualRevFlip));
    idx++;
    if (v.includeNoElectric) {
      const noElRow = parseOptionalRow(v.noElectricRow, startRow);
      entries.push({ metaLine: `FreightImageType[${idx}]=No_Electric` });
      entries.push(...buildDirectionalSlots(`FreightImage[${idx}]`, DIRS_8, noElRow, startCol, flipBase));
      idx++;
      entries.push({ metaLine: `FreightImageType[${idx}]=Reverse_No_Electric` });
      entries.push(...buildDirectionalSlots(`FreightImage[${idx}]`, DIRS_8, revMode === 'same_row' ? noElRow : revRow, startCol, actualRevFlip));
    }
  } else if (format === 'vehicle_image_8' || (!format && objType === 'citycar')) {
    entries = buildDirectionalSlots('Image', DIRS_8, startRow, startCol, flipBase);
  } else if (format === 'building_back' || format === 'building_front' || format === 'building_both') {
    const layer = format.replace('building_', '');
    entries = buildBuildingEntries(objType, v, startRow, startCol, layer);
  } else if (objType === 'building' || objType === 'factory') {
    entries = buildBuildingEntries(objType, v, startRow, startCol);
  } else if (objType === 'tree') {
    const ages = Math.max(1, parseInt(v.ageCount, 10) || 5);
    const seasons = Math.max(1, parseInt(v.seasons, 10) || 4);
    for (let age = 0; age < ages; age++) {
      for (let s = 0; s < seasons; s++) {
        entries.push({ key: `Image[${age}][${s}]`, row: startRow + age, col: startCol + s });
      }
    }
  } else if (objType === 'groundobj') {
    const seasons = Math.max(1, parseInt(v.seasons, 10) || 1);
    for (let s = 0; s < seasons; s++) {
      entries.push({ key: `Image[0][${s}]`, row: startRow, col: startCol + s });
    }
  } else {
    entries = buildInfraEntries(objType, v, startRow, startCol);
  }

  const custom = c.customImageCoords || null;
  const finalEntries = custom
    ? entries.map(e => (!e.metaLine && custom[e.key] ? { ...e, row: custom[e.key].row, col: custom[e.key].col } : e))
    : entries;

  return {
    metaLines: [],
    entries: finalEntries
  };
}

// customImageCoords 内の方向キー [S]〜[NE] を 180度反対方向へスワップする
export function flipCustomImageCoords180(customCoords) {
  if (!customCoords) return null;
  const flipped = {};
  Object.entries(customCoords).forEach(([key, coord]) => {
    const m = key.match(/^(.+?)\[(S|N|E|W|SE|NW|SW|NE)\](.*)$/);
    if (m) {
      const opp = DIR_180_MAP[m[2]] || m[2];
      flipped[`${m[1]}[${opp}]${m[3]}`] = { ...coord };
    } else {
      flipped[key] = { ...coord };
    }
  });
  return flipped;
}
