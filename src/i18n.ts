/**
 * Tiny framework-free i18n (English + 简体中文).
 *
 * No dependency, no build step: one dictionary keyed by string id, a `t()`
 * lookup with `{var}` interpolation, the active language persisted to
 * localStorage (auto-detected from the browser on first run), and a subscribe
 * hook so the DOM can re-render when the language changes. Matches the plain-DOM
 * style of ui/Settings.ts.
 *
 * Feature names/descriptions and POI kind names live here too (keyed by their
 * domain id) so the world's content is localised from one place.
 */

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'wwd.lang';

/** UI strings. Every key MUST exist in both locales (a test enforces this). */
const UI = {
  en: {
    'app.title': 'Walk with Datou',
    'hud.walk': 'WASD / Arrow keys to walk',
    'hud.look': 'Drag to look · scroll to zoom',
    'hud.pet': 'Click on Datou to pet',
    'hud.hover': 'Hover a landmark for its name · click to look closer',
    'hud.creator': 'Press {key} for creator fly-cam',
    'hud.mood': 'Datou mood',
    'creator.banner': '✈️ Creator mode — WASD fly · Q/E down/up · Shift boost · C to exit',
    'settings.language': 'Language',
    'settings.physics': 'Physics engine',
    'settings.running': 'Now running',
    'settings.lite': 'Lite',
    'settings.liteDesc': 'Instant, lightweight motion. Best on older devices.',
    'settings.mujoco': 'MuJoCo physics',
    'settings.mujocoDesc': 'Real simulation engine (~8.5 MB download).',
    'settings.reloadMujoco': 'MuJoCo downloads a ~8.5 MB engine on first load. Reloading…',
    'settings.reloading': 'Reloading…',
    'card.close': 'Close',
    'invite.investigate': 'Datou trots over to investigate…',
    'invite.onway': 'Datou is already on its way…',
    'mood.happy': 'happy',
    'mood.calm': 'calm',
    'mood.curious': 'curious',
    'mood.tired': 'tired',
  },
  zh: {
    'app.title': '与大头同行',
    'hud.walk': 'WASD / 方向键 移动',
    'hud.look': '拖拽转视角 · 滚轮缩放',
    'hud.pet': '点击大头来抚摸',
    'hud.hover': '悬停地标查看名称 · 点击查看详情',
    'hud.creator': '按 {key} 进入创作者飞行视角',
    'hud.mood': '大头心情',
    'creator.banner': '✈️ 创作者模式 — WASD 飞行 · Q/E 升降 · Shift 加速 · C 退出',
    'settings.language': '语言',
    'settings.physics': '物理引擎',
    'settings.running': '当前运行',
    'settings.lite': '轻量',
    'settings.liteDesc': '即时、轻量的运动。适合较旧的设备。',
    'settings.mujoco': 'MuJoCo 物理',
    'settings.mujocoDesc': '真实仿真引擎（约 8.5 MB 下载）。',
    'settings.reloadMujoco': 'MuJoCo 首次加载需下载约 8.5 MB 引擎。正在重新加载…',
    'settings.reloading': '正在重新加载…',
    'card.close': '关闭',
    'invite.investigate': '大头小跑过去查看…',
    'invite.onway': '大头已经在路上了…',
    'mood.happy': '开心',
    'mood.calm': '平静',
    'mood.curious': '好奇',
    'mood.tired': '疲倦',
  },
} as const;

/** Localised name + description for each named feature, keyed by feature id. */
const FEATURE_TEXT: Record<Lang, Record<string, { name: string; description: string }>> = {
  en: {
    'big-oak': {
      name: 'The Big Oak',
      description:
        'The oldest tree in the park, tall enough to see from the home meadow. Datou likes to circle its roots, nose down, reading who passed through.',
    },
    'lookout-bench': {
      name: 'Lookout Bench',
      description:
        'A weathered bench at the edge of the East Grove. A good place to sit while Datou watches the long grass for movement.',
    },
    bridge: {
      name: 'Old Plank Bridge',
      description:
        'An arched wooden footbridge across the lake. The boards knock pleasantly underpaw — Datou always trots across a little faster than it needs to.',
    },
    fountain: {
      name: 'Meadow Fountain',
      description:
        'A small tiered stone fountain near home. The trickle is the first sound you hear each visit. Birds bathe here when no one is looking.',
    },
    'home-post': {
      name: 'Home Post',
      description:
        'The signpost by the spawn — the heart of the park and where shared discoveries come home to. Start and end your walk here.',
    },
    birdbath: {
      name: 'Stone Birdbath',
      description:
        'A mossy birdbath the meadow songbirds adore. Datou keeps a respectful distance and just… watches.',
    },
    'picnic-spot': {
      name: 'Picnic Spot',
      description:
        'A checked blanket and a wicker basket, laid out in the sun. The coziest corner of the meadow to rest a while together.',
    },
    'signpost-woods': {
      name: 'Woods Trailhead',
      description:
        'A trail sign pointing north into the Deep Woods. Cooler, darker, denser — where curiosity tends to lead.',
    },
    'signpost-lake': {
      name: 'Lakeside Trailhead',
      description:
        'A trail sign pointing south to the Lakeside. Reeds, lily pads, and the old plank bridge wait at the water.',
    },
    'signpost-grove': {
      name: 'Grove Trailhead',
      description:
        'A trail sign pointing east to the Grove. Dappled light, scattered shinies, and the Lookout Bench lie that way.',
    },
  },
  zh: {
    'big-oak': {
      name: '大橡树',
      description:
        '公园里最古老的树，从家园草甸就能望见。大头喜欢低着鼻子绕着树根转，读取谁曾从这里经过。',
    },
    'lookout-bench': {
      name: '瞭望长椅',
      description: '东林边缘一张饱经风霜的长椅。坐在这里，看着大头在长草中留意动静，正合适。',
    },
    bridge: {
      name: '旧木板桥',
      description: '横跨湖面的拱形木桥。木板在脚下咯吱作响——大头过桥时总会不由自主地小跑快一点。',
    },
    fountain: {
      name: '草甸喷泉',
      description: '家附近一座小巧的多层石喷泉。潺潺水声是你每次到来听见的第一种声音。没人看时，鸟儿会在这里沐浴。',
    },
    'home-post': {
      name: '家园木桩',
      description: '出生点旁的指示桩——公园的中心，也是共同发现的归处。你的散步从这里开始，也在这里结束。',
    },
    birdbath: {
      name: '石制鸟浴盆',
      description: '一座长满青苔的鸟浴盆，草甸的鸣禽都很喜欢。大头识趣地保持着距离，只是静静地看着。',
    },
    'picnic-spot': {
      name: '野餐地',
      description: '阳光下铺着的格子野餐布和一只柳条篮子。草甸里最惬意的一角，适合一起歇一会儿。',
    },
    'signpost-woods': {
      name: '林间小径入口',
      description: '一块指向北方深林的路牌。更凉、更暗、更密——好奇心往往把你引向那里。',
    },
    'signpost-lake': {
      name: '湖畔小径入口',
      description: '一块指向南方湖畔的路牌。芦苇、睡莲和那座旧木板桥在水边等着你。',
    },
    'signpost-grove': {
      name: '林苑小径入口',
      description: '一块指向东方林苑的路牌。斑驳的光影、散落的闪光物，还有瞭望长椅都在那个方向。',
    },
  },
};

/** Localised POI kind names (for the discovery loop / diary). */
const POI_KIND_NAME: Record<Lang, Record<string, string>> = {
  en: {
    'sniff-spot': 'an interesting smell',
    'shiny-thing': 'something shiny',
    butterfly: 'a butterfly',
    puddle: 'a little puddle',
    burrow: 'a small burrow',
    'berry-bush': 'a berry bush',
    'scent-trail': 'a scent trail',
  },
  zh: {
    'sniff-spot': '有趣的气味',
    'shiny-thing': '闪亮的东西',
    butterfly: '一只蝴蝶',
    puddle: '一小洼水',
    burrow: '一个小洞穴',
    'berry-bush': '一丛浆果',
    'scent-trail': '一条气味踪迹',
  },
};

export type UIKey = keyof typeof UI.en;

let current: Lang = detectInitialLang();
const listeners = new Set<(lang: Lang) => void>();

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // localStorage may be unavailable (private mode / SSR) — fall through.
  }
  // Auto-detect: any zh-* browser language → Chinese, else English.
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore persistence failures.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const fn of listeners) fn(lang);
}

/** Subscribe to language changes; returns an unsubscribe fn. */
export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate a UI key, interpolating `{name}` placeholders from `vars`. */
export function t(key: UIKey, vars?: Record<string, string>): string {
  let s: string = UI[current][key] ?? UI.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  }
  return s;
}

/** Localised { name, description } for a feature id (falls back to English). */
export function featureText(id: string): { name: string; description: string } {
  return FEATURE_TEXT[current][id] ?? FEATURE_TEXT.en[id] ?? { name: id, description: '' };
}

/** Localised name for a POI kind (falls back to English). */
export function poiKindName(kind: string): string {
  return POI_KIND_NAME[current][kind] ?? POI_KIND_NAME.en[kind] ?? kind;
}

/**
 * Translate every element in the DOM carrying a `data-i18n="<key>"` attribute,
 * setting its textContent to the current locale's string. An optional
 * `data-i18n-key` provides the `{key}` interpolation var (used by the creator
 * hint's keyboard key). Call once at boot and again on each language change.
 */
export function applyStaticI18n(root: ParentNode = document): void {
  const nodes = root.querySelectorAll<HTMLElement>('[data-i18n]');
  for (const el of nodes) {
    const key = el.dataset.i18n as UIKey | undefined;
    if (!key) continue;
    const keyVar = el.dataset.i18nKey;
    el.textContent = t(key, keyVar ? { key: keyVar } : undefined);
  }
}

// Exposed for tests: the raw tables so completeness can be asserted.
export const __tables = { UI, FEATURE_TEXT, POI_KIND_NAME };
