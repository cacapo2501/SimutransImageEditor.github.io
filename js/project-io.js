import { Layer } from './layer.js';
import { resolveSpecialColorConflicts } from './color-utils.js';

export function imageToPngDataUrl(img) {
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

export function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadImageElementAsPng(img, filename) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);

  const safeName = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safeName;
    a.click();
  }, 'image/png');
}

export class ProjectIO {
  static save(app) {
    if (!app.baseImage) return alert('保存するデータがありません。');

    const tintObj = {}, overridesObj = {};
    app.maskTintColors.forEach((v, k) => { tintObj[k] = v; });
    app.maskToneOverrides.forEach((v, k) => { overridesObj[k] = v; });

    const data = {
      version: '15.0',
      base_name: app.baseName,
      mask_name: app.maskName,
      base_image_data: imageToPngDataUrl(app.baseImage),
      mask_image_data: imageToPngDataUrl(app.maskImage),
      global_tone_config: app.globalTone,
      enable_mask_tint: app.enableMaskTint,
      mask_tint_colors: tintObj,
      mask_tone_overrides: overridesObj,
      enable_blur: app.enableBlur,
      blur_radius: app.blurRadius,
      pixel_snap: app.pixelSnap,
      layers: app.layers.map(l => l.toDict(app.layers)),
      active_idx: app.activeIdx,
      palette_data: app.paletteManager.toDict(),
      keybindings: app.paintEditor ? app.paintEditor.keybindings : null
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (app.baseName ? app.baseName.replace(/\.[^/.]+$/, '') : 'project') + '.proj.json';
    a.click();
    app.isDirty = false;
    document.getElementById('status-bar').textContent = 'プロジェクト(画像・パレット内包)を保存しました。';
  }

  static async load(app, file) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);

        if (data.global_tone_config) app.globalTone = data.global_tone_config;
        if (data.enable_mask_tint !== undefined) {
          app.enableMaskTint = data.enable_mask_tint;
          const chkTint = document.getElementById('chk-enable-tint');
          if (chkTint) chkTint.checked = app.enableMaskTint;
        }
        if (data.mask_tint_colors) {
          app.maskTintColors.clear();
          Object.entries(data.mask_tint_colors).forEach(([k, v]) => app.maskTintColors.set(k, v));
        }
        if (data.mask_tone_overrides) {
          app.maskToneOverrides.clear();
          Object.entries(data.mask_tone_overrides).forEach(([k, v]) => app.maskToneOverrides.set(k, v));
        }
        app.enableBlur = data.enable_blur !== undefined ? data.enable_blur : true;
        app.blurRadius = data.blur_radius || 0.0;
        app.pixelSnap = data.pixel_snap !== undefined ? data.pixel_snap : true;
        document.getElementById('chk-enable-blur').checked = app.enableBlur;
        document.getElementById('slider-blur').value = app.blurRadius;
        document.getElementById('lbl-blur-radius').textContent = `${app.blurRadius.toFixed(2)}px`;
        document.getElementById('chk-pixel-snap').checked = app.pixelSnap;
        app.onToneTargetChanged('__ALL__');

        if (data.palette_data) app.paletteManager.fromDict(data.palette_data);
        if (data.keybindings && app.paintEditor) {
          Object.assign(app.paintEditor.keybindings, data.keybindings);
          app.paintEditor.saveKeybindings();
        }

        if (data.base_image_data) {
          const baseImg = await loadImageAsync(data.base_image_data);
          if (baseImg) app.applyBaseImage(baseImg, data.base_name || 'base.png');
        }
        if (data.mask_image_data) {
          const maskImg = await loadImageAsync(data.mask_image_data);
          if (maskImg) app.applyMaskImage(maskImg, data.mask_name || 'mask.png');
        }

        const layerDefs = data.layers || [];
        const layerImages = await Promise.all(layerDefs.map(ld => {
          if (ld.image_data) return loadImageAsync(ld.image_data);
          return Promise.resolve(null);
        }));

        app.layers = [];
        for (let i = 0; i < layerDefs.length; i++) {
          const ld = layerDefs[i];
          const img = layerImages[i];
          const layer = new Layer({
            name: ld.name,
            imageElement: img,
            canvasW: app.baseW,
            canvasH: app.baseH,
            corners: ld.corners,
            opacity: ld.opacity,
            visible: ld.visible,
            transformMode: ld.transform_mode,
            tileX: ld.tile_x,
            tileY: ld.tile_y,
            targetMaskColor: ld.target_mask_color,
            layerType: ld.layer_type,
            fillAll: ld.fill_all,
            transparentE7ffff: ld.transparent_e7ffff
          });
          app.layers.push(layer);
        }

        for (let i = 0; i < layerDefs.length; i++) {
          const sIdx = layerDefs[i].source_idx;
          if (sIdx !== null && sIdx !== undefined && sIdx >= 0 && sIdx < app.layers.length) {
            app.layers[i].sourceLayer = app.layers[sIdx];
          }
        }

        app.refreshLayerList();
        const act = data.active_idx !== undefined ? data.active_idx : 0;
        app.selectLayer(app.layers.length > 0 ? Math.min(act, app.layers.length - 1) : -1);

        app.isDirty = false;
        app.zoomFit();
        app.render();
        document.getElementById('status-bar').textContent = `プロジェクトを完全復元しました: ${file.name}`;
      } catch (e) {
        alert('プロジェクトの読み込みに失敗しました: ' + e);
      }
    };
    r.readAsText(file);
  }

  // ベース画像単体PNG保存
  static exportBasePng(app) {
    if (!app.baseImage) return alert('保存するベース画像がありません。');
    downloadImageElementAsPng(app.baseImage, app.baseName || 'base.png');
    document.getElementById('status-bar').textContent = 'ベース画像をPNG保存しました。';
  }

  // マスク画像単体PNG保存
  static exportMaskPng(app) {
    if (!app.maskImage) return alert('保存するマスク画像がありません。');
    downloadImageElementAsPng(app.maskImage, app.maskName || 'mask.png');
    document.getElementById('status-bar').textContent = 'マスク画像をPNG保存しました。';
  }

  // 合成結果PNG保存
  static exportPng(app) {
    const pixels = app.computeFinalImage();
    if (!pixels) return alert('保存できる画像がありません。');

    const conflicts = resolveSpecialColorConflicts(pixels, app.baseW, app.baseH, app.specialColors, app.isBaseSpecialColor);
    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    c.getContext('2d').putImageData(new ImageData(pixels, app.baseW, app.baseH), 0, 0);

    c.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'export_result.png';
      a.click();
      if (conflicts > 0) alert(`画像を保存しました。\n※ 乗算等によりSpecialColorと重複した ${conflicts} ピクセルのR成分を補正しました。(ベース画像固有のSpecialColorは保護されました)`);
    }, 'image/png');
  }
}
