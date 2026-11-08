import { rgbToHex, hexToRgb } from './color-utils.js';
import { applyProtectedBlur } from './transform.js';

export class RenderEngine {
  // ピクセル合成パイプライン計算
  static compute(app) {
    if (!app.baseRgb) return null;
    const total = app.baseW * app.baseH;
    let multAccum = new Float32Array(total).fill(1.0);

    // 1. 乗算テクスチャの積算
    app.layers.forEach(layer => {
      if (layer.visible && layer.layerType === 'multiply') {
        const mMap = layer.getMultiplierMap(app.baseW, app.baseH, app.maskRgb);
        for (let i = 0; i < total; i++) multAccum[i] *= mMap[i];
      }
    });

    const outRgb = new Float32Array(total * 3);
    const outAlpha = new Float32Array(total);

    // 2. ベース画像のトーン変換 ＆ テクスチャ乗算 ＆ マスクTint
    for (let i = 0; i < total; i++) {
      outAlpha[i] = app.baseAlpha[i] / 255.0;
      if (app.editableMask[i]) {
        const bg = app.baseRgb[i * 3] / 255.0;
        const mVal = multAccum[i];
        let cfg = app.globalTone;
        if (app.maskRgb) {
          const mHex = rgbToHex(app.maskRgb[i * 3], app.maskRgb[i * 3 + 1], app.maskRgb[i * 3 + 2]);
          const oCfg = app.maskToneOverrides.get(mHex);
          if (oCfg && oCfg.enabled) cfg = oCfg;
        }

        const lMin = cfg.min_dark_pct / 100.0;
        let lMax = cfg.max_bright_pct / 100.0;
        if (lMax <= lMin) lMax = lMin + 0.001;

        const u = Math.min(1.0, Math.max(0.0, (bg - lMin) / (lMax - lMin)));
        const [dr, dg, db] = hexToRgb(cfg.dark_color_hex).map(v => v / 255);

        let tr = ((1.0 - u) * dr + u) * mVal;
        let tg = ((1.0 - u) * dg + u) * mVal;
        let tb = ((1.0 - u) * db + u) * mVal;

        if (app.enableMaskTint && app.maskRgb) {
          const mHex = rgbToHex(app.maskRgb[i * 3], app.maskRgb[i * 3 + 1], app.maskRgb[i * 3 + 2]);
          const tintHex = app.maskTintColors.get(mHex) || mHex;
          const [trCol, tgCol, tbCol] = hexToRgb(tintHex).map(v => v / 255);
          tr *= trCol; tg *= tgCol; tb *= tbCol;
        }

        outRgb[i * 3] = tr;
        outRgb[i * 3 + 1] = tg;
        outRgb[i * 3 + 2] = tb;
      } else {
        outRgb[i * 3] = app.baseRgb[i * 3] / 255.0;
        outRgb[i * 3 + 1] = app.baseRgb[i * 3 + 1] / 255.0;
        outRgb[i * 3 + 2] = app.baseRgb[i * 3 + 2] / 255.0;
      }
    }

    // 3. ハイライトNormalブレンド (乗算完了後に適用)
    for (let i = 0; i < total; i++) {
      if (!app.editableMask[i]) continue;
      const bg = app.baseRgb[i * 3] / 255.0;
      let cfg = app.globalTone;
      if (app.maskRgb) {
        const mHex = rgbToHex(app.maskRgb[i * 3], app.maskRgb[i * 3 + 1], app.maskRgb[i * 3 + 2]);
        const oCfg = app.maskToneOverrides.get(mHex);
        if (oCfg && oCfg.enabled) cfg = oCfg;
      }

      if (cfg.enable_dodge) {
        const lMax = cfg.max_bright_pct / 100.0;
        if (lMax < 1.0 && bg > lMax) {
          const t = (bg - lMax) / (1.0 - lMax + 1e-6);
          const s = Math.min(1.0, Math.max(0.0, t * (cfg.dodge_max_strength / 100.0)));
          const [br, bgCol, bb] = hexToRgb(cfg.dodge_color_hex).map(v => v / 255);
          outRgb[i * 3] = (1.0 - s) * outRgb[i * 3] + s * br;
          outRgb[i * 3 + 1] = (1.0 - s) * outRgb[i * 3 + 1] + s * bgCol;
          outRgb[i * 3 + 2] = (1.0 - s) * outRgb[i * 3 + 2] + s * bb;
        }
      }
    }

    // 4. ストラクチャー (小物) 上乗せ合成
    app.layers.forEach(layer => {
      if (layer.visible && layer.layerType === 'structure') {
        const sData = layer.getWarpedStructure(app.baseW, app.baseH, app.maskRgb);
        if (!sData) return;
        for (let i = 0; i < total; i++) {
          const sa = sData[i * 4 + 3];
          if (sa > 0.001) {
            if (app.isBgMask[i]) {
              outRgb[i * 3] = 192 / 255;
              outRgb[i * 3 + 1] = 192 / 255;
              outRgb[i * 3 + 2] = 192 / 255;
              outAlpha[i] = 0.0;
            } else {
              outRgb[i * 3] = outRgb[i * 3] * (1.0 - sa) + sData[i * 4] * sa;
              outRgb[i * 3 + 1] = outRgb[i * 3 + 1] * (1.0 - sa) + sData[i * 4 + 1] * sa;
              outRgb[i * 3 + 2] = outRgb[i * 3 + 2] * (1.0 - sa) + sData[i * 4 + 2] * sa;
              outAlpha[i] = Math.min(1.0, outAlpha[i] + sa * (1.0 - outAlpha[i]));
            }
          }
        }
      }
    });

    // 5. SpecialColor保護ぼかし
    if (app.enableBlur && app.blurRadius > 0.001) {
      const invalid = new Uint8Array(total);
      for (let i = 0; i < total; i++) {
        if (app.isBgMask[i]) invalid[i] = 1;
        else {
          const hex = rgbToHex(outRgb[i * 3] * 255, outRgb[i * 3 + 1] * 255, outRgb[i * 3 + 2] * 255);
          if (app.specialColors.has(hex)) invalid[i] = 1;
        }
      }
      const blurred = applyProtectedBlur(outRgb, app.baseW, app.baseH, app.blurRadius, invalid);
      for (let i = 0; i < outRgb.length; i++) outRgb[i] = blurred[i];
    }

    const res = new Uint8ClampedArray(total * 4);
    for (let i = 0; i < total; i++) {
      res[i * 4] = Math.round(outRgb[i * 3] * 255);
      res[i * 4 + 1] = Math.round(outRgb[i * 3 + 1] * 255);
      res[i * 4 + 2] = Math.round(outRgb[i * 3 + 2] * 255);
      res[i * 4 + 3] = Math.round(outAlpha[i] * 255);
    }
    return res;
  }

  // 選択中レイヤーの枠線と四隅ハンドルのオーバーレイ描画
  static drawOverlay(ctx, layer, zoomLevel, panX, panY) {
    if (!layer) return;
    const pts = layer.corners.map(([x, y]) => [x * zoomLevel + panX, y * zoomLevel + panY]);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = layer.layerType === 'structure' ? '#FF9900' : (layer.transformMode === 'affine' ? '#00FF66' : '#00E5FF');
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const cols = ['#FF3366', '#FFCC00', '#00E5FF', '#00FF66'];
    pts.forEach(([hx, hy], i) => {
      ctx.fillStyle = cols[i];
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
}