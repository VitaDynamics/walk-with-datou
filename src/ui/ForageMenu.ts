/**
 * Forage menu — the discoverable "ask Datou to find & pick things" command
 * (BUILDING_SYSTEM §7). Opens from the action bar's Fetch button as a small
 * sheet: a tappable list of materials Datou can gather (ground pickables he
 * forages, bulk node materials he works with the right tool), each sending him
 * off; and a live "Datou is fetching… · Call back" state while he works.
 *
 * Plain DOM over the canvas, baseline tokens (matches the pack/memories
 * sheets). Game owns the actual forage/harvest dispatch.
 */

import { applyStaticI18n, onLangChange, t, tDyn } from '../i18n';
import { itemSprite } from '../game/workshop/sprites';
import type { MaterialId } from '../game/workshop/materials';

export interface ForageOption {
  /** Material id to gather. */
  id: string;
  /** How it's gathered, for the sub-label ("forage" vs "needs the pickaxe"). */
  via: 'forage' | 'node' | 'blocked';
  /** Optional reason when blocked (e.g. needs a tool). */
  note?: string;
}

export interface ForageMenuCallbacks {
  /** The materials Datou could fetch right now (ground + reachable nodes). */
  options(): ForageOption[];
  /** Send Datou to gather a material id. */
  send(id: string): void;
  /** Call Datou off the current job. */
  callBack(): void;
  /** Is Datou currently foraging/harvesting? What material/where. */
  status(): { active: boolean; label: string; fill: number; capacity: number };
}

const STYLE_ID = 'forage-style';

export class ForageMenu {
  private readonly root: HTMLDivElement;
  private readonly cb: ForageMenuCallbacks;
  private open = false;

  constructor(cb: ForageMenuCallbacks) {
    this.cb = cb;
    injectStyles();
    this.root = document.createElement('div');
    this.root.id = 'forage-panel';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Fetch');
    document.body.append(this.root);
    onLangChange(() => {
      if (this.open) this.render();
    });
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  show(): void {
    this.open = true;
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.root.hidden = true;
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Refresh if visible (e.g. Datou finished a haul, or moved into tool range). */
  refresh(): void {
    if (this.open) this.render();
  }

  private render(): void {
    // Preserve scroll position: render() rebuilds the whole panel (and is
    // called on a 0.5s tick while Datou works), so without this the list
    // jumps back to the top every refresh as the user scrolls.
    const prevScroll =
      this.root.querySelector<HTMLDivElement>('.forage-list')?.scrollTop ?? 0;
    this.root.replaceChildren();

    const head = div('panel-head');
    const title = document.createElement('span');
    title.dataset.i18n = 'forage.title';
    title.textContent = t('forage.title');
    const close = document.createElement('button');
    close.id = 'forage-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    this.root.append(head);

    const status = this.cb.status();
    if (status.active) {
      // Live working state: a calm banner + Call back.
      const banner = div('forage-active');
      const line = div('forage-active-line');
      line.textContent = t('forage.working', { thing: status.label });
      const dots = div('forage-bucket');
      for (let i = 0; i < status.capacity; i++) {
        const d = div('forage-dot');
        if (i < status.fill) d.classList.add('on');
        dots.append(d);
      }
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'forage-callback';
      back.textContent = t('forage.callBack');
      back.addEventListener('click', () => {
        this.cb.callBack();
        this.render();
      });
      banner.append(line, dots, back);
      this.root.append(banner);
      return;
    }

    const hint = div('forage-hint');
    hint.dataset.i18n = 'forage.hint';
    hint.textContent = t('forage.hint');
    this.root.append(hint);

    const list = div('forage-list');
    const opts = this.cb.options();
    if (opts.length === 0) {
      const empty = div('forage-empty');
      empty.dataset.i18n = 'forage.none';
      empty.textContent = t('forage.none');
      list.append(empty);
    }
    for (const opt of opts) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'forage-row';
      row.disabled = opt.via === 'blocked';
      const img = document.createElement('img');
      img.src = pickIcon(opt.id);
      img.alt = '';
      const text = div('forage-row-text');
      const name = div('forage-row-name');
      name.textContent = tDyn(`material.${opt.id}`);
      const via = div('forage-row-via');
      via.textContent =
        opt.via === 'node'
          ? t('forage.viaNode')
          : opt.via === 'blocked'
            ? (opt.note ?? t('forage.blocked'))
            : t('forage.viaForage');
      text.append(name, via);
      row.append(img, text);
      if (opt.via !== 'blocked') {
        row.addEventListener('click', () => {
          this.cb.send(opt.id);
          this.render(); // flips to the working banner
        });
      }
      list.append(row);
    }
    this.root.append(list);
    if (prevScroll > 0) list.scrollTop = prevScroll;
    applyStaticI18n(this.root);
  }
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

const iconCache = new Map<string, string>();
function pickIcon(id: string): string {
  let url = iconCache.get(id);
  if (!url) {
    // Reuse the material's bench-chip plate so icons match the Workshop strip.
    url = itemSprite(`bundle:${id as MaterialId}:S:plain`).canvas.toDataURL();
    iconCache.set(id, url);
  }
  return url;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = FORAGE_CSS;
  document.head.append(s);
}

const FORAGE_CSS = `
#forage-panel[hidden]{display:none;}
#forage-panel{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);z-index:9;
  width:min(320px,86vw);max-height:52vh;display:flex;flex-direction:column;
  background:var(--surface);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border-radius:var(--radius-card);box-shadow:var(--shadow-soft);overflow:hidden;
  animation:forage-in var(--normal,280ms) ease-out;}
@keyframes forage-in{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%);}}
#forage-panel .panel-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px;font-size:14px;font-weight:600;}
#forage-close{border:none;background:transparent;font-size:18px;line-height:1;color:var(--text-tertiary);cursor:pointer;padding:4px 8px;}
#forage-close:hover{color:var(--text-primary);}
.forage-hint{padding:0 18px 8px;font-size:11.5px;color:var(--text-tertiary);line-height:1.5;}
.forage-list{overflow-y:auto;padding:4px 12px 14px;display:flex;flex-direction:column;gap:6px;
  scrollbar-width:thin;scrollbar-color:rgba(124,140,122,0.35) transparent;}
.forage-list::-webkit-scrollbar{width:8px;}
.forage-list::-webkit-scrollbar-thumb{background:rgba(124,140,122,0.3);border-radius:999px;border:2px solid transparent;background-clip:padding-box;}
.forage-row{display:flex;align-items:center;gap:10px;border:none;background:var(--surface-strong);
  border-radius:var(--radius-s);padding:8px 10px;cursor:pointer;text-align:left;font-family:inherit;
  transition:background var(--fast,160ms) ease,transform var(--fast,160ms) ease;}
.forage-row:hover:not(:disabled){background:var(--accent-soft);}
.forage-row:active:not(:disabled){transform:scale(0.98);}
.forage-row:disabled{opacity:0.5;cursor:default;}
.forage-row img{width:34px;height:34px;object-fit:contain;flex:none;}
.forage-row-name{font-size:13px;color:var(--text-primary);}
.forage-row-via{font-size:10.5px;color:var(--text-tertiary);}
.forage-empty{padding:18px 8px;font-size:12.5px;color:var(--text-tertiary);text-align:center;line-height:1.6;}
.forage-active{padding:6px 18px 18px;display:flex;flex-direction:column;gap:12px;align-items:center;}
.forage-active-line{font-size:13px;color:var(--text-primary);text-align:center;line-height:1.5;}
.forage-bucket{display:flex;gap:6px;}
.forage-dot{width:10px;height:10px;border-radius:50%;background:rgba(0,0,0,0.08);}
.forage-dot.on{background:var(--accent-warm);}
.forage-callback{border:none;background:var(--accent);color:#fff;font-family:inherit;font-size:13px;font-weight:500;
  padding:8px 22px;border-radius:999px;cursor:pointer;transition:background var(--fast,160ms) ease;}
.forage-callback:hover{background:#6c7c6a;}
`;
