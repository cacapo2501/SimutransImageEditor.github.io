import { hexToRgb } from './color-utils.js';

export function getBuildingOutputSize(w, h, maxFloors, pixelHeight, layoutMode = '4dir') {
  const singleW = w * 2 + h * 2;
  const singleH = Math.max(1, maxFloors * pixelHeight + w + h - 1);
  return {
    singleW,
    singleH,
    totalW: layoutMode === '4dir' ? singleW * 4 : singleW,
    totalH: singleH
  };
}

function getRotatedPixel(srcData, w, h, rotDeg, rx, ry) {
  let sx = rx, sy = ry;
  if (rotDeg === 90) {
    sx = w - 1 - ry;
    sy = rx;
  } else if (rotDeg === 180) {
    sx = w - 1 - rx;
    sy = h - 1 - ry;
  } else if (rotDeg === 270) {
    sx = ry;
    sy = h - 1 - rx;
  }
  const idx = (sy * w + sx) * 4;
  return [srcData[idx], srcData[idx + 1], srcData[idx + 2], srcData[idx + 3]];
}

function renderDirectionSubImage(outData, totalW, totalH, offsetX, srcData, srcW, srcH, rotDeg, opts) {
  const rotW = (rotDeg === 90 || rotDeg === 270) ? srcH : srcW;
  const rotH = (rotDeg === 90 || rotDeg === 270) ? srcW : srcH;

  const {
    maxFloors,
    pixelHeight,
    drawSeparator,
    smooth,
    topRgb,
    southRgb,
    eastRgb,
    southSepRgb,
    eastSepRgb
  } = opts;

  const fillRect = (x0, y0, x1, y1, rgb) => {
    if (x1 < x0 || y1 < y0) return;
    const minX = Math.max(0, x0);
    const maxX = Math.min(totalW - 1, offsetX + x1) - offsetX;
    const minY = Math.max(0, y0);
    const maxY = Math.min(totalH - 1, y1);
    for (let y = minY; y <= maxY; y++) {
      const rowBase = y * totalW + offsetX;
      for (let x = minX; x <= maxX; x++) {
        const idx = (rowBase + x) * 4;
        outData[idx] = rgb[0];
        outData[idx + 1] = rgb[1];
        outData[idx + 2] = rgb[2];
        outData[idx + 3] = 255;
      }
    }
  };

  for (let iI = 0; iI < rotW + rotH - 1; iI++) {
    for (let iX = 0; iX <= iI; iX++) {
      const iY = iI - iX;
      if (iX >= rotW || iY >= rotH) continue;

      const [r, g, b, a] = getRotatedPixel(srcData, srcW, srcH, rotDeg, iX, iY);
      if (a === 0) continue;

      let floors = 0;
      if (r === g && g === b) {
        floors = (r / 255.0) * maxFloors;
        if (!smooth) floors = Math.floor(floors);
      }

      const drawTopX = (rotH * 2) + ((iX - iY - 1) * 2);
      const drawTopY = Math.floor((maxFloors - floors) * pixelHeight) + iX + iY;
      const drawBottomY = maxFloors * pixelHeight + iX + iY;

      fillRect(drawTopX, drawTopY, drawTopX + 3, drawTopY, topRgb);

      if (floors !== 0) {
        fillRect(drawTopX, drawTopY + 1, drawTopX + 1, drawBottomY, southRgb);
        fillRect(drawTopX + 2, drawTopY + 1, drawTopX + 3, drawBottomY, eastRgb);

        if (drawSeparator) {
          const ceilFloors = Math.ceil(floors);
          for (let fl = 1; fl < ceilFloors; fl++) {
            const sepY = drawBottomY - fl * pixelHeight;
            fillRect(drawTopX, sepY, drawTopX + 1, sepY, southSepRgb);
            fillRect(drawTopX + 2, sepY, drawTopX + 3, sepY, eastSepRgb);
          }
        }
      }
    }
  }
}

export function generateBuildingFromDeftile(deftileSource, rawOpts = {}) {
  const srcW = deftileSource.naturalWidth || deftileSource.width || 16;
  const srcH = deftileSource.naturalHeight || deftileSource.height || 16;

  const sCanvas = document.createElement('canvas');
  sCanvas.width = srcW;
  sCanvas.height = srcH;
  const sCtx = sCanvas.getContext('2d');
  sCtx.drawImage(deftileSource, 0, 0);
  const srcData = sCtx.getImageData(0, 0, srcW, srcH).data;

  const maxFloors = Math.max(1, parseInt(rawOpts.maxFloors, 10) || 4);
  const pixelHeight = Math.max(1, parseInt(rawOpts.pixelHeight, 10) || 8);
  const layoutMode = rawOpts.layoutMode === '1dir' ? '1dir' : '4dir';

  const opts = {
    maxFloors,
    pixelHeight,
    drawSeparator: Boolean(rawOpts.drawSeparator),
    smooth: Boolean(rawOpts.smooth),
    topRgb: hexToRgb(rawOpts.topColor || '#CCCCCC'),
    southRgb: hexToRgb(rawOpts.southColor || '#B2B2B2'),
    eastRgb: hexToRgb(rawOpts.eastColor || '#808080'),
    southSepRgb: hexToRgb(rawOpts.southSepColor || '#999999'),
    eastSepRgb: hexToRgb(rawOpts.eastSepColor || '#666666')
  };

  const { singleW, totalW, totalH } = getBuildingOutputSize(srcW, srcH, maxFloors, pixelHeight, layoutMode);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = totalW;
  outCanvas.height = totalH;
  const outCtx = outCanvas.getContext('2d');
  const outImgData = outCtx.createImageData(totalW, totalH);
  const outData = outImgData.data;

  for (let i = 0; i < totalW * totalH; i++) {
    outData[i * 4] = 231;
    outData[i * 4 + 1] = 255;
    outData[i * 4 + 2] = 255;
    outData[i * 4 + 3] = 255;
  }

  renderDirectionSubImage(outData, totalW, totalH, 0, srcData, srcW, srcH, 0, opts);
  if (layoutMode === '4dir') {
    renderDirectionSubImage(outData, totalW, totalH, singleW, srcData, srcW, srcH, 90, opts);
    renderDirectionSubImage(outData, totalW, totalH, singleW * 2, srcData, srcW, srcH, 180, opts);
    renderDirectionSubImage(outData, totalW, totalH, singleW * 3, srcData, srcW, srcH, 270, opts);
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}