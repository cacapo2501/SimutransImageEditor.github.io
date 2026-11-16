// Simutrans makeobj 用 dat テキスト生成シリアライザ

function pushIfPresent(lines, key, val) {
  if (val === undefined || val === null) return;
  const s = String(val).trim();
  if (s !== '') lines.push(`${key}=${s}`);
}

function pushFlagIfTrue(lines, key, val) {
  if (val === true || val === '1' || val === 1) {
    lines.push(`${key}=1`);
  }
}

function normalizeOffset(rawOffset) {
  const s = String(rawOffset || '').trim();
  if (!s) return '';
  return s.startsWith(',') ? s : `,${s}`;
}

function imgRef(prefix, row, col, offsetStr) {
  return `${prefix}.${row}.${col}${offsetStr}`;
}

function serializeBuildingOrFactoryImages(lines, objType, v, prefix, startRow, startCol, offsetStr) {
  const dimsW = Math.max(1, parseInt(v.dimsW, 10) || 1);
  const dimsH = Math.max(1, parseInt(v.dimsH, 10) || 1);
  const views = Math.max(1, parseInt(v.dimsViews, 10) || 1);
  const heightTiles = Math.max(1, parseInt(v.heightTiles, 10) || 1);
  const frames = objType === 'factory' ? 1 : Math.max(1, parseInt(v.frames, 10) || 1);
  const seasons = Math.max(1, parseInt(v.seasons, 10) || 1);
  const layerMode = objType === 'factory' ? 'back' : (v.imageLayer || 'back');

  const writeLayer = (layerPrefix) => {
    for (let s = 0; s < seasons; s++) {
      for (let a = 0; a < frames; a++) {
        for (let view = 0; view < views; view++) {
          for (let y = 0; y < dimsH; y++) {
            for (let x = 0; x < dimsW; x++) {
              for (let h = 0; h < heightTiles; h++) {
                // 下段(h=0)が画像の下行になるよう逆順に割り当て
                const row = startRow + s * (heightTiles * frames) + a * heightTiles + (heightTiles - 1 - h);
                const col = startCol + view * (dimsW * dimsH) + y * dimsW + x;
                lines.push(`${layerPrefix}[${view}][${y}][${x}][${h}][${a}][${s}]=${imgRef(prefix, row, col, offsetStr)}`);
              }
            }
          }
        }
      }
    }
  };

  if (layerMode === 'back' || layerMode === 'both') writeLayer('BackImage');
  if (layerMode === 'front' || layerMode === 'both') writeLayer('FrontImage');
}

function serializeInfraImages(lines, objType, v, prefix, startRow, startCol, offsetStr) {
  if (objType === 'way') {
    const dirs = ['-', 'N', 'S', 'NS', 'E', 'NE', 'SE', 'NSE', 'W', 'NW', 'SW', 'NSW', 'EW', 'NEW', 'SEW', 'NSEW'];
    dirs.forEach((d, i) => lines.push(`Image[${d}]=${imgRef(prefix, startRow, startCol + i, offsetStr)}`));
    if (v.includeDiagonal) {
      ['NE', 'SE', 'NW', 'SW'].forEach((d, i) => lines.push(`Diagonal[${d}]=${imgRef(prefix, startRow + 1, startCol + i, offsetStr)}`));
    }
    if (v.includeSlopes) {
      ['3', '6', '9', '12'].forEach((d, i) => lines.push(`ImageUp[${d}]=${imgRef(prefix, startRow + 2, startCol + i, offsetStr)}`));
    }
    if (v.includeCursorIcon) {
      lines.push(`Cursor=${imgRef(prefix, startRow + 3, startCol, offsetStr)}`);
      lines.push(`Icon=> ${prefix}.${startRow + 3}.${startCol + 1}`);
    }
  } else if (objType === 'way-object') {
    const dirs = ['NS', 'EW', 'NE', 'SE', 'NW', 'SW', 'N', 'S', 'E', 'W'];
    dirs.forEach((d, i) => lines.push(`FrontImage[${d}]=${imgRef(prefix, startRow, startCol + i, offsetStr)}`));
    ['NE', 'SE', 'NW', 'SW'].forEach((d, i) => lines.push(`Diagonal[${d}]=${imgRef(prefix, startRow + 1, startCol + i, offsetStr)}`));
    if (v.includeCursorIcon) {
      lines.push(`Cursor=${imgRef(prefix, startRow + 2, startCol, offsetStr)}`);
      lines.push(`Icon=> ${prefix}.${startRow + 2}.${startCol + 1}`);
    }
  } else if (objType === 'bridge') {
    lines.push(`BackImage[NS]=${imgRef(prefix, startRow, startCol, offsetStr)}`);
    lines.push(`BackImage[EW]=${imgRef(prefix, startRow, startCol + 1, offsetStr)}`);
    ['N', 'S', 'E', 'W'].forEach((d, i) => lines.push(`BackStart[${d}]=${imgRef(prefix, startRow + 1, startCol + i, offsetStr)}`));
    ['N', 'S', 'E', 'W'].forEach((d, i) => lines.push(`BackRamp[${d}]=${imgRef(prefix, startRow + 2, startCol + i, offsetStr)}`));
    lines.push(`BackPillar[S]=${imgRef(prefix, startRow + 3, startCol, offsetStr)}`);
    lines.push(`BackPillar[W]=${imgRef(prefix, startRow + 3, startCol + 1, offsetStr)}`);
    if (v.includeCursorIcon) {
      lines.push(`Cursor=${imgRef(prefix, startRow + 3, startCol + 2, offsetStr)}`);
      lines.push(`Icon=> ${prefix}.${startRow + 3}.${startCol + 3}`);
    }
  } else if (objType === 'tunnel') {
    ['N', 'S', 'E', 'W'].forEach((d, i) => lines.push(`BackImage[${d}]=${imgRef(prefix, startRow, startCol + i, offsetStr)}`));
    ['N', 'S', 'E', 'W'].forEach((d, i) => lines.push(`FrontImage[${d}]=${imgRef(prefix, startRow + 1, startCol + i, offsetStr)}`));
    if (v.includeCursorIcon) {
      lines.push(`Cursor=${imgRef(prefix, startRow + 2, startCol, offsetStr)}`);
      lines.push(`Icon=> ${prefix}.${startRow + 2}.${startCol + 1}`);
    }
  } else if (objType === 'crossing') {
    lines.push(`openimage[NS][0]=${imgRef(prefix, startRow, startCol, offsetStr)}`);
    lines.push(`openimage[EW][0]=${imgRef(prefix, startRow, startCol + 1, offsetStr)}`);
    lines.push(`closedimage[NS][0]=${imgRef(prefix, startRow + 1, startCol, offsetStr)}`);
    lines.push(`closedimage[EW][0]=${imgRef(prefix, startRow + 1, startCol + 1, offsetStr)}`);
  } else if (objType === 'roadsign') {
    const count = Math.max(1, Math.min(32, parseInt(v.signalStates, 10) || 4));
    for (let i = 0; i < count; i++) {
      lines.push(`Image[${i}]=${imgRef(prefix, startRow, startCol + i, offsetStr)}`);
    }
    if (v.includeCursorIcon) {
      lines.push(`Cursor=${imgRef(prefix, startRow + 1, startCol, offsetStr)}`);
      lines.push(`Icon=> ${prefix}.${startRow + 1}.${startCol + 1}`);
    }
  }
}

function serializeImages(lines, objType, v, common) {
  if (!common.includeImages) return;
  const prefix = String(common.imgPrefix || '').trim();
  if (!prefix || objType === 'good') return;

  const startRow = Math.max(0, parseInt(common.startRow, 10) || 0);
  const startCol = Math.max(0, parseInt(common.startCol, 10) || 0);
  const offsetStr = normalizeOffset(common.imgOffset);

  if (objType === 'building' || objType === 'factory') {
    serializeBuildingOrFactoryImages(lines, objType, v, prefix, startRow, startCol, offsetStr);
    return;
  }

  if (objType === 'vehicle') {
    const dirs = String(v.directions) === '4'
      ? ['S', 'E', 'N', 'W']
      : ['S', 'E', 'SE', 'SW', 'N', 'W', 'NW', 'NE'];
    dirs.forEach((d, i) => lines.push(`EmptyImage[${d}]=${imgRef(prefix, startRow, startCol + i, offsetStr)}`));
    if (v.hasFreightImage) {
      const fRow = Math.max(0, parseInt(v.freightRow, 10) || 1);
      dirs.forEach((d, i) => lines.push(`FreightImage[${d}]=${imgRef(prefix, fRow, startCol + i, offsetStr)}`));
    }
    return;
  }

  if (objType === 'citycar') {
    const dirs = ['S', 'E', 'SE', 'SW', 'N', 'W', 'NW', 'NE'];
    dirs.forEach((d, i) => lines.push(`Image[${d}]=${imgRef(prefix, startRow, startCol + i, offsetStr)}`));
    return;
  }

  if (objType === 'tree') {
    const ages = Math.max(1, parseInt(v.ageCount, 10) || 5);
    const seasons = Math.max(1, parseInt(v.seasons, 10) || 4);
    for (let age = 0; age < ages; age++) {
      for (let s = 0; s < seasons; s++) {
        lines.push(`Image[${age}][${s}]=${imgRef(prefix, startRow + age, startCol + s, offsetStr)}`);
      }
    }
    return;
  }

  if (objType === 'groundobj') {
    const seasons = Math.max(1, parseInt(v.seasons, 10) || 1);
    for (let s = 0; s < seasons; s++) {
      lines.push(`Image[0][${s}]=${imgRef(prefix, startRow, startCol + s, offsetStr)}`);
    }
    return;
  }

  serializeInfraImages(lines, objType, v, prefix, startRow, startCol, offsetStr);
}

// フォーム状態から Simutrans dat テキストを生成する
export function serializeDatObject(objType, values, common) {
  const v = values || {};
  const lines = [];

  lines.push(`obj=${objType}`);
  pushIfPresent(lines, 'name', common.name);
  pushIfPresent(lines, 'copyright', common.copyright);

  if (objType === 'building') {
    pushIfPresent(lines, 'type', v.type);
    lines.push(`dims=${Math.max(1, parseInt(v.dimsW, 10) || 1)},${Math.max(1, parseInt(v.dimsH, 10) || 1)},${Math.max(1, parseInt(v.dimsViews, 10) || 1)}`);
    pushIfPresent(lines, 'level', v.level);
    pushIfPresent(lines, 'chance', v.chance);
    pushIfPresent(lines, 'waytype', v.waytype);
    pushIfPresent(lines, 'capacity', v.capacity);
    pushIfPresent(lines, 'cost', v.cost);
    pushIfPresent(lines, 'maintenance', v.maintenance);
    pushIfPresent(lines, 'allow_underground', v.allow_underground);
    if (parseInt(v.frames, 10) > 1) pushIfPresent(lines, 'animation_time', v.animation_time);
    pushFlagIfTrue(lines, 'needs_ground', v.needs_ground);
    pushFlagIfTrue(lines, 'noinfo', v.noinfo);
    pushFlagIfTrue(lines, 'noconstruction', v.noconstruction);
    pushFlagIfTrue(lines, 'enables_pax', v.enables_pax);
    pushFlagIfTrue(lines, 'enables_post', v.enables_post);
    pushFlagIfTrue(lines, 'enables_ware', v.enables_ware);
  } else if (objType === 'vehicle') {
    pushIfPresent(lines, 'waytype', v.waytype);
    pushIfPresent(lines, 'engine_type', v.engine_type);
    pushIfPresent(lines, 'speed', v.speed);
    pushIfPresent(lines, 'power', v.power);
    pushIfPresent(lines, 'gear', v.gear);
    pushIfPresent(lines, 'weight', v.weight);
    pushIfPresent(lines, 'axle_load', v.axle_load);
    pushIfPresent(lines, 'length', v.length);
    pushIfPresent(lines, 'cost', v.cost);
    pushIfPresent(lines, 'runningcost', v.runningcost);
    pushIfPresent(lines, 'freight', v.freight);
    pushIfPresent(lines, 'payload', v.payload);
    pushIfPresent(lines, 'loading_time', v.loading_time);
    pushIfPresent(lines, 'smoke', v.smoke);
    pushIfPresent(lines, 'sound', v.sound);
  } else if (objType === 'citycar') {
    pushIfPresent(lines, 'DistributionWeight', v.DistributionWeight);
    pushIfPresent(lines, 'speed', v.speed);
  } else if (objType === 'way' || objType === 'way-object' || objType === 'bridge' || objType === 'tunnel') {
    pushIfPresent(lines, 'waytype', v.waytype);
    if (objType === 'way') pushIfPresent(lines, 'system_type', v.system_type);
    if (objType === 'way-object') pushIfPresent(lines, 'own_waytype', v.own_waytype);
    pushIfPresent(lines, 'topspeed', v.topspeed);
    if (objType !== 'way-object') pushIfPresent(lines, 'max_weight', v.max_weight);
    if (objType === 'bridge') {
      pushIfPresent(lines, 'max_length', v.max_length);
      pushIfPresent(lines, 'max_height', v.max_height);
      pushIfPresent(lines, 'pillars_every', v.pillars_every);
    }
    pushIfPresent(lines, 'cost', v.cost);
    pushIfPresent(lines, 'maintenance', v.maintenance);
    if (objType === 'tunnel') pushFlagIfTrue(lines, 'way_is_clipped', v.way_is_clipped);
  } else if (objType === 'crossing') {
    pushIfPresent(lines, 'waytype[0]', v.waytype0);
    pushIfPresent(lines, 'waytype[1]', v.waytype1);
    pushIfPresent(lines, 'speed[0]', v.speed0);
    pushIfPresent(lines, 'speed[1]', v.speed1);
    pushIfPresent(lines, 'animation_time_open', v.animation_time_open);
    pushIfPresent(lines, 'animation_time_closed', v.animation_time_closed);
    pushIfPresent(lines, 'sound', v.sound);
  } else if (objType === 'roadsign') {
    pushIfPresent(lines, 'waytype', v.waytype);
    pushIfPresent(lines, 'cost', v.cost);
    pushIfPresent(lines, 'maintenance', v.maintenance);
    pushIfPresent(lines, 'min_speed', v.min_speed);
    pushFlagIfTrue(lines, 'is_signal', v.is_signal);
    pushFlagIfTrue(lines, 'is_presignal', v.is_presignal);
    pushFlagIfTrue(lines, 'is_longblocksignal', v.is_longblocksignal);
    pushFlagIfTrue(lines, 'is_prioritysignal', v.is_prioritysignal);
    pushFlagIfTrue(lines, 'is_choose_signal', v.is_choose_signal);
    pushFlagIfTrue(lines, 'single_way', v.single_way);
  } else if (objType === 'tree') {
    pushIfPresent(lines, 'DistributionWeight', v.DistributionWeight);
    pushIfPresent(lines, 'seasons', v.seasons);
  } else if (objType === 'groundobj') {
    pushIfPresent(lines, 'DistributionWeight', v.DistributionWeight);
    pushIfPresent(lines, 'cost', v.cost);
    pushIfPresent(lines, 'seasons', v.seasons);
    pushIfPresent(lines, 'waytype', v.waytype);
    pushFlagIfTrue(lines, 'trees_on_top', v.trees_on_top);
  } else if (objType === 'factory') {
    pushIfPresent(lines, 'Location', v.Location);
    pushIfPresent(lines, 'DistributionWeight', v.DistributionWeight);
    pushIfPresent(lines, 'Productivity', v.Productivity);
    pushIfPresent(lines, 'Range', v.Range);
    pushIfPresent(lines, 'pax_level', v.pax_level);
    pushIfPresent(lines, 'MapColor', v.MapColor);
    lines.push(`dims=${Math.max(1, parseInt(v.dimsW, 10) || 1)},${Math.max(1, parseInt(v.dimsH, 10) || 1)},${Math.max(1, parseInt(v.dimsViews, 10) || 1)}`);
    pushIfPresent(lines, 'InputGood[0]', v.inputGood0);
    pushIfPresent(lines, 'InputCapacity[0]', v.inputCapacity0);
    pushIfPresent(lines, 'InputFactor[0]', v.inputFactor0);
    pushIfPresent(lines, 'OutputGood[0]', v.outputGood0);
    pushIfPresent(lines, 'OutputCapacity[0]', v.outputCapacity0);
    pushIfPresent(lines, 'OutputFactor[0]', v.outputFactor0);
  } else if (objType === 'good') {
    pushIfPresent(lines, 'metric', v.metric);
    pushIfPresent(lines, 'catg', v.catg);
    pushIfPresent(lines, 'value', v.value);
    pushIfPresent(lines, 'weight_per_unit', v.weight_per_unit);
    pushIfPresent(lines, 'speed_bonus', v.speed_bonus);
    pushIfPresent(lines, 'color', v.color);
  }

  // 登場・引退年月
  pushIfPresent(lines, 'intro_year', v.intro_year);
  pushIfPresent(lines, 'intro_month', v.intro_month);
  pushIfPresent(lines, 'retire_year', v.retire_year);
  pushIfPresent(lines, 'retire_month', v.retire_month);

  // 気候
  if (Array.isArray(v.climates) && v.climates.length > 0) {
    lines.push(`climates=${v.climates.join(',')}`);
  }

  // 車両連結制約
  if (objType === 'vehicle') {
    const prevList = String(v.constraintsPrev || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    prevList.forEach((item, idx) => lines.push(`constraint[prev][${idx}]=${item}`));
    const nextList = String(v.constraintsNext || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    nextList.forEach((item, idx) => lines.push(`constraint[next][${idx}]=${item}`));
  }

  // 画像行
  serializeImages(lines, objType, v, common);

  // 自由追記行
  const extra = String(common.extraLines || '').split(/\r?\n/).map(s => s.trimEnd()).filter(s => s.trim() !== '');
  extra.forEach(line => lines.push(line));

  return lines.join('\n') + '\n';
}

export function downloadDatText(text, filename) {
  const clean = (filename || 'addon.dat').trim();
  const outName = clean.toLowerCase().endsWith('.dat') ? clean : `${clean}.dat`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
