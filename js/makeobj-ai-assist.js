// makeobj (.pak コンパイル設定) ＆ ja.tab 日本語翻訳の AI 設定支援モジュール
import { loadGeminiConfig, requestDatFromGemini, extractJsonText, pasteClipboardIntoTextarea } from './dat-ai-service.js';
import { parseDatObjectsSummary, collectJaTabEntries, buildJaTabText } from './ja-tab-helper.js';

const VALID_PAK_ARGS = new Set(['pak', 'pak32', 'pak48', 'pak64', 'pak96', 'pak128', 'pak192', 'pak256']);

export function buildMakeobjAssistPrompt({
  datText,
  baseW = 0,
  baseH = 0,
  currentPakArg = 'pak',
  pakFilename = 'addon.pak',
  userHint = ''
}) {
  const objects = parseDatObjectsSummary(datText);
  const objListText = objects.length > 0
    ? objects.map(o => `- obj=${o.objType}, name=${o.name || '(未設定)'}, waytype=${o.waytype || '-'}`).join('\n')
    : '(オブジェクト未検出)';

  const datPreview = String(datText || '').slice(0, 6000);

  return `あなたは Simutrans アドオン開発（makeobj コンパイルおよび ja.tab 翻訳作成）の専門家です。
以下の画像サイズ・現在の .dat 内容・ユーザーメモを分析し、最適な makeobj 設定と ja.tab 用の自然な日本語名を JSON 形式で提案してください。

【現在の状態】
- 編集中画像サイズ: ${baseW && baseH ? `${baseW}×${baseH}px` : '不明'}
- 現在の pak 指定: ${currentPakArg}
- 現在の出力 .pak 名: ${pakFilename}
- ユーザーメモ / 要望: ${userHint || '(特になし)'}

【dat内の検出オブジェクト一覧 (${objects.length}件)】
${objListText}

【datテキスト抜粋】
${datPreview}

【推論ルール】
1. "recommendedPakArg" は次の中から画像サイズや記述内容に最も合うものを1つ選択:
   "pak", "pak32", "pak48", "pak64", "pak96", "pak128", "pak192", "pak256"
   （画像幅が 512〜768 の 64px タイル系や一般標準は "pak" または "pak64"、96px系は "pak96"、128px系は "pak128" など）
2. "recommendedPakFilename" は複数車両が1つの dat に含まれている場合でも 1つの .pak にまとめる適切なファイル名（末尾 .pak）を提案。
3. "translations" は検出された各 name をキー、ja.tab 用のわかりやすい日本語表示名を値とするオブジェクトにする。
   - 車両名に (Chuo) や (205系) 等の括弧・型式が含まれる場合は「鉄道会社/路線・形式名・車種 (塗装)」等を読みやすく日本語化。
   - 複数車両がある場合は編成内の役割（クハ・モハ・先頭車・中間車など）もわかるように訳す。
4. "advice" は 2〜4行の短い日本語アドバイス（選択した pak サイズの根拠、dat 記述上の注意点や画像サイズ整合の警告があれば記載）。

【出力JSONスキーマ（厳守・Markdown不要・純粋なJSONのみ）】
{
  "recommendedPakArg": "pak",
  "recommendedPakFilename": "addon.pak",
  "advice": "設定アドバイス...",
  "translations": {
    "object_name_1": "日本語表示名1"
  }
}`;
}

export function parseMakeobjAssistResponse(rawText) {
  const jsonStr = extractJsonText(rawText);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('AIの応答をJSONとして解析できませんでした: ' + err.message);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AIの応答が空または不正です。');
  }

  let rawPak = String(parsed.recommendedPakArg || 'pak').trim().toLowerCase();
  if (/^\d+$/.test(rawPak)) rawPak = `pak${rawPak}`;
  const recommendedPakArg = VALID_PAK_ARGS.has(rawPak) ? rawPak : 'pak';

  let recommendedPakFilename = String(parsed.recommendedPakFilename || '').trim();
  if (recommendedPakFilename && !recommendedPakFilename.toLowerCase().endsWith('.pak')) {
    recommendedPakFilename += '.pak';
  }

  const translations = {};
  if (parsed.translations && typeof parsed.translations === 'object') {
    Object.entries(parsed.translations).forEach(([k, v]) => {
      const key = String(k || '').trim();
      const val = String(v || '').trim();
      if (key && val) translations[key] = val;
    });
  }

  return {
    recommendedPakArg,
    recommendedPakFilename,
    advice: String(parsed.advice || '').trim(),
    translations
  };
}

export async function requestMakeobjAssist(opts) {
  const cfg = loadGeminiConfig();
  if (!cfg.apiKey) {
    throw new Error(
      'Gemini API Key が未設定です。\n「dat生成・編集エディタ」内の Gemini API 設定でキーを入力するか、「📋 AIプロンプト」＋「📥 JSON貼付」をご利用ください。'
    );
  }
  const prompt = buildMakeobjAssistPrompt(opts);
  const raw = await requestDatFromGemini({
    apiKey: cfg.apiKey,
    model: cfg.model,
    prompt
  });
  return parseMakeobjAssistResponse(raw);
}

export function applyMakeobjAssistToModal(ctrl, res) {
  const selPak = document.getElementById('sel-mk-pak-arg');
  const inpPak = document.getElementById('inp-mk-pak-name');
  const adviceEl = document.getElementById('lbl-mk-ai-advice');

  if (selPak && res.recommendedPakArg) {
    selPak.value = res.recommendedPakArg;
    selPak.dataset.userEdited = '1';
  }
  if (inpPak && res.recommendedPakFilename && !inpPak.dataset.userEdited) {
    inpPak.value = res.recommendedPakFilename;
  }

  const datText = document.getElementById('txt-mk-dat')?.value || '';
  const map = ctrl._collectKnownJaNames();
  Object.entries(res.translations || {}).forEach(([k, v]) => map.set(k, v));

  const gen = ctrl.app?.datGenerator;
  if (gen) {
    if (gen.common?.name && map.has(gen.common.name)) {
      gen.common.jaName = map.get(gen.common.name);
      const inpJa = document.getElementById('inp-dat-ja-name');
      if (inpJa) inpJa.value = gen.common.jaName;
    }
    gen.collectionMgr?.items?.forEach((it) => {
      if (it.common?.name && map.has(it.common.name)) {
        it.common.jaName = map.get(it.common.name);
      }
    });
  }

  const entries = collectJaTabEntries(datText, map);
  const tabEl = document.getElementById('txt-mk-jatab');
  if (tabEl) tabEl.value = buildJaTabText(entries);

  if (adviceEl) {
    adviceEl.style.color = '#9cdcfe';
    adviceEl.textContent = `AI提案 (${res.recommendedPakArg}): ${res.advice || '設定と ja.tab を反映しました。'}`;
  }
}

export function bindMakeobjModalAiEvents(ctrl) {
  const getOpts = () => ({
    datText: document.getElementById('txt-mk-dat')?.value || '',
    baseW: ctrl.app?.baseW || 0,
    baseH: ctrl.app?.baseH || 0,
    currentPakArg: document.getElementById('sel-mk-pak-arg')?.value || 'pak',
    pakFilename: document.getElementById('inp-mk-pak-name')?.value || 'addon.pak',
    userHint: document.getElementById('inp-mk-ai-hint')?.value?.trim() || ''
  });

  document.getElementById('btn-mk-ai-assist')?.addEventListener('click', async () => {
    if (ctrl.isAssisting) return;
    const opts = getOpts();
    if (!opts.datText.trim()) return alert('先に .dat テキストを用意してください。');

    const btn = document.getElementById('btn-mk-ai-assist');
    const adviceEl = document.getElementById('lbl-mk-ai-advice');
    ctrl.isAssisting = true;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 解析中...'; }
    if (adviceEl) { adviceEl.style.color = '#9cdcfe'; adviceEl.textContent = 'AIで設定と ja.tab を解析中...'; }

    try {
      const res = await requestMakeobjAssist(opts);
      applyMakeobjAssistToModal(ctrl, res);
    } catch (err) {
      if (adviceEl) { adviceEl.style.color = '#ff8888'; adviceEl.textContent = `エラー: ${err.message || err}`; }
      alert(err.message || String(err));
    } finally {
      ctrl.isAssisting = false;
      if (btn) { btn.disabled = false; btn.textContent = '✨ AIで設定支援'; }
    }
  });

  document.getElementById('btn-mk-ai-copy-prompt')?.addEventListener('click', async () => {
    const prompt = buildMakeobjAssistPrompt(getOpts());
    await navigator.clipboard.writeText(prompt);
    const adv = document.getElementById('lbl-mk-ai-advice');
    if (adv) adv.textContent = 'AIプロンプトをクリップボードにコピーしました。';
  });

  const jsonWrap = document.getElementById('mk-ai-json-wrap');
  const jsonInp = document.getElementById('inp-mk-ai-json');
  const adviceEl = document.getElementById('lbl-mk-ai-advice');
  document.getElementById('btn-mk-ai-toggle-json')?.addEventListener('click', () => {
    if (!jsonWrap) return;
    const opening = jsonWrap.style.display === 'none';
    jsonWrap.style.display = opening ? '' : 'none';
    if (opening && jsonInp) {
      if (!jsonInp.value.trim()) {
        pasteClipboardIntoTextarea(jsonInp, (msg) => { if (adviceEl) adviceEl.textContent = msg; });
      } else {
        jsonInp.focus();
      }
    }
  });
  document.getElementById('btn-mk-ai-paste-clip')?.addEventListener('click', () => {
    pasteClipboardIntoTextarea(jsonInp, (msg) => { if (adviceEl) adviceEl.textContent = msg; });
  });
  document.getElementById('btn-mk-ai-cancel-json')?.addEventListener('click', () => {
    if (jsonWrap) jsonWrap.style.display = 'none';
  });
  document.getElementById('btn-mk-ai-apply-json')?.addEventListener('click', () => {
    try {
      const res = parseMakeobjAssistResponse(document.getElementById('inp-mk-ai-json')?.value || '');
      applyMakeobjAssistToModal(ctrl, res);
      if (jsonWrap) jsonWrap.style.display = 'none';
    } catch (err) {
      alert(err.message || String(err));
    }
  });
}
