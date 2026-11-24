// Simutrans dat 生成AI用プロンプト構築・pakセット別バランス＆オブジェクト種別ルール定義モジュール
import { DAT_OBJECT_TEMPLATES } from './dat-templates.js';

export const PAKSET_OPTIONS = [
  {
    value: 'pak64',
    label: 'pak64 (標準バランス)',
    guide: [
      '【pak64 スケール・数値基準】',
      '- タイルサイズ 64px。車体長 length は「半タイル(標準18〜20m級鉄道車両1両) = 8」が基準（length 1 ≈ 2.2〜2.5m）。',
      '  - 車種別の length 目安: 小型トラック/小型バス/2軸貨車/車掌車/炭水車=3〜5、大型バス/トラック/小型電車/15〜16m車/ボギー貨車=5〜7、18〜21m級鉄道車両/標準機関車=7〜8、25m級新幹線/大型車=8〜10、連接車中間車体=3〜6、船舶/航空機=8〜16。',
      '- 最高速度(speed)・出力(power [kW])・自重(weight [t])・軸重(axle_load [t])は、特定の狭い範囲に丸めず【実車・実機の実際の諸元（カタログスペック・史実値）】を最優先で反映してください。',
      '- 定員・積載量(payload): 実車の車種・時代・規模の格差を忠実に反映（小型バス/旧型車=15〜50、通勤・近郊電車=70〜150、特急・新幹線座席車=45〜100、グリーン車/寝台車=25〜60、2軸貨車=10〜25、ボギー貨車=30〜65、トラック=5〜25、航空機=30〜400、船舶=50〜800）。',
      '- 購入費(cost)・運行費(runningcost): 動力有無(M車/機関車は高く、T車/客車/貨車は安い)・車格・速度・出力に応じて明確に差をつける（小型車/貨車 cost=15000〜80000 / runningcost=10〜60、一般鉄道車両 cost=80000〜350000 / runningcost=50〜220、高速車両/大出力機関車/航空機/大型船 cost=350000〜2500000 / runningcost=200〜1500）。',
      '- 建物 level=1〜40。'
    ].join('\n')
  },
  {
    value: 'pak128',
    label: 'pak128 (欧米・高密度標準)',
    guide: [
      '【pak128 スケール・数値基準】',
      '- タイルサイズ 128px。1タイル = length 16（約25〜30m相当）。',
      '  - 車種別の length 目安: トラクターヘッド/超小型車=3〜4、小型トラック/2軸貨車/炭水車=4〜6、バス/大型トラック/セミトレーラー=6〜8、18〜20m級鉄道車両/標準機関車=8〜10、25〜27m級鉄道車両(新幹線・欧州客車・大型機関車)=10〜12、船舶/大型航空機=12〜16。',
      '- 最高速度(speed)・出力(power [kW])・自重(weight [t])・軸重(axle_load [t])は【実車・実機の実際の諸元】を正確に反映してください。',
      '- 定員・積載量(payload): 実車規模に応じて幅広く設定（バス=30〜110、通勤・近郊鉄道=90〜200、優等列車/新幹線=50〜120、一等車/寝台車=24〜65、貨車=20〜90、トラック=8〜35、航空機=40〜500、大型船=100〜1500）。',
      '- 購入費(cost)・運行費(runningcost): pak128経済スケール（小型車/貨車 cost=40000〜200000 / runningcost=20〜150、一般鉄道車 cost=200000〜900000 / runningcost=120〜550、機関車/新幹線/航空機/船舶 cost=800000〜5000000 / runningcost=500〜3500）。動力車と付随車で明確に差をつけること。',
      '- 建物 level=2〜80。'
    ].join('\n')
  },
  {
    value: 'pak128.japan',
    label: 'pak128.japan (日本向けリアル諸元)',
    guide: [
      '【pak128.japan スケール・実車諸元厳密反映ルール】',
      '- 実車のカタログ諸元（実測の最高速度・定格出力・空車自重・定員/荷重・全長・登場/引退年月）を丸めず1両ごとに忠実に反映してください。',
      '- 車体長 length: 「length 1 ≈ 2.5m（20m級標準 = 8）」で実車全長から算出（length = round(全長m / 2.5)）。',
      '  - 5〜8m級(小型バス/トラック/車掌車/2軸小型貨車/連接中間車)=2〜3、9〜11m級(一般路線バス/大型トラック/2軸貨車/炭水車)=4、12〜14m級(高速・観光バス/小型気動車/小型機関車)=5、15〜17m級(小型電車/銀座線等/中型機関車/ボギー貨車)=6〜7、18〜19m級(京急・京成・地下鉄・大型機関車)=7〜8、20m級(JR・私鉄標準電車/気動車/客車/コキ)=8、21m級(一部特急車/EF66・EH500等)=8〜9、25m級(新幹線中間車)=10、26〜27m級(新幹線ロングノーズ先頭車)=10〜11。',
      '- 出力 power [kW]: 実車の1両あたり合計定格出力を正確に設定（制御車Tc・付随車T・客車・貨車・炭水車は必ず "0"）。',
      '  - 電車(EMU)の電動車(M/Mc): 「主電動機1基の定格出力(kW) × その車両の搭載基数(通常4基、0.5M車は2基等)」を実車型式どおりに算出（例: 95kW×4=380、100kW×4=400、110kW×4=440、120kW×4=480、140kW×4=560、150kW×4=600、190kW×4=760、220kW×4=880、250kW×4=1000、300kW×4=1200 等）。',
      '  - 気動車(DMU)・ディーゼル機関車(DL)・バス・トラック: 実車の機関出力(PS) × 基数 を「1 PS = 0.7355 kW」で換算（例: 180PS×1=132、180PS×2=265、250PS=184、330PS=243、450PS×2=662、DD51(2200PS)=1618、DF200=2500 等）。',
      '  - 電気機関車(EL)・蒸気機関車(SL): 実車の定格出力kW（例: ED75=1900、EF58=1900、EF64/65/81=2550、EF66=3900、EF210=3390、EH500=4000、C11=約600、D51/C62=約1000〜1400 等）。',
      '- 自重 weight [t]・軸重 axle_load [t]: 編成内の各形式・番台（クハ・モハM1・モハM2・サハ・サロ・サシ・カニ・機関車・貨車）ごとの実車自重(t)を1両ずつ正確に設定（全車同一値は厳禁）。',
      '- 定員・積載量 payload:',
      '  - 立席定員がある通勤・近郊電車、一般気動車、地下鉄、路面電車、一般路線バスは実車の「座席定員＋立席定員（合計定員）」を1両ごとに設定（先頭車と中間車、トイレ有無等の定員差も実車通りに区別）。',
      '  - 新幹線、在来線特急・急行、グリーン車・グランクラス、寝台車、観光列車、高速・観光バス、旅客機、客船など着席/寝台前提の車両は実車の「座席定員（または寝台定員）のみ」を設定（立席を足して水増ししない）。',
      '  - 貨車・トラック・荷物/郵便車は実車の最大積載トン数(荷重t)等を基準に設定。機関車・電源車・食堂車・炭水車は payload="0", freight="None"。'
    ].join('\n')
  },
  {
    value: 'pak96',
    label: 'pak96 / pak96.comic',
    guide: [
      '【pak96 スケール・数値基準】',
      '- タイルサイズ 96px（pak64とpak128の中間スケール）。',
      '- 最高速度(speed)・出力(power [kW])・自重(weight [t])・車種の特性差は実車諸元に忠実に設定し、車体長(length=4〜12)・コスト・定員/積載量をpak96バランスに合わせてスケーリングしてください。',
      '- 建物 level=2〜50。'
    ].join('\n')
  }
];

export function describeFieldsSchema(objType) {
  const tpl = DAT_OBJECT_TEMPLATES[objType];
  if (!tpl) return '';
  return tpl.fields.map(f => {
    let extra = '';
    if (f.options) {
      extra = ' 選択肢:[' + f.options.map(o => `"${o.value}"`).join(', ') + ']';
    } else if (f.type === 'number_presets') {
      const pList = (f.presets || []).map(p => `"${p.value}"`).join(', ');
      extra = ` (数値文字列 ${f.min ?? 1}〜${f.max ?? 255}${pList ? ' / 代表値:[' + pList + ']' : ''})`;
    } else if (f.type === 'checkbox') {
      extra = ' (boolean: true/false)';
    } else if (f.type === 'climates') {
      extra = ' (配列: ["water","desert","tropic","mediterran","temperate","tundra","rocky","arctic"]から選択)';
    }
    return `  - "${f.key}": ${f.label}${extra}`;
  }).join('\n');
}

function buildVehicleRules({ vehicleMode, carCount, liveryName, accelProfile = 'auto' }) {
  const hasLivery = Boolean(liveryName && liveryName.trim());
  const liveryRule = hasLivery
    ? `- 現在選択中の塗装マスク名 "${liveryName.trim()}" に合わせ、各車両の common.name 末尾には "(${liveryName.trim()})" を付与してください（例: "JRE_E233_0_KuHaE233_0(${liveryName.trim()})"）。`
    : '- 各車両の common.name は「事業者/国/メーカー略称_系列/車種名_形式/番台」のように一意で分かりやすい半角英数識別名にしてください（路線カラーや塗装バリエーションが明確な場合は末尾に "(Chuo)" 等の塗装名を付与可。不要なら括弧なしでも構いません）。';
  const accelDirective = accelProfile === 'high'
    ? '（※ユーザー指定: 今回は必ず「高加速車両 = 最高速の 2.5 倍」で計算してください）'
    : (accelProfile === 'low'
      ? '（※ユーザー指定: 今回は必ず「低加速車両 = 最高速の 1.1 倍」で計算してください）'
      : '（※車種特性から高加速[2.5倍]・低加速[1.1倍]を自動判定してください）');

  let modeSection = '';
  if (vehicleMode === 'consist') {
    modeSection = [
      '【車両・編成フル構成モード (consist)】',
      `- 指定された編成・列車・車両セット（${carCount ? `指定両数: ${carCount}両` : '実車の標準的な編成構成、または牽引機＋客車/貨車/トレーラー構成'}）を構成する各車両オブジェクトを "objects" 配列に出力してください。`,
      '- 編成内の号車順・連結順（例: 下り先頭車 → 中間電動車M1/M2 → 中間付随車T → グリーン車Ts/食堂車Td/電源車 → 上り後尾車、または 機関車 → 炭水車 → 客車/貨車群、トラクターヘッド → セミトレーラー等）を実車通りに構成してください。',
      '- 同一形式名であっても「先頭向きと後尾向き」「パンタグラフ1基搭載と2基搭載」「番台区分・トイレ有無・機器差」「編成内の連結位置(前後の相手)」が異なる車両は別オブジェクト（末尾に _1, _2 や番台・号車区別を付与）として出力するか、同種中間車の反復連結として constraint が先頭から後尾まで完全に繋がるように設定してください。',
      '- 全車両に "constraintsPrev" と "constraintsNext"（複数候補は "\\n" 区切り文字列）を設定してください：',
      '  - 先頭車(1両目): constraintsPrev = "none", constraintsNext = 直後(2両目)の車両の name',
      '  - 中間車: constraintsPrev = 直前の車両の name, constraintsNext = 直後の車両の name',
      '  - 後尾車(最終両): constraintsPrev = 直前の車両の name, constraintsNext = "none"',
      '  - 単行運転や増解結・分割併合にも対応する先頭車/両運転台車は、"none" と連結相手の name を "\\n" 区切りで併記してください。'
    ].join('\n');
  } else if (vehicleMode === 'series') {
    modeSection = [
      '【車両・形式/車種バリエーションモード (series)】',
      '- 指定された系列・車種に含まれる主要な形式・番台バリエーション（例: 下り向き先頭車・上り向き後尾車・中間電動車M1/M2・中間付随車T・優等車・合造車、または機関車＋代表客車/貨車など）を網羅して "objects" 配列に出力してください。',
      '- 各形式がゲーム内の車庫で自在かつ正確に編成を組めるよう、"constraintsPrev" と "constraintsNext"（複数候補は "\\n" 区切り）に連結可能な全相手形式の name（先頭・後尾になり得る車両は "none" も含める）を設定してください。'
    ].join('\n');
  } else {
    modeSection = [
      '【単一車両モード (single)】',
      '- "objects" 配列に1つの車両オブジェクトを出力してください。',
      '- 単行可能な車両（単行気動車・機関車・バス・トラック・路面電車・船舶・航空機等）は constraintsPrev = "none", constraintsNext = "none"（重連や牽引を行う場合は自身や連結相手も考慮）を設定してください。'
    ].join('\n');
  }

  return `
${modeSection}

【車両スペック精密設定ルール（画一的・限定的なテンプレ値の出力は厳禁！）】
${liveryRule}
- あらゆる交通機関（鉄道の電車・気動車・SL/EL/DL機関車・客車・貨車・新幹線・路面電車・モノレール・リニア・軽便鉄道、道路のバス・連節バス・トラック・トレーラー・特殊車、船舶、航空機）に対応し、リクエスト対象の【実車・実機の正確な諸元】を1両ごとに個別に反映してください。
- 編成内の全車両に同じ weight / payload / power / cost / runningcost をコピーすることは厳禁です。以下の車種・形式ごとの違いを必ず作り分けてください：
  1. 軌道種別 (waytype): 鉄道="track", 道路(バス/トラック)="road", 路面電車/LRT="tram_track", モノレール="monorail_track", リニア="maglev_track", 軽便/狭軌="narrowgauge_track", 船舶="water", 航空機="air"。
  2. 動力種別 (engine_type) と 出力 (power [kW])・ギア比 (gear [%]):
     - 動力車(Mc, M, M1, M2, 気動車, 機関車, バス, トラック, 動力船, 航空機)のみ実車の1両あたり定格出力(kW)を power に設定してください。
     - 制御車(Tc: クハ)・付随車(T: サハ/サロ/サシ)・客車・貨車・炭水車(テンダー)・被牽引トレーラーは必ず power = "0" にしてください。
     - 【重要】機関車に牽引される「客車・貨車・炭水車」および「被牽引トレーラー」は、非電化区間でも各種機関車で牽引できるよう engine_type = ""（空文字）にしてください。一方、電車(EMU)編成のクハ・サハは engine_type = "electric"、気動車(DMU)編成のキサハ等は "diesel" にしてください。
     - 【ギア比 (gear [%]) ・上限設定なし】Simutrans Standard の最高速度式 v = 50 * sqrt((Σ(power * gear/100)) / W_loaded - 1) に基づき、標準編成（単行車は単車、機関車・牽引機は標準牽引編成）に積載物を満載した総重量 W_loaded [t]（全車の空車 weight 合計＋満員乗客[75kg/人]・郵便[50kg/個]・満載貨物[1t/単位等]）を基準に動力車の gear を設定してください ${accelDirective}：
       - 高加速車両（通勤電車・地下鉄・LRT・モノレール・新交通・路線バス等）: 目標理論最高速 V_target = 2.5 × speed
       - 低加速車両（機関車牽引列車・貨物列車・SL/EL/DL・トラック/トレーラー・船舶・長距離巡航機等）: 目標理論最高速 V_target = 1.1 × speed
       - 算出式: gear = round(100 * (W_loaded / Σpower) * ((V_target / 50)^2 + 1))。上限値は設定しません（300%や800%以上もそのまま整数出力、最小1、動力なしの付随車は "100"）。
  3. 空車自重 (weight [t]) と 軸重 (axle_load [t]):
     - 先頭車(運転台付)、パンタ・主制御器搭載M1車、MG/SIV・CP搭載M2車、付随車T、グリーン車/2階建車/寝台車/食堂車/電源車、機関車、炭水車、貨車それぞれ実車の実際の空車重量(t)を1両ごとに設定してください。
     - axle_load は鉄道・道路車両では実車軸重または round(重量 / 軸数) を設定してください（船舶・航空機は "" または "0"）。
  4. 積載貨物 (freight)・定員/積載量 (payload)・乗降/荷役時間 (loading_time [ms]):
     - 旅客車両 (freight = "Passagiere"):
       - 通勤・近郊電車、一般気動車、地下鉄、路面電車、一般路線バスなど【立席乗車がある車両】は「座席定員＋立席定員（実車合計定員）」を基準にし、先頭車(運転台分少ない)と中間車、トイレ有無等による定員差も実車通りに反映してください。
       - 新幹線、特急・急行、グリーン車・グランクラス、寝台車、観光列車、高速・観光バス、航空機、客船など【着席・寝台前提の車両】は実車の「座席定員（または寝台定員）のみ」を基準にしてください（立席を足して120〜160名等に水増ししないこと）。
     - 郵便車・荷物車は freight = "Post"（または荷物用貨物名）。
     - 貨車・トラック・貨物船・貨物機は用途に合った freight（例: コンテナ/混載="Goods" または "Stueckgut", 石炭="Kohle", 鉄鉱石="Eisenerz", 鉄鋼="Stahl", 石油="Oel", ガソリン="Gasolin", 木材="Holz", 板材="Bretter", 土砂="Sand", セメント="Zement", 自動車="Autos", 食品="Nahrung" 等）と実車荷重(t)に応じた payload を設定してください。
     - 【非積載車】機関車(SL/EL/DL)・炭水車・電源車(カニ/マヤ)・客席扱いのない食堂車・事業用車・トラクターヘッド単体は必ず freight = "None", payload = "0" にしてください。
     - loading_time は多扉通勤車="1000"〜"1600"、3扉近郊車/路線バス="1800"〜"2400"、特急/新幹線/グリーン車/高速バス="2500"〜"3500"、寝台車/貨車/トラック/船舶/航空機="3500"〜"8000" のように車種に応じて差をつけてください。
  5. 車体長 (length)・排煙 (smoke)・登場/引退年月 (intro_year / retire_year)・コスト (cost / runningcost):
     - length は対象 pak セットの基準と実車全長(m)に合わせ、先頭車・中間車・短尺車・機関車・炭水車・2軸/ボギー貨車・バス/トラックそれぞれの実際の長さに応じた値を設定してください。
     - smoke は蒸気機関車/蒸気船なら "Steam"、ディーゼル機関車/気動車/非電化排煙車なら "Diesel"、電気車/客車/貨車なら "" にしてください。
     - cost と runningcost は動力車(M/Mc/機関車)や優等車(グリーン/寝台/食堂)を高く、付随車(T/Tc/客車/貨車)を安く設定し、全車同一コストにしないでください。`;
}

function buildNonVehicleObjRules(objType) {
  if (objType === 'building') {
    return [
      '【建物・駅・車庫 (building) 設定ルール】',
      '- 都市自動生成建物 (type = "res" / "com" / "ind") の場合: level(規模)・chance(出現重み)・climates・needs_ground=true を設定し、waytype / capacity / cost / maintenance / enables_* は空文字または false にしてください。',
      '- 観光名所・記念碑・庁舎・本社 (type = "cur" / "mon" / "tow" / "hq") の場合: level・chance(cur用)・needs_ground を用途に合わせて設定してください。',
      '- 駅・停留所・港・駅拡張・車庫 (type = "stop" / "harbour" / "dock" / "extension" / "depot") の場合: waytype(extension以外)・capacity(depot以外)・cost・maintenance、および旅客(enables_pax)・郵便(enables_post)・貨物(enables_ware)フラグを施設用途に合わせて適切に設定してください。'
    ].join('\n');
  }
  if (objType === 'factory') {
    return [
      '【工場・産業 (factory) 設定ルール】',
      '- 産業種別に応じて Location("Land"/"City"/"Water")、Productivity(基礎生産力)、Range(振れ幅)、pax_level、MapColor、および原料 InputGood[0]/InputCapacity[0]/InputFactor[0] と製品 OutputGood[0]/OutputCapacity[0]/OutputFactor[0] を現実的な産業チェーンに合わせて設定してください。'
    ].join('\n');
  }
  if (objType === 'way' || objType === 'way-object' || objType === 'bridge' || objType === 'tunnel') {
    return [
      `【インフラ (${objType}) 設定ルール】`,
      '- 構造や時代・用途に合わせて waytype、topspeed(最高速度 km/h)、max_weight(最大軸重・耐荷重 t)、cost(建設費)、maintenance(維持費)、intro_year 等を現実的に設定してください。',
      '- way-object の架線・電化設備は own_waytype = "electrified_track" を使用してください。'
    ].join('\n');
  }
  if (objType === 'roadsign') {
    return [
      '【信号機・標識 (roadsign) 設定ルール】',
      '- 信号・標識の種類（閉塞信号 is_signal、遠方信号 is_presignal、長区間信号 is_longblocksignal、優先信号 is_prioritysignal、番線選択信号 is_choose_signal、経路選択標識 free_route、一方通行 single_way 等）に合わせてフラグと waytype, cost, maintenance を設定してください。'
    ].join('\n');
  }
  return '';
}

function buildImageContextSection({
  objType,
  imgPrefix,
  autoSeqRows,
  imageContext = null,
  currentCommon = {},
  currentValues = {}
}) {
  const curFmt = currentCommon.imageFormat || 'auto';
  const baseRow = Math.max(0, parseInt(currentCommon.startRow, 10) || 0);
  const baseCol = Math.max(0, parseInt(currentCommon.startCol, 10) || 0);
  const curOffset = currentCommon.imgOffset || '';
  const curFlip = Boolean(currentCommon.flipDirections);
  const v = currentValues || {};

  const lines = [
    '【指定画像・画像レイアウト設定（現在のエディタ状態に厳密に合わせること！）】',
    `- 画像ファイル名プレフィックス (common.imgPrefix): 必ず "${imgPrefix || 'base_combined'}" をそのまま出力してください（架空の別ファイル名に変更すると makeobj で画像読込エラーになります）。`,
    `- 現在の基本開始位置: startRow = "${baseRow}", startCol = "${baseCol}", imgOffset = "${curOffset}", imageFormat = "${curFmt}", flipDirections = ${curFlip}`
  ];

  if (imageContext && imageContext.hasImage) {
    const { imgW, imgH, tileW, tileH, gridRows, gridCols, useCut } = imageContext;
    lines.push(
      `- 現在開いている出力対象PNG画像: ${imgW}×${imgH}px（1タイル=${tileW}×${tileH}px / 利用可能グリッド: 縦 ${gridRows} 行 [row: 0〜${gridRows - 1}] × 横 ${gridCols} 列 [col: 0〜${gridCols - 1}]${useCut ? ' / タイルカッター分割出力ON' : ''}）`,
      `- 【重要・画像範囲外エラー防止】画像内に実在する行番号は 0 〜 ${gridRows - 1}（全${gridRows}行）のみです。"startRow" には絶対に ${gridRows} 以上の行番号を指定しないでください！`
    );

    if (objType === 'vehicle') {
      if (gridRows <= 1) {
        lines.push(
          '- 現在の画像は 1行 (row=0) のみです。複数車両を出力する場合でも全車両の common.startRow は必ず "0" に設定してください。また、前後対称の1行画像を後尾車(逆向き先頭車)にも流用する場合は、後尾車の common.flipDirections を true（先頭車と逆向き）に設定してください。'
        );
      } else {
        lines.push(
          `- 現在の画像は ${gridRows} 行 (row: 0〜${gridRows - 1}) あります。`,
          autoSeqRows
            ? `  - 出力車両数が ${gridRows} 両以下の場合は startRow を "${baseRow}", "${Math.min(gridRows - 1, baseRow + 1)}"... と順番に割り当ててください。\n  - 出力車両数（例: フル編成）が画像の行数(${gridRows}行)より多い場合は、画像が「車種別シート（例: row 0=先頭車, row 1..${Math.max(1, gridRows - 2)}=中間車各形式, row ${gridRows - 1}=後尾車）」になっているため、各車両の車種に対応する 0〜${gridRows - 1} の範囲内の startRow を割り当て、同種の中間車は同じ startRow を共有させてください。`
            : `  - startRow は原則 "${baseRow}"（または 0〜${gridRows - 1} の範囲内）を設定してください。`
        );
      }
    }
  } else {
    lines.push(
      autoSeqRows
        ? `- 複数オブジェクトを出力する場合、画像開始行 "startRow" は "${baseRow}" から連番（"${baseRow}", "${baseRow + 1}", ...、または編成内で同一外観の繰り返し中間車は同じ行番号を共有）で割り当ててください。`
        : `- 画像開始行 "startRow" は原則 "${baseRow}" を設定してください。`
    );
  }

  // オブジェクト種別ごとの現在の画像構成パラメータ維持ルール
  if (objType === 'building' || objType === 'factory') {
    lines.push(
      `- 現在の建物/工場タイル・画像構成設定: dimsW="${v.dimsW || '1'}", dimsH="${v.dimsH || '1'}", dimsViews="${v.dimsViews || '1'}", heightTiles="${v.heightTiles || '1'}"${objType === 'building' ? `, frames="${v.frames || '1'}", imageLayer="${v.imageLayer || 'back'}"` : ''}, seasons="${v.seasons || '1'}"`,
      '  - 【厳守】ユーザーがリクエスト文でタイルサイズ(2x2等)・向き数・アニメ・雪画像(seasons=2)の変更を明示的に求めていない限り、上記の dimsW / dimsH / dimsViews / heightTiles / frames / seasons / imageLayer の現在値をそのまま維持してください（勝手に増やすと現在のPNG画像サイズと合わずコンパイルエラーになります）。'
    );
  } else if (objType === 'vehicle') {
    const isExplicitEmpty = curFmt === 'vehicle_empty_8' || curFmt === 'vehicle_empty_4' || curFmt === 'vehicle_image_8';
    lines.push(
      `- 現在の車両画像設定: directions="${v.directions || '8'}", hasFreightImage=${Boolean(v.hasFreightImage)}${v.freightRow ? `, freightRow="${v.freightRow}"` : ''}`,
      isExplicitEmpty
        ? `  - 【厳守】現在は "${curFmt}"（Reverse なし・EmptyImage 等のみ）が選択されているため、common.imageFormat は必ず "${curFmt}" のまま出力し、勝手に OTRP Reverse や FreightImage を追加しないでください。`
        : '  - 【厳守】common.imageFormat は原則 "auto"（積載画像あり車両のみ "vehicle_freight"）として出力してください。先頭車・後尾車・単行鉄道車両への OTRP Reverse 対応はアプリ側が必要車両のみ自動適用するため、中間車・貨車・道路車両・船舶・航空機など Reverse のない車両に "vehicle_otrp_reverse" を指定したり、反転用の別オブジェクト (xxx_rev 等) を勝手に増やしたりしないでください。'
    );
  } else if (objType === 'way' || objType === 'way-object' || objType === 'bridge' || objType === 'tunnel' || objType === 'roadsign') {
    const imgFlags = [];
    ['includePoints', 'includeDiagonal', 'includeSlopes', 'includeSlopes2', 'includeCursorIcon', 'includeFrontImage', 'includeFrontDiagonal', 'tunnelPortalMode', 'signalStates', 'diagonalStates'].forEach(k => {
      if (v[k] !== undefined) imgFlags.push(`${k}=${JSON.stringify(v[k])}`);
    });
    if (imgFlags.length > 0) {
      lines.push(
        `- 現在の画像構成オプション設定: ${imgFlags.join(', ')}`,
        '  - 【厳守】ユーザーが明示的に画像構成の変更を指示していない限り、これらの画像出力フラグ・コマ数は必ず現在値のまま出力してください（編集中PNGのレイアウトと一致させるため）。'
      );
    }
  } else if (objType === 'tree' || objType === 'groundobj' || objType === 'field') {
    const natFlags = [];
    ['seasons', 'ageCount', 'has_snow'].forEach(k => {
      if (v[k] !== undefined) natFlags.push(`${k}=${JSON.stringify(v[k])}`);
    });
    if (natFlags.length > 0) {
      lines.push(
        `- 現在の季節・画像コマ設定: ${natFlags.join(', ')}`,
        '  - 【厳守】ユーザーが明示的に季節数や雪画像の変更を指示していない限り、現在の設定値を維持してください。'
      );
    }
  }

  return lines.join('\n');
}

const LEGACY_COST_PCT = {
  standard: 100, cheap: 65, budget: 35, expensive: 150, luxury: 250,
  high_eff: 65, ultra_eff: 35, heavy: 150, high_cap: 135, express: 75
};

function resolvePct(pctVal, legacyMode) {
  if (typeof pctVal === 'number' && Number.isFinite(pctVal)) return pctVal;
  if (legacyMode && LEGACY_COST_PCT[legacyMode]) return LEGACY_COST_PCT[legacyMode];
  return 100;
}

// 生成AI向けプロンプトを構築する
export function buildDatAiPrompt({
  objType,
  userPrompt,
  pakset = 'pak64',
  vehicleMode = 'consist',
  carCount = '',
  accelProfile = 'auto',
  buildCostPct = null,
  maintCostPct = null,
  payloadPct = null,
  buildCostMode = 'standard',
  maintCostMode = 'standard',
  payloadMode = 'standard',
  liveryName = '',
  imgPrefix = 'base_combined',
  copyright = '',
  autoSeqRows = true,
  imageContext = null,
  currentCommon = {},
  currentValues = {}
}) {
  const bPct = resolvePct(buildCostPct, buildCostMode);
  const mPct = resolvePct(maintCostPct, maintCostMode);
  const pPct = resolvePct(payloadPct, payloadMode);
  const tpl = DAT_OBJECT_TEMPLATES[objType];
  const pakInfo = PAKSET_OPTIONS.find(p => p.value === pakset) || PAKSET_OPTIONS[0];
  const schemaText = describeFieldsSchema(objType);

  const objSpecificRules = objType === 'vehicle'
    ? buildVehicleRules({ vehicleMode, carCount, liveryName, accelProfile })
    : buildNonVehicleObjRules(objType);
  const consistSpecSchema = objType === 'vehicle'
    ? ',\n  "consistSpec": { "accelProfile": "highまたはlow", "speedMultiplier": 2.5, "standardMaxSpeed": 120, "standardTotalPower": 3600, "standardFullLoadWeight": 380 }'
    : '';

  const imageSection = buildImageContextSection({
    objType,
    imgPrefix,
    autoSeqRows,
    imageContext,
    currentCommon,
    currentValues
  });

  const baseRow = String(currentCommon.startRow ?? '0');
  const baseCol = String(currentCommon.startCol ?? '0');
  const baseOffset = String(currentCommon.imgOffset ?? '');
  const baseFmt = String(currentCommon.imageFormat || 'auto');
  const baseFlip = Boolean(currentCommon.flipDirections);

  return `あなたは Simutrans アドオン開発（makeobj 用 .dat ファイル設計および実車・建築・鉄道/交通諸元データベース）の専門家です。
ユーザーのリクエストに基づき、実在モデル・史実諸元・現在の画像指定設定に厳密に沿った Simutrans の .dat パラメータを正確な JSON 形式で生成してください。

【対象オブジェクト種別】
obj = "${objType}" (${tpl ? tpl.label : objType})

【対象 pak セットと数値基準】
${pakInfo.label}
${pakInfo.guide}

【コスト・収容効率スライダー倍率】
- 作成・購入コスト倍率 (cost): 基準値の約 ${(bPct / 100).toFixed(2)} 倍（${bPct}%）に設定
- 輸送・維持コスト倍率 (runningcost / maintenance): 基準値の約 ${(mPct / 100).toFixed(2)} 倍（${mPct}%）に設定
- 積載・収容効率倍率 (payload / capacity / Productivity): 基準値（実車の合計定員・座席定員・荷重t等の基準）の約 ${(pPct / 100).toFixed(2)} 倍（${pPct}%）に設定
${objSpecificRules}

${imageSection}

【共通設定】
- copyright: "${copyright || ''}"
- 登場年(intro_year)・登場月(intro_month)・引退年(retire_year)・引退月(retire_month)は実在モデルの史実に即して設定してください（現在も現役で運用中のものは retire_year: "", retire_month: "" にする）。

【values オブジェクトで使用可能なキー一覧】
${schemaText}

【出力JSONスキーマ（厳守・Markdownコードブロック不要・純粋なJSONのみ）】
{
  "summary": "生成した車両・編成・施設と主要諸元の簡潔な日本語要約"${consistSpecSchema},
  "objects": [
    {
      "obj": "${objType}",
      "common": {
        "name": "addon_unique_name",
        "jaName": "日本語での正式表示名（ja.tab用・形式や番台、役割が分かる自然な日本語）",
        "copyright": "${copyright || ''}",
        "imgPrefix": "${imgPrefix || 'base_combined'}",
        "imageFormat": "${baseFmt}",
        "flipDirections": ${baseFlip},
        "startRow": "${baseRow}",
        "startCol": "${baseCol}",
        "imgOffset": "${baseOffset}",
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
