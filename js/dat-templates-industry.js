// 自然物・工場・田畑・貨物系オブジェクトの dat テンプレート定義

export const INDUSTRY_DAT_TEMPLATES = (WAYTYPE_OPTIONS) => ({
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
      speed: '0',
      trees_on_top: false,
      waytype: '',
      climates: ['temperate']
    },
    fields: [
      { key: 'DistributionWeight', label: '出現重み (DistributionWeight)', type: 'number', min: 0 },
      { key: 'cost', label: '撤去費 (cost)', type: 'number', min: 0 },
      { key: 'seasons', label: '季節数 (seasons)', type: 'number', min: 1, max: 4 },
      { key: 'speed', label: '移動速度 km/h (speed / 0=静止)', type: 'number', min: 0 },
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
      start_fields: '',
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
      {
        key: 'dimsViews',
        label: '向き数 (dims Views)',
        type: 'number_presets',
        min: 1,
        max: 255,
        presets: [
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '4', label: '4' }
        ]
      },
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
      { key: 'min_fields', label: '最小フィールド数 (min_fields / makeobj46+)', type: 'number', min: 0 },
      { key: 'max_fields', label: '最大フィールド数 (max_fields / makeobj46+)', type: 'number', min: 0 },
      { key: 'start_fields', label: '初期フィールド最大数 (start_fields / makeobj55+)', type: 'number', min: 0 },
      { key: 'probability_to_spawn', label: 'フィールド生成確率 (probability_to_spawn / makeobj46+)', type: 'number', min: 0, max: 10000 },
      { key: 'climates', label: '気候 (climates)', type: 'climates', fullWidth: true }
    ]
  },

  field: {
    obj: 'field',
    label: '畑・周辺フィールド (field)',
    supportsImages: true,
    defaults: {
      name: 'new_field',
      seasons: '1',
      has_snow: false,
      min_fields: '',
      max_fields: '',
      start_fields: '',
      probability_to_spawn: '',
      production_per_field: '16',
      storage_capacity: '0',
      spawn_weight: '100'
    },
    fields: [
      { key: 'seasons', label: '季節・パターン数 (1〜4 / 雪あり時は+1枚追加)', type: 'number', min: 1, max: 4 },
      { key: 'has_snow', label: '雪画像あり (has_snow=1 / 末尾を雪画像として追加)', type: 'checkbox' },
      { key: 'min_fields', label: '最小フィールド数 (min_fields / makeobj46+)', type: 'number', min: 0 },
      { key: 'max_fields', label: '最大フィールド数 (max_fields / makeobj46+)', type: 'number', min: 0 },
      { key: 'probability_to_spawn', label: '生成確率 (probability_to_spawn / makeobj46+)', type: 'number', min: 0, max: 10000 },
      { key: 'production_per_field', label: '1枚毎の生産増 (production_per_field / makeobj46+)', type: 'number', min: 0 },
      { key: 'storage_capacity', label: '1枚毎の貯蔵増 (storage_capacity / makeobj51+)', type: 'number', min: 0 },
      { key: 'spawn_weight', label: '出現重み (spawn_weight / makeobj51+)', type: 'number', min: 0 },
      { key: 'start_fields', label: '初期フィールド最大数 (start_fields / makeobj55+)', type: 'number', min: 0 }
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
});
