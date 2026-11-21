// Simutrans 画像指定形式定義とエントリ生成・方向反転ユーティリティ

export const DIRS_8 = ['S', 'E', 'SE', 'SW', 'N', 'W', 'NW', 'NE'];
export const DIRS_4 = ['S', 'E', 'N', 'W'];

// way 形状ごとのまとまり順（直線 → カーブ → 終端 → T字分岐 → 十字 → 単独）
export const WAY_BASE_DIRS = [
  'NS', 'EW',
  'NE', 'SE', 'NW', 'SW',
  'N', 'S', 'E', 'W',
  'NSE', 'NSW', 'NEW', 'SEW',
  'NSEW', '-'
];

// Simutrans 102.2+ 分岐ポイント画像タイプ
export const WAY_POINT_DIRS = [
  'NSE1', 'NSW1', 'NEW1', 'SEW1', 'NSEW1',
  'NSE2', 'NSW2', 'NEW2', 'SEW2', 'NSEW2'
];

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
  { value: 'auto', label: '自動 (オブジェクト種別標準)', objTypes: null },
  { value: 'vehicle_empty_8', label: '車両: 8方向 EmptyImage のみ', objTypes: ['vehicle'] },
  { value: 'vehicle_empty_4', label: '車両: 4方向 EmptyImage のみ', objTypes: ['vehicle'] },
  { value: 'vehicle_freight', label: '車両: EmptyImage + FreightImage[dir] (全貨物共通)', objTypes: ['vehicle'] },
  { value: 'vehicle_freight_typed', label: '車両: EmptyImage + FreightImageType[0] + [0][dir]', objTypes: ['vehicle'] },
  { value: 'vehicle_otrp_reverse', label: '車両: OTRP Reverse.pak 対応 (Empty + Reverse)', objTypes: ['vehicle'] },
  { value: 'vehicle_otrp_reverse_only', label: '車両: OTRP Reverse.pak 単独 (Reverse のみ)', objTypes: ['vehicle'] },
  { value: 'vehicle_image_8', label: '車両/車: 8方向 Image[dir]', objTypes: ['vehicle', 'citycar'] },
  { value: 'building_back', label: '建物: BackImage のみ', objTypes: ['building', 'factory'] },
  { value: 'building_front', label: '建物: FrontImage のみ', objTypes: ['building', 'factory'] },
  { value: 'building_both', label: '建物: BackImage + FrontImage', objTypes: ['building', 'factory'] },
  { value: 'custom_template', label: 'カスタムテンプレート書式', objTypes: null }
];

// 指定したオブジェクト種別で使用可能な画像指定形式のみ返す
export function getImageFormatOptionsForObjType(objType) {
  return IMAGE_FORMAT_OPTIONS.filter(o => !o.objTypes || o.objTypes.includes(objType));
}

// セレクト要素の選択肢を対象オブジェクト種別に合わせて再構築する
export function populateImageFormatSelect(selectEl, objType, currentVal = 'auto') {
  if (!selectEl) return 'auto';
  const opts = getImageFormatOptionsForObjType(objType);
  selectEl.innerHTML = opts.map(o => `<option value="${o.value}" title="${o.label}">${o.label}</option>`).join('');
  const next = opts.some(o => o.value === currentVal) ? currentVal : 'auto';
  selectEl.value = next;
  selectEl.title = opts.find(o => o.value === next)?.label || '';
  return next;
}

function hasExternalSeason(v, s) {
  const ref = v?.seasonMasks && v.seasonMasks[String(s)];
  return Boolean(ref && ref !== '__self__');
}

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
      // 色違いマスク等で別ファイルを割り当てた季節は、その画像内の先頭(0段目)を使用する
      const rowSeason = hasExternalSeason(v, s) ? 0 : s;
      for (let a = 0; a < frames; a++) {
        for (let view = 0; view < views; view++) {
          // 奇数ビュー(90°/270°回転)では東西(W)と南北(H)のタイル数を入れ替える
          const viewW = (view % 2 === 1) ? dimsH : dimsW;
          const viewH = (view % 2 === 1) ? dimsW : dimsH;
          for (let y = 0; y < viewH; y++) {
            for (let x = 0; x < viewW; x++) {
              for (let h = 0; h < heightTiles; h++) {
                // 下段(h=0)が画像の下行になるよう逆順に割り当て
                const row = startRow + rowSeason * (heightTiles * frames) + a * heightTiles + (heightTiles - 1 - h);
                const col = startCol + view * (dimsW * dimsH) + y * viewW + x;
                entries.push({ key: `${layerPrefix}[${view}][${y}][${x}][${h}][${a}][${s}]`, row, col, season: s });
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
    WAY_BASE_DIRS.forEach((d, i) => entries.push({ key: `Image[${d}]`, row: startRow, col: startCol + i }));
    let nextRow = startRow + 1;
    if (v.includePoints) {
      WAY_POINT_DIRS.forEach((d, i) => entries.push({ key: `Image[${d}][0]`, row: nextRow, col: startCol + i }));
      nextRow += 1;
    }
    if (v.includeDiagonal !== false) {
      ['NE', 'SE', 'NW', 'SW'].forEach((d, i) => entries.push({ key: `Diagonal[${d}]`, row: nextRow, col: startCol + i }));
      nextRow += 1;
    }
    if (v.includeSlopes) {
      ['3', '6', '9', '12'].forEach((d, i) => entries.push({ key: `ImageUp[${d}]`, row: nextRow, col: startCol + i }));
      nextRow += 1;
    }
    if (v.includeSlopes2) {
      ['3', '6', '9', '12'].forEach((d, i) => entries.push({ key: `ImageUp2[${d}]`, row: nextRow, col: startCol + i }));
      nextRow += 1;
    }
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: nextRow, col: startCol });
      entries.push({ key: 'Icon', row: nextRow, col: startCol + 1, isIcon: true });
    }
  } else if (objType === 'way-object') {
    const dirs = ['NS', 'EW', 'NE', 'SE', 'NW', 'SW', 'N', 'S', 'E', 'W'];
    dirs.forEach((d, i) => entries.push({ key: `FrontImage[${d}]`, row: startRow, col: startCol + i }));
    let nextRow = startRow + 1;
    if (v.includeDiagonal !== false) {
      ['NE', 'SE', 'NW', 'SW'].forEach((d, i) => entries.push({ key: `Diagonal[${d}]`, row: nextRow, col: startCol + i }));
      nextRow += 1;
    }
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: nextRow, col: startCol });
      entries.push({ key: 'Icon', row: nextRow, col: startCol + 1, isIcon: true });
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
    const portalMode = v.tunnelPortalMode || 'single';
    let nextRow = startRow;
    if (portalMode !== 'wide_only') {
      DIRS_4.forEach((d, i) => entries.push({ key: `BackImage[${d}]`, row: nextRow, col: startCol + i }));
      DIRS_4.forEach((d, i) => entries.push({ key: `FrontImage[${d}]`, row: nextRow + 1, col: startCol + i }));
      nextRow += 2;
    }
    if (portalMode !== 'single') {
      const suffixes = portalMode === 'double' ? ['l', 'r'] : ['l', 'm', 'r'];
      const wideDirs = [];
      DIRS_4.forEach(d => suffixes.forEach(sf => wideDirs.push(`${d}${sf}`)));
      wideDirs.forEach((wd, i) => entries.push({ key: `BackImage[${wd}]`, row: nextRow, col: startCol + i }));
      wideDirs.forEach((wd, i) => entries.push({ key: `FrontImage[${wd}]`, row: nextRow + 1, col: startCol + i }));
      nextRow += 2;
    }
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: nextRow, col: startCol });
      entries.push({ key: 'Icon', row: nextRow, col: startCol + 1, isIcon: true });
    }
  } else if (objType === 'crossing') {
    entries.push({ key: 'openimage[NS][0]', row: startRow, col: startCol });
    entries.push({ key: 'openimage[EW][0]', row: startRow, col: startCol + 1 });
    entries.push({ key: 'closedimage[NS][0]', row: startRow + 1, col: startCol });
    entries.push({ key: 'closedimage[EW][0]', row: startRow + 1, col: startCol + 1 });
  } else if (objType === 'roadsign') {
    const count = Math.max(1, Math.min(64, parseInt(v.signalStates, 10) || 4));
    for (let i = 0; i < count; i++) {
      entries.push({ key: `Image[${i}]`, row: startRow, col: startCol + i });
    }
    let nextRow = startRow + 1;
    if (v.includeFrontImage) {
      for (let i = 0; i < count; i++) {
        entries.push({ key: `FrontImage[${i}]`, row: nextRow, col: startCol + i });
      }
      nextRow += 1;
    }
    const diagCount = Math.max(1, Math.min(128, parseInt(v.diagonalStates, 10) || (count * 2)));
    if (v.includeDiagonal) {
      for (let i = 0; i < diagCount; i++) {
        entries.push({ key: `Diagonal[${i}]`, row: nextRow, col: startCol + i });
      }
      nextRow += 1;
    }
    if (v.includeFrontDiagonal) {
      for (let i = 0; i < diagCount; i++) {
        entries.push({ key: `FrontDiagonal[${i}]`, row: nextRow, col: startCol + i });
      }
      nextRow += 1;
    }
    if (v.includeCursorIcon) {
      entries.push({ key: 'Cursor', row: nextRow, col: startCol });
      entries.push({ key: 'Icon', row: nextRow, col: startCol + 1, isIcon: true });
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

  const rawFormat = c.imageFormat && c.imageFormat !== 'auto' ? c.imageFormat : null;
  const allowedOpts = getImageFormatOptionsForObjType(objType);
  const format = (rawFormat && allowedOpts.some(o => o.value === rawFormat)) ? rawFormat : null;
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
    const typeList = freightName.split(',').map(s => s.trim()).filter(Boolean);
    (typeList.length ? typeList : ['Passagiere']).forEach((tName, tIdx) => {
      entries.push({ metaLine: `FreightImageType[${tIdx}]=${tName}` });
      entries.push(...buildDirectionalSlots(`FreightImage[${tIdx}]`, DIRS_8, fRow + tIdx, startCol, flipBase));
    });
  } else if (format === 'vehicle_otrp_reverse') {
    // OTRP Reverse指定時は通常のFreightImageと同時設定不可のため、Reverse専用として展開する
    entries = buildDirectionalSlots('EmptyImage', DIRS_8, startRow, startCol, flipBase);
    let idx = 0;
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
  } else if (format === 'vehicle_otrp_reverse_only') {
    entries = [];
    entries.push({ metaLine: 'FreightImageType[0]=Reverse' });
    entries.push(...buildDirectionalSlots('FreightImage[0]', DIRS_8, revRow, startCol, actualRevFlip));
    if (v.includeNoElectric) {
      const noElRow = parseOptionalRow(v.noElectricRow, startRow);
      entries.push({ metaLine: 'FreightImageType[1]=Reverse_No_Electric' });
      entries.push(...buildDirectionalSlots('FreightImage[1]', DIRS_8, revMode === 'same_row' ? noElRow : revRow, startCol, actualRevFlip));
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
        const colSeason = hasExternalSeason(v, s) ? 0 : s;
        entries.push({ key: `Image[${age}][${s}]`, row: startRow + age, col: startCol + colSeason, season: s });
      }
    }
  } else if (objType === 'groundobj' || objType === 'field') {
    const seasons = Math.max(1, parseInt(v.seasons, 10) || 1);
    const total = objType === 'field' ? seasons + (v.has_snow ? 1 : 0) : seasons;
    for (let s = 0; s < total; s++) {
      const colSeason = hasExternalSeason(v, s) ? 0 : s;
      const key = objType === 'field' ? `Image[${s}]` : `Image[0][${s}]`;
      entries.push({ key, row: startRow, col: startCol + colSeason, season: s });
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
