// プロジェクト完全リセットおよびリセット状態・保存先状態の明示表示モジュール

// デフォルトの全体トーン設定を生成する
export function createDefaultGlobalTone() {
  return {
    dark_color_hex: '#000018',
    min_dark_pct: 0.0,
    max_bright_pct: 100.0,
    alpha_pct: 100.0,
    dodge_color_hex: '#FFFFFF',
    dodge_max_strength: 100.0,
    enable_dodge: true
  };
}

// デフォルトの窓色暗転設定を生成する
export function createDefaultWindowDarken() {
  return {
    enabled: false,
    ratio_pct: 50,
    seed: 12345,
    include_all_special: false
  };
}

// 現在時刻を HH:MM:SS 形式で返す
function formatNowTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// トーン・ぼかし・Tint・窓暗転・ピクセルスナップ等のサイドバーDOMを現在のapp状態に同期する
export function syncProjectEffectInputsFromApp(app) {
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = Boolean(v); };
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };

  setChk('chk-enable-blur', app.enableBlur);
  setVal('slider-blur', app.blurRadius || 0);
  setTxt('lbl-blur-radius', `${(app.blurRadius || 0).toFixed(2)}px`);

  setChk('chk-enable-tint', app.enableMaskTint);
  setChk('chk-pixel-snap', app.pixelSnap);

  const wd = app.windowDarken || createDefaultWindowDarken();
  setChk('chk-window-darken', wd.enabled);
  setVal('slider-window-darken-ratio', wd.ratio_pct ?? 50);
  setTxt('lbl-window-darken-ratio', `${wd.ratio_pct ?? 50}%`);
  setChk('chk-window-darken-all-special', wd.include_all_special);
  if (!wd.enabled) {
    setTxt('lbl-window-darken-info', '検出された窓グループ: 未実行');
  }

  app.toneTintCtrl?.onToneTargetChanged?.('__ALL__');
  app.toneTintCtrl?.updateMaskCombos?.();
  app.toneTintCtrl?.updateTintTable?.();
}

// サイドバー上部および下部ステータスバーのプロジェクト状態・リセット明示表示を更新する
export function updateProjectStatusUI(app, {
  title = '',
  detail = '',
  mode = 'normal',
  statusBarText = ''
} = {}) {
  const box = document.getElementById('project-status-box');
  const titleEl = document.getElementById('lbl-project-status-title');
  const detailEl = document.getElementById('lbl-project-status-detail');

  if (box) {
    box.classList.remove('is-reset', 'is-warning');
    if (mode === 'reset') box.classList.add('is-reset');
    else if (mode === 'warning') box.classList.add('is-warning');
  }
  if (titleEl && title) titleEl.textContent = title;
  if (detailEl && detail) detailEl.textContent = detail;

  const statusBar = document.getElementById('status-bar');
  if (statusBar && statusBarText) {
    statusBar.textContent = statusBarText;
  }
}

// プロジェクトの全状態（保存先ハンドル・レイヤー・マスク・トーン・ぼかし・タイルカッター・dat・makeobj）を完全に初期化する
export function resetFullProjectState(app, {
  reason = '',
  resetBase = false,
  silent = false
} = {}) {
  // 1. 前プロジェクトのファイル上書きハンドルを確実に破棄（無断上書き防止）
  app.storage?.clearProjectHandle?.();
  app.currentProjectName = null;

  // 2. レイヤーをすべて消去
  app.layers = [];
  app.activeIdx = -1;

  // 3. マスク画像・マスク乗算色・個別トーン設定を消去
  if (app.maskMgr) {
    app.maskMgr.clearAll();
  }
  app.maskImage = null;
  app.maskName = 'mask.png';
  app.maskRgb = null;
  app.maskColors = [];
  app.maskTintColors.clear();
  app.maskToneOverrides.clear();

  // 4. トーン・ぼかし・窓暗転・ピクセルスナップを初期値へ戻す
  app.globalTone = createDefaultGlobalTone();
  app.windowDarken = createDefaultWindowDarken();
  app.enableMaskTint = true;
  app.enableBlur = true;
  app.blurRadius = 0.0;
  app.pixelSnap = true;
  if (app.toneTintCtrl) {
    app.toneTintCtrl.selectedMaskTint = null;
  }
  syncProjectEffectInputsFromApp(app);

  // 5. レイヤーUI同期
  app.layerManager?.refreshList?.();
  app.layerManager?.syncActiveUI?.();

  // 6. タイルカッターと dat ジェネレータ・makeobj ブリッジを初期化
  app.tileCutter?.reset?.();
  app.datGenerator?.resetState?.();
  if (app.datGenerator?.makeobjBridge) {
    app.datGenerator.makeobjBridge.extraPngMap?.clear?.();
    app.datGenerator.makeobjBridge._updateExtraLabel?.();
  }
  if (app.datGenerator?.makeobjModalCtrl) {
    app.datGenerator.makeobjModalCtrl.extraPngMap?.clear?.();
    app.datGenerator.makeobjModalCtrl._updateExtraPngLabel?.();
  }
  const clearInput = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      delete el.dataset.userEdited;
    }
  };
  clearInput('txt-mk-dat');
  clearInput('txt-mk-jatab');
  clearInput('inp-mk-dat-name');
  clearInput('inp-mk-pak-name');
  clearInput('inp-mk-jatab-name');

  // 7. ベース画像自体も消去する場合（手動完全リセット時など）
  if (resetBase) {
    app.baseImage = null;
    app.baseName = 'base.png';
    app.baseW = 0;
    app.baseH = 0;
    app.baseRgb = null;
    app.baseAlpha = null;
    app.isBgMask = null;
    app.editableMask = null;
    app.isBaseSpecialColor = null;
    const inpBase = document.getElementById('inp-base-name');
    if (inpBase) inpBase.value = 'base.png';
    const info = document.getElementById('lbl-base-info');
    if (info) info.textContent = 'ベース: 未読込';
  }

  app.isDirty = false;

  if (!silent) {
    const timeStr = formatNowTime();
    const label = reason ? ` (${reason})` : '';
    updateProjectStatusUI(app, {
      title: `✓ プロジェクトリセット完了 [${timeStr}]`,
      detail: `新規状態${label}: レイヤー・マスク・トーン・dat・上書き保存先をすべて初期化しました`,
      mode: 'reset',
      statusBarText: `✓ プロジェクトを完全リセットしました [${timeStr}]${label} | 前プロジェクトへの上書きリンク解除済`
    });
  }
}
