// Simutrans 複数タイル建物シート切り出し処理（指定行数分割対応）

// 指定寸法で最下段用の底面菱形下V字外側カットマスクを生成する (1 = 背景#E7FFFFで抜く)
function buildBottomCutMask(tileSize) {
  const Tw = Math.max(8, tileSize);
  const Th = Math.max(4, Math.floor(Tw / 2));
  const effH = Math.max(1, Th - 1);
  const diamondTop = Tw - effH;
  const halfW = Tw / 2;
  const halfH = Th / 2;
  const step = Tw / Th;

  const cutMask = new Uint8Array(Tw * Tw);
  const splitRow = Math.floor(effH / 2);

  for (let ly = diamondTop + splitRow; ly < Tw; ly++) {
    const yInDia = ly - diamondTop;
    const dy = yInDia < halfH ? yInDia : (effH - 1 - yInDia);
    const wHalf = Math.max(1, Math.round((dy + 1) * step));
    const xStart = Math.max(0, Math.floor(halfW - wHalf));
    const xEnd = Math.min(Tw - 1, Math.ceil(halfW + wHalf) - 1);
    for (let lx = 0; lx < Tw; lx++) {
      if (lx < xStart || lx > xEnd) {
        cutMask[ly * Tw + lx] = 1;
      }
    }
  }
  return cutMask;
}

// 大きな複数タイル建物画像を Simutrans makeobj 用のタイルシート PNG に切り出して並べる
export function cutBuildingSheet(sourceCanvas, opts = {}) {
  const tileSize = Math.max(16, Math.min(512, parseInt(opts.tileSize, 10) || 64));
  const dimsW = Math.max(1, Math.min(16, parseInt(opts.dimsW, 10) || 1));
  const dimsH = Math.max(1, Math.min(16, parseInt(opts.dimsH, 10) || 1));
  const dimsViews = Math.max(1, Math.min(255, parseInt(opts.dimsViews, 10) || 4));
  const heightTiles = Math.max(1, Math.min(16, parseInt(opts.heightTiles, 10) || 1));
  const frames = Math.max(1, Math.min(16, parseInt(opts.frames, 10) || 1));
  const seasons = Math.max(1, Math.min(2, parseInt(opts.seasons, 10) || 1));
  const sourceRows = Math.max(1, Math.min(64, parseInt(opts.sourceRows, 10) || 1));
  const offsetX = parseInt(opts.offsetX, 10) || 0;
  const offsetY = parseInt(opts.offsetY, 10) || 0;
  const maskBottomV = opts.maskBottomV !== false;

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcData = sourceCanvas.getContext('2d').getImageData(0, 0, srcW, srcH).data;

  const colsPerView = dimsW * dimsH;
  const rowsPerSource = seasons * frames * heightTiles;
  const outCols = dimsViews * colsPerView;
  const outRows = sourceRows * rowsPerSource;
  const outW = outCols * tileSize;
  const outH = outRows * tileSize;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  const outImgData = outCtx.createImageData(outW, outH);
  const outData = outImgData.data;

  // 背景をSimutrans透過色 #E7FFFF (231, 255, 255, 255) で初期化
  for (let i = 0; i < outW * outH; i++) {
    const p = i * 4;
    outData[p] = 231;
    outData[p + 1] = 255;
    outData[p + 2] = 255;
    outData[p + 3] = 255;
  }

  const cutMask = maskBottomV ? buildBottomCutMask(tileSize) : null;
  const halfW = tileSize / 2;
  const quarterH = tileSize / 4;
  const expectedViewW = (dimsW + dimsH) * halfW;
  const srcViewW = dimsViews > 1 ? Math.floor(srcW / dimsViews) : srcW;
  const baseXInView = Math.round((srcViewW - expectedViewW) / 2);

  // 指定された分割行数で縦方向に均等分割し、各行内の季節・アニメブロックごとに切り出す
  const rowBandH = sourceRows > 1 ? Math.floor(srcH / sourceRows) : srcH;
  const blockTotal = seasons * frames;
  const blockH = blockTotal > 1 ? Math.floor(rowBandH / blockTotal) : rowBandH;

  for (let srcRow = 0; srcRow < sourceRows; srcRow++) {
    const srcRowTopY = srcRow * rowBandH;
    for (let s = 0; s < seasons; s++) {
      for (let a = 0; a < frames; a++) {
        const blockIdx = s * frames + a;
        const blockTopY = srcRowTopY + blockIdx * blockH;
        const blockBottomY = blockTopY + blockH;

        for (let view = 0; view < dimsViews; view++) {
          // Simutrans仕様に合わせ、90°/270°回転ビュー(奇数)は東西・南北タイル数を入れ替える
          const viewW = (view % 2 === 1) ? dimsH : dimsW;
          const viewH = (view % 2 === 1) ? dimsW : dimsH;
          const viewOriginX = view * srcViewW + baseXInView;

          for (let y = 0; y < viewH; y++) {
            for (let x = 0; x < viewW; x++) {
              const tileBaseX = viewOriginX + Math.round((viewH - 1 + x - y) * halfW) + offsetX;
              const tileBaseY = blockBottomY - tileSize - Math.round(((viewW + viewH - 2) - (x + y)) * quarterH) + offsetY;
              const dstCol = view * colsPerView + y * viewW + x;

              for (let h = 0; h < heightTiles; h++) {
                const sx0 = tileBaseX;
                const sy0 = tileBaseY - h * tileSize;
                const dstRow = srcRow * rowsPerSource + s * (heightTiles * frames) + a * heightTiles + (heightTiles - 1 - h);
                const dx0 = dstCol * tileSize;
                const dy0 = dstRow * tileSize;
                const applyCut = Boolean(cutMask && h === 0);

                for (let ly = 0; ly < tileSize; ly++) {
                  const sy = sy0 + ly;
                  const dy = dy0 + ly;
                  const rowOutBase = dy * outW;
                  const rowCutBase = ly * tileSize;

                  for (let lx = 0; lx < tileSize; lx++) {
                    if (applyCut && cutMask[rowCutBase + lx]) continue;
                    const sx = sx0 + lx;
                    if (sx < 0 || sx >= srcW || sy < blockTopY || sy >= blockBottomY) continue;
                    const sIdx = (sy * srcW + sx) * 4;
                    const dIdx = (rowOutBase + dx0 + lx) * 4;
                    outData[dIdx] = srcData[sIdx];
                    outData[dIdx + 1] = srcData[sIdx + 1];
                    outData[dIdx + 2] = srcData[sIdx + 2];
                    outData[dIdx + 3] = srcData[sIdx + 3];
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}
