// インフラ・施設系・自然物・工場・貨物系オブジェクトの dat テンプレート定義
import { INDUSTRY_DAT_TEMPLATES } from './dat-templates-industry.js';

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

// way-object の own_waytype 用（makeobj の get_waytype() 準拠）
export const OWN_WAYTYPE_OPTIONS = [
  { value: 'electrified_track', label: 'electrified_track (架線・電化設備)' },
  ...WAYTYPE_OPTIONS,
  { value: 'decoration', label: 'decoration (装飾設備)' },
  { value: 'power', label: 'power (送電線)' },
  { value: 'none', label: 'none (種別なし)' }
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
      iconMode: 'auto',
      iconSampleMode: 'auto',
      cursorMode: 'none',
      cursorExternalName: '',
      cursorExternalDataUrl: '',
      cursorExternalRow: '0',
      cursorExternalCol: '0',
      includePoints: false,
      includeDiagonal: true,
      includeSlopes: true,
      includeSlopes2: false
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
      { key: 'includePoints', label: '分岐ポイント画像 (NSE1〜NSEW2) を出力', type: 'checkbox' },
      { key: 'includeDiagonal', label: '斜め画像 (Diagonal) を出力', type: 'checkbox' },
      { key: 'includeSlopes', label: '坂道画像 (ImageUp) を出力', type: 'checkbox' },
      { key: 'includeSlopes2', label: '2段坂画像 (ImageUp2) を出力', type: 'checkbox' }
    ]
  },

  'way-object': {
    obj: 'way-object',
    label: '架線・軌道設備 (way-object)',
    supportsImages: true,
    defaults: {
      name: 'new_catenary',
      waytype: 'track',
      own_waytype: 'electrified_track',
      topspeed: '200',
      cost: '3000',
      maintenance: '100',
      intro_year: '1930',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      includeDiagonal: true,
      iconMode: 'auto',
      iconSampleMode: 'auto',
      cursorMode: 'none',
      cursorExternalName: '',
      cursorExternalDataUrl: '',
      cursorExternalRow: '0',
      cursorExternalCol: '0'
    },
    fields: [
      { key: 'waytype', label: '対象軌道 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'own_waytype', label: '設備種別 (own_waytype)', type: 'select', options: OWN_WAYTYPE_OPTIONS },
      { key: 'topspeed', label: '最高速度 (topspeed)', type: 'number', min: 1 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'includeDiagonal', label: '斜め画像 (Diagonal) を出力', type: 'checkbox' }
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
      iconMode: 'auto',
      iconSampleMode: 'auto',
      cursorMode: 'none',
      cursorExternalName: '',
      cursorExternalDataUrl: '',
      cursorExternalRow: '0',
      cursorExternalCol: '0'
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
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 }
    ]
  },

  tunnel: {
    obj: 'tunnel',
    label: 'トンネル (tunnel)',
    supportsImages: true,
    defaults: {
      name: 'new_tunnel',
      waytype: 'track',
      way: '',
      topspeed: '160',
      max_weight: '30',
      cost: '100000',
      maintenance: '2000',
      way_is_clipped: true,
      tunnelPortalMode: 'single',
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      iconMode: 'auto',
      iconSampleMode: 'auto',
      cursorMode: 'none',
      cursorExternalName: '',
      cursorExternalDataUrl: '',
      cursorExternalRow: '0',
      cursorExternalCol: '0'
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'way', label: 'トンネル内軌道名 (way / 省略時自動)', type: 'text', placeholder: '例: wooden_sleeper_track' },
      { key: 'tunnelPortalMode', label: '坑口パターン (単線 / Nl,Nm,Nr複線以上)', type: 'select', options: [
        { value: 'single', label: '単線のみ (N, S, E, W)' },
        { value: 'double', label: '単線 + 複線 (N..W + Nl,Nr等)' },
        { value: 'multi', label: '単線 + 3線以上 (N..W + Nl,Nm,Nr等)' },
        { value: 'wide_only', label: '複線・3線以上のみ (Nl,Nm,Nr等)' }
      ] },
      { key: 'topspeed', label: '最高速度 (topspeed)', type: 'number', min: 1 },
      { key: 'max_weight', label: '最大軸重 (max_weight)', type: 'number', min: 0 },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'way_is_clipped', label: '坑口クリップ (way_is_clipped=1)', type: 'checkbox' },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 }
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
      free_route: false,
      end_of_choose: false,
      single_way: false,
      min_speed: '0',
      cost: '5000',
      maintenance: '100',
      intro_year: '1950',
      intro_month: '1',
      retire_year: '',
      retire_month: '',
      signalStates: '4',
      includeFrontImage: false,
      includeDiagonal: false,
      includeFrontDiagonal: false,
      diagonalStates: '8',
      iconMode: 'auto',
      iconSampleMode: 'auto',
      cursorMode: 'none',
      cursorExternalName: '',
      cursorExternalDataUrl: '',
      cursorExternalRow: '0',
      cursorExternalCol: '0'
    },
    fields: [
      { key: 'waytype', label: '軌道種別 (waytype)', type: 'select', options: WAYTYPE_OPTIONS },
      { key: 'cost', label: '建設費 (cost)', type: 'number', min: 0 },
      { key: 'maintenance', label: '維持費 (maintenance)', type: 'number', min: 0 },
      { key: 'min_speed', label: '最低速度 (min_speed)', type: 'number', min: 0 },
      { key: 'signalStates', label: '画像コマ数 (Image[0..N-1] / 4の倍数)', type: 'number', min: 4, max: 64 },
      { key: 'diagonalStates', label: '斜め画像コマ数 (Diagonal/FrontDiagonal, 基本 N×2)', type: 'number', min: 4, max: 128 },
      { key: 'intro_year', label: '登場年 (intro_year)', type: 'number', min: 1 },
      { key: 'intro_month', label: '登場月 (intro_month)', type: 'number', min: 1, max: 12 },
      { key: 'retire_year', label: '引退年 (retire_year)', type: 'number', min: 1 },
      { key: 'retire_month', label: '引退月 (retire_month)', type: 'number', min: 1, max: 12 },
      { key: 'is_signal', label: '閉塞信号 (is_signal=1)', type: 'checkbox' },
      { key: 'is_presignal', label: '遠方信号 (is_presignal=1)', type: 'checkbox' },
      { key: 'is_longblocksignal', label: '長区間信号 (is_longblocksignal=1)', type: 'checkbox' },
      { key: 'is_prioritysignal', label: '優先信号 (is_prioritysignal=1)', type: 'checkbox' },
      { key: 'is_choose_signal', label: '番線選択 (is_choose_signal=1)', type: 'checkbox' },
      { key: 'free_route', label: 'チューズ / 経路選択 (free_route=1)', type: 'checkbox' },
      { key: 'end_of_choose', label: '選択終了 / 振分無効 (end_of_choose=1)', type: 'checkbox' },
      { key: 'single_way', label: '一方通行 (single_way=1)', type: 'checkbox' },
      { key: 'includeFrontImage', label: '前面画像 (FrontImage[0..N-1]) を出力', type: 'checkbox' },
      { key: 'includeDiagonal', label: '斜め画像 (Diagonal[0..M-1]) を出力', type: 'checkbox' },
      { key: 'includeFrontDiagonal', label: '斜め前面画像 (FrontDiagonal[0..M-1]) を出力', type: 'checkbox' }
    ]
  },

  ...INDUSTRY_DAT_TEMPLATES(WAYTYPE_OPTIONS)
};
