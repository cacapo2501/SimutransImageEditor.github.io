import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  loadGeminiConfig,
  saveGeminiConfig,
  buildDatAiPrompt,
  parseAiDatResponse,
  fetchAvailableGeminiModels,
  requestDatFromGemini,
  pasteClipboardIntoTextarea
} from './dat-ai-service.js';
import { guessInitialTileSize } from './dat-picker-viewport.js';

export class DatAiController {
  constructor(datGenerator) {
    this.gen = datGenerator;
    this.cfg = loadGeminiConfig();
    this.isGenerating = false;
  }

  syncInitialUI() {
    const inpKey = document.getElementById('inp-dat-ai-apikey');
    const chkSave = document.getElementById('chk-dat-ai-save-key');
    const selModel = document.getElementById('sel-dat-ai-model');
    const customWrap = document.getElementById('dat-ai-custom-model-wrap');
    const inpCustom = document.getElementById('inp-dat-ai-custom-model');

    if (inpKey) inpKey.value = this.cfg.apiKey || '';
    if (chkSave) chkSave.checked = Boolean(this.cfg.saveKey);

    const isKnownModel = GEMINI_MODELS.some(m => m.value === this.cfg.model);
    if (selModel) {
      selModel.value = isKnownModel ? this.cfg.model : '__custom__';
    }
    if (customWrap) {
      customWrap.style.display = isKnownModel ? 'none' : '';
    }
    if (inpCustom && !isKnownModel) {
      inpCustom.value = this.cfg.model;
    }

    this.updateObjTypeVisibility(this.gen.currentObjType);
    this.syncBalanceSliderLabels();
  }

  // コスト・バランス調整スライダーの表示ラベルを更新する
  syncBalanceSliderLabels() {
    const syncOne = (rngId, lblId, lowText, highText) => {
      const rng = document.getElementById(rngId);
      const lbl = document.getElementById(lblId);
      if (!rng || !lbl) return;
      const pct = parseInt(rng.value, 10) || 100;
      const mult = (pct / 100).toFixed(2);
      const tag = pct === 100 ? '標準' : (pct < 100 ? lowText : highText);
      lbl.textContent = `${pct}% (${mult}倍 / ${tag})`;
    };
    syncOne('rng-dat-ai-build-cost', 'lbl-dat-ai-build-cost', '低コスト', '高コスト');
    syncOne('rng-dat-ai-maint-cost', 'lbl-dat-ai-maint-cost', '省エネ', '高維持費');
    syncOne('rng-dat-ai-payload-eff', 'lbl-dat-ai-payload-eff', '快適少', '高収容');
  }

  updateObjTypeVisibility(objType) {
    const isVeh = objType === 'vehicle';
    const wrap1 = document.getElementById('dat-ai-vehicle-mode-wrap');
    const wrap2 = document.getElementById('dat-ai-vehicle-extra-wrap');
    if (wrap1) wrap1.style.display = isVeh ? '' : 'none';
    if (wrap2) wrap2.style.display = isVeh ? '' : 'none';
  }

  _persistSettings() {
    const inpKey = document.getElementById('inp-dat-ai-apikey');
    const chkSave = document.getElementById('chk-dat-ai-save-key');
    const selModel = document.getElementById('sel-dat-ai-model');
    const inpCustom = document.getElementById('inp-dat-ai-custom-model');

    const apiKey = inpKey ? inpKey.value.trim() : '';
    const saveKey = chkSave ? chkSave.checked : false;
    let model = selModel ? selModel.value : DEFAULT_GEMINI_MODEL;
    if (model === '__custom__') {
      model = (inpCustom ? inpCustom.value.trim() : '') || DEFAULT_GEMINI_MODEL;
    }

    this.cfg = { apiKey, model, saveKey };
    saveGeminiConfig(this.cfg);
  }

  // 現在開いている出力画像のサイズ・タイル寸法・有効行数/列数を算出する
  _buildCurrentImageContext(objType) {
    const app = this.gen.app;
    if (!app || !app.baseImage || !app.baseW || !app.baseH) {
      return { hasImage: false, imgW: 0, imgH: 0, tileW: 64, tileH: 64, gridRows: 0, gridCols: 0, useCut: false };
    }
    const isBld = objType === 'building' || objType === 'factory';
    const tc = app.tileCutter;
    const useCut = Boolean(isBld && tc?.shouldCutOnExport?.());
    let imgW = app.baseW;
    let imgH = app.baseH;
    let tileW = 64;
    let tileH = 64;

    if (useCut && tc) {
      tileW = tc.tileSize || 64;
      tileH = tileW;
      const outCols = Math.max(1, (tc.dimsViews || 1) * (tc.dimsW || 1) * (tc.dimsH || 1));
      const outRows = Math.max(1, (tc.seasons || 1) * (tc.frames || 1) * (tc.heightTiles || 1));
      imgW = outCols * tileW;
      imgH = outRows * tileH;
    } else {
      const [gw, gh] = guessInitialTileSize(imgW, imgH, objType, tc);
      tileW = gw;
      tileH = gh;
    }

    const gridCols = Math.max(1, Math.floor(imgW / tileW));
    const gridRows = Math.max(1, Math.floor(imgH / tileH));
    return { hasImage: true, imgW, imgH, tileW, tileH, gridRows, gridCols, useCut };
  }

  _collectPromptOptions() {
    this.gen.syncImagePrefixWithApp?.();

    const objType = this.gen.currentObjType;
    const userPrompt = (document.getElementById('inp-dat-ai-prompt')?.value || '').trim();
    const pakset = document.getElementById('sel-dat-ai-pakset')?.value || 'pak64';
    const vehicleMode = document.getElementById('sel-dat-ai-vehicle-mode')?.value || 'consist';
    const carCount = (document.getElementById('inp-dat-ai-car-count')?.value || '').trim();
    const autoSeqRows = Boolean(document.getElementById('chk-dat-ai-seq-rows')?.checked);
    const buildCostPct = parseInt(document.getElementById('rng-dat-ai-build-cost')?.value, 10) || 100;
    const maintCostPct = parseInt(document.getElementById('rng-dat-ai-maint-cost')?.value, 10) || 100;
    const payloadPct = parseInt(document.getElementById('rng-dat-ai-payload-eff')?.value, 10) || 100;
    const liveryName = this.gen.liveryMgr ? this.gen.liveryMgr.getActiveLiveryName({ forPrompt: true }) : '';
    const imageContext = this._buildCurrentImageContext(objType);
    const currentValues = { ...this.gen._getObjState(objType) };

    return {
      objType,
      userPrompt,
      pakset,
      vehicleMode,
      carCount,
      buildCostPct,
      maintCostPct,
      payloadPct,
      liveryName,
      imgPrefix: this.gen.common.imgPrefix,
      copyright: this.gen.common.copyright,
      autoSeqRows,
      imageContext,
      currentCommon: { ...this.gen.common },
      currentValues
    };
  }

  _setStatus(text, isError = false) {
    const el = document.getElementById('lbl-dat-ai-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#ff8888' : '#9cdcfe';
  }

  bindEvents() {
    const onConfigChange = () => this._persistSettings();
    document.getElementById('inp-dat-ai-apikey')?.addEventListener('input', onConfigChange);
    document.getElementById('chk-dat-ai-save-key')?.addEventListener('change', onConfigChange);
    document.getElementById('inp-dat-ai-custom-model')?.addEventListener('input', onConfigChange);

    document.getElementById('sel-dat-ai-model')?.addEventListener('change', (e) => {
      const customWrap = document.getElementById('dat-ai-custom-model-wrap');
      if (customWrap) {
        customWrap.style.display = e.target.value === '__custom__' ? '' : 'none';
      }
      this._persistSettings();
    });

    document.getElementById('btn-dat-ai-fetch-models')?.addEventListener('click', () => this.refreshAvailableModels());
    document.getElementById('btn-dat-ai-generate')?.addEventListener('click', () => this.executeGeminiGenerate());
    document.getElementById('btn-dat-ai-copy-prompt')?.addEventListener('click', () => this.copyPromptToClipboard());

    ['rng-dat-ai-build-cost', 'rng-dat-ai-maint-cost', 'rng-dat-ai-payload-eff'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => this.syncBalanceSliderLabels());
    });
    document.getElementById('btn-dat-ai-reset-balance')?.addEventListener('click', () => {
      ['rng-dat-ai-build-cost', 'rng-dat-ai-maint-cost', 'rng-dat-ai-payload-eff'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '100';
      });
      this.syncBalanceSliderLabels();
    });

    const jsonWrap = document.getElementById('dat-ai-manual-json-wrap');
    const jsonInp = document.getElementById('inp-dat-ai-manual-json');
    document.getElementById('btn-dat-ai-toggle-json')?.addEventListener('click', () => {
      if (!jsonWrap) return;
      const opening = jsonWrap.style.display === 'none';
      jsonWrap.style.display = opening ? '' : 'none';
      if (opening && jsonInp) {
        if (!jsonInp.value.trim()) {
          pasteClipboardIntoTextarea(jsonInp, (msg) => this._setStatus(msg));
        } else {
          jsonInp.focus();
        }
      }
    });
    document.getElementById('btn-dat-ai-paste-clip')?.addEventListener('click', () => {
      pasteClipboardIntoTextarea(jsonInp, (msg) => this._setStatus(msg));
    });
    document.getElementById('btn-dat-ai-cancel-json')?.addEventListener('click', () => {
      if (jsonWrap) jsonWrap.style.display = 'none';
    });
    document.getElementById('btn-dat-ai-apply-json')?.addEventListener('click', () => this.applyManualJson());
  }

  async executeGeminiGenerate() {
    if (this.isGenerating) return;
    this._persistSettings();

    const opts = this._collectPromptOptions();
    if (!opts.userPrompt) {
      alert('生成したい実車名・編成・建物などの内容を入力してください。');
      document.getElementById('inp-dat-ai-prompt')?.focus();
      return;
    }
    if (!this.cfg.apiKey) {
      const keyDetails = document.getElementById('details-dat-ai-key');
      if (keyDetails) keyDetails.open = true;
      alert('Gemini API Key を入力してください。（APIキーがない場合は「📋 プロンプト」＋「📥 JSON貼付」も利用できます）');
      document.getElementById('inp-dat-ai-apikey')?.focus();
      return;
    }

    const btn = document.getElementById('btn-dat-ai-generate');
    this.isGenerating = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ 生成中...';
    }
    this._setStatus(`AI生成中 (${this.cfg.model})...`);

    try {
      const prompt = buildDatAiPrompt(opts);
      const rawText = await requestDatFromGemini({
        apiKey: this.cfg.apiKey,
        model: this.cfg.model,
        prompt
      });
      const parsed = parseAiDatResponse(rawText, this.gen.currentObjType, this.gen.common, {
        fallbackValues: opts.currentValues,
        autoSeqRows: opts.autoSeqRows,
        gridRows: opts.imageContext?.gridRows || 0,
        gridCols: opts.imageContext?.gridCols || 0
      });
      this.gen.applyAiResult(parsed);
      this._setStatus(`完了: ${parsed.summary} (${parsed.objects.length}件)`);
    } catch (err) {
      this._setStatus(`エラー: ${err.message || err}`, true);
      alert(err.message || String(err));
    } finally {
      this.isGenerating = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✨ AIで生成・反映';
      }
    }
  }

  async refreshAvailableModels() {
    this._persistSettings();
    const apiKey = this.cfg.apiKey;
    if (!apiKey) {
      alert('モデル一覧を取得するには Gemini API Key を入力してください。');
      document.getElementById('inp-dat-ai-apikey')?.focus();
      return;
    }

    const btn = document.getElementById('btn-dat-ai-fetch-models');
    if (btn) btn.disabled = true;
    this._setStatus('利用可能なモデル一覧を取得中...');

    try {
      const models = await fetchAvailableGeminiModels(apiKey);
      const selModel = document.getElementById('sel-dat-ai-model');
      if (selModel && models.length > 0) {
        const prevVal = this.cfg.model;
        selModel.innerHTML = '';
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.value;
          opt.textContent = m.label;
          selModel.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = 'カスタムモデル名を指定...';
        selModel.appendChild(customOpt);

        if (models.some(m => m.value === prevVal)) {
          selModel.value = prevVal;
        } else {
          selModel.value = models[0].value;
        }
        const customWrap = document.getElementById('dat-ai-custom-model-wrap');
        if (customWrap) customWrap.style.display = 'none';
        this._persistSettings();
      }
      this._setStatus(`モデル一覧を更新しました (${models.length}件)`);
    } catch (err) {
      this._setStatus(`モデル取得エラー: ${err.message || err}`, true);
      alert(err.message || String(err));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async copyPromptToClipboard() {
    const opts = this._collectPromptOptions();
    if (!opts.userPrompt) {
      alert('先に「生成したい実車・建物・設備名や特徴」欄に内容を入力してください。');
      document.getElementById('inp-dat-ai-prompt')?.focus();
      return;
    }
    const prompt = buildDatAiPrompt(opts);
    try {
      await navigator.clipboard.writeText(prompt);
      this._setStatus('プロンプトをクリップボードにコピーしました');
    } catch (err) {
      alert('クリップボードへのコピーに失敗しました: ' + (err.message || err));
    }
  }

  applyManualJson() {
    const raw = document.getElementById('inp-dat-ai-manual-json')?.value || '';
    if (!raw.trim()) {
      alert('JSONテキストを貼り付けてください。');
      return;
    }
    try {
      const opts = this._collectPromptOptions();
      const parsed = parseAiDatResponse(raw, this.gen.currentObjType, this.gen.common, {
        fallbackValues: opts.currentValues,
        autoSeqRows: opts.autoSeqRows,
        gridRows: opts.imageContext?.gridRows || 0,
        gridCols: opts.imageContext?.gridCols || 0
      });
      this.gen.applyAiResult(parsed);
      const jsonWrap = document.getElementById('dat-ai-manual-json-wrap');
      if (jsonWrap) jsonWrap.style.display = 'none';
      this._setStatus(`反映完了: ${parsed.summary} (${parsed.objects.length}件)`);
    } catch (err) {
      this._setStatus(`JSON解析エラー: ${err.message || err}`, true);
      alert(err.message || String(err));
    }
  }
}
