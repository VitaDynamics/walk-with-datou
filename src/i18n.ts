/**
 * Tiny framework-free i18n (English + 简体中文).
 *
 * No dependency, no build step: one dictionary keyed by string id, a `t()`
 * lookup with `{var}` interpolation, the active language persisted to
 * localStorage (auto-detected from the browser on first run), and a subscribe
 * hook so the DOM can re-render when the language changes.
 *
 * Discovery things/places and bond milestones live in the same table (keyed
 * by domain id) so the whole experience is localised from one place and the
 * completeness test covers everything.
 */

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'wwd.lang';

/** UI strings. Every key MUST exist in both locales (a test enforces this). */
const UI = {
  en: {
    'app.title': 'Walk with Datou',
    'status.trust': 'Trust',
    'console.sit': 'Sit with me',
    'console.roam': 'Let it choose',
    'console.memories': 'Memories',
    'console.foundToday': 'Found today · {n}/{total}',
    'hint.firstSteps': 'Tap the glade to explore together · tap Datou to pet · hold to soothe',
    'want.attention': 'Datou is looking at you…',
    'want.play': 'Datou wants to play!',
    'want.curious': 'Datou noticed something…',
    'memory.discovery': 'Found {thing} {place}',
    'memory.want.attention': 'A quiet moment together',
    'memory.want.play': 'A burst of play',
    'memory.want.curious': 'Followed its curiosity',
    'memory.comfort': 'A long soothing touch',
    'milestone.glance-back': 'Datou glances back to check on you now',
    'milestone.fetch': 'Datou trusts you enough to really play',
    'milestone.lie-at-feet': 'Datou lies down at your spot now',
    'milestone.initiate-explore': 'Datou leads the way sometimes',
    'milestone.signature': 'Datou has little ways of its own now',
    'thing.sprout': 'a tiny sprout',
    'thing.shiny': 'something shiny',
    'thing.feather': 'a soft feather',
    'thing.mushroom': 'a little mushroom',
    'thing.ladybug': 'a ladybug',
    'place.under-tree': 'under the big tree',
    'place.behind-rock': 'behind the boulder',
    'place.by-stump': 'by the old stump',
    'place.under-bush': 'under the bush',
    'place.glade-east': 'at the east edge of the glade',
    'place.glade-north': 'at the north edge',
    'place.by-lamp': 'beside the little lamp',
    'memories.title': 'Memories',
    'memories.empty': 'No memories yet — spend a little time together.',
    'mood.happy': 'happy',
    'mood.calm': 'calm',
    'mood.curious': 'curious',
    'mood.tired': 'tired',
    'settings.language': 'Language',
    'settings.physics': 'Physics engine',
    'settings.running': 'Now running',
    'settings.lite': 'Lite',
    'settings.liteDesc': 'Instant, lightweight motion. Best on older devices.',
    'settings.mujoco': 'MuJoCo physics',
    'settings.mujocoDesc': 'Real simulation engine (~8.5 MB download).',
    'settings.reloadMujoco': 'MuJoCo downloads a ~8.5 MB engine on first load. Reloading…',
    'settings.reloading': 'Reloading…',
  },
  zh: {
    'app.title': '与大头同行',
    'status.trust': '信任',
    'console.sit': '来我身边',
    'console.roam': '让它自己逛',
    'console.memories': '回忆',
    'console.foundToday': '今日发现 · {n}/{total}',
    'hint.firstSteps': '点一点草地，一起去看看 · 点大头摸一摸 · 长按安抚',
    'want.attention': '大头望着你…',
    'want.play': '大头想玩！',
    'want.curious': '大头注意到了什么…',
    'memory.discovery': '在{place}发现了{thing}',
    'memory.want.attention': '安静地陪伴了一会儿',
    'memory.want.play': '痛快地玩了一场',
    'memory.want.curious': '跟着它的好奇心走了一趟',
    'memory.comfort': '一次长长的安抚',
    'milestone.glance-back': '大头现在会回头看你了',
    'milestone.fetch': '大头愿意放开和你玩了',
    'milestone.lie-at-feet': '大头会趴到你身边了',
    'milestone.initiate-explore': '大头有时会主动带路了',
    'milestone.signature': '大头有了自己的小习惯',
    'thing.sprout': '一株小芽',
    'thing.shiny': '一个闪亮的小东西',
    'thing.feather': '一根柔软的羽毛',
    'thing.mushroom': '一朵小蘑菇',
    'thing.ladybug': '一只小瓢虫',
    'place.under-tree': '大树下',
    'place.behind-rock': '大石头后面',
    'place.by-stump': '老树桩旁',
    'place.under-bush': '灌木丛下',
    'place.glade-east': '空地东缘',
    'place.glade-north': '北边草地',
    'place.by-lamp': '小灯旁',
    'memories.title': '回忆',
    'memories.empty': '还没有回忆——先一起待一会儿吧。',
    'mood.happy': '开心',
    'mood.calm': '平静',
    'mood.curious': '好奇',
    'mood.tired': '困了',
    'settings.language': '语言',
    'settings.physics': '物理引擎',
    'settings.running': '当前运行',
    'settings.lite': '轻量',
    'settings.liteDesc': '即时、轻量的运动。适合较旧的设备。',
    'settings.mujoco': 'MuJoCo 物理',
    'settings.mujocoDesc': '真实仿真引擎（约 8.5 MB 下载）。',
    'settings.reloadMujoco': 'MuJoCo 首次加载需下载约 8.5 MB 引擎。正在重新加载…',
    'settings.reloading': '正在重新加载…',
  },
} as const;

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
  if (typeof document !== 'undefined')
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
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

/** Translate a dynamically-built key (e.g. `thing.${art}`), with fallback. */
export function tDyn(key: string, vars?: Record<string, string>): string {
  const table = UI[current] as Record<string, string>;
  const en = UI.en as Record<string, string>;
  let s = table[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  }
  return s;
}

/**
 * Translate every element carrying a `data-i18n="<key>"` attribute. Call once
 * at boot and again on each language change.
 */
export function applyStaticI18n(root: ParentNode = document): void {
  const nodes = root.querySelectorAll<HTMLElement>('[data-i18n]');
  for (const el of nodes) {
    const key = el.dataset.i18n as UIKey | undefined;
    if (!key) continue;
    el.textContent = t(key);
  }
}

// Exposed for tests: the raw tables so completeness can be asserted.
export const __tables = { UI };
