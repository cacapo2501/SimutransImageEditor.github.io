import { resolveSpecialColorConflicts } from './color-utils.js';

function renderCurrentCompositeBlob(app) {
  return new Promise((resolve, reject) => {
    const pixels = app.computeFinalImage();
    if (!pixels) {
      reject(new Error('合成画像の生成に失敗しました。'));
      return;
    }
    const copy = new Uint8ClampedArray(pixels);
    resolveSpecialColorConflicts(
      copy,
      app.baseW,
      app.baseH,
      app.specialColors,
      app.isBaseSpecialColor,
      app.isBgMask
    );

    const c = document.createElement('canvas');
    c.width = app.baseW;
    c.height = app.baseH;
    c.getContext('2d').putImageData(new ImageData(copy, app.baseW, app.baseH), 0, 0);
    c.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNGエンコードに失敗しました。'));
    }, 'image/png');
  });
}

function buildOutputFilename(baseName, suffixTag) {
  const cleanBase = (baseName || 'output.png').replace(/\.png$/i, '');
  const cleanTag = (suffixTag || '').replace(/\.png$/i, '').replace(/[\\/:*?"<>|]/g, '_');
  if (!cleanTag) return `${cleanBase}_combined.png`;
  return `${cleanBase}_${cleanTag}_combined.png`;
}

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class BatchExporter {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    document.getElementById('btn-batch-export-masks')?.addEventListener('click', () => {
      this.exportAllMasks(false);
    });
    document.getElementById('btn-batch-export-masks-dir')?.addEventListener('click', () => {
      this.exportAllMasks(true);
    });
    document.getElementById('btn-batch-export-variants')?.addEventListener('click', () => {
      this.exportSeedVariants(false);
    });
  }

  async _pickTargetDirectoryIfRequested(toDirectory) {
    if (!toDirectory) return null;
    if (!window.showDirectoryPicker) {
      alert('お使いのブラウザはフォルダ直接保存APIに未対応のため、通常の連続ダウンロードで出力します。');
      return null;
    }
    try {
      return await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      return 'CANCELLED';
    }
  }

  async _saveBlob(blob, filename, dirHandle) {
    if (dirHandle) {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      triggerBrowserDownload(blob, filename);
      await sleep(220);
    }
  }

  // 登録されている全マスク画像を順番に切り替えて結合画像を連続出力
  async exportAllMasks(toDirectory = false) {
    const app = this.app;
    if (!app.baseImage) {
      alert('ベース画像が読み込まれていません。');
      return;
    }

    const maskMgr = app.maskMgr;
    if (!maskMgr || maskMgr.items.length === 0) {
      alert('マスク画像が登録されていません。');
      return;
    }

    const dirHandle = await this._pickTargetDirectoryIfRequested(toDirectory);
    if (dirHandle === 'CANCELLED') return;

    const statusEl = document.getElementById('lbl-batch-export-status');
    const origIdx = maskMgr.activeIndex;
    const total = maskMgr.items.length;

    try {
      for (let i = 0; i < total; i++) {
        if (statusEl) statusEl.textContent = `連続出力中... (${i + 1} / ${total})`;
        maskMgr.selectMask(i);
        const item = maskMgr.items[i];
        const blob = await renderCurrentCompositeBlob(app);
        const filename = buildOutputFilename(app.baseName, item.name);
        await this._saveBlob(blob, filename, dirHandle);
      }
      if (statusEl) statusEl.textContent = `連続出力完了: 全 ${total} 枚の結合画像を出力しました`;
    } catch (err) {
      alert('連続出力中にエラーが発生しました: ' + (err.message || err));
      if (statusEl) statusEl.textContent = '連続出力中断';
    } finally {
      if (origIdx >= 0 && origIdx < maskMgr.items.length) {
        maskMgr.selectMask(origIdx);
      }
    }
  }

  // 現在のマスク状態で連番バリエーション（窓ランダム暗転シード変更等）を指定枚数連続出力
  async exportSeedVariants(toDirectory = false) {
    const app = this.app;
    if (!app.baseImage) {
      alert('ベース画像が読み込まれていません。');
      return;
    }

    const count = Math.max(1, Math.min(100, parseInt(document.getElementById('inp-batch-variant-count')?.value, 10) || 4));
    const rerollWindow = Boolean(document.getElementById('chk-batch-reroll-window')?.checked);
    const dirHandle = await this._pickTargetDirectoryIfRequested(toDirectory);
    if (dirHandle === 'CANCELLED') return;

    const statusEl = document.getElementById('lbl-batch-export-status');
    const origSeed = app.windowDarken.seed;

    try {
      for (let i = 0; i < count; i++) {
        if (statusEl) statusEl.textContent = `連続出力中... (${i + 1} / ${count})`;
        if (rerollWindow && i > 0) {
          app.windowDarken.seed = Math.floor(Math.random() * 0x7FFFFFFF) + 1;
        }
        const blob = await renderCurrentCompositeBlob(app);
        const seq = String(i + 1).padStart(2, '0');
        const maskTag = app.maskImage ? app.maskName.replace(/\.png$/i, '') : '';
        const tag = maskTag ? `${maskTag}_${seq}` : seq;
        const filename = buildOutputFilename(app.baseName, tag);
        await this._saveBlob(blob, filename, dirHandle);
      }
      if (statusEl) statusEl.textContent = `連続出力完了: ${count} 枚の結合画像を出力しました`;
    } catch (err) {
      alert('連続出力中にエラーが発生しました: ' + (err.message || err));
      if (statusEl) statusEl.textContent = '連続出力中断';
    } finally {
      app.windowDarken.seed = origSeed;
      app.render();
    }
  }
}