import { WAYTYPE_OPTIONS, CLIMATE_OPTIONS, EXTRA_DAT_TEMPLATES } from './dat-templates-extra.js';

export { WAYTYPE_OPTIONS, CLIMATE_OPTIONS };

// 建物用プリセット定義
export const BUILDING_PRESETS = {
  res: { label: '住宅 (res)', values: { type: 'res', level: '10', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  com: { label: '商業 (com)', values: { type: 'com', level: '10', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  ind: { label: '工業 (ind)', values: { type: 'ind', level: '10', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  cur: { label: '観光名所 (cur)', values: { type: 'cur', level: '25', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  mon: { label: '記念碑 (mon)', values: { type: 'mon', level: '20', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  hq:  { label: '本社 (hq)', values: { type: 'hq', level: '30', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  tow: { label: '市庁舎 (tow)', values: { type: 'tow', level: '20', waytype: '', enables_pax: false, enables_post: false, enables_ware: false, needs_ground: true } },
  stop: { label: '駅・停留所 (stop)', values: { type: 'stop', level: '4', waytype: 'track', enables_pax: true, enables_post: false, enables_ware: false, capacity: '32', cost: '20000', maintenance: '400', needs_ground: false } },
  extension: { label: '駅拡張施設 (extension)', values: { type: 'extension', level: '4', waytype: '', enables_pax: true, enables_post: true, enables_ware: false, capacity: '64', cost: '25000', maintenance: '500', needs_ground: true } },
  depot: { label: '車庫 (depot)', values: { type: 'depot', level: '2', waytype: 'track', enables_pax: false, enables_post: false, enables_ware: false, cost: '50000', maintenance: '1000', needs_ground: false } },
  harbour: { label: '港 (harbour)', values: { type: 'harbour', level: '6', waytype: 'water', enables_pax: true, enables_post: true, enables_ware: true, capacity: '128', cost: '80000', maintenance: '1200', needs_ground: true } }
};

export const CORE_DAT_TEMPLATES = {
  building: {
    obj: 'building',
    label: '建物・駅・車庫 (building)',
    supportsImages: true,
    defaults: {
      name: 'new_building',
      type: 'res',
      dimsW: '1',
      dimsH: '1',
      dimsViews: '4',
      heightTiles: '1',
      frames: '1',
      seasons: '1',
      imageLayer: 'back',
      level: '10',
      chance: '',
      waytype: '',
      enables_pax: false,
      enables_post: false,
      enables_ware: false,
      capacity: '',
      cost: '',
      maintenance: '',
      animation_time: '300',
      needs_ground: true,
      noinfo: false,
      noconstruction: false,
      allow_underground: '',
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      climates: ['temperate', 'mediterran', 'tropic', 'desert']
    },
    fields: [
      { key: 'type', label: '建物種別 (type)', type: 'select', options: [
        { value: 'res', label: 'res (住宅)' },
        { value: 'com', label: 'com (商業)' },
        { value: 'ind', label: 'ind (工業)' },
        { value: 'cur', label: 'cur (観光名所)' },
        { value: 'mon', label: 'mon (記念碑)' },
        { value: 'hq', label: 'hq (本社)' },
        { value: 'tow', label: 'tow (市庁舎)' },
        { value: 'stop', label: 'stop (駅・停留所)' },
        { value: 'extension', label: 'extension (駅拡張施設)' },
        { value: 'depot', label: 'depot (車庫)' },
        { value: 'harbour', label: 'harbour (港)' },
        { value: 'dock', label: 'dock (ドック)' }
      ] },
      { key: 'level', label: 'レベル / 規模 (level)', type: 'number', min: 0 },
      { key: 'dimsW', label: '幅タイル (dims W)', type: 'number', min: 1, max: 16 },
      { key: 'dimsH', label: '奥行タイル (dims H)', type: 'number', min: 1, max: 16 },
      { key: 'dimsViews', label: '向き数 (dims Views)', type: 'select', options: [
        { value: '1', label: '1方向' },
        { value: '2', label: '2方向' },
        { value: '4', label: '4方向' }
      ] },
      { key: 'heightTiles', label: '高さ段数 (H)', type: 'number', min: 1, max: 16 },
      { key: 'frames', label: 'アニメ枚数 (A)', type: 'number', min: 1, max: 16 },
      { key: 'seasons', label: '季節数 (S: 1=通常 / 2=雪有)', type: 'select', options: [
        { value: '1', label: '1 (通常のみ)' },
        { value: '2', label: '2 (通常 + 雪)' }
      ] },
      { key: 'imageLayer', label: '画像レイヤー種別', type: 'select', options: [
        { value: 'back', label: 'BackImage のみ' },
        { value: 'front', label: 'FrontImage のみ' },
        { value: 'both', label: 'BackImage + FrontImage' }
      ] },
      { key: 'animation_time', label: 'アニメ間隔 ms (frames>1時)', type: 'number', min: 10 },
      { key: 'waytype', label: '接続軌道 (駅/車庫用 waytype)', type: 'select', options: [{ value: '', label: '(なし)' }, ...WAYTYPE_OPTIONS] },
      { key: 'capacity', label: '駅容量 (capacity)', type: 'number', min: 0 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'chance', label: '出現確率 (chance)', type: 'number', min: 0 },
      { key: 'allow_underground', label: '地下建設 (allow_underground)', type: 'select', options: [
        { value: '', label: '(未指定)' },
        { value: '0', label: '0 (地上のみ)' },
        { value: '1', label: '1 (地下のみ)' },
        { value: '2', label: '2 (地上・地下両用)' }
      ] },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'needs_ground', label: '地面描画 (needs_ground=1)', type: 'checkbox' },
      { key: 'noinfo', label: '情報窓非表示 (noinfo=1)', type: 'checkbox' },
      { key: 'noconstruction', label: '建設中画像なし (noconstruction=1)', type: 'checkbox' },
      { key: 'enables_pax', label: '旅客対応 (enables_pax=1)', type: 'checkbox' },
      { key: 'enables_post', label: '郵便対応 (enables_post=1)', type: 'checkbox' },
      { key: 'enables_ware', label: '貨物対応 (enables_ware=1)', type: 'checkbox' },
      { key: 'climates', label: '気候 (climates)', type: 'climates', fullWidth: true }
    ]
  },

  vehicle: {
    obj: 'vehicle',
    label: '車両・航空機・船舶 (vehicle)',
    supportsImages: true,
    defaults: {
      name: 'new_vehicle',
      waytype: 'track',
      engine_type: 'electric',
      speed: '120',
      power: '1000',
      gear: '100',
      weight: '40',
      axle_load: '',
      cost: '150000',
      runningcost: '80',
      length: '8',
      freight: 'Passagiere',
      payload: '80',
      loading_time: '2000',
      intro_year: '1970',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      smoke: '',
      sound: '',
      constraintsPrev: '',
      constraintsNext: '',
      directions: '8',
      hasFreightImage: false,
      freightRow: '',
      freightTypeName: '',
      reverseRowMode: 'same_row',
      reverseRow: '0',
      reverseFlipDir: false,
      includeNoElectric: false,
      noElectricRow: ''
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'engine_type', label: '動力種別 (engine_type)', type: 'select', options: [
        { value: '', label: '(指定なし / 客車・貨車)' },
        { value: 'electric', label: 'electric (電気)' },
        { value: 'diesel', label: 'diesel (ディーゼル)' },
        { value: 'steam', label: 'steam (蒸気)' },
        { value: 'bio', label: 'bio (バイオ)' },
        { value: 'fuel_cell', label: 'fuel_cell (燃料電池)' },
        { value: 'sail', label: 'sail (帆走)' },
        { value: 'unknown', label: 'unknown' }
      ] },
      { key: 'speed', label: '最高速度 km/h (speed)', type: 'number', min: 1 },
      { key: 'power', label: '出力 kW (power)', type: 'number', min: 0 },
      { key: 'gear', label: 'ギア比 % (gear)', type: 'number', min: 1 },
      { key: 'weight', label: '自重 t (weight)', type: 'number', min: 0 },
      { key: 'axle_load', label: '軸重 t (axle_load)', type: 'number', min: 0 },
      { key: 'length', label: '車体長 (length)', type: 'number', min: 1, max: 32 },
      { key: 'cost', label: '購入費 (cost)', type: 'number', min: 0 },
      { key: 'runningcost', label: '運行費 (runningcost)', type: 'number', min: 0 },
      { key: 'freight', label: '積載貨物 (freight)', type: 'text', placeholder: 'None / Passagiere / Post / Kohle 等' },
      { key: 'payload', label: '積載量 (payload)', type: 'number', min: 0 },
      { key: 'loading_time', label: '積載時間 ms (loading_time)', type: 'number', min: 0 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'smoke', label: '排煙定義 (smoke)', type: 'text', placeholder: '例: Diesel / Steam' },
      { key: 'sound', label: '効果音 (sound)', type: 'text', placeholder: '例: train.wav' },
      { key: 'constraintsPrev', label: '連結前車両 constraint[prev][i] (1行1車名/none)', type: 'textarea', placeholder: 'none\nother_car_name', fullWidth: true },
      { key: 'constraintsNext', label: '連結後車両 constraint[next][i] (1行1車名/none)', type: 'textarea', placeholder: 'none\nother_car_name', fullWidth: true }
    ]
  },

  citycar: {
    obj: 'citycar',
    label: '都市自動車 (citycar)',
    supportsImages: true,
    defaults: {
      name: 'new_citycar',
      DistributionWeight: '10',
      speed: '80',
      intro_year: '1970',
      intro_month: '1',
      retire_year: '',
      retire_month: ''
    },
    fields: [
      { key: 'DistributionWeight', label: '出現重み (DistributionWeight)', type: 'number', min: 0 },
      { key: 'speed', label: '最高速度 km/h (speed)', type: 'number', min: 1 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 }
    ]
  }
};

// 全オブジェクトテンプレート統合マップ
export const DAT_OBJECT_TEMPLATES = {
  ...CORE_DAT_TEMPLATES,
  ...EXTRA_DAT_TEMPLATES
};

// カテゴリ別メニュー構造
export const DAT_OBJECT_CATEGORIES = [
  {
    groupLabel: '建物・施設',
    items: ['building']
  },
  {
    groupLabel: '車両・自動車',
    items: ['vehicle', 'citycar']
  },
  {
    groupLabel: 'インフラ・軌道設備',
    items: ['way', 'way-object', 'bridge', 'tunnel', 'crossing', 'roadsign']
  },
  {
    groupLabel: '自然物・工場・貨物',
    items: ['tree', 'groundobj', 'field', 'factory', 'good']
  }
];
