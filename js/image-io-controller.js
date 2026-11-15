import { parseSpecialColorsCsv } from './color-utils.js';
import { ProjectIO } from './project-io.js';
import { MaskGenerator } from './mask-generator.js';
import { renderSubModalsUI } from './ui-sub-modals.js';

export function safePickFile(accept = '.png') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (input.parentNode) document.body.removeChild(input);
      resolve(file || null);
    };

    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (input.parentNode) {
          document.body.removeChild(input);
          resolve(null);
        }
      }, 500);
    }, { once: true });

    input.click();
  });
}

export class ImageIOController {
  constructor(app, pickFileFn = safePickFile) {
    this.app = app;
    this.pickFileFn = pickFileFn;
  }

  bindAll() {
    this._bindNewImageModalEvents();
    this._bindDragAndDrop();
    this._bindFileAndProjectEvents();
  }

  async loadDefaultSpecialColors() {
    const app = this.app;
    const candidateFiles = [
      'special_colors.csv',
      'SpecialColor.csv',
      'SpecialColors.csv',
      'special_color.csv',
      'data/special_colors.csv',
      'csv/special_colors.csv'
    ];
    const infoLabel = document.getElementById('lbl-csv-info');

    for (const filename of candidateFiles) {
      try {
        const response = await fetch(`./${filename}`, { cache: 'no-cache' });
        if (response.ok) {
          const text = await response.text();
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) continue;

          const parsed = parseSpecialColorsCsv(text);
          if (parsed.size > 0) {
            app.specialColors = parsed;
            if (infoLabel) {
              infoLabel.textContent = `特殊色: ${app.specialColors.size}件登録済 (${filename} 1列目)`;
            }
            app.paletteManager.generateBasePalette();
            MaskGenerator.recomputeBaseSpecialColors(app);
            app.render();
            return;
          }
        }
      } catch (err) {}
    }

    if (infoLabel && app.specialColors.size === 0) {
      infoLabel.textContent = '特殊色: 0件登録済 (ルートに special_colors.csv 未検出 / 手動選択可)';
    }
  }

  openNewImageModal() {
    renderSubModalsUI();
    this._bindNewImageModalEvents();
    const modal = document.getElementById('modal-new-image');
    if (!modal) return;
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  _bindNewImageModalEvents() {
    const modal = document.getElementById('modal-new-image');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    document.querySelectorAll('.btn-preset-size').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('inp-new-width').value = btn.dataset.w;
        document.getElementById('inp-new-height').value = btn.dataset.h;
      };
    });

    document.getElementById('btn-new-img-ok').onclick = () => {
      const w = parseInt(document.getElementById('inp-new-width').value, 10) || 64;
      const h = parseInt(document.getElementById('inp-new-height').value, 10) || 96;
      const openPaint = document.getElementById('chk-new-open-paint').checked;
      modal.close();
      this.app.createNewBlankBaseImage(w, h, openPaint);
    };

    document.getElementById('btn-new-img-cancel').onclick = () => modal.close();
  }

  _bindDragAndDrop() {
    const app = this.app;
    app.viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    app.viewport.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      for (const file of files) {
        if (file.name.endsWith('.proj.json') || file.name.endsWith('.json')) {
          ProjectIO.load(app, file);
        } else if (/bp\d{3}h\d{3}/i.test(file.name) && app.aircraftCtrl) {
          // ★追加1: ドラッグ＆ドロップ時に bpXXXhYYY なら平面定義画像として読込
          await app.aircraftCtrl.loadPlanFromFile(file);
        } else if (file.name.includes('mask') || file.name.includes('paint')) {
          await app.loadMaskFromFile(file);
        } else if (file.type.startsWith('image/')) {
          await app.loadBaseFromFile(file);
        }
      }
    });
  }

  _bindFileAndProjectEvents() {
    const app = this.app;

    document.getElementById('btn-new-base')?.addEventListener('click', () => this.openNewImageModal());
    document.getElementById('btn-open-deftile-builder')?.addEventListener('click', () => app.deftileBuilder.open());

    document.getElementById('btn-load-base').onclick = async () => {
      const f = await this.pickFileFn('.png');
      if (f) app.loadBaseFromFile(f);
    };
    document.getElementById('btn-load-mask').onclick = async () => {
      const f = await this.pickFileFn('.png');
      if (f) app.loadMaskFromFile(f);
    };
    document.getElementById('btn-regen-mask').onclick = () => {
      app.regenerateMaskFromBase();
    };
    document.getElementById('btn-save-base').onclick = () => ProjectIO.exportBasePng(app);
    document.getElementById('btn-save-mask').onclick = () => ProjectIO.exportMaskPng(app);

    document.getElementById('btn-paint-base').onclick = () => {
      if (!app.baseImage) {
        this.openNewImageModal();
        return;
      }
      app.paintEditor.open('base');
    };

    document.getElementById('btn-paint-mask').onclick = () => {
      if (!app.baseImage) {
        alert('先にベース画像を開くか、新規作成してください。');
        return;
      }
      if (!app.maskImage) {
        MaskGenerator.generateFromBase(app);
      }
      app.paintEditor.open('mask');
    };

    document.getElementById('btn-load-folder').onclick = async () => {
      const files = await app.storage.pickLocalDirectory();
      if (files && files.length > 0) {
        const base = files.find(f => f.name.includes('def') || f.name.includes('base')) || files[0];
        const mask = files.find(f => f.name.includes('paint') || f.name.includes('mask'));
        await app.loadBaseFromFile(base);
        if (mask) await app.loadMaskFromFile(mask);
      }
    };

    document.getElementById('btn-google-drive').onclick = async () => {
      const apiKey = document.getElementById('gdrive-api-key').value.trim();
      const clientId = document.getElementById('gdrive-client-id').value.trim();
      const res = await app.storage.openGoogleDrivePicker(apiKey, clientId);
      if (res) {
        const file = new File([res.blob], res.name, { type: res.blob.type });
        if (res.name.endsWith('.proj.json') || res.name.endsWith('.json')) ProjectIO.load(app, file);
        // ★追加2: Google Drive 読込時も bpXXXhYYY なら平面定義画像として読込
        else if (/bp\d{3}h\d{3}/i.test(res.name) && app.aircraftCtrl) await app.aircraftCtrl.loadPlanFromFile(file);
        else if (res.name.includes('mask') || res.name.includes('paint')) app.loadMaskFromFile(file);
        else app.loadBaseFromFile(file);
      }
    };

    document.getElementById('file-csv').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const r = new FileReader();
        r.onload = () => {
          app.specialColors = parseSpecialColorsCsv(r.result);
          document.getElementById('lbl-csv-info').textContent = `特殊色: ${app.specialColors.size}件登録済 (1列目読込)`;
          app.paletteManager.generateBasePalette();
          MaskGenerator.recomputeBaseSpecialColors(app);
          app.markDirty();
          app.render();
        };
        r.readAsText(file);
      }
    };

    document.getElementById('btn-save-proj').onclick = () => ProjectIO.save(app);
    document.getElementById('btn-save-proj-as').onclick = () => ProjectIO.save(app);
    document.getElementById('btn-load-proj').onclick = async () => {
      const f = await this.pickFileFn('.json');
      if (f) ProjectIO.load(app, f);
    };
    document.getElementById('btn-save-png').onclick = () => ProjectIO.exportPng(app);
  }
}