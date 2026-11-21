import { resolveSpecialColorConflicts } from './color-utils.js';
import { buildCompositeImageFilename } from './composite-naming.js';
import {
  resetFullProjectState,
  syncProjectEffectInputsFromApp,
  updateProjectStatusUI,
  createDefaultGlobalTone,
  createDefaultWindowDarken
} from './project-reset.js';

export function canvasToDataUrl(source) {
  if (!source) return null;
  if (source instanceof HTMLCanvasElement) return source.toDataURL('image/png');
  const c = document.createElement('canvas');
  c.width = source.naturalWidth || source.width;
  c.height = source.naturalHeight || source.height;
  c.getContext('2d').drawImage(source, 0, 0);
  return c.toDataURL('image/png');
}

export function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export class ProjectIO {
  static async save(app, { saveAs = false } = {}) {
    if (!app.baseImage) {
      alert('ベース画像が読み込まれていません。');
      return;
    }

    if (app.maskMgr) {
      app.maskMgr.saveActiveStateFromApp();
    }

    const maskItems = app.maskMgr ? app.maskMgr.items : [];
    const maskEntries = maskItems.map(item => ({
      name: item.name,
      image_data_url: canvasToDataUrl(item.image),
      tint_colors: Array.from(item.tintColors.entries()),
      tone_overrides: Array.from(item.toneOverrides.entries())
    }));

    const projData = {
      version: '4.0',
      base_name: app.baseName,
      base_data_url: canvasToDataUrl(app.baseImage),
      active_mask_index: app.maskMgr ? app.maskMgr.activeIndex : -1,
      masks: maskEntries,
      mask_name: app.maskName,
      mask_data_url: canvasToDataUrl(app.maskImage),
      mask_tint_colors: Array.from(app.maskTintColors.entries()),
      mask_tone_overrides: Array.from(app.maskToneOverrides.entries()),
      enable_mask_tint: app.enableMaskTint,
      enable_blur: app.enableBlur,
      blur_radius: app.blurRadius,
      pixel_snap: app.pixelSnap,
      global_tone: app.globalTone,
      window_darken: app.windowDarken,
      special_colors: Array.from(app.specialColors),
      palette_data: app.paletteManager ? app.paletteManager.toDict() : null,
      tile_cutter: app.tileCutter ? app.tileCutter.exportProjectState() : null,
      dat_generator: app.datGenerator ? app.datGenerator.exportProjectState() : null,
      layers: app.layers.map(l => ({
        name: l.name,
        layer_type: l.layerType,
        image_data_url: canvasToDataUrl(l.imageElement),
        corners: l.corners,
        transform_mode: l.transformMode,
        opacity: l.opacity,
        visible: l.visible,
        fill_all: l.fillAll,
        transparent_e7ffff: l.transparentE7ffff,
        exclude_mask_color: l.excludeMaskColor,
        tile_x: l.tileX,
        tile_y: l.tileY,
        target_mask_color: l.targetMaskColor,
        target_mask_index: l.targetMaskId !== null ? maskItems.findIndex(m => m.id === l.targetMaskId) : -1,
        source_index: l.sourceLayer ? app.layers.indexOf(l.sourceLayer) : -1
      }))
    };

    const jsonStr = JSON.stringify(projData, null, 2);
    const defaultName = app.currentProjectName || (app.baseName.replace(/\.png$/i, '') + '.proj.json');

    const savedName = await app.storage.saveJsonFile(jsonStr, defaultName, { saveAs });
    if (savedName) {
      const projName = typeof savedName === 'string' ? savedName : defaultName;
      app.currentProjectName = projName;
      app.isDirty = false;
      updateProjectStatusUI(app, {
        title: `💾 保存済プロジェクト: ${projName}`,
        detail: `ベース: ${app.baseName} | 次回「プロジェクト保存」はこのファイルに保存されます（新しいベース読込で自動解除）`,
        mode: 'normal',
        statusBarText: `💾 プロジェクトを保存しました: ${projName}`
      });
      alert(`プロジェクトを保存しました！ (${projName})`);
    }
  }

  static async load(app, file) {
    if (app.isDirty && !confirm('未保存の変更があります。破棄してプロジェクトを開きますか？')) return;
    const text = await file.text();
    const data = JSON.parse(text);

    // 前のプロジェクト状態・保存先ハンドルを完全にリセットしてから読み込む
    resetFullProjectState(app, { silent: true });

    const baseImg = await loadImageAsync(data.base_data_url);
    app.applyBaseImage(baseImg, data.base_name || 'base.png', { resetMask: false, resetDat: false, isProjectLoad: true });

    if (Array.isArray(data.masks) && data.masks.length > 0 && app.maskMgr) {
      app.maskMgr.clearAll();
      for (let i = 0; i < data.masks.length; i++) {
        const m = data.masks[i];
        if (!m.image_data_url) continue;
        const mImg = await loadImageAsync(m.image_data_url);
        app.maskMgr.registerAnalyzedMask(mImg, m.name || `mask_${i + 1}.png`, { addAsNew: true });
        if (m.tint_colors) app.maskTintColors = new Map(m.tint_colors);
        if (m.tone_overrides) app.maskToneOverrides = new Map(m.tone_overrides);
        app.maskMgr.saveActiveStateFromApp();
      }
      const targetIdx = typeof data.active_mask_index === 'number' ? data.active_mask_index : 0;
      if (targetIdx >= 0 && targetIdx < app.maskMgr.items.length) {
        app.maskMgr.selectMask(targetIdx);
      }
    } else if (data.mask_data_url) {
      const maskImg = await loadImageAsync(data.mask_data_url);
      app.applyMaskImage(maskImg, data.mask_name || 'mask.png');
      if (data.mask_tint_colors) app.maskTintColors = new Map(data.mask_tint_colors);
      if (data.mask_tone_overrides) app.maskToneOverrides = new Map(data.mask_tone_overrides);
      if (app.maskMgr) app.maskMgr.saveActiveStateFromApp();
    }

    if (data.palette_data && app.paletteManager) {
      app.paletteManager.fromDict(data.palette_data);
    }

    app.globalTone = { ...createDefaultGlobalTone(), ...(data.global_tone || {}) };
    app.windowDarken = { ...createDefaultWindowDarken(), ...(data.window_darken || {}) };
    app.enableMaskTint = data.enable_mask_tint !== undefined ? data.enable_mask_tint : true;
    app.enableBlur = data.enable_blur !== undefined ? data.enable_blur : true;
    app.blurRadius = data.blur_radius || 0.0;
    app.pixelSnap = data.pixel_snap !== undefined ? data.pixel_snap : true;
    if (data.special_colors) app.specialColors = new Set(data.special_colors);

    const loadedMasks = app.maskMgr ? app.maskMgr.items : [];
    app.layers = [];
    const { Layer } = await import('./layer.js');
    for (const ld of (data.layers || [])) {
      const lImg = await loadImageAsync(ld.image_data_url);
      const mappedMaskId = (typeof ld.target_mask_index === 'number' && ld.target_mask_index >= 0 && ld.target_mask_index < loadedMasks.length)
        ? loadedMasks[ld.target_mask_index].id
        : null;

      const layer = new Layer({
        name: ld.name,
        imageElement: lImg,
        canvasW: app.baseW,
        canvasH: app.baseH,
        layerType: ld.layer_type,
        corners: ld.corners,
        transformMode: ld.transform_mode,
        opacity: ld.opacity,
        visible: ld.visible,
        fillAll: ld.fill_all,
        transparentE7ffff: ld.transparent_e7ffff,
        excludeMaskColor: ld.exclude_mask_color,
        tileX: ld.tile_x,
        tileY: ld.tile_y,
        targetMaskColor: ld.target_mask_color,
        targetMaskId: mappedMaskId
      });
      layer._tempSrcIdx = ld.source_index;
      app.layers.push(layer);
    }
    app.layers.forEach(l => {
      if (l._tempSrcIdx >= 0 && l._tempSrcIdx < app.layers.length) {
        l.sourceLayer = app.layers[l._tempSrcIdx];
      }
      delete l._tempSrcIdx;
    });

    if (app.layerManager) app.layerManager.onMaskCollectionChanged();
    if (app.tileCutter) app.tileCutter.importProjectState(data.tile_cutter || null);
    if (app.datGenerator) app.datGenerator.importProjectState(data.dat_generator || null);
    syncProjectEffectInputsFromApp(app);
    app.currentProjectName = file.name || null;
    if (app.storage) {
      app.storage.lastProjectHandle = null;
      app.storage.currentProjectName = app.currentProjectName;
    }
    updateProjectStatusUI(app, {
      title: `📂 読込済プロジェクト: ${file.name}`,
      detail: `ベース: ${app.baseName} (${app.baseW}×${app.baseH}px) | 保存時は保存先確認ダイアログが開きます`,
      mode: 'normal',
      statusBarText: `📂 プロジェクトを読み込みました: ${file.name}`
    });
    app.isDirty = false;
    app.zoomFit();
  }

  static exportBasePng(app) {
    if (!app.baseImage) return alert('ベース画像が読み込まれていません。');
    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    c.getContext('2d').drawImage(app.baseImage, 0, 0);
    const filename = app.baseName.toLowerCase().endsWith('.png') ? app.baseName : `${app.baseName}.png`;
    c.toBlob(blob => downloadBlob(blob, filename), 'image/png');
  }

  static exportMaskPng(app) {
    if (!app.maskImage) return alert('マスク画像が読み込まれていません。');
    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    c.getContext('2d').drawImage(app.maskImage, 0, 0);
    const filename = app.maskName.toLowerCase().endsWith('.png') ? app.maskName : `${app.maskName}.png`;
    c.toBlob(blob => downloadBlob(blob, filename), 'image/png');
  }

  static exportPng(app) {
    if (!app.baseImage) return;
    const pixels = app.computeFinalImage();
    if (!pixels) return;

    const copy = new Uint8ClampedArray(pixels);
    const conflicts = resolveSpecialColorConflicts(
      copy, app.baseW, app.baseH, app.specialColors, app.isBaseSpecialColor, app.isBgMask
    );
    if (conflicts > 0) {
      alert(`出力前に SpecialColor との色衝突を ${conflicts} ピクセル自動回避しました。`);
    }

    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    c.getContext('2d').putImageData(new ImageData(copy, app.baseW, app.baseH), 0, 0);

    const activeMask = app.maskMgr?.getActive?.();
    const maskName = activeMask ? activeMask.name : (app.maskImage ? app.maskName : '');
    const useCut = Boolean(app.tileCutter?.shouldCutOnExport?.());
    const outCanvas = useCut ? app.tileCutter.cutCanvas(c) : c;
    const outName = buildCompositeImageFilename(app.baseName, maskName, { useCut });
    outCanvas.toBlob(blob => downloadBlob(blob, outName), 'image/png');
  }
}