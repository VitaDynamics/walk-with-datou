/**
 * The Workshop window (BUILDING_SYSTEM §6) — a full-screen "paper sketchbook"
 * overlay where the player makes things on a 3×3 bench. Three tabs: Bench
 * (W2/W3), Tree (W4), Notebook (W5). Built as plain DOM over the canvas with
 * baseline tokens; styles injected once.
 *
 * Baseline discipline (§10): cream page · ink headers · soft rounded cells (no
 * slot-grid chrome, no rarity colors, no confetti). One focal element — the
 * 3×3 grid. The only "system" feedback is the amber near-miss dot (slow
 * breathing, never a flash) and the calm assembly beat. Emotion-first.
 */

import { applyStaticI18n, onLangChange, t, tDyn } from '../i18n';
import type { Backpack } from '../game/Backpack';
import type { WorkshopState } from '../game/workshop/WorkshopState';
import { Bench, type Outcome } from '../game/workshop/bench';
import { itemSpriteUrl } from '../game/workshop/sprites';
import { parseItemId } from '../game/workshop/items';
import { itemName } from '../game/workshop/items';
import { MATERIAL_IDS, type MaterialId } from '../game/workshop/materials';
import { renderTree } from './workshopTree';
import { renderNotebook } from './workshopNotebook';

export interface WorkshopCallbacks {
  /** Player confirmed a make; consume bench materials & record. Returns the made label (or null if it couldn't). */
  onMake(outcome: Outcome): boolean;
  /** Bench wants to refund materials (e.g. on close/clear). */
  onRefund(materials: MaterialId[]): void;
  /** How many of a material the player holds (drives the strip). */
  count(mat: MaterialId): number;
  /** Take one material for the bench; false if none held. */
  takeOne(mat: MaterialId): boolean;
  /** Pin a material for Datou to forage (right-click / long-press a chip). */
  onPinForage(mat: MaterialId): void;
  /** Does the player hold `n` units of any material in `group`? (Tree recipe.) */
  hasGroup(group: import('../game/workshop/materials').MaterialGroup, n: number): boolean;
  /** Build one of `form` directly from the Tree recipe (consume + record). */
  onBuildForm(form: import('../game/workshop/forms').FormId): void;
}

type Tab = 'bench' | 'tree' | 'notebook';

const STYLE_ID = 'workshop-style';
const DRAG_THRESHOLD = 6;

interface MaterialDrag {
  readonly pointerId: number;
  readonly mat: MaterialId;
  readonly source: HTMLButtonElement;
  readonly ghost: HTMLDivElement;
  readonly startX: number;
  readonly startY: number;
  readonly visited: Set<number>;
  active: boolean;
  hover: HTMLButtonElement | null;
  pressTimer: number | null;
}

export class Workshop {
  private readonly root: HTMLDivElement;
  private readonly bench = new Bench();
  private readonly state: WorkshopState;
  private readonly cb: WorkshopCallbacks;

  private tab: Tab = 'bench';
  private open = false;
  private drag: MaterialDrag | null = null;
  private cells: HTMLButtonElement[] = [];
  private resultCard!: HTMLDivElement;
  private stripEl!: HTMLDivElement;
  private pulseDot!: HTMLDivElement;
  private bodyEl!: HTMLDivElement;
  private tabBtns: Record<Tab, HTMLButtonElement> = {} as never;

  constructor(state: WorkshopState, backpack: Backpack, cb: WorkshopCallbacks) {
    this.state = state;
    this.cb = cb;
    injectStyles();
    this.root = this.build();
    document.body.append(this.root);
    onLangChange(() => {
      if (this.open) this.render();
    });
    // Keep the material strip live as the pack changes (e.g. Datou delivers a
    // forage haul, W6) while the window is open on the bench.
    backpack.onChange(() => {
      if (this.open && this.tab === 'bench' && !this.drag) this.refreshStrip();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.root.hidden = false;
    this.root.classList.add('ws-in');
    this.render();
  }

  hide(): void {
    if (!this.open) return;
    this.finishMaterialDrag();
    this.open = false;
    this.root.hidden = true;
    // Refund anything left on the bench — nothing is ever lost on close.
    const left = this.bench.clear();
    if (left.length) this.cb.onRefund(left);
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  // --- DOM construction ------------------------------------------------------

  private build(): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'workshop';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Workshop');

    const page = div('ws-page');
    const head = div('ws-head');
    const title = div('ws-title');
    title.dataset.i18n = 'workshop.title';
    title.textContent = t('workshop.title');
    const tabs = div('ws-tabs');
    for (const tb of ['bench', 'tree', 'notebook'] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ws-tab';
      b.dataset.i18n = `workshop.tab.${tb}`;
      b.textContent = t(`workshop.tab.${tb}` as never);
      b.addEventListener('click', () => this.switchTab(tb));
      this.tabBtns[tb] = b;
      tabs.append(b);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ws-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.hide());
    head.append(title, tabs, close);

    this.bodyEl = div('ws-body');
    page.append(head, this.bodyEl);
    root.append(page);

    // Esc closes.
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
    return root;
  }

  private switchTab(tab: Tab): void {
    this.tab = tab;
    this.render();
  }

  private render(): void {
    applyStaticI18n(this.root);
    for (const tb of ['bench', 'tree', 'notebook'] as const) {
      this.tabBtns[tb].classList.toggle('active', this.tab === tb);
    }
    this.bodyEl.replaceChildren();
    if (this.tab === 'bench') this.renderBench();
    else if (this.tab === 'tree')
      this.bodyEl.append(
        renderTree(this.state, {
          hasGroup: (group, n) => this.cb.hasGroup(group, n),
          build: (form) => {
            this.cb.onBuildForm(form);
            this.render(); // refresh counts/state after a build
          },
        }),
      );
    else this.bodyEl.append(renderNotebook(this.state));
  }

  // --- Bench tab -------------------------------------------------------------

  private renderBench(): void {
    const wrap = div('ws-bench');

    // The 3×3 grid (the one focal element).
    const gridWrap = div('ws-grid-wrap');
    const grid = div('ws-grid');
    this.cells = [];
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'ws-cell';
      cell.dataset.cell = String(i);
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.removeFromCell(i);
      });
      this.cells.push(cell);
      grid.append(cell);
    }
    this.pulseDot = div('ws-pulse');
    gridWrap.append(grid, this.pulseDot);

    // Result easel (right / below) — the made item as a sketched plate.
    this.resultCard = div('ws-result');

    // Backpack material strip (bottom).
    this.stripEl = div('ws-strip');

    const left = div('ws-bench-left');
    const hint = div('ws-hint');
    hint.dataset.i18n = 'workshop.benchHint';
    hint.textContent = t('workshop.benchHint');
    left.append(gridWrap, hint, this.stripEl);
    wrap.append(left, this.resultCard);
    this.bodyEl.append(wrap);

    this.refreshCells();
    this.refreshStrip();
    this.refreshResult();
  }

  private placeInCell(i: number, mat: MaterialId): boolean {
    if (this.bench.cellMaterial(i) && this.bench.cellMaterial(i) !== mat) return false;
    if (!this.cb.takeOne(mat)) return false;
    if (!this.bench.place(i, mat)) {
      this.cb.onRefund([mat]);
      return false;
    }
    this.afterBenchChange(false);
    return true;
  }

  private removeFromCell(i: number): void {
    const mat = this.bench.removeOne(i);
    if (mat) {
      this.cb.onRefund([mat]);
      this.afterBenchChange();
    }
  }

  private afterBenchChange(refreshStrip = true): void {
    this.refreshCells();
    if (refreshStrip) this.refreshStrip();
    this.refreshResult();
  }

  private refreshCells(): void {
    for (let i = 0; i < 9; i++) {
      const cell = this.cells[i];
      const mat = this.bench.cellMaterial(i);
      const stack = this.bench.cellStack(i);
      cell.replaceChildren();
      cell.classList.toggle('filled', !!mat);
      if (mat) {
        const img = document.createElement('img');
        img.src = matIcon(mat);
        img.alt = '';
        cell.append(img);
        if (stack > 1) {
          const s = div('ws-stack');
          s.textContent = `×${stack}`;
          cell.append(s);
        }
      }
    }
    // Near-miss pulse: a slow amber breath when one edit from an unfound exact.
    const near = this.bench.nearMiss(this.state.foundPatternSet());
    this.pulseDot.classList.toggle('on', near);
  }

  private refreshStrip(): void {
    this.stripEl.replaceChildren();
    const held = MATERIAL_IDS.filter((m) => this.cb.count(m) > 0);
    if (held.length === 0) {
      const empty = div('ws-strip-empty');
      empty.dataset.i18n = 'workshop.noMaterials';
      empty.textContent = t('workshop.noMaterials');
      this.stripEl.append(empty);
      return;
    }
    for (const mat of held) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ws-mat';
      b.title = tDyn(`material.${mat}`);
      const img = document.createElement('img');
      img.src = matIcon(mat);
      img.alt = b.title;
      const n = div('ws-mat-count');
      n.textContent = `×${this.cb.count(mat)}`;
      b.append(img, n);
      // Right-click / long-press a material → send Datou to forage for it (§7).
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.cb.onPinForage(mat);
      });
      b.addEventListener('pointerdown', (e) => this.startMaterialDrag(e, mat, b));
      b.addEventListener('pointermove', (e) => this.moveMaterialDrag(e));
      b.addEventListener('pointerup', (e) => this.endMaterialDrag(e));
      b.addEventListener('pointercancel', (e) => this.endMaterialDrag(e));
      b.title = `${tDyn(`material.${mat}`)} · ${t('workshop.pinForage')}`;
      this.stripEl.append(b);
    }
  }

  private startMaterialDrag(e: PointerEvent, mat: MaterialId, source: HTMLButtonElement): void {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    this.finishMaterialDrag();

    const ghost = div('ws-drag-ghost');
    ghost.hidden = true;
    const img = document.createElement('img');
    img.src = matIcon(mat);
    img.alt = '';
    ghost.append(img);
    this.root.append(ghost);

    this.drag = {
      pointerId: e.pointerId,
      mat,
      source,
      ghost,
      startX: e.clientX,
      startY: e.clientY,
      visited: new Set(),
      active: false,
      hover: null,
      pressTimer: window.setTimeout(() => {
        if (!this.drag || this.drag.pointerId !== e.pointerId || this.drag.active) return;
        this.cb.onPinForage(mat);
        this.finishMaterialDrag();
      }, 550),
    };
    source.setPointerCapture(e.pointerId);
  }

  private moveMaterialDrag(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (!drag.active && distance < DRAG_THRESHOLD) return;
    if (!drag.active) {
      drag.active = true;
      drag.source.classList.add('dragging');
      drag.ghost.hidden = false;
      this.clearPressTimer(drag);
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`;
    this.paintDragAt(e.clientX, e.clientY);
  }

  private endMaterialDrag(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.active && e.type === 'pointerup') this.paintDragAt(e.clientX, e.clientY);
    this.finishMaterialDrag();
  }

  private paintDragAt(x: number, y: number): void {
    const drag = this.drag;
    if (!drag) return;
    const target = document.elementFromPoint(x, y);
    const cell = target?.closest<HTMLButtonElement>('.ws-cell') ?? null;
    if (drag.hover !== cell) {
      drag.hover?.classList.remove('drag-over');
      drag.hover = cell && this.root.contains(cell) ? cell : null;
      drag.hover?.classList.add('drag-over');
    }
    if (!drag.hover) return;
    const i = Number(drag.hover.dataset.cell);
    if (!Number.isInteger(i) || drag.visited.has(i)) return;
    drag.visited.add(i);
    this.placeInCell(i, drag.mat);
  }

  private finishMaterialDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    this.clearPressTimer(drag);
    drag.hover?.classList.remove('drag-over');
    drag.source.classList.remove('dragging');
    if (drag.source.hasPointerCapture(drag.pointerId)) {
      drag.source.releasePointerCapture(drag.pointerId);
    }
    drag.ghost.remove();
    this.drag = null;
    if (this.open && this.tab === 'bench') this.refreshStrip();
  }

  private clearPressTimer(drag: MaterialDrag): void {
    if (drag.pressTimer !== null) window.clearTimeout(drag.pressTimer);
    drag.pressTimer = null;
  }

  private refreshResult(): void {
    this.resultCard.replaceChildren();
    const outcome = this.bench.resolve();
    const head = div('ws-result-head');
    head.dataset.i18n = 'workshop.result';
    head.textContent = t('workshop.result');
    this.resultCard.append(head);

    if (outcome.kind === 'empty') {
      const e = div('ws-result-empty');
      e.dataset.i18n = 'workshop.resultEmpty';
      e.textContent = t('workshop.resultEmpty');
      this.resultCard.append(e);
      return;
    }

    const plate = div('ws-plate');
    if (outcome.kind === 'curio') {
      plate.classList.add('curio');
      plate.textContent = '✦';
    } else {
      const img = document.createElement('img');
      img.src = itemSpriteUrl(outcome.id);
      img.alt = '';
      plate.append(img);
    }
    const label = div('ws-result-label');
    if (outcome.kind === 'curio') label.textContent = t('workshop.curio');
    else {
      const spec = parseItemId(outcome.id);
      label.textContent = spec ? itemName(spec) : '';
    }
    const makeBtn = document.createElement('button');
    makeBtn.type = 'button';
    makeBtn.className = 'ws-make';
    makeBtn.dataset.i18n = 'workshop.make';
    makeBtn.textContent = t('workshop.make');
    makeBtn.addEventListener('click', () => this.confirmMake(outcome));

    this.resultCard.append(plate, label, makeBtn);
  }

  private confirmMake(outcome: Outcome): void {
    if (!this.cb.onMake(outcome)) return;
    // The bench materials were consumed by onMake; clear the local bench WITHOUT
    // refunding (they became the item).
    this.bench.clear();
    this.afterBenchChange();
    // A calm assembly beat: the result card slides/rustles.
    this.resultCard.classList.remove('assembled');
    void this.resultCard.offsetWidth; // reflow to restart the animation
    this.resultCard.classList.add('assembled');
  }
}

// --- helpers -----------------------------------------------------------------

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

const matIconCache = new Map<MaterialId, string>();
function matIcon(mat: MaterialId): string {
  let url = matIconCache.get(mat);
  if (!url) {
    // A material chip: a small plate of the material rendered via its profile,
    // reusing the component family template for a neutral "lump" read.
    url = itemSpriteUrl(`bundle:${mat}:S:plain`);
    matIconCache.set(mat, url);
  }
  return url;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = WORKSHOP_CSS;
  document.head.append(s);
}

const WORKSHOP_CSS = `
#workshop[hidden]{display:none;}
#workshop{position:fixed;inset:0;z-index:12;display:flex;align-items:stretch;justify-content:center;
  background:rgba(245,242,236,0.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
#workshop.ws-in .ws-page{animation:ws-page-in 280ms ease-out;}
@keyframes ws-page-in{from{opacity:0;transform:translateY(10px) scale(0.99);}to{opacity:1;transform:none;}}
.ws-page{width:min(880px,94vw);margin:auto;max-height:92vh;display:flex;flex-direction:column;
  background:var(--surface-strong);border-radius:var(--radius-card);box-shadow:var(--shadow-soft);overflow:hidden;}
.ws-head{display:flex;align-items:center;gap:16px;padding:20px 26px 14px;border-bottom:1px solid rgba(0,0,0,0.06);}
.ws-title{font-size:17px;font-weight:600;letter-spacing:0.01em;}
.ws-tabs{display:flex;gap:4px;margin-left:8px;flex:1;}
.ws-tab{border:none;background:transparent;font-family:inherit;font-size:13.5px;color:var(--text-tertiary);
  padding:6px 14px;border-radius:999px;cursor:pointer;transition:color var(--fast),background var(--fast);}
.ws-tab:hover{color:var(--text-secondary);}
.ws-tab.active{color:var(--text-primary);background:var(--accent-soft);}
.ws-close{border:none;background:transparent;font-size:22px;line-height:1;color:var(--text-tertiary);cursor:pointer;padding:2px 8px;}
.ws-close:hover{color:var(--text-primary);}
.ws-body{flex:1;overflow-y:auto;padding:24px 26px 28px;}

/* Bench tab */
.ws-bench{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;justify-content:center;}
.ws-bench-left{flex:1;min-width:300px;max-width:440px;display:flex;flex-direction:column;align-items:center;gap:16px;}
.ws-grid-wrap{position:relative;}
.ws-grid{display:grid;grid-template-columns:repeat(3,96px);grid-template-rows:repeat(3,96px);gap:12px;
  padding:16px;background:var(--bg);border-radius:var(--radius-m);}
.ws-cell{width:96px;height:96px;border:none;border-radius:var(--radius-s);cursor:pointer;position:relative;
  background:rgba(255,255,255,0.55);box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);transition:transform var(--fast),background var(--fast);}
.ws-cell:hover{background:rgba(255,255,255,0.9);}
.ws-cell.filled{background:var(--surface-strong);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.ws-cell.drag-over{box-shadow:inset 0 0 0 2px var(--accent);background:rgba(255,255,255,0.95);}
.ws-cell:active{transform:scale(0.96);}
.ws-cell img{width:78%;height:78%;object-fit:contain;position:absolute;left:11%;top:11%;}
.ws-stack{position:absolute;right:6px;bottom:5px;font-size:11px;font-weight:600;color:var(--text-secondary);
  background:var(--accent-soft);border-radius:999px;padding:1px 7px;}
.ws-pulse{position:absolute;top:6px;right:6px;width:11px;height:11px;border-radius:50%;background:var(--accent-warm);
  opacity:0;transform:scale(0.6);}
.ws-pulse.on{animation:ws-breathe 2400ms ease-in-out infinite;}
@keyframes ws-breathe{0%,100%{opacity:0.25;transform:scale(0.7);}50%{opacity:0.9;transform:scale(1);}}
.ws-hint{font-size:12px;color:var(--text-tertiary);text-align:center;line-height:1.5;max-width:320px;}
.ws-strip{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:380px;}
.ws-strip-empty{font-size:12px;color:var(--text-tertiary);padding:10px;}
.ws-mat{position:relative;width:56px;height:56px;border:none;border-radius:var(--radius-s);cursor:pointer;padding:6px;
  background:var(--bg);transition:transform var(--fast),box-shadow var(--fast);touch-action:none;}
.ws-mat:hover{transform:translateY(-1px);}
.ws-mat.dragging{opacity:0.55;transform:scale(0.96);cursor:grabbing;}
.ws-mat img{width:100%;height:100%;object-fit:contain;}
.ws-mat-count{position:absolute;right:2px;bottom:1px;font-size:9.5px;font-weight:600;color:var(--text-secondary);}
.ws-drag-ghost{position:fixed;left:0;top:0;z-index:2;width:52px;height:52px;padding:5px;border-radius:var(--radius-s);
  background:var(--surface-strong);box-shadow:var(--shadow-soft);pointer-events:none;will-change:transform;}
.ws-drag-ghost[hidden]{display:none;}
.ws-drag-ghost img{width:100%;height:100%;object-fit:contain;}

/* Result easel */
.ws-result{width:200px;min-height:240px;background:var(--bg);border-radius:var(--radius-m);padding:18px 16px;
  display:flex;flex-direction:column;align-items:center;gap:12px;align-self:flex-start;}
.ws-result.assembled{animation:ws-assemble 460ms cubic-bezier(0.2,0.7,0.2,1);}
@keyframes ws-assemble{0%{transform:translateY(6px) scale(0.96);opacity:0.4;}60%{transform:translateY(-2px) scale(1.02);}100%{transform:none;opacity:1;}}
.ws-result-head{font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-tertiary);}
.ws-result-empty{font-size:12.5px;color:var(--text-tertiary);text-align:center;line-height:1.5;margin-top:24px;}
.ws-plate{width:140px;height:140px;display:flex;align-items:center;justify-content:center;}
.ws-plate img{max-width:100%;max-height:100%;object-fit:contain;}
.ws-plate.curio{font-size:54px;color:var(--accent-warm);}
.ws-result-label{font-size:13.5px;font-weight:500;color:var(--text-primary);text-align:center;}
.ws-make{border:none;background:var(--accent);color:#fff;font-family:inherit;font-size:13.5px;font-weight:500;
  padding:9px 26px;border-radius:999px;cursor:pointer;transition:transform var(--fast),background var(--fast);margin-top:4px;}
.ws-make:hover{background:#6c7c6a;}
.ws-make:active{transform:scale(0.97);}

/* Tree & Notebook (W4/W5) */
.ws-tree,.ws-notebook{display:flex;flex-direction:column;gap:18px;}
.ws-branch{}
.ws-branch-head{font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;display:flex;gap:8px;align-items:baseline;}
.ws-branch-count{font-size:11px;color:var(--text-tertiary);font-weight:400;}
.ws-branch-items{display:flex;flex-wrap:wrap;gap:10px;}
.ws-node{width:64px;text-align:center;}
.ws-node-plate{width:64px;height:64px;border-radius:var(--radius-s);background:var(--bg);display:flex;align-items:center;justify-content:center;}
.ws-node-plate img{width:80%;height:80%;object-fit:contain;}
.ws-node.silhouette .ws-node-plate img{filter:grayscale(1) brightness(0) opacity(0.22);}
.ws-node.silhouette .ws-node-plate{border:1px dashed rgba(0,0,0,0.18);}
.ws-node-name{font-size:10px;color:var(--text-secondary);margin-top:4px;line-height:1.3;}
.ws-node.silhouette .ws-node-name{color:var(--text-tertiary);}
.ws-empty{font-size:13px;color:var(--text-tertiary);text-align:center;padding:30px;line-height:1.6;}
.ws-hint-card{background:var(--bg);border-radius:var(--radius-s);padding:12px 14px;}
.ws-hint-grid{display:grid;grid-template-columns:repeat(3,22px);grid-template-rows:repeat(3,22px);gap:3px;}
.ws-hint-cell{width:22px;height:22px;border-radius:5px;background:rgba(0,0,0,0.05);}
.ws-hint-cell.on{background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent);}
.ws-hint-ctx{font-size:11.5px;color:var(--text-tertiary);margin-top:8px;}
.ws-hint-card{display:flex;flex-direction:column;gap:7px;max-width:240px;}
.ws-hint-title{font-size:13px;font-weight:600;color:var(--text-primary);}
.ws-hint-recipe{font-size:11.5px;color:var(--text-secondary);}

/* Tree node tap + recipe popover */
.ws-node.tappable{cursor:pointer;position:relative;}
.ws-node.tappable:hover .ws-node-plate{box-shadow:0 0 0 2px var(--accent-soft);}
.ws-pop{position:absolute;left:50%;top:72px;transform:translateX(-50%);z-index:3;animation:ws-pop-in 160ms ease-out;}
@keyframes ws-pop-in{from{opacity:0;transform:translateX(-50%) translateY(-4px);}to{opacity:1;transform:translateX(-50%);}}
.ws-recipe{width:188px;background:var(--surface-strong);border-radius:var(--radius-m);box-shadow:var(--shadow-soft);padding:14px;display:flex;flex-direction:column;gap:10px;}
.ws-recipe-head{display:flex;align-items:center;gap:10px;}
.ws-recipe-plate{width:44px;height:44px;background:var(--bg);border-radius:var(--radius-s);display:flex;align-items:center;justify-content:center;flex:none;}
.ws-recipe-plate img{width:80%;height:80%;object-fit:contain;}
.ws-recipe-name{font-size:13.5px;font-weight:600;color:var(--text-primary);}
.ws-recipe-needs{display:flex;flex-direction:column;gap:5px;}
.ws-recipe-need{display:flex;align-items:center;gap:8px;}
.ws-recipe-swatch{width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.12);flex:none;}
.ws-recipe-need-label{font-size:12px;color:var(--text-secondary);}
.ws-recipe-need-label.short{color:var(--danger);}
.ws-recipe-unknown{font-size:11.5px;color:var(--text-tertiary);}
.ws-recipe-build{border:none;background:var(--accent);color:#fff;font-family:inherit;font-size:13px;font-weight:500;padding:8px 0;border-radius:999px;cursor:pointer;transition:background var(--fast);}
.ws-recipe-build:hover:not(:disabled){background:#6c7c6a;}
.ws-recipe-build:disabled{background:var(--surface-muted,#ece7df);color:var(--text-tertiary);cursor:default;}

@media (max-width:680px){
  .ws-grid{grid-template-columns:repeat(3,76px);grid-template-rows:repeat(3,76px);}
  .ws-cell{width:76px;height:76px;}
  .ws-result{width:100%;}
}
`;
