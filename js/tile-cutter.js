// Simutrans 複数タイル建物用タイルカッター（切り出し＆シート再配置・設定同期）

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
  const dimsViews = Math.max(1, Math.min(4, parseInt(opts.dimsViews, 10) || 4));
  const heightTiles = Math.max(1, Math.min(16, parseInt(opts.heightTiles, 10) || 1));
  const frames = Math.max(1, Math.min(16, parseInt(opts.frames, 10) || 1));
  const seasons = Math.max(1, Math.min(2, parseInt(opts.seasons, 10) || 1));
  const offsetX = parseInt(opts.offsetX, 10) || 0;
  const offsetY = parseInt(opts.offsetY, 10) || 0;
  const maskBottomV = opts.maskBottomV !== false;

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcData = sourceCanvas.getContext('2d').getImageData(0, 0, srcW, srcH).data;

  const colsPerView = dimsW * dimsH;
  const outCols = dimsViews * colsPerView;
  const outRows = seasons * frames * heightTiles;
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

  const blockTotal = seasons * frames;
  const blockH = blockTotal > 1 ? Math.floor(srcH / blockTotal) : srcH;

  for (let s = 0; s < seasons; s++) {
    for (let a = 0; a < frames; a++) {
      const blockIdx = s * frames + a;
      const blockTopY = blockIdx * blockH;
      const blockBottomY = (blockIdx + 1) * blockH;

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
              const dstRow = s * (heightTiles * frames) + a * heightTiles + (heightTiles - 1 - h);
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

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

export class TileCutterController {
  constructor(app) {
    this.app = app;
    this.reset();
  }

  reset() {
    this.enabled = false;
    this.manualOverride = null;
    this.tileSize = 64;
    this.dimsW = 1;
    this.dimsH = 1;
    this.dimsViews = 4;
    this.heightTiles = 1;
    this.frames = 1;
    this.seasons = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.maskBottomV = true;
    this.syncUI();
  }

  shouldCutOnExport() {
    return Boolean(this.enabled);
  }

  cutCanvas(sourceCanvas) {
    return cutBuildingSheet(sourceCanvas, this.getConfig());
  }

  getConfig() {
    return {
      tileSize: this.tileSize,
      dimsW: this.dimsW,
      dimsH: this.dimsH,
      dimsViews: this.dimsViews,
      heightTiles: this.heightTiles,
      frames: this.frames,
      seasons: this.seasons,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      maskBottomV: this.maskBottomV
    };
  }

  // DEFTILEの平面サイズ・出力形式から建物タイル数を自動推定して設定する
  applyFromDeftile(deftileW, deftileH, deftileOpts = {}, totalH = 64) {
    const unitPlane = Math.max(4, Math.floor(this.tileSize / 4));
    const w = Math.max(1, Math.min(16, Math.round(deftileW / unitPlane)));
    const h = Math.max(1, Math.min(16, Math.round(deftileH / unitPlane)));
    const views = deftileOpts.layoutMode === '1dir' ? 1 : 4;
    const rawH = (parseInt(deftileOpts.maxFloors, 10) || 4) * (parseInt(deftileOpts.pixelHeight, 10) || 8) + deftileW + deftileH - 1;
    const effH = Math.max(totalH, rawH);
    const heightTiles = Math.max(1, Math.min(16, Math.ceil(effH / this.tileSize)));

    this.dimsW = w;
    this.dimsH = h;
    this.dimsViews = views;
    this.heightTiles = heightTiles;
    this.enabled = w > 1 || h > 1 || heightTiles > 1;
    this.manualOverride = null;
    this.pushToDatState('building');
    this.syncUI();
  }

  // datフォームの建物/工場設定変更を受け取りタイルカッター側へ同期する
  syncFromDat(objType, state) {
    if ((objType !== 'building' && objType !== 'factory') || !state) return;
    this.dimsW = Math.max(1, Math.min(16, parseInt(state.dimsW, 10) || 1));
    this.dimsH = Math.max(1, Math.min(16, parseInt(state.dimsH, 10) || 1));
    this.dimsViews = Math.max(1, Math.min(4, parseInt(state.dimsViews, 10) || 1));
    this.heightTiles = Math.max(1, Math.min(16, parseInt(state.heightTiles, 10) || 1));
    this.frames = objType === 'factory' ? 1 : Math.max(1, Math.min(16, parseInt(state.frames, 10) || 1));
    this.seasons = Math.max(1, Math.min(2, parseInt(state.seasons, 10) || 1));

    const isMulti = this.dimsW > 1 || this.dimsH > 1 || this.heightTiles > 1;
    if (this.manualOverride === null) {
      this.enabled = isMulti;
    }
    this.syncUI();
  }

  // タイルカッター設定をdat側ステートへ反映し、dat内容をカット済み仕様に合わせる
  pushToDatState(targetObjType = null) {
    const gen = this.app?.datGenerator;
    if (!gen) return;
    const obj = targetObjType || ((gen.currentObjType === 'factory') ? 'factory' : 'building');
    const st = gen._getObjState(obj);
    st.dimsW = String(this.dimsW);
    st.dimsH = String(this.dimsH);
    st.dimsViews = String(this.dimsViews);
    st.heightTiles = String(this.heightTiles);
    if (obj === 'building') st.frames = String(this.frames);
    st.seasons = String(this.seasons);

    // カット用グリッド座標 (0,0) 起点と _cut プレフィックスを整合させる
    if (this.enabled) {
      gen.common.startRow = '0';
      gen.common.startCol = '0';
      gen.common.customImageCoords = null;
    }
    if (gen.common.imgPrefix && /(_combined|_cut)$/i.test(gen.common.imgPrefix)) {
      gen.common.imgPrefix = gen._deriveImagePrefixFromApp();
    }
    if (gen.initialized) {
      if (gen.currentObjType === obj) gen._applyControllerStateToForm();
      if (gen.autoSync) gen.regenerateOutput();
    }
    gen.liveryMgr?.refreshUI?.();
  }

  exportProjectState() {
    return { ...this.getConfig(), enabled: this.enabled, manualOverride: this.manualOverride };
  }

  importProjectState(data) {
    if (!data) { this.reset(); return; }
    this.enabled = Boolean(data.enabled);
    this.manualOverride = data.manualOverride ?? null;
    this.tileSize = parseInt(data.tileSize, 10) || 64;
    this.dimsW = parseInt(data.dimsW, 10) || 1;
    this.dimsH = parseInt(data.dimsH, 10) || 1;
    this.dimsViews = parseInt(data.dimsViews, 10) || 4;
    this.heightTiles = parseInt(data.heightTiles, 10) || 1;
    this.frames = parseInt(data.frames, 10) || 1;
    this.seasons = parseInt(data.seasons, 10) || 1;
    this.offsetX = parseInt(data.offsetX, 10) || 0;
    this.offsetY = parseInt(data.offsetY, 10) || 0;
    this.maskBottomV = data.maskBottomV !== undefined ? Boolean(data.maskBottomV) : true;
    this.syncUI();
  }

  syncUI() {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = Boolean(v); };

    setChk('chk-tilecut-enable', this.enabled);
    setChk('chk-quick-tilecut', this.enabled);
    setChk('chk-dat-tilecut-enable', this.enabled);
    setChk('chk-tilecut-mask-v', this.maskBottomV);
    setVal('sel-tilecut-size', this.tileSize);
    setVal('sel-dat-tilecut-size', this.tileSize);
    setVal('inp-tilecut-w', this.dimsW);
    setVal('inp-tilecut-h', this.dimsH);
    setVal('sel-tilecut-views', this.dimsViews);
    setVal('inp-tilecut-height', this.heightTiles);
    setVal('inp-tilecut-ox', this.offsetX);
    setVal('inp-tilecut-oy', this.offsetY);

    const outCols = this.dimsViews * this.dimsW * this.dimsH;
    const outRows = this.seasons * this.frames * this.heightTiles;
    const outW = outCols * this.tileSize;
    const outH = outRows * this.tileSize;
    const statusText = this.enabled
      ? `出力時カット有効: ${outW}×${outH}px (${outCols}列×${outRows}行 / ${this.tileSize}px)`
      : `OFF (通常結合出力 / 指定時予定: ${outW}×${outH}px)`;

    const lbl = document.getElementById('lbl-tilecut-status');
    if (lbl) lbl.textContent = statusText;
    const quickLbl = document.getElementById('lbl-quick-tilecut-info');
    if (quickLbl) {
      quickLbl.textContent = this.enabled ? `🧱 カット出力ON (${this.dimsW}×${this.dimsH}×${this.dimsViews} / ${this.tileSize}px)` : '';
    }
  }

  bindEvents() {
    const onToggle = (checked) => {
      this.enabled = Boolean(checked);
      this.manualOverride = this.enabled;
      this.pushToDatState();
      this.syncUI();
      this.app?.markDirty?.();
    };
    document.getElementById('chk-tilecut-enable')?.addEventListener('change', (e) => onToggle(e.target.checked));
    document.getElementById('chk-quick-tilecut')?.addEventListener('change', (e) => onToggle(e.target.checked));

    const bindNum = (id, key, min, max) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        this[key] = Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
        this.pushToDatState();
        this.syncUI();
        this.app?.markDirty?.();
      });
    };
    bindNum('inp-tilecut-w', 'dimsW', 1, 16);
    bindNum('inp-tilecut-h', 'dimsH', 1, 16);
    bindNum('inp-tilecut-height', 'heightTiles', 1, 16);
    document.getElementById('inp-tilecut-ox')?.addEventListener('input', (e) => { this.offsetX = parseInt(e.target.value, 10) || 0; this.app?.markDirty?.(); });
    document.getElementById('inp-tilecut-oy')?.addEventListener('input', (e) => { this.offsetY = parseInt(e.target.value, 10) || 0; this.app?.markDirty?.(); });

    document.getElementById('sel-tilecut-views')?.addEventListener('change', (e) => {
      this.dimsViews = parseInt(e.target.value, 10) || 4;
      this.pushToDatState();
      this.syncUI();
      this.app?.markDirty?.();
    });
    document.getElementById('sel-tilecut-size')?.addEventListener('change', (e) => {
      this.tileSize = parseInt(e.target.value, 10) || 64;
      this.syncUI();
      this.app?.markDirty?.();
    });
    document.getElementById('chk-tilecut-mask-v')?.addEventListener('change', (e) => {
      this.maskBottomV = e.target.checked;
      this.app?.markDirty?.();
    });
    document.getElementById('btn-tilecut-sync-dat')?.addEventListener('click', () => {
      const gen = this.app?.datGenerator;
      if (!gen) return;
      const obj = gen.currentObjType === 'factory' ? 'factory' : 'building';
      this.manualOverride = null;
      this.syncFromDat(obj, gen._getObjState(obj));
    });
  }
}
