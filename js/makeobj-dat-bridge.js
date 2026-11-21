// DAT生成モーダルと makeobj WASM コンパイルを仲介し、参照PNG収集・pak保存を行うモジュール
import { resolveSpecialColorConflicts } from './color-utils.js';
import { buildMaskImagePrefix } from './dat-livery-manager.js';
import { buildCompositeImagePrefix } from './composite-naming.js';
import { openMakeobjLicenseModal, runMakeobjCompile } from './makeobj-service.js';
import { resolveCursorIconModes } from './dat-image-formats.js';
import {
  supportsCursorIcon,
  generateAutoIconCanvas,
  parsePakArgSize,
  canvasToPngBytes,
  dataUrlToPngBytes
} from './dat-icon-generator.js';

function renderCompositePngBytes(app) {
  return new Promise((resolve, reject) => {
    const pixels = app.computeFinalImage();
    if (!pixels) {
      reject(new Error('合成画像の生成に失敗しました。'));
      return;
    }
    const copy = new Uint8ClampedArray(pixels);
    resolveSpecialColorConflicts(
      copy, app.baseW, app.baseH, app.specialColors, app.isBaseSpecialColor, app.isBgMask
    );
    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    c.getContext('2d').putImageData(new ImageData(copy, app.baseW, app.baseH), 0, 0);
    const outCanvas = app.tileCutter?.shouldCutOnExport?.() ? app.tileCutter.cutCanvas(c) : c;
    outCanvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('PNGエンコードに失敗しました。'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

// dat テキスト内の画像キー (= prefix.row.col や => prefix.row.col) から参照プレフィックスを抽出
function extractDatImagePrefixes(datText) {
  const prefixes = new Set();
  String(datText || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === '---') return;
    const m = line.match(/^(?:Image|BackImage|FrontImage|EmptyImage|FreightImage|Diagonal|ImageUp|ImageUp2|BackStart|BackRamp|BackPillar|openimage|closedimage|Cursor|Icon)[^=]*=\s*(?:>\s*)?([^\r\n]+)$/i);
    if (!m) return;
    const rhs = m[1].trim();
    const coordMatch = rhs.match(/^(.+?)\.\d+\.\d+(?:,.*)?$/);
    if (coordMatch) {
      prefixes.add(coordMatch[1].trim());
    }
  });
  return prefixes;
}

function downloadPakBlob(blob, filename) {
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

export class MakeobjDatBridge {
  constructor(datGenerator) {
    this.gen = datGenerator;
    this.extraPngMap = new Map();
    this.isCompiling = false;
  }

  bindEvents() {
    document.getElementById('inp-dat-pak-filename')?.addEventListener('input', (e) => {
      e.target.dataset.userEdited = '1';
    });

    document.getElementById('btn-dat-makeobj-license')?.addEventListener('click', () => {
      openMakeobjLicenseModal();
    });

    document.getElementById('btn-dat-makeobj-add-png')?.addEventListener('click', async () => {
      if (!this.gen.pickFileFn) return;
      const f = await this.gen.pickFileFn('.png');
      if (!f) return;
      const bytes = new Uint8Array(await f.arrayBuffer());
      this.extraPngMap.set(f.name, bytes);
      this._updateExtraLabel();
    });

    document.getElementById('btn-dat-makeobj-clear-png')?.addEventListener('click', () => {
      this.extraPngMap.clear();
      this._updateExtraLabel();
    });

    document.getElementById('btn-dat-makeobj-compile')?.addEventListener('click', () => {
      this.compileCurrentDat();
    });

    this._updateExtraLabel();
  }

  syncPakFilename(datFilename) {
    const inp = document.getElementById('inp-dat-pak-filename');
    if (!inp || inp.dataset.userEdited) return;
    const base = String(datFilename || 'addon.dat').replace(/\.dat$/i, '');
    inp.value = `${base}.pak`;
  }

  _updateExtraLabel() {
    const lbl = document.getElementById('lbl-dat-makeobj-extra-png');
    const btnClr = document.getElementById('btn-dat-makeobj-clear-png');
    const count = this.extraPngMap.size;
    if (lbl) {
      lbl.textContent = count > 0
        ? `追加PNG: ${Array.from(this.extraPngMap.keys()).join(', ')}`
        : '追加PNG: なし（編集中画像は自動添付）';
    }
    if (btnClr) btnClr.style.display = count > 0 ? '' : 'none';
  }

  _setLog(text, isError = false) {
    const el = document.getElementById('pre-dat-makeobj-log');
    if (!el) return;
    el.style.display = '';
    el.textContent = text;
    el.style.color = isError ? '#ff9999' : '#b7e8b7';
  }

  async _collectReferencedPngFiles(datText, { pakSize = 64 } = {}) {
    const filesMap = new Map();
    const app = this.gen.app;
    const neededPrefixes = extractDatImagePrefixes(datText);

    if (app?.baseImage) {
      const maskMgr = app.maskMgr;
      const useCut = Boolean(app.tileCutter?.shouldCutOnExport?.());
      const activeMask = maskMgr?.getActive?.();
      const activePrefix = activeMask
        ? buildMaskImagePrefix(app, activeMask, this.gen.liveryMgr?.useBatchImgNaming)
        : buildCompositeImagePrefix(app.baseName || 'base.png', '', { useCut });

      // 現在アクティブな合成画像をまず登録
      const activeBytes = await renderCompositePngBytes(app);
      filesMap.set(`${activePrefix}.png`, activeBytes);
      if (this.gen.common?.imgPrefix) {
        filesMap.set(`${this.gen.common.imgPrefix}.png`, activeBytes);
      }

      // 季節マスク・一括展開マスクなど他マスクが dat から参照されていれば自動レンダリング
      if (maskMgr && maskMgr.items.length > 0 && neededPrefixes.size > 0) {
        const origIdx = maskMgr.activeIndex;
        try {
          for (let i = 0; i < maskMgr.items.length; i++) {
            const m = maskMgr.items[i];
            const p1 = buildMaskImagePrefix(app, m, true);
            const p2 = buildMaskImagePrefix(app, m, false);
            const matched = [p1, p2].filter(p => neededPrefixes.has(p) && !filesMap.has(`${p}.png`));
            if (matched.length > 0) {
              maskMgr.selectMask(i);
              const bytes = await renderCompositePngBytes(app);
              matched.forEach(p => filesMap.set(`${p}.png`, bytes));
            }
          }
        } finally {
          if (origIdx >= 0 && origIdx < maskMgr.items.length && maskMgr.activeIndex !== origIdx) {
            maskMgr.selectMask(origIdx);
          }
        }
      }

      // 自動生成 Icon PNG (pakサイズに合わせて余白#E7FFFF・左上32x32ボタン合成) および外部指定 Cursor PNG を収集する
      await this._attachIconAndCursorPngs(filesMap, neededPrefixes, activePrefix, pakSize);
    }

    // ユーザーが明示的に添付した PNG で上書き可能
    this.extraPngMap.forEach((bytes, name) => filesMap.set(name, bytes));
    return Array.from(filesMap.entries()).map(([name, data]) => ({ name, data }));
  }

  async _attachIconAndCursorPngs(filesMap, neededPrefixes, activePrefix, pakSize = 64) {
    const app = this.gen.app;
    const entriesToCheck = this.gen.collectionMgr?.hasCollection?.()
      ? this.gen.collectionMgr.items
      : [{ objType: this.gen.currentObjType, common: this.gen.common, values: this.gen._getObjState(this.gen.currentObjType) }];

    for (const item of entriesToCheck) {
      if (!item || !supportsCursorIcon(item.objType)) continue;
      const v = item.values || {};
      const { iconMode, cursorMode } = resolveCursorIconModes(v);

      if (cursorMode === 'external' && v.cursorExternalName && v.cursorExternalDataUrl) {
        const curPrefix = String(v.cursorExternalName).replace(/\.png$/i, '').trim();
        const bytes = dataUrlToPngBytes(v.cursorExternalDataUrl);
        if (bytes && curPrefix) filesMap.set(`${curPrefix}.png`, bytes);
      }

      if (iconMode === 'auto') {
        const candPrefixes = new Set([
          `${item.common?.imgPrefix || ''}_icon`,
          `${activePrefix}_icon`
        ]);
        for (const iconPref of candPrefixes) {
          if (iconPref !== '_icon' && neededPrefixes.has(iconPref) && !filesMap.has(`${iconPref}.png`)) {
            const iconCanvas = await generateAutoIconCanvas(app, item.objType, v, item.common, { pakSize });
            filesMap.set(`${iconPref}.png`, await canvasToPngBytes(iconCanvas));
          }
        }
      }
    }
  }

  async compileCurrentDat() {
    if (this.isCompiling) return;
    const datText = document.getElementById('txt-dat-output')?.value || '';
    if (!datText.trim()) {
      alert('コンパイルする dat テキストが空です。');
      return;
    }

    const pakArg = document.getElementById('sel-dat-makeobj-pak')?.value || 'pak';
    const datFilename = (document.getElementById('inp-dat-filename')?.value || 'addon.dat').trim() || 'addon.dat';
    const pakFilenameRaw = (document.getElementById('inp-dat-pak-filename')?.value || 'addon.pak').trim() || 'addon.pak';
    const pakFilename = pakFilenameRaw.toLowerCase().endsWith('.pak') ? pakFilenameRaw : `${pakFilenameRaw}.pak`;

    const btn = document.getElementById('btn-dat-makeobj-compile');
    this.isCompiling = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ コンパイル中...';
    }
    this._setLog('仮想ファイルシステムへ画像を準備して makeobj を実行しています...');

    try {
      const pakSize = parsePakArgSize(pakArg);
      const files = await this._collectReferencedPngFiles(datText, { pakSize });
      const res = await runMakeobjCompile({ pakArg, pakFilename, datFilename, datText, files });
      const fileSummary = `渡したファイル: ${datFilename}, ${files.map(f => f.name).join(', ') || '(PNGなし)'}`;
      const logOut = [fileSummary, res.log || `(exit code: ${res.exitCode})`].filter(Boolean).join('\n');

      if (res.ok && res.pakBlob) {
        this._setLog(`✓ コンパイル成功: ${res.pakFilename} (${res.pakBlob.size} bytes)\n${logOut}`, false);
        downloadPakBlob(res.pakBlob, res.pakFilename);
      } else {
        this._setLog(`✕ コンパイル失敗 (exit=${res.exitCode})\n${logOut}`, true);
      }
    } catch (err) {
      this._setLog(`✕ エラー: ${err.message || err}`, true);
    } finally {
      this.isCompiling = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚙️ .pak コンパイル';
      }
    }
  }
}
