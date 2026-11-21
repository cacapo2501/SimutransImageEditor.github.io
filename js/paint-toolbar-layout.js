// ペイントエディタ上部ツールバーのガイド設定・折りたたみ開閉・タブレット向けコンパクトレイアウト制御モジュール

// 補助線・タイル菱形ガイドの入力イベントをバインドする
export function bindPaintGuideControls(editor) {
  const chkGrid = document.getElementById('chk-paint-grid');
  const inpGridStep = document.getElementById('inp-paint-grid-step');
  const inpGridColor = document.getElementById('inp-paint-grid-color');
  const chkIso = document.getElementById('chk-paint-iso');
  const inpIsoW = document.getElementById('inp-paint-iso-w');
  const inpIsoH = document.getElementById('inp-paint-iso-h');
  const inpIsoColor = document.getElementById('inp-paint-iso-color');

  if (chkGrid) chkGrid.onchange = (e) => { editor.showGrid = e.target.checked; editor._drawOverlay(); };
  if (inpGridStep) inpGridStep.oninput = (e) => { editor.gridStep = Math.max(1, Math.min(256, parseInt(e.target.value, 10) || 8)); editor._drawOverlay(); };
  if (inpGridColor) inpGridColor.oninput = (e) => { editor.gridColor = e.target.value; editor._drawOverlay(); };

  if (chkIso) chkIso.onchange = (e) => { editor.showIsoTile = e.target.checked; editor._drawOverlay(); };
  if (inpIsoW) {
    inpIsoW.oninput = (e) => {
      const w = Math.max(4, Math.min(512, parseInt(e.target.value, 10) || 64));
      editor.isoTileW = w;
      const autoH = Math.max(2, Math.round(w / 2));
      editor.isoTileH = autoH;
      if (inpIsoH) inpIsoH.value = autoH;
      editor._drawOverlay();
    };
  }
  if (inpIsoH) inpIsoH.oninput = (e) => { editor.isoTileH = Math.max(2, Math.min(512, parseInt(e.target.value, 10) || 32)); editor._drawOverlay(); };
  if (inpIsoColor) inpIsoColor.oninput = (e) => { editor.isoColor = e.target.value; editor._drawOverlay(); };
}

// ツール行・詳細ガイド行・左パレットペインの開閉状態をボタン表示と同期する
export function syncPaintToolbarToggleUI(editor) {
  const toolsRow = document.getElementById('paint-toolbar-tools');
  const extraRow = document.getElementById('paint-toolbar-extra');
  const sidebar = document.getElementById('paint-sidebar');
  const btnTools = document.getElementById('btn-paint-toggle-tools');
  const btnExtra = document.getElementById('btn-paint-toggle-extra');
  const btnSide = document.getElementById('btn-paint-toggle-sidebar');

  if (btnTools && toolsRow) {
    const open = !toolsRow.classList.contains('collapsed');
    btnTools.classList.toggle('active', open);
    btnTools.textContent = open ? '🛠️ ツール ▾' : '🛠️ ツール ▸';
  }
  if (btnExtra && extraRow) {
    const open = !extraRow.classList.contains('collapsed');
    btnExtra.classList.toggle('active', open);
    btnExtra.textContent = open ? '🔧 ガイド・設定 ▾' : '🔧 ガイド・設定 ▸';
  }
  if (btnSide && sidebar) {
    const open = !sidebar.classList.contains('collapsed');
    btnSide.classList.toggle('active', open);
    btnSide.textContent = open ? '🎨 パレット' : '🎨 パレット(閉)';
  }
  if (editor?.rectHandles) editor.rectHandles.updateUI();
}

// タブレット等の狭小・タッチ画面向けにツールバー折りたたみトグルをバインドする
export function bindPaintToolbarToggles(inputCtrl) {
  const toggleEl = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('collapsed');
    inputCtrl.hasUserToggledLayout = true;
    syncPaintToolbarToggleUI(inputCtrl.editor);
  };

  document.getElementById('btn-paint-toggle-tools')?.addEventListener('click', () => toggleEl('paint-toolbar-tools'));
  document.getElementById('btn-paint-toggle-extra')?.addEventListener('click', () => toggleEl('paint-toolbar-extra'));
  document.getElementById('btn-paint-toggle-sidebar')?.addEventListener('click', () => toggleEl('paint-sidebar'));
}

// 端末サイズ・タッチ環境に応じて初期表示時のコンパクトレイアウトを適用する
export function applyDefaultPaintCompactLayout(inputCtrl) {
  if (inputCtrl?.hasUserToggledLayout) return;
  const isTabletOrCompact =
    (typeof window !== 'undefined' && Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) ||
    (typeof window !== 'undefined' && (window.innerWidth <= 1180 || window.innerHeight <= 820));

  const extraRow = document.getElementById('paint-toolbar-extra');
  if (extraRow) {
    extraRow.classList.toggle('collapsed', isTabletOrCompact);
  }
  syncPaintToolbarToggleUI(inputCtrl?.editor);
}
