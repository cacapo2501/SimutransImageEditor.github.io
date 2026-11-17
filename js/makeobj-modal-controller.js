// makeobj コンパイル ＆ ja.tab 出力 ＆ AI設定支援モーダル制御モジュール
import { renderMakeobjCompileModalUI } from './ui-makeobj-modal.js';
import {
  parseDatObjectsSummary,
  collectJaTabEntries,
  buildJaTabText,
  parseJaTabText,
  downloadJaTabText,
  deriveSinglePakFilename
} from './ja-tab-helper.js';
import { downloadDatText } from './dat-serializer.js';
import { loadMakeobjMeta, openMakeobjLicenseModal, runMakeobjCompile } from './makeobj-service.js';
import { bindMakeobjModalAiEvents } from './makeobj-ai-assist.js';

function downloadPakFile(blob, filename) {
  const clean = (filename || 'addon.pak').trim();
  const outName = clean.toLowerCase().endsWith('.pak') ? clean : `${clean}.pak`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export class MakeobjModalController {
  constructor(app) {
    this.app = app;
    this.initialized = false;
    this.isCompiling = false;
    this.isAssisting = false;
    this.extraPngMap = new Map();
  }

  bindEvents() {
    document.getElementById('btn-sidebar-makeobj')?.addEventListener('click', () => this.open());
    document.getElementById('btn-tool-open-makeobj')?.addEventListener('click', () => this.open());
  }

  _ensureInitialized() {
    if (this.initialized) return;
    renderMakeobjCompileModalUI();
    this._bindModalEvents();
    this.initialized = true;
  }

  _buildInitialDatFromApp() {
    const gen = this.app?.datGenerator;
    if (!gen) return '';
    const txtOut = document.getElementById('txt-dat-output');
    if (gen.initialized && txtOut && txtOut.value.trim()) {
      return txtOut.value;
    }
    if (gen.collectionMgr?.hasCollection?.()) {
      const combined = gen.collectionMgr.buildCombinedText();
      if (combined) return combined;
    }
    if (!gen.hasOpenedOnce) {
      gen.common.imgPrefix = gen._deriveImagePrefixFromApp();
      gen.common.name = gen._deriveAddonNameFromApp(gen.currentObjType);
    }
    return gen.buildCurrentText();
  }

  _collectKnownJaNames() {
    const map = new Map();
    const gen = this.app?.datGenerator;
    if (gen) {
      if (gen.common?.name && gen.common?.jaName) {
        map.set(gen.common.name.trim(), gen.common.jaName.trim());
      }
      if (gen.collectionMgr?.items) {
        gen.collectionMgr.items.forEach((it) => {
          const n = String(it.common?.name || '').trim();
          const jn = String(it.common?.jaName || '').trim();
          if (n && jn) map.set(n, jn);
        });
      }
    }
    const curTabEl = document.getElementById('txt-mk-jatab');
    if (curTabEl && curTabEl.value.trim()) {
      parseJaTabText(curTabEl.value).forEach((v, k) => {
        if (!map.has(k) || v !== k) map.set(k, v);
      });
    }
    return map;
  }

  _guessInitialPakArg() {
    const tc = this.app?.tileCutter;
    const w = this.app?.baseW || 0;
    const sz = tc?.shouldCutOnExport?.() ? tc.tileSize : (w >= 1024 ? 128 : 64);
    if (sz === 128) return 'pak128';
    if (sz === 96) return 'pak96';
    if (sz === 192) return 'pak192';
    if (sz === 256) return 'pak256';
    return 'pak';
  }

  async open({ forceSyncFromDat = true } = {}) {
    this._ensureInitialized();
    const meta = await loadMakeobjMeta();
    const badge = document.getElementById('lbl-mk-version-badge');
    if (badge) {
      badge.textContent = meta.available && meta.version
        ? `makeobj ${meta.version} (Standard)`
        : 'makeobj: 未ビルド (Standard)';
    }

    if (forceSyncFromDat) {
      this.syncFromDatEditor({ keepUserNames: false });
    } else {
      this._refreshObjectSummary();
    }

    const modal = document.getElementById('modal-makeobj-compile');
    if (!modal) return;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  syncFromDatEditor({ keepUserNames = true } = {}) {
    const datEl = document.getElementById('txt-mk-dat');
    const inpDat = document.getElementById('inp-mk-dat-name');
    const inpPak = document.getElementById('inp-mk-pak-name');
    const selPak = document.getElementById('sel-mk-pak-arg');

    const datText = this._buildInitialDatFromApp();
    if (datEl) datEl.value = datText;

    const objects = parseDatObjectsSummary(datText);
    const srcDatFilename = document.getElementById('inp-dat-filename')?.value?.trim() || '';

    if (inpDat && (!keepUserNames || !inpDat.dataset.userEdited)) {
      const derivedDat = srcDatFilename || `${this.app?.datGenerator?.common?.name || 'addon'}.dat`;
      inpDat.value = derivedDat.toLowerCase().endsWith('.dat') ? derivedDat : `${derivedDat}.dat`;
    }
    if (inpPak && (!keepUserNames || !inpPak.dataset.userEdited)) {
      inpPak.value = deriveSinglePakFilename(inpDat?.value, this.app?.baseName, objects);
    }
    if (selPak && !selPak.dataset.userEdited) {
      const datSelPak = document.getElementById('sel-dat-makeobj-pak')?.value;
      selPak.value = datSelPak || this._guessInitialPakArg();
    }

    this.rebuildJaTabFromDat();
    this._refreshObjectSummary();
  }

  _refreshObjectSummary() {
    const datText = document.getElementById('txt-mk-dat')?.value || '';
    const objects = parseDatObjectsSummary(datText);
    const summaryEl = document.getElementById('lbl-mk-obj-summary');
    if (!summaryEl) return;

    if (objects.length === 0) {
      summaryEl.textContent = '検出オブジェクト: 0件（obj= / name= 行を確認してください）';
      return;
    }
    const counts = new Map();
    objects.forEach(o => counts.set(o.objType, (counts.get(o.objType) || 0) + 1));
    const breakdown = Array.from(counts.entries()).map(([k, v]) => `${k}×${v}`).join(', ');
    summaryEl.textContent = objects.length > 1
      ? `検出オブジェクト: 計${objects.length}件 (${breakdown}) → 1つの .pak にまとめて出力`
      : `検出オブジェクト: 1件 (${breakdown})`;
  }

  rebuildJaTabFromDat() {
    const datText = document.getElementById('txt-mk-dat')?.value || '';
    const known = this._collectKnownJaNames();
    const entries = collectJaTabEntries(datText, known);
    const tabEl = document.getElementById('txt-mk-jatab');
    if (tabEl) tabEl.value = buildJaTabText(entries);
  }

  _updateExtraPngLabel() {
    const lbl = document.getElementById('lbl-mk-extra-png');
    const btnClr = document.getElementById('btn-mk-clear-png');
    const count = this.extraPngMap.size;
    if (lbl) {
      lbl.textContent = count > 0
        ? `追加PNG: ${Array.from(this.extraPngMap.keys()).join(', ')}`
        : '追加PNG: なし（編集中画像は自動添付）';
    }
    if (btnClr) btnClr.style.display = count > 0 ? '' : 'none';
  }

  async compileToSinglePak() {
    if (this.isCompiling) return;
    const datText = document.getElementById('txt-mk-dat')?.value || '';
    if (!datText.trim()) return alert('コンパイルする .dat テキストが空です。');

    const pakArg = document.getElementById('sel-mk-pak-arg')?.value || 'pak';
    const datFilename = (document.getElementById('inp-mk-dat-name')?.value || 'addon.dat').trim() || 'addon.dat';
    const pakRaw = (document.getElementById('inp-mk-pak-name')?.value || 'addon.pak').trim() || 'addon.pak';
    const pakFilename = pakRaw.toLowerCase().endsWith('.pak') ? pakRaw : `${pakRaw}.pak`;

    const btn = document.getElementById('btn-mk-compile');
    const statusEl = document.getElementById('lbl-mk-compile-status');
    const logEl = document.getElementById('pre-mk-log');
    this.isCompiling = true;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ コンパイル中...'; }
    if (statusEl) statusEl.textContent = '画像を収集して makeobj を実行しています...';
    if (logEl) { logEl.style.display = ''; logEl.style.color = '#b7e8b7'; logEl.textContent = '準備中...'; }

    try {
      const bridge = this.app?.datGenerator?.makeobjBridge;
      const autoFiles = bridge ? await bridge._collectReferencedPngFiles(datText) : [];
      const merged = new Map(autoFiles.map(f => [f.name, f.data]));
      this.extraPngMap.forEach((bytes, name) => merged.set(name, bytes));
      const files = Array.from(merged.entries()).map(([name, data]) => ({ name, data }));

      const res = await runMakeobjCompile({ pakArg, pakFilename, datFilename, datText, files });
      const fileList = `渡したファイル: ${datFilename}, ${files.map(f => f.name).join(', ') || '(PNGなし)'}`;
      const logOut = [fileList, res.log || `(exit code: ${res.exitCode})`].filter(Boolean).join('\n');

      if (res.ok && res.pakBlob) {
        if (statusEl) statusEl.textContent = `✓ 成功: ${res.pakFilename} (${res.pakBlob.size} bytes) を1つのpakとして生成`;
        if (logEl) { logEl.style.color = '#b7e8b7'; logEl.textContent = logOut; }
        downloadPakFile(res.pakBlob, res.pakFilename);
      } else {
        if (statusEl) statusEl.textContent = `✕ コンパイル失敗 (exit=${res.exitCode})`;
        if (logEl) { logEl.style.color = '#ff9999'; logEl.textContent = logOut; }
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `✕ エラー: ${err.message || err}`;
      if (logEl) { logEl.style.color = '#ff9999'; logEl.textContent = err.message || String(err); }
    } finally {
      this.isCompiling = false;
      if (btn) { btn.disabled = false; btn.textContent = '⚙️ 1つの .pak にコンパイルして保存'; }
    }
  }

  _bindModalEvents() {
    const modal = document.getElementById('modal-makeobj-compile');
    const close = () => modal?.close();
    document.getElementById('btn-mk-close-top')?.addEventListener('click', close);
    document.getElementById('btn-mk-close')?.addEventListener('click', close);
    document.getElementById('btn-mk-license-top')?.addEventListener('click', () => openMakeobjLicenseModal());
    document.getElementById('btn-mk-license-foot')?.addEventListener('click', () => openMakeobjLicenseModal());

    document.getElementById('sel-mk-pak-arg')?.addEventListener('change', (e) => { e.target.dataset.userEdited = '1'; });
    document.getElementById('inp-mk-pak-name')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });
    document.getElementById('inp-mk-dat-name')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });
    document.getElementById('txt-mk-dat')?.addEventListener('input', () => this._refreshObjectSummary());

    document.getElementById('btn-mk-sync-dat')?.addEventListener('click', () => this.syncFromDatEditor({ keepUserNames: false }));
    document.getElementById('btn-mk-open-dat-editor')?.addEventListener('click', () => {
      close();
      this.app?.datGenerator?.open?.();
    });
    document.getElementById('btn-mk-load-dat')?.addEventListener('click', async () => {
      const f = await this.app?.datGenerator?.pickFileFn?.('.dat,.txt');
      if (!f) return;
      const text = await f.text();
      const datEl = document.getElementById('txt-mk-dat');
      if (datEl) datEl.value = text;
      const inpDat = document.getElementById('inp-mk-dat-name');
      if (inpDat) { inpDat.value = f.name; inpDat.dataset.userEdited = '1'; }
      const inpPak = document.getElementById('inp-mk-pak-name');
      if (inpPak && !inpPak.dataset.userEdited) {
        inpPak.value = deriveSinglePakFilename(f.name, '', parseDatObjectsSummary(text));
      }
      this.rebuildJaTabFromDat();
      this._refreshObjectSummary();
    });
    document.getElementById('btn-mk-save-dat')?.addEventListener('click', () => {
      const txt = document.getElementById('txt-mk-dat')?.value || '';
      if (!txt.trim()) return alert('保存する .dat が空です。');
      downloadDatText(txt, document.getElementById('inp-mk-dat-name')?.value || 'addon.dat');
    });

    document.getElementById('btn-mk-add-png')?.addEventListener('click', async () => {
      const f = await this.app?.datGenerator?.pickFileFn?.('.png');
      if (!f) return;
      this.extraPngMap.set(f.name, new Uint8Array(await f.arrayBuffer()));
      this._updateExtraPngLabel();
    });
    document.getElementById('btn-mk-clear-png')?.addEventListener('click', () => {
      this.extraPngMap.clear();
      this._updateExtraPngLabel();
    });

    document.getElementById('btn-mk-rebuild-jatab')?.addEventListener('click', () => this.rebuildJaTabFromDat());
    document.getElementById('btn-mk-load-jatab')?.addEventListener('click', async () => {
      const f = await this.app?.datGenerator?.pickFileFn?.('.tab,.txt');
      if (!f) return;
      const tabEl = document.getElementById('txt-mk-jatab');
      if (tabEl) tabEl.value = await f.text();
    });
    document.getElementById('btn-mk-copy-jatab')?.addEventListener('click', async () => {
      const txt = document.getElementById('txt-mk-jatab')?.value || '';
      if (!txt.trim()) return;
      await navigator.clipboard.writeText(txt);
    });
    document.getElementById('btn-mk-save-jatab')?.addEventListener('click', () => {
      const txt = document.getElementById('txt-mk-jatab')?.value || '';
      if (!txt.trim()) return alert('保存する ja.tab が空です。');
      downloadJaTabText(txt, 'ja.tab');
    });

    bindMakeobjModalAiEvents(this);
    document.getElementById('btn-mk-compile')?.addEventListener('click', () => this.compileToSinglePak());
  }
}
