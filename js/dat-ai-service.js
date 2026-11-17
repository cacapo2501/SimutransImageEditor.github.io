import { DAT_OBJECT_TEMPLATES } from './dat-templates.js';

const STORAGE_KEY = 'simutrans_editor_gemini_cfg_v1';

export const PAKSET_OPTIONS = [
  { value: 'pak64', label: 'pak64 (標準バランス)', guide: 'pak64基準: 鉄道旅客車payload=40〜120(立席定員がある車両は座席+立席を含めた定員を基準), speed=80〜300, power=300〜5000, weight=20〜80, cost=50000〜500000, runningcost=30〜250, length=4〜10(標準8)。建物level=1〜40。' },
  { value: 'pak128', label: 'pak128', guide: 'pak128基準: 鉄道旅客車payload=60〜200(立席定員がある車両は座席+立席を含めた定員を基準), cost=150000〜1500000, runningcost=80〜600, power=500〜8000, length=6〜16(標準8〜12)。建物level=2〜80。' },
  { value: 'pak128.japan', label: 'pak128.japan (日本向け)', guide: 'pak128.japan基準: 実車に近い定員(立席定員がある通勤・近郊・路線バス等は座席+立席の総定員を含めた値を採用し1両payload=120〜160, 新幹線は60〜100), speedは実車km/h, powerは実車kW(電車の電動車は400〜600kW, 制御車は0), weightは実車t, length=6〜14(20m級=8〜10, 新幹線25m級=10〜12), cost=100000〜2000000, runningcost=50〜500。' },
  { value: 'pak96', label: 'pak96 / pak96.comic', guide: 'pak96基準: pak64とpak128の中間スケール。旅客車payload=50〜140(立席定員込み基準), 建物level=2〜50。' }
];

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export const GEMINI_MODELS = [
  { value: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen (最新・高速推奨)' },
  { value: 'gemini-4-carbon', label: 'gemini-4-carbon (最新・高精度推論)' },
  { value: 'gemini-4-argon', label: 'gemini-4-argon (最新・フラッグシップ推論)' },
  { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash (Flash 高速)' },
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash' },
  { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (超軽量)' },
  { value: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (旧世代)' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (旧世代)' }
];

export function loadGeminiConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { apiKey: '', model: DEFAULT_GEMINI_MODEL, saveKey: false };
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed.apiKey || ''),
      model: String(parsed.model || DEFAULT_GEMINI_MODEL),
      saveKey: Boolean(parsed.apiKey)
    };
  } catch (e) {
    return { apiKey: '', model: DEFAULT_GEMINI_MODEL, saveKey: false };
  }
}

export function saveGeminiConfig({ apiKey, model, saveKey }) {
  try {
    if (saveKey && apiKey) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, model }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // localStorage 利用不可時は無視
  }
}

function describeFieldsSchema(objType) {
  const tpl = DAT_OBJECT_TEMPLATES[objType];
  if (!tpl) return '';
  return tpl.fields.map(f => {
    let extra = '';
    if (f.options) {
      extra = ' 選択肢:[' + f.options.map(o => `"${o.value}"`).join(', ') + ']';
    } else if (f.type === 'checkbox') {
      extra = ' (boolean: true/false)';
    } else if (f.type === 'climates') {
      extra = ' (配列: ["water","desert","tropic","mediterran","temperate","tundra","rocky","arctic"]から選択)';
    }
    return `  - "${f.key}": ${f.label}${extra}`;
  }).join('\n');
}

const BUILD_COST_GUIDES = {
  standard: '作成・購入コスト (cost) は pak セット標準バランスどおりに設定',
  cheap: '作成・購入コスト効率を重視し、cost を pak 標準の約 0.6〜0.7 倍（低コスト）に設定',
  budget: '超高効率・格安バランスとし、cost を pak 標準の約 0.3〜0.4 倍に設定',
  expensive: '高級・高コスト車両/施設として、cost を pak 標準の約 1.4〜1.6 倍に設定',
  luxury: '超高価・特注扱いとして、cost を pak 標準の約 2.2〜2.8 倍に設定'
};

const MAINT_COST_GUIDES = {
  standard: '輸送・維持コスト (runningcost / maintenance) は pak 標準バランスどおりに設定',
  high_eff: '輸送コスト効率（燃費・省メンテ）を優秀にし、runningcost / maintenance を標準の約 0.6〜0.7 倍に設定',
  ultra_eff: '超省エネ・赤字回避重視とし、runningcost / maintenance を標準の約 0.35〜0.45 倍に設定',
  heavy: '高維持費・重装備とし、runningcost / maintenance を標準の約 1.4〜1.6 倍に設定'
};

const PAYLOAD_EFF_GUIDES = {
  standard: '積載量・容量・生産性 (payload / capacity / Productivity) は実車/標準に準拠（旅客車両に立席定員がある場合は座席+立席の合計定員を含めた値を基準とする）',
  high_cap: '収容効率を重視し、payload / capacity / Productivity を標準（立席定員込み基準）の約 1.3〜1.5 倍に設定',
  express: '快適性・ゆとり重視とし、payload / capacity を標準（立席定員込み基準）の約 0.7〜0.8 倍に設定'
};

// 生成AI向けプロンプトを構築する
export function buildDatAiPrompt({
  objType,
  userPrompt,
  pakset = 'pak64',
  vehicleMode = 'consist',
  carCount = '',
  buildCostMode = 'standard',
  maintCostMode = 'standard',
  payloadMode = 'standard',
  liveryName = '',
  imgPrefix = 'base_combined',
  copyright = '',
  autoSeqRows = true
}) {
  const tpl = DAT_OBJECT_TEMPLATES[objType];
  const pakInfo = PAKSET_OPTIONS.find(p => p.value === pakset) || PAKSET_OPTIONS[0];
  const schemaText = describeFieldsSchema(objType);

  let vehicleRules = '';
  if (objType === 'vehicle') {
    const liveryHint = liveryName ? `（今回の塗装名: "${liveryName}"）` : '（例: Chuo, Shinkaisoku, Standard 等、リクエストに応じた塗装名）';
    const namingRule = `- 各車両の name は必ず「鉄道会社略称_系列名_形式(塗装名)」の形式で命名してください${liveryHint}。例: "JRE_E233_KuHaE233(Chuo)", "JRE_E233_MoHaE233(Chuo)"。同一形式が編成内に複数あり区別が必要な場合は「会社略称_系列名_形式_区別(塗装名)」（例: "JRE_E233_MoHaE233_2(Chuo)"）のように末尾に "(塗装名)" を付けてください。`;

    if (vehicleMode === 'consist') {
      vehicleRules = `
【鉄道車両・編成単位モード (重要)】
- 指定された車両・編成を、先頭車・中間電動車(M)・中間付随車(T)・特別車・後尾車など、実際の編成を構成する各車両オブジェクトの配列("objects")として出力してください。
- 指定両数(${carCount ? carCount + '両' : '実車または代表的な編成構成'})に合わせ、同形式の繰り返し車両も必要数生成するか、編成として連結完結するよう各車の name と constraint を設定してください。
${namingRule}
- constraint[prev] / constraint[next] に当たる "constraintsPrev" と "constraintsNext"（複数候補は "\\n" 区切り文字列）を全車両に必ず設定してください：
  - 先頭車: constraintsPrev = "none", constraintsNext = 直後の車両のname
  - 中間車: constraintsPrev = 直前の車両のname, constraintsNext = 直後の車両のname
  - 後尾車: constraintsPrev = 直前の車両のname, constraintsNext = "none"
  - 両運転台や増解結対応車の場合は "none" と連結相手の name の両方を "\\n" 区切りで指定可。
- 動力車(Mc, M, 機関車)のみ power > 0 にし、制御車(Tc)・付随車(T)・客車・貨車は power = "0"（または機関車以外でもユニット構成に準拠）にしてください。`;
    } else if (vehicleMode === 'series') {
      vehicleRules = `
【鉄道車両・形式単位モード (重要)】
- 指定された鉄道車両形式に含まれる主要車種（例: 先頭制御車・中間電動車・中間付随車、または機関車・単行気動車など代表バリエーション）を "objects" 配列に出力してください。
${namingRule}
- 各車種の連結ルールに合わせて "constraintsPrev" と "constraintsNext"（複数候補は "\\n" 区切り）を設定してください。
  - 例: 先頭車は constraintsPrev="none", constraintsNext="同形式の中間車群や後尾車"。中間車は前後に連結可能な同形式の車種名を列挙。単行可能な形式なら "none" と自身を含める。`;
    } else {
      vehicleRules = `
【単一車両モード】
- "objects" 配列に1つの車両オブジェクトを出力してください。
${namingRule}
- その車両の特性に合わせて "constraintsPrev" と "constraintsNext"（例: 単行可能なら "none", 連結相手があれば "none" 等）を適切に設定してください。`;
    }
    vehicleRules += '\n- 【旅客定員 (payload) ルール】実車に立席定員がある旅客車両（通勤電車・近郊型・一般形気動車・路面電車・路線バス等）は、座席定員のみではなく「座席定員＋立席定員（合計定員）」を含めた値を採用して payload を算出してください。';
  }

  const rowRule = autoSeqRows
    ? '複数オブジェクトを出力する場合、画像開始行 "startRow" は 0, 1, 2, ... と0から連番で割り当ててください。'
    : '画像開始行 "startRow" は基本 "0" を設定してください。';

  return `あなたは Simutrans アドオン開発（makeobj 用 .dat ファイル作成）の専門家です。
ユーザーのリクエストに基づき、Simutrans の .dat パラメータを正確な JSON 形式で生成してください。

【対象オブジェクト種別】
obj = "${objType}" (${tpl ? tpl.label : objType})

【対象 pak セットと数値バランス】
${pakInfo.label}
${pakInfo.guide}
【コスト・効率指定バランス】
- 作成コスト効率: ${BUILD_COST_GUIDES[buildCostMode] || BUILD_COST_GUIDES.standard}
- 輸送/維持コスト効率: ${MAINT_COST_GUIDES[maintCostMode] || MAINT_COST_GUIDES.standard}
- 積載/容量効率: ${PAYLOAD_EFF_GUIDES[payloadMode] || PAYLOAD_EFF_GUIDES.standard}
${vehicleRules}

【画像・共通設定】
- imgPrefix のベース名: "${imgPrefix || 'base_combined'}"
- copyright: "${copyright || ''}"
- ${rowRule}
- 登場年(intro_year)・引退年(retire_year)・最高速度(speed/topspeed)・重量・積載量などは実在モデルや一般的な仕様に合わせて現実的に設定してください（現役車両は retire_year を空文字 "" にする）。

【values オブジェクトで使用可能なキー一覧】
${schemaText}

【出力JSONスキーマ（厳守・Markdown不要・純粋なJSONのみ）】
{
  "summary": "生成内容の短い日本語要約",
  "objects": [
    {
      "obj": "${objType}",
      "common": {
        "name": "addon_unique_name",
        "jaName": "日本語での表示名（ja.tab用・自然な日本語）",
        "copyright": "${copyright || ''}",
        "imgPrefix": "${imgPrefix || 'base_combined'}",
        "startRow": "0",
        "startCol": "0",
        "imgOffset": "",
        "extraLines": ""
      },
      "values": {
        "...": "..."
      }
    }
  ]
}

【ユーザーからの生成リクエスト】
${userPrompt}`;
}

function extractJsonText(rawText) {
  const trimmed = String(rawText || '').trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function normalizeStringList(val) {
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean).join('\n');
  if (val === undefined || val === null) return '';
  return String(val);
}

// AI返却JSONを検証・正規化してアプリ内部フォーマットに変換する
export function parseAiDatResponse(rawText, fallbackObjType = 'building', fallbackCommon = {}) {
  const jsonStr = extractJsonText(rawText);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('AIの応答をJSONとして解析できませんでした: ' + err.message);
  }

  const rawObjects = Array.isArray(parsed.objects) ? parsed.objects : (parsed.obj ? [parsed] : []);
  if (rawObjects.length === 0) {
    throw new Error('AIの応答に有効な objects 配列が含まれていません。');
  }

  const normalized = rawObjects.map((item, idx) => {
    const objType = DAT_OBJECT_TEMPLATES[item.obj] ? item.obj : fallbackObjType;
    const tpl = DAT_OBJECT_TEMPLATES[objType];
    const defaults = tpl ? { ...tpl.defaults } : {};
    const values = { ...defaults };

    if (item.values && typeof item.values === 'object') {
      Object.entries(item.values).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (k === 'climates') {
          values[k] = Array.isArray(v)
            ? v.map(c => String(c).trim()).filter(Boolean)
            : String(v).split(',').map(c => c.trim()).filter(Boolean);
        } else if (k === 'constraintsPrev' || k === 'constraintsNext') {
          values[k] = normalizeStringList(v);
        } else if (typeof defaults[k] === 'boolean') {
          values[k] = v === true || v === 'true' || v === '1' || v === 1;
        } else {
          values[k] = String(v);
        }
      });
    }

    const rawCommon = item.common && typeof item.common === 'object' ? item.common : {};
    const common = {
      name: String(rawCommon.name || `${defaults.name || 'addon'}_${idx + 1}`),
      jaName: String(rawCommon.jaName || ''),
      copyright: String(rawCommon.copyright ?? fallbackCommon.copyright ?? ''),
      includeImages: fallbackCommon.includeImages !== undefined ? Boolean(fallbackCommon.includeImages) : true,
      imageFormat: String(fallbackCommon.imageFormat || 'auto'),
      customImgFormat: String(fallbackCommon.customImgFormat || 'EmptyImage[{dir}][0]={prefix}.{row}.{col}{offset}'),
      flipDirections: Boolean(fallbackCommon.flipDirections),
      imgPrefix: String(rawCommon.imgPrefix || fallbackCommon.imgPrefix || 'base_combined'),
      startRow: String(rawCommon.startRow ?? idx),
      startCol: String(rawCommon.startCol ?? fallbackCommon.startCol ?? '0'),
      imgOffset: String(rawCommon.imgOffset ?? fallbackCommon.imgOffset ?? ''),
      customImageCoords: null,
      extraLines: String(rawCommon.extraLines ?? '')
    };

    return { objType, common, values };
  });

  return {
    summary: String(parsed.summary || `${normalized.length}件のオブジェクトを生成しました`),
    objects: normalized
  };
}

// Gemini API から利用可能な最新モデル一覧を取得する
export async function fetchAvailableGeminiModels(apiKey) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('モデル一覧を取得するには Gemini API Key を入力してください。');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) errMsg = errJson.error.message;
    } catch (e) {}
    throw new Error(`モデル一覧取得エラー: ${errMsg}`);
  }
  const data = await res.json();
  const list = Array.isArray(data.models) ? data.models : [];
  return list
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => {
      const id = String(m.name || '').replace(/^models\//, '');
      const display = m.displayName ? `${id} (${m.displayName})` : id;
      return { value: id, label: display };
    })
    .filter(m => m.value.includes('gemini'))
    .sort((a, b) => b.value.localeCompare(a.value));
}

// Gemini API を呼び出して dat パラメータ JSON を取得する
export async function requestDatFromGemini({ apiKey, model = DEFAULT_GEMINI_MODEL, prompt }) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Gemini API Key を入力してください。');
  }
  const cleanModel = String(model || DEFAULT_GEMINI_MODEL).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) errMsg = errJson.error.message;
    } catch (e) {}
    throw new Error(`Gemini API エラー: ${errMsg}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('\n').trim();
  if (!text) {
    throw new Error('Gemini API から空の応答が返されました。');
  }
  return text;
}
