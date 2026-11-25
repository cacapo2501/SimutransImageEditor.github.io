// Simutrans Standard の最高速度式に基づき標準編成満載重量と連続加速度(最大4.5km/h/s)から gear を算出するモジュール

export const MIN_ACCEL_MULTIPLIER = 1.03;
export const MAX_ACCEL_MULTIPLIER = 1.6;
export const MAX_ACCEL_KMH_S = 4.5;

export const ACCEL_MULTIPLIERS = {
  high: MAX_ACCEL_MULTIPLIER,
  low: MIN_ACCEL_MULTIPLIER
};

// Simutrans の標準的な貨物種別ごとの1単位あたり重量(kg)
const CARGO_WEIGHT_KG_MAP = {
  none: 0,
  passagiere: 75,
  passenger: 75,
  passengers: 75,
  post: 50,
  mail: 50,
  autos: 1800,
  cars: 1800
};

function toFiniteNumber(val, fallback = 0) {
  if (val === '' || val === null || val === undefined) return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

// 貨物名から積載物1単位あたりの重量(kg)を返す
export function getCargoWeightPerUnitKg(freight) {
  const key = String(freight || '').trim().toLowerCase();
  if (!key) return 0;
  if (Object.prototype.hasOwnProperty.call(CARGO_WEIGHT_KG_MAP, key)) {
    return CARGO_WEIGHT_KG_MAP[key];
  }
  // 一般貨物は 1 単位 = 1 t (1000 kg) 基準で扱う
  return 1000;
}

// 起動加速度(km/h/s, 上限4.5)から連続的に最高速倍率(1.03〜1.6)を算出する
export function calcSpeedMultiplierFromAccel(accelKmhPerS) {
  const raw = toFiniteNumber(accelKmhPerS, 0);
  const clamped = Math.max(0, Math.min(MAX_ACCEL_KMH_S, raw));
  return MIN_ACCEL_MULTIPLIER + (MAX_ACCEL_MULTIPLIER - MIN_ACCEL_MULTIPLIER) * (clamped / MAX_ACCEL_KMH_S);
}

// 最高速倍率(1.03〜1.6)から対応する加速度(km/h/s)へ逆算する
export function calcAccelFromSpeedMultiplier(multiplier) {
  const raw = toFiniteNumber(multiplier, MIN_ACCEL_MULTIPLIER);
  const ratio = (raw - MIN_ACCEL_MULTIPLIER) / (MAX_ACCEL_MULTIPLIER - MIN_ACCEL_MULTIPLIER);
  return Math.max(0, Math.min(MAX_ACCEL_KMH_S, ratio * MAX_ACCEL_KMH_S));
}

// 車両配列から編成全体の出力・空車重量・満載貨物重量・総重量・最高速度を集計する
export function calcConsistMetrics(objects = []) {
  let count = 0;
  let poweredCount = 0;
  let totalPower = 0;
  let emptyWeight = 0;
  let cargoWeight = 0;
  let minTopSpeed = 0;

  objects.forEach((item) => {
    if (!item || (item.objType && item.objType !== 'vehicle')) return;
    const v = item.values || item;
    count += 1;

    const power = Math.max(0, toFiniteNumber(v.power, 0));
    const weight = Math.max(0, toFiniteNumber(v.weight, 0));
    const payload = Math.max(0, toFiniteNumber(v.payload, 0));
    const speed = Math.max(0, toFiniteNumber(v.speed, 0));
    const unitKg = getCargoWeightPerUnitKg(v.freight);

    if (power > 0) {
      poweredCount += 1;
      totalPower += power;
    }
    emptyWeight += weight;
    cargoWeight += (payload * unitKg) / 1000;
    if (speed > 0 && (minTopSpeed === 0 || speed < minTopSpeed)) {
      minTopSpeed = speed;
    }
  });

  return {
    count,
    poweredCount,
    totalPower,
    emptyWeight,
    cargoWeight,
    loadedWeight: emptyWeight + cargoWeight,
    minTopSpeed
  };
}

// Simutrans Standard の連続式で平坦線での理論最高速度(km/h)を計算する
export function calcSimutransMaxSpeedKmh({ power, gear = 100, loadedWeight }) {
  if (power <= 0 || gear <= 0 || loadedWeight <= 0) return 0;
  const effPower = power * (gear / 100);
  const ratio = effPower / loadedWeight;
  if (ratio <= 1) return 0;
  return 50 * Math.sqrt(ratio - 1);
}

// Simutrans Standard (simconvoi.cc) の整数演算で指定速度(km/h)を維持できるか判定する
export function hasEnoughSimutransPowerForSpeed({ power, gear, loadedWeight, speedKmh }) {
  if (power <= 0 || gear <= 0 || loadedWeight <= 0 || speedKmh <= 0) return false;
  const internalGear = Math.floor((gear * 64) / 100);
  if (internalGear <= 0) return false;
  const p = power * internalGear;
  const mKg = Math.round(loadedWeight * 1000);
  const s = Math.floor((speedKmh * 64) / 5);
  const resistance = Math.floor((s * (Math.floor((mKg * s) / 3125) + 1)) / 2048 + (64 * mKg) / 1000);
  return p >= resistance;
}

// Standard 基準で目標理論最高速度(targetSpeed km/h)を出すために必要な gear(%) を上限なしで算出する
export function calcGearForTargetSpeed({ power, loadedWeight, targetSpeed }) {
  if (!(power > 0) || !(loadedWeight > 0) || !(targetSpeed > 0)) return null;
  const powerPerTonNeeded = (targetSpeed / 50) ** 2 + 1;
  let gear = Math.max(1, Math.ceil((100 * loadedWeight * powerPerTonNeeded) / power));

  // C++ 側の整数切り捨て (gear * 64 / 100) による僅かな不足を最小限だけ補正する（上限は設けない）
  for (let i = 0; i < 4; i++) {
    if (hasEnoughSimutransPowerForSpeed({ power, gear, loadedWeight, speedKmh: targetSpeed })) break;
    gear += 1;
  }
  return gear;
}

// テキスト・仕様・車両種別から連続的な起動加速度(km/h/s, 上限4.5)を推定する
export function resolveVehicleAcceleration({ accelKmhS = '', accelProfile = 'auto', consistSpec = null, objects = [], userPrompt = '' } = {}) {
  const clamp = v => Math.round(Math.max(0, Math.min(MAX_ACCEL_KMH_S, v)) * 100) / 100;

  // 1. UI 数値指定またはオプション数値指定を最優先
  const explicitNum = toFiniteNumber(accelKmhS, NaN);
  if (Number.isFinite(explicitNum) && explicitNum >= 0) return clamp(explicitNum);
  if (accelProfile === 'high') return MAX_ACCEL_KMH_S;
  if (accelProfile === 'low') return 0;

  // 2. プロンプト内の明示的な加速度数値指定（例: "3.3km/h/s", "加速度2.5"）
  const promptMatch = String(userPrompt || '').match(/(?:起動加速度|加速度)?\s*(\d+(?:\.\d+)?)\s*km\/h\/s/i);
  if (promptMatch) return clamp(Number(promptMatch[1]));

  // 3. AI 出力の consistSpec.acceleration / accelKmhPerS / speedMultiplier
  const specAccel = toFiniteNumber(consistSpec?.acceleration ?? consistSpec?.accelKmhPerS ?? consistSpec?.accel_kmhs, NaN);
  if (Number.isFinite(specAccel) && specAccel >= 0) return clamp(specAccel);

  const specMult = toFiniteNumber(consistSpec?.speedMultiplier, NaN);
  if (Number.isFinite(specMult) && specMult > 0) return clamp(calcAccelFromSpeedMultiplier(specMult));

  const specProf = String(consistSpec?.accelProfile || '').trim().toLowerCase();
  if (specProf === 'high') return MAX_ACCEL_KMH_S;
  if (specProf === 'low') return 0.5;

  // 4. 車両諸元・キーワードからの連続的デフォルト推定 (0〜4.5 km/h/s)
  const vehicles = objects.filter(it => !it?.objType || it.objType === 'vehicle');
  const waytypes = vehicles.map(it => String(it?.values?.waytype || '').toLowerCase());
  const engines = vehicles.map(it => String(it?.values?.engine_type || '').toLowerCase());
  const freights = vehicles.map(it => String(it?.values?.freight || '').toLowerCase());
  const namesText = vehicles.map(it => `${it?.common?.name || ''} ${it?.common?.jaName || ''}`).join(' ');
  const text = `${userPrompt} ${namesText}`.toLowerCase();

  if (waytypes.includes('water') || /船|フェリー|タンカー|ship|ferry|tanker/.test(text)) return 0.2;
  if (engines.includes('steam') || /\bsl\b|蒸気機関車/.test(text)) return 0.4;
  if (/貨物|貨車|freight|cargo|コキ|タキ|トキ/.test(text) || freights.some(f => f && f !== 'none' && f !== 'passagiere' && f !== 'post')) {
    return waytypes.includes('road') ? 1.2 : 0.5;
  }
  if (/ジェットカー|5500系|5700系|高加速/.test(text)) return 4.2;
  if (waytypes.some(w => w === 'tram_track' || w === 'monorail_track' || w === 'maglev_track') || /路面電車|lrt|モノレール|新交通|agt/.test(text)) return 3.5;
  if (/地下鉄|メトロ|metro|subway/.test(text)) return 3.3;
  if (/路線バス|トロリーバス|都市バス/.test(text)) return 3.0;
  if (/トレーラー|大型トラック|truck/.test(text)) return 1.2;
  if (waytypes.includes('road') || /バス|bus/.test(text)) return 2.5;
  if (/機関車|客車|locomotive|\bel\b|\bdl\b/.test(text)) return 0.8;
  if (/新幹線|shinkansen/.test(text)) return 2.2;
  if (/特急|急行|近郊/.test(text)) return 1.9;
  if (/気動車|キハ|dmu/.test(text) || engines.includes('diesel')) return 1.4;
  if (/通勤/.test(text)) return 2.6;
  if (waytypes.includes('air') || /航空機|旅客機/.test(text)) return 2.0;

  const powered = vehicles.filter(it => toFiniteNumber(it?.values?.power, 0) > 0);
  const allLocos = powered.length > 0 && powered.length === vehicles.length &&
    powered.every(it => toFiniteNumber(it?.values?.payload, 0) <= 0) &&
    waytypes.some(w => w === 'track' || w === 'narrowgauge_track');
  if (allLocos) return 0.6;

  return 2.4;
}

// 生成された車両オブジェクト配列に対し、標準編成満載重量と連続加速度から gear を補正する
export function applyStandardGearBalance(objects = [], { parsed = {}, options = {} } = {}) {
  const vehicles = objects.filter(it => it && it.objType === 'vehicle');
  if (vehicles.length === 0) return { applied: false };

  const metrics = calcConsistMetrics(vehicles);
  if (metrics.poweredCount === 0 || metrics.totalPower <= 0 || metrics.minTopSpeed <= 0) {
    return { applied: false };
  }

  const consistSpec = parsed?.consistSpec && typeof parsed.consistSpec === 'object' ? parsed.consistSpec : null;
  const accelKmhS = resolveVehicleAcceleration({
    accelKmhS: options.accelKmhS,
    accelProfile: options.accelProfile || 'auto',
    consistSpec,
    objects: vehicles,
    userPrompt: options.userPrompt || ''
  });
  const multiplier = calcSpeedMultiplierFromAccel(accelKmhS);

  const vehicleMode = options.vehicleMode || 'consist';
  const specPower = toFiniteNumber(consistSpec?.standardTotalPower, 0);
  const specWeight = toFiniteNumber(consistSpec?.standardFullLoadWeight, 0);
  const specSpeed = toFiniteNumber(consistSpec?.standardMaxSpeed, 0);

  const isSingleUncoupledLoco = (
    vehicles.length === 1 &&
    metrics.poweredCount === 1 &&
    toFiniteNumber(vehicles[0]?.values?.payload, 0) <= 0 &&
    (vehicles[0]?.values?.waytype === 'track' || vehicles[0]?.values?.waytype === 'narrowgauge_track') &&
    specWeight > metrics.loadedWeight &&
    specPower > 0
  );
  const useSpecConsist = ((vehicleMode === 'series' || vehicleMode === 'single') || isSingleUncoupledLoco) &&
    specPower > 0 && specWeight > 0;

  const totalPower = useSpecConsist ? specPower : metrics.totalPower;
  const loadedWeight = useSpecConsist ? specWeight : metrics.loadedWeight;
  const maxSpeed = metrics.minTopSpeed || specSpeed;
  const targetSpeed = maxSpeed * multiplier;

  const gear = calcGearForTargetSpeed({ power: totalPower, loadedWeight, targetSpeed });
  if (!gear) return { applied: false };

  vehicles.forEach((it) => {
    if (toFiniteNumber(it.values?.power, 0) > 0) {
      it.values.gear = String(gear);
    }
  });

  const multStr = multiplier.toFixed(2);
  const summaryNote = `[Standardギア補正: 加速度${accelKmhS}km/h/s→${multStr}x (基準${maxSpeed}km/h→理論${Math.round(targetSpeed)}km/h / 満載総重${loadedWeight.toFixed(1)}t / 総出力${Math.round(totalPower)}kW → gear=${gear})]`;

  return {
    applied: true,
    accelKmhS,
    multiplier,
    gear,
    loadedWeight,
    totalPower,
    maxSpeed,
    targetSpeed,
    summaryNote
  };
}
