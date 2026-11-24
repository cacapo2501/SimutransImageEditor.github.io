// Simutrans Standard の最高速度式に基づき標準編成満載重量からギア比(gear)を算出するモジュール

export const ACCEL_MULTIPLIERS = {
  high: 2.5,
  low: 1.1
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

// 車種・動力構成・プロンプト文から高加速(high)か低加速(low)かを判定する
export function inferAccelProfile({ accelProfile = 'auto', consistSpec = null, objects = [], userPrompt = '' } = {}) {
  if (accelProfile === 'high' || accelProfile === 'low') return accelProfile;

  const specProfile = String(consistSpec?.accelProfile || '').trim().toLowerCase();
  if (specProfile === 'high' || specProfile === 'low') return specProfile;

  const specMult = Number(consistSpec?.speedMultiplier);
  if (Number.isFinite(specMult) && specMult > 0) {
    return specMult >= 1.8 ? 'high' : 'low';
  }

  const vehicles = objects.filter(it => !it?.objType || it.objType === 'vehicle');
  const waytypes = vehicles.map(it => String(it?.values?.waytype || '').toLowerCase());
  const engines = vehicles.map(it => String(it?.values?.engine_type || '').toLowerCase());
  const freights = vehicles.map(it => String(it?.values?.freight || '').toLowerCase());
  const namesText = vehicles.map(it => `${it?.common?.name || ''} ${it?.common?.jaName || ''}`).join(' ');
  const text = `${userPrompt} ${namesText}`.toLowerCase();

  if (/低加速|1\.1\s*倍|1\.1x|low.?accel/i.test(text)) return 'low';
  if (/高加速|2\.5\s*倍|2\.5x|high.?accel/i.test(text)) return 'high';

  const hasLowSignal = (
    engines.includes('steam') ||
    waytypes.includes('water') ||
    waytypes.includes('air') ||
    freights.some(f => f && f !== 'none' && f !== 'passagiere' && f !== 'post') ||
    /機関車|locomotive|貨物|貨車|客車|freight|cargo|tanker|トレーラー|大型トラック|フェリー|貨物船|タンカー|航空機|旅客機|\bsl\b|\bel\b|\bdl\b/.test(text)
  );
  if (hasLowSignal) return 'low';

  const hasHighSignal = (
    waytypes.some(w => w === 'tram_track' || w === 'monorail_track' || w === 'maglev_track') ||
    /通勤|地下鉄|メトロ|metro|subway|tram|路面電車|lrt|モノレール|新交通|agt|路線バス|トロリーバス/.test(text)
  );
  if (hasHighSignal) return 'high';

  // 電車・気動車・バス等の一般的な旅客自走車両は高加速側、単一動力車で牽引前提等の場合は低加速とする
  const poweredVehicles = vehicles.filter(it => toFiniteNumber(it?.values?.power, 0) > 0);
  const allLocosWithoutPayload = poweredVehicles.length > 0 &&
    poweredVehicles.length === vehicles.length &&
    poweredVehicles.every(it => toFiniteNumber(it?.values?.payload, 0) <= 0) &&
    waytypes.some(w => w === 'track' || w === 'narrowgauge_track');
  if (allLocosWithoutPayload) return 'low';

  return 'high';
}

// 生成された車両オブジェクト配列に対し、標準編成満載時の重量ベースで gear を補正する
export function applyStandardGearBalance(objects = [], { parsed = {}, options = {} } = {}) {
  const vehicles = objects.filter(it => it && it.objType === 'vehicle');
  if (vehicles.length === 0) return { applied: false };

  const metrics = calcConsistMetrics(vehicles);
  if (metrics.poweredCount === 0 || metrics.totalPower <= 0 || metrics.minTopSpeed <= 0) {
    return { applied: false };
  }

  const consistSpec = parsed?.consistSpec && typeof parsed.consistSpec === 'object' ? parsed.consistSpec : null;
  const profile = inferAccelProfile({
    accelProfile: options.accelProfile || 'auto',
    consistSpec,
    objects: vehicles,
    userPrompt: options.userPrompt || ''
  });
  const multiplier = ACCEL_MULTIPLIERS[profile];

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

  const profileLabel = profile === 'high' ? '高加速' : '低加速';
  const summaryNote = `[Standardギア補正: ${profileLabel}${multiplier}x (基準${maxSpeed}km/h→理論${Math.round(targetSpeed)}km/h / 満載総重${loadedWeight.toFixed(1)}t / 総出力${Math.round(totalPower)}kW → gear=${gear})]`;

  return {
    applied: true,
    profile,
    multiplier,
    gear,
    loadedWeight,
    totalPower,
    maxSpeed,
    targetSpeed,
    summaryNote
  };
}
