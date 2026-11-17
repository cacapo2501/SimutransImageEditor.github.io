// dat生成設定・編成データ・出力内容のプロジェクト保存・復元モジュール

export function cloneCommon(c) {
  const copy = { ...(c || {}) };
  if (copy.customImageCoords) {
    copy.customImageCoords = JSON.parse(JSON.stringify(copy.customImageCoords));
  }
  return copy;
}

export function cloneDatEntry(entry) {
  const values = { ...(entry.values || {}) };
  if (Array.isArray(values.climates)) values.climates = [...values.climates];
  return {
    objType: entry.objType,
    common: cloneCommon(entry.common),
    values
  };
}

export function createDefaultDatCommon() {
  return {
    name: 'new_building',
    copyright: '',
    includeImages: true,
    imageFormat: 'auto',
    customImgFormat: 'EmptyImage[{dir}][0]={prefix}.{row}.{col}{offset}',
    flipDirections: false,
    imgPrefix: 'base_combined',
    startRow: '0',
    startCol: '0',
    imgOffset: '',
    customImageCoords: null,
    extraLines: ''
  };
}

export function serializeDatProjectState(gen) {
  gen.collectionMgr.saveActiveFromController();
  const txtEl = document.getElementById('txt-dat-output');
  const fileEl = document.getElementById('inp-dat-filename');
  const pending = gen._pendingProjectUi || {};

  return {
    currentObjType: gen.currentObjType,
    autoSync: gen.autoSync,
    hasOpenedOnce: gen.hasOpenedOnce,
    common: cloneCommon(gen.common),
    stateByObj: JSON.parse(JSON.stringify(gen.stateByObj || {})),
    collection: {
      items: gen.collectionMgr.items.map(cloneDatEntry),
      activeIndex: gen.collectionMgr.activeIndex,
      exportAll: gen.collectionMgr.exportAll
    },
    livery: gen.liveryMgr.exportState(),
    outputText: txtEl ? txtEl.value : (pending.outputText ?? null),
    outputFilename: fileEl ? fileEl.value : (pending.outputFilename ?? null),
    outputFilenameEdited: fileEl ? Boolean(fileEl.dataset.userEdited) : Boolean(pending.outputFilenameEdited),
    aiOptions: {
      pakset: document.getElementById('sel-dat-ai-pakset')?.value ?? pending.aiOptions?.pakset ?? 'pak64',
      vehicleMode: document.getElementById('sel-dat-ai-vehicle-mode')?.value ?? pending.aiOptions?.vehicleMode ?? 'consist',
      carCount: document.getElementById('inp-dat-ai-car-count')?.value ?? pending.aiOptions?.carCount ?? '',
      userPrompt: document.getElementById('inp-dat-ai-prompt')?.value ?? pending.aiOptions?.userPrompt ?? '',
      autoSeqRows: document.getElementById('chk-dat-ai-seq-rows')?.checked ?? pending.aiOptions?.autoSeqRows ?? true
    }
  };
}

export function applyPendingDatProjectUi(gen) {
  const p = gen._pendingProjectUi;
  gen._applyControllerStateToForm();
  gen.collectionMgr.refreshUI();
  gen.liveryMgr.refreshUI();
  gen._updateSyncBadge();

  if (p) {
    const inpFile = document.getElementById('inp-dat-filename');
    if (inpFile && p.outputFilename) {
      inpFile.value = p.outputFilename;
      if (p.outputFilenameEdited) inpFile.dataset.userEdited = '1';
      else delete inpFile.dataset.userEdited;
    }
    if (p.aiOptions) {
      const setV = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
      setV('sel-dat-ai-pakset', p.aiOptions.pakset);
      setV('sel-dat-ai-vehicle-mode', p.aiOptions.vehicleMode);
      setV('inp-dat-ai-car-count', p.aiOptions.carCount);
      setV('inp-dat-ai-prompt', p.aiOptions.userPrompt);
      const chk = document.getElementById('chk-dat-ai-seq-rows');
      if (chk && p.aiOptions.autoSeqRows !== undefined) chk.checked = Boolean(p.aiOptions.autoSeqRows);
    }
    const txtEl = document.getElementById('txt-dat-output');
    if (txtEl && p.outputText !== null && (!gen.autoSync || p.outputText)) {
      txtEl.value = p.outputText;
    } else if (gen.autoSync) {
      gen.regenerateOutput();
    }
    gen._pendingProjectUi = null;
  } else if (gen.autoSync) {
    gen.regenerateOutput();
  }
  gen._updateSidebarStatus();
}

export function restoreDatProjectState(gen, data) {
  if (!data) {
    gen.hasOpenedOnce = false;
    gen.currentObjType = 'building';
    gen.autoSync = true;
    gen.stateByObj = {};
    gen.common = createDefaultDatCommon();
    gen.collectionMgr.items = [];
    gen.collectionMgr.activeIndex = -1;
    gen.liveryMgr.importState(null);
    gen._pendingProjectUi = null;
    if (gen.initialized) applyPendingDatProjectUi(gen);
    return;
  }

  gen.currentObjType = data.currentObjType || 'building';
  gen.autoSync = data.autoSync !== undefined ? Boolean(data.autoSync) : true;
  gen.hasOpenedOnce = data.hasOpenedOnce !== undefined ? Boolean(data.hasOpenedOnce) : true;
  gen.common = cloneCommon({ ...createDefaultDatCommon(), ...(data.common || {}) });
  gen.stateByObj = data.stateByObj ? JSON.parse(JSON.stringify(data.stateByObj)) : {};

  const col = data.collection || {};
  gen.collectionMgr.items = Array.isArray(col.items) ? col.items.map(cloneDatEntry) : [];
  gen.collectionMgr.activeIndex = typeof col.activeIndex === 'number' ? col.activeIndex : -1;
  gen.collectionMgr.exportAll = col.exportAll !== undefined ? Boolean(col.exportAll) : true;

  gen.liveryMgr.importState(data.livery || null);
  gen._pendingProjectUi = {
    outputText: data.outputText ?? null,
    outputFilename: data.outputFilename ?? null,
    outputFilenameEdited: Boolean(data.outputFilenameEdited),
    aiOptions: data.aiOptions || null
  };

  if (gen.initialized) {
    applyPendingDatProjectUi(gen);
  }
}
