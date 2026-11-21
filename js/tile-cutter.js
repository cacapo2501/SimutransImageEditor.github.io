// Simutrans 複数タイル建物用タイルカッター（設定管理・dat設定との双方向同期）
import { cutBuildingSheet } from './tile-cutter-sheet.js';
export { cutBuildingSheet };

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
    this.sourceRows = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.maskBottomV = true;
    this.syncUI();
  }

  getRowsPerBlock() {
    return Math.max(1, this.seasons * this.frames * this.heightTiles);
  }

  getTotalOutputRows() {
    return Math.max(1, this.sourceRows * this.getRowsPerBlock());
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
      sourceRows: this.sourceRows,
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

  // datフォームの建物/工場設定および複数オブジェクト数を受け取りタイルカッター側へ同期する
  syncFromDat(objType, state, { syncRowCountFromCollection = false } = {}) {
    if ((objType !== 'building' && objType !== 'factory') || !state) return;
    this.dimsW = Math.max(1, Math.min(16, parseInt(state.dimsW, 10) || 1));
    this.dimsH = Math.max(1, Math.min(16, parseInt(state.dimsH, 10) || 1));
    this.dimsViews = Math.max(1, Math.min(255, parseInt(state.dimsViews, 10) || 1));
    this.heightTiles = Math.max(1, Math.min(16, parseInt(state.heightTiles, 10) || 1));
    this.frames = objType === 'factory' ? 1 : Math.max(1, Math.min(16, parseInt(state.frames, 10) || 1));
    const hasExtSeason = state.seasonMasks && Object.values(state.seasonMasks).some(ref => ref && ref !== '__self__');
    // 色違いマスクで別ファイルを使う場合は1画像あたり1季節分として切り出す
    this.seasons = hasExtSeason ? 1 : Math.max(1, Math.min(2, parseInt(state.seasons, 10) || 1));

    const items = this.app?.datGenerator?.collectionMgr?.items || [];
    const bldCount = items.filter(it => it.objType === 'building' || it.objType === 'factory').length;
    if (bldCount > 1 || syncRowCountFromCollection) {
      this.sourceRows = Math.max(1, Math.min(64, bldCount || 1));
    }

    const isMulti = this.dimsW > 1 || this.dimsH > 1 || this.heightTiles > 1 || this.sourceRows > 1;
    if (this.manualOverride === null) {
      this.enabled = isMulti;
    }
    this.syncUI();
  }

  // タイルカッター設定をdat側ステート（単体および複数コレクション）へ反映し、開始行を連番整合する
  pushToDatState(targetObjType = null, { expandCollection = false } = {}) {
    const gen = this.app?.datGenerator;
    if (!gen) return;
    const obj = targetObjType || ((gen.currentObjType === 'factory') ? 'factory' : 'building');
    const colMgr = gen.collectionMgr;
    const syncDims = (st, oType) => {
      st.dimsW = String(this.dimsW);
      st.dimsH = String(this.dimsH);
      st.dimsViews = String(this.dimsViews);
      st.heightTiles = String(this.heightTiles);
      if (oType === 'building') st.frames = String(this.frames);
      st.seasons = String(this.seasons);
    };

    syncDims(gen._getObjState(obj), obj);
    if (expandCollection && this.sourceRows > 1 && !colMgr.hasCollection()) {
      const baseName = (gen.common.name || 'building').replace(/_\d+$/, '');
      const list = Array.from({ length: this.sourceRows }, (_, i) => ({
        objType: obj,
        common: { ...gen.common, name: `${baseName}_${i + 1}`, customImageCoords: null },
        values: { ...gen._getObjState(obj) }
      }));
      colMgr.setItems(list);
    }

    if (colMgr.hasCollection()) {
      colMgr.saveActiveFromController();
      if (expandCollection && colMgr.items.length < this.sourceRows) {
        const last = colMgr.items[colMgr.items.length - 1];
        const baseName = (last.common?.name || 'building').replace(/_\d+$/, '');
        while (colMgr.items.length < this.sourceRows) {
          colMgr.items.push({
            objType: last.objType,
            common: { ...last.common, name: `${baseName}_${colMgr.items.length + 1}`, customImageCoords: null },
            values: { ...last.values }
          });
        }
      }
      let nextRow = 0;
      const rowsPerBlock = this.getRowsPerBlock();
      colMgr.items.forEach((it) => {
        if (it.objType === 'building' || it.objType === 'factory') syncDims(it.values, it.objType);
        if (this.enabled) {
          it.common.startRow = String(nextRow);
          it.common.startCol = '0';
          it.common.customImageCoords = null;
          nextRow += rowsPerBlock;
        }
      });
      if (colMgr.activeIndex >= 0 && colMgr.items[colMgr.activeIndex]) {
        colMgr._loadItemIntoController(colMgr.items[colMgr.activeIndex]);
      }
      colMgr.refreshUI();
    } else if (this.enabled) {
      gen.common.startRow = '0';
      gen.common.startCol = '0';
      gen.common.customImageCoords = null;
    }

    if (gen.common.imgPrefix && /(_combined|_cut)$/i.test(gen.common.imgPrefix)) {
      gen.syncImagePrefixWithApp({ force: true });
    }
    if (gen.initialized) {
      if (!colMgr.hasCollection() && gen.currentObjType === obj) gen._applyControllerStateToForm();
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
    this.sourceRows = Math.max(1, Math.min(64, parseInt(data.sourceRows, 10) || 1));
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
    setVal('inp-tilecut-views', this.dimsViews);
    setVal('inp-tilecut-height', this.heightTiles);
    setVal('inp-tilecut-rows', this.sourceRows);
    setVal('inp-dat-tilecut-rows', this.sourceRows);
    setVal('inp-tilecut-ox', this.offsetX);
    setVal('inp-tilecut-oy', this.offsetY);

    const outCols = this.dimsViews * this.dimsW * this.dimsH;
    const outRows = this.getTotalOutputRows();
    const outW = outCols * this.tileSize;
    const outH = outRows * this.tileSize;
    const rowTag = this.sourceRows > 1 ? `・${this.sourceRows}行分割` : '';
    const statusText = this.enabled
      ? `出力時カット有効: ${outW}×${outH}px (${outCols}列×${outRows}行${rowTag} / ${this.tileSize}px)`
      : `OFF (通常結合出力 / 指定時予定: ${outW}×${outH}px)`;

    const lbl = document.getElementById('lbl-tilecut-status');
    if (lbl) lbl.textContent = statusText;
    const quickLbl = document.getElementById('lbl-quick-tilecut-info');
    if (quickLbl) {
      quickLbl.textContent = this.enabled ? `🧱 カット出力ON (${this.dimsW}×${this.dimsH}×${this.dimsViews}${rowTag} / ${this.tileSize}px)` : '';
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
    bindNum('inp-tilecut-views', 'dimsViews', 1, 255);
    bindNum('inp-tilecut-height', 'heightTiles', 1, 16);
    document.getElementById('inp-tilecut-rows')?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this.sourceRows = Number.isFinite(v) ? Math.max(1, Math.min(64, v)) : 1;
      if (this.sourceRows > 1 && this.manualOverride === null) this.enabled = true;
      this.pushToDatState();
      this.syncUI();
      this.app?.markDirty?.();
    });
    document.getElementById('inp-tilecut-ox')?.addEventListener('input', (e) => { this.offsetX = parseInt(e.target.value, 10) || 0; this.app?.markDirty?.(); });
    document.getElementById('inp-tilecut-oy')?.addEventListener('input', (e) => { this.offsetY = parseInt(e.target.value, 10) || 0; this.app?.markDirty?.(); });

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
      this.syncFromDat(obj, gen._getObjState(obj), { syncRowCountFromCollection: true });
    });
    document.getElementById('btn-tilecut-push-dat')?.addEventListener('click', () => {
      if (this.sourceRows > 1 && !this.enabled) {
        this.enabled = true;
        this.manualOverride = true;
      }
      this.pushToDatState(null, { expandCollection: true });
      this.syncUI();
      this.app?.markDirty?.();
    });
  }
}
