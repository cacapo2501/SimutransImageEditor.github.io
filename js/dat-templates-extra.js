// インフラ・施設系・自然物・工場・貨物系オブジェクトの dat テンプレート定義

export const WAYTYPE_OPTIONS = [
  { value: 'track', label: 'track (鉄道)' },
  { value: 'road', label: 'road (道路)' },
  { value: 'tram_track', label: 'tram_track (路面電車)' },
  { value: 'monorail_track', label: 'monorail_track (モノレール)' },
  { value: 'maglev_track', label: 'maglev_track (リニア)' },
  { value: 'narrowgauge_track', label: 'narrowgauge_track (ナローゲージ)' },
  { value: 'water', label: 'water (水上)' },
  { value: 'air', label: 'air (航空)' }
];

export const CLIMATE_OPTIONS = [
  { value: 'water', label: 'water' },
  { value: 'desert', label: 'desert' },
  { value: 'tropic', label: 'tropic' },
  { value: 'mediterran', label: 'mediterran' },
  { value: 'temperate', label: 'temperate' },
  { value: 'tundra', label: 'tundra' },
  { value: 'rocky', label: 'rocky' },
  { value: 'arctic', label: 'arctic' }
];

export const EXTRA_DAT_TEMPLATES = {
  way: {
    obj: 'way',
    label: '軌道・道路 (way)',
    supportsImages: true,
    defaults: {
      name: 'new_way',
      waytype: 'track',
      topspeed: '120',
      max_weight: '25',
      cost: '15000',
      maintenance: '500',
      system_type: '0',
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      includeCursorIcon: true,
      includeDiagonal: true,
      includeSlopes: true
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'system_type', label: '構造種別 (system_type)', type: 'select', options: [
        { value: '0', label: '0 (通常地上)' },
        { value: '1', label: '1 (高架軌道/道路)' },
        { value: '255', label: '255 (滑走路/誘導路)' }
      ] },
      { key: 'topspeed', label: '最高速度 (topspeed)', type: 'number', min: 1 },
      { key: 'max_weight', label: '最大軸重 (max_weight)', type: 'number', min: 0 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'includeDiagonal', label: '斜め画像 (Diagonal) を出力', type: 'checkbox' },
      { key: 'includeSlopes', label: '坂道画像 (ImageUp) を出力', type: 'checkbox' },
      { key: 'includeCursorIcon', label: 'Cursor / Icon を出力', type: 'checkbox' }
    ]
  },

  'way-object': {
    obj: 'way-object',
    label: '架線・軌道設備 (way-object)',
    supportsImages: true,
    defaults: {
      name: 'new_catenary',
      waytype: 'track',
      own_waytype: 'overhead_lines',
      topspeed: '200',
      cost: '3000',
      maintenance: '100',
      intro_year: '1930',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      includeCursorIcon: true
    },
    fields: [
      { key: 'waytype', label: '対象軌道 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'own_waytype', label: '設備種別 (own_waytype)', type: 'select', options: [
        { value: 'overhead_lines', label: 'overhead_lines (架線)' },
        { value: 'electrified_track', label: 'electrified_track' }
      ] },
      { key: 'topspeed', label: '最高速度 (topspeed)', type: 'number', min: 1 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'includeCursorIcon', label: 'Cursor / Icon を出力', type: 'checkbox' }
    ]
  },

  bridge: {
    obj: 'bridge',
    label: '橋梁 (bridge)',
    supportsImages: true,
    defaults: {
      name: 'new_bridge',
      waytype: 'track',
      topspeed: '140',
      max_weight: '30',
      max_length: '0',
      max_height: '0',
      pillars_every: '0',
      cost: '60000',
      maintenance: '1500',
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      includeCursorIcon: true
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'topspeed', label: '最高速度 (topspeed)', type: 'number', min: 1 },
      { key: 'max_weight', label: '最大軸重 (max_weight)', type: 'number', min: 0 },
      { key: 'max_length', label: '最大長 (max_length, 0=無制限)', type: 'number', min: 0 },
      { key: 'max_height', label: '最大高 (max_height, 0=無制限)', type: 'number', min: 0 },
      { key: 'pillars_every', label: '橋脚間隔 (pillars_every)', type: 'number', min: 0 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'includeCursorIcon', label: 'Cursor / Icon を出力', type: 'checkbox' }
    ]
  },

  tunnel: {
    obj: 'tunnel',
    label: 'トンネル (tunnel)',
    supportsImages: true,
    defaults: {
      name: 'new_tunnel',
      waytype: 'track',
      topspeed: '160',
      max_weight: '30',
      cost: '100000',
      maintenance: '2000',
      way_is_clipped: true,
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      includeCursorIcon: true
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'topspeed', label: '最高速度 (topspeed)', type: 'number', min: 1 },
      { key: 'max_weight', label: '最大軸重 (max_weight)', type: 'number', min: 0 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'way_is_clipped', label: '坑口クリップ (way_is_clipped=1)', type: 'checkbox' },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'includeCursorIcon', label: 'Cursor / Icon を出力', type: 'checkbox' }
    ]
  },

  crossing: {
    obj: 'crossing',
    label: '踏切 (crossing)',
    supportsImages: true,
    defaults: {
      name: 'new_crossing',
      waytype0: 'track',
      waytype1: 'road',
      speed0: '160',
      speed1: '60',
      animation_time_open: '0',
      animation_time_closed: '0',
      sound: ''
    },
    fields: [
      { key: 'waytype0', label: '軌道1 (waytype[0])', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'waytype1', label: '軌道2 (waytype[1])', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'speed0', label: '速度制限1 (speed[0])', type: 'number', min: 1 },
      { key: 'speed1', label: '速度制限2 (speed[1])', type: 'number', min: 1 },
      { key: 'animation_time_open', label: '開状態アニメ時間 (ms)', type: 'number', min: 0 },
      { key: 'animation_time_closed', label: '閉状態アニメ時間 (ms)', type: 'number', min: 0 },
      { key: 'sound', label: '警報音ファイル (sound)', type: 'text', placeholder: '例: crossing.wav' }
    ]
  },

  roadsign: {
    obj: 'roadsign',
    label: '信号機・標識 (roadsign)',
    supportsImages: true,
    defaults: {
      name: 'new_signal',
      waytype: 'track',
      is_signal: true,
      is_presignal: false,
      is_longblocksignal: false,
      is_prioritysignal: false,
      is_choose_signal: false,
      single_way: false,
      min_speed: '0',
      cost: '5000',
      maintenance: '100',
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      signalStates: '4',
      includeCursorIcon: true
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'min_speed', label: '最低速度 (min_speed)', type: 'number', min: 0 },
      { key: 'signalStates', label: '画像コマ数 (Image[0..N-1])', type: 'number', min: 1, max: 32 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'is_signal', label: '閉塞信号 (is_signal=1)', type: 'checkbox' },
      { key: 'is_presignal', label: '遠方信号 (is_presignal=1)', type: 'checkbox' },
      { key: 'is_longblocksignal', label: '長区間信号 (is_longblocksignal=1)', type: 'checkbox' },
      { key: 'is_prioritysignal', label: '優先信号 (is_prioritysignal=1)', type: 'checkbox' },
      { key: 'is_choose_signal', label: '番線選択 (is_choose_signal=1)', type: 'checkbox' },
      { key: 'single_way', label: '一方通行 (single_way=1)', type: 'checkbox' },
      { key: 'includeCursorIcon', label: 'Cursor / Icon を出力', type: 'checkbox' }
    ]
  },

  tree: {
    obj: 'tree',
    label: '樹木 (tree)',
    supportsImages: true,
    defaults: {
      name: 'new_tree',
      DistributionWeight: '10',
      seasons: '4',
      ageCount: '5',
      climates: ['temperate', 'mediterran']
    },
    fields: [
      { key: 'DistributionWeight', label: '出現重み (DistributionWeight)', type: 'number', min: 0 },
      { key: 'seasons', label: '季節数 (seasons)', type: 'number', min: 1, max: 5 },
      { key: 'ageCount', label: '成長段階数 (Image[age])', type: 'number', min: 1, max: 5 },
      { key: 'climates', label: '気候 (climates)', type: 'climates', fullWidth: true }
    ]
  },

  groundobj: {
    obj: 'groundobj',
    label: '地上オブジェクト (groundobj)',
    supportsImages: true,
    defaults: {
      name: 'new_groundobj',
      DistributionWeight: '10',
      cost: '500',
      seasons: '1',
      trees_on_top: false,
      waytype: '',
      climates: ['temperate']
    },
    fields: [
      { key: 'DistributionWeight', label: '出現重み (DistributionWeight)', type: 'number', min: 0 },
      { key: 'cost', label: '撤去費 (cost)', type: 'number', min: 0 },
      { key: 'seasons', label: '季節数 (seasons)', type: 'number', min: 1, max: 4 },
      { key: 'waytype', label: '通行不可判定 (waytype)', type: 'select', options: [{ value: '', label: '(なし)' }, ...WAYTYPE_OPTIONS] },
      { key: 'trees_on_top', label: '上に木を生やす (trees_on_top=1)', type: 'checkbox' },
      { key: 'climates', label: '気候 (climates)', type: 'climates', fullWidth: true }
    ]
  },

  factory: {
    obj: 'factory',
    label: '工場・産業 (factory)',
    supportsImages: true,
    defaults: {
      name: 'new_factory',
      Location: 'Land',
      DistributionWeight: '10',
      Productivity: '100',
      Range: '20',
      pax_level: '12',
      MapColor: '240',
      dimsW: '2',
      dimsH: '2',
      dimsViews: '1',
      heightTiles: '1',
      seasons: '1',
      climates: ['temperate', 'mediterran', 'tropic'],
      inputGood0: '',
      inputCapacity0: '',
      inputFactor0: '',
      outputGood0: 'Kohle',
      outputCapacity0: '100',
      outputFactor0: '100',
      min_fields: '',
      max_fields: '',
      probability_to_spawn: '',
      fieldRefs: []
    },
    fields: [
      { key: 'Location', label: '立地 (Location)', type: 'select', options: [
        { value: 'Land', label: 'Land (郊外)' },
        { value: 'City', label: 'City (都市内)' },
        { value: 'Water', label: 'Water (海上)' }
      ] },
      { key: 'DistributionWeight', label: '出現重み (DistributionWeight)', type: 'number', min: 0 },
      { key: 'Productivity', label: '基本生産力 (Productivity)', type: 'number', min: 1 },
      { key: 'Range', label: '生産力振れ幅 (Range)', type: 'number', min: 0 },
      { key: 'pax_level', label: '旅客発生度 (pax_level)', type: 'number', min: 0 },
      { key: 'MapColor', label: 'マップ色番号 (MapColor)', type: 'number', min: 0, max: 255 },
      { key: 'dimsW', label: '幅タイル (dims W)', type: 'number', min: 1, max: 16 },
      { key: 'dimsH', label: '奥行タイル (dims H)', type: 'number', min: 1, max: 16 },
      { key: 'dimsViews', label: '向き数 (dims Views)', type: 'select', options: [
        { value: '1', label: '1方向' },
        { value: '2', label: '2方向' },
        { value: '4', label: '4方向' }
      ] },
      { key: 'heightTiles', label: '高さ段数 (H)', type: 'number', min: 1, max: 16 },
      { key: 'seasons', label: '季節数 (1:通常 / 2:通常+雪)', type: 'select', options: [
        { value: '1', label: '1 (通常のみ)' },
        { value: '2', label: '2 (通常 + 雪)' }
      ] },
      { key: 'inputGood0', label: '入力貨物0 (InputGood[0])', type: 'text', placeholder: '例: Eisenerz' },
      { key: 'inputCapacity0', label: '入力容量0 (InputCapacity[0])', type: 'number', min: 0 },
      { key: 'inputFactor0', label: '入力消費率0 (InputFactor[0])', type: 'number', min: 0 },
      { key: 'outputGood0', label: '出力貨物0 (OutputGood[0])', type: 'text', placeholder: '例: Stahl' },
      { key: 'outputCapacity0', label: '出力容量0 (OutputCapacity[0])', type: 'number', min: 0 },
      { key: 'outputFactor0', label: '出力生産率0 (OutputFactor[0])', type: 'number', min: 0 },
      { key: 'min_fields', label: '最小フィールド数 (min_fields)', type: 'number', min: 0 },
      { key: 'max_fields', label: '最大フィールド数 (max_fields)', type: 'number', min: 0 },
      { key: 'probability_to_spawn', label: 'フィールド生成確率 (probability_to_spawn)', type: 'number', min: 0, max: 10000 },
      { key: 'climates', label: '気候 (climates)', type: 'climates', fullWidth: true }
    ]
  },

  field: {
    obj: 'field',
    label: '畑・周辺フィールド (field)',
    supportsImages: true,
    defaults: { name: 'new_field', seasons: '1', has_snow: false },
    fields: [
      { key: 'seasons', label: '季節・パターン数 (Image[0..N-1])', type: 'number', min: 1, max: 4 },
      { key: 'has_snow', label: '雪画像あり (has_snow=1)', type: 'checkbox' }
    ]
  },

  good: {
    obj: 'good',
    label: '貨物定義 (good)',
    supportsImages: false,
    defaults: {
      name: 'new_good',
      metric: 't',
      catg: '1',
      value: '100',
      weight_per_unit: '1000',
      speed_bonus: '0',
      color: '12'
    },
    fields: [
      { key: 'metric', label: '単位 (metric)', type: 'text', placeholder: 't / kg / l / Sack / Paletten' },
      { key: 'catg', label: 'カテゴリ (catg: 0=特殊, 1=ばら, 2=梱包等)', type: 'number', min: 0 },
      { key: 'value', label: '基本運賃 (value)', type: 'number', min: 0 },
      { key: 'weight_per_unit', label: '単位重量 kg (weight_per_unit)', type: 'number', min: 0 },
      { key: 'speed_bonus', label: '速度ボーナス (speed_bonus)', type: 'number', min: 0 },
      { key: 'color', label: 'グラフ色番号 (color)', type: 'number', min: 0, max: 255 }
    ]
  }
};
