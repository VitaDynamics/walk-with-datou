/**
 * Console — the companion interface around the world.
 *
 * Status capsule (name, mood, trust) top-left; three soft actions at the
 * bottom (leash · backpack · memories); a thought chip near Datou; the
 * backpack sheet (gathered things + a small recipe book) on the left and
 * memory cards on the right. Plain DOM over the canvas, baseline tokens.
 */

import { applyStaticI18n, onLangChange, t, tDyn } from '../i18n';
import type { DatouMood } from '../physics/PhysicsAdapter';
import type { Memories, MemoryEntry } from '../game/Memories';
import type { WantKind } from '../game/Companion';
import type { Backpack, CraftedId, ItemId } from '../game/Backpack';
import { RECIPES, canCraft } from '../game/Crafting';
import {
  drawArchway,
  drawBench,
  drawBerry,
  drawBirdbath,
  drawBundle,
  drawCairn,
  drawCampfire,
  drawFence,
  drawFlower,
  drawGarland,
  drawLamp,
  drawMushroom,
  drawPebble,
  drawPinecone,
  drawShelter,
  drawSoil,
  drawStick,
  drawStonepile,
  drawTwig,
  drawWindchime,
} from '../art/props';

export interface ConsoleCallbacks {
  onLeashToggle(): void;
  onUseItem(id: CraftedId): void;
  onCraft(id: CraftedId): void;
}

const ICON_DRAW: Record<ItemId, (seed: number) => { canvas: HTMLCanvasElement }> = {
  twig: drawTwig,
  pebble: drawPebble,
  berry: drawBerry,
  flower: drawFlower,
  mushroom: drawMushroom,
  pinecone: drawPinecone,
  stick: drawStick,
  cairn: drawCairn,
  garland: drawGarland,
  lantern: drawLamp,
  fence: drawFence,
  plot: drawSoil,
  campfire: drawCampfire,
  shelter: drawShelter,
  bundle: drawBundle,
  stonepile: drawStonepile,
  bench: drawBench,
  birdbath: drawBirdbath,
  windchime: drawWindchime,
  archway: drawArchway,
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing from index.html`);
  return node as T;
}

export class Console {
  private readonly moodWord = el<HTMLSpanElement>('mood-word');
  private readonly trustFill = el<HTMLDivElement>('trust-fill');
  private readonly foundToday = el<HTMLDivElement>('found-today');
  private readonly hint = el<HTMLDivElement>('hint-line');
  private readonly wantChip = el<HTMLDivElement>('want-chip');
  private readonly toastEl = el<HTMLDivElement>('toast');
  private readonly memoriesPanel = el<HTMLDivElement>('memories-panel');
  private readonly memoriesList = el<HTMLDivElement>('memories-list');
  private readonly packPanel = el<HTMLDivElement>('pack-panel');
  private readonly packItems = el<HTMLDivElement>('pack-items');
  private readonly packRecipes = el<HTMLDivElement>('pack-recipes');
  private readonly btnLeash = el<HTMLButtonElement>('btn-leash');

  private readonly memories: Memories;
  private readonly backpack: Backpack;
  private readonly callbacks: ConsoleCallbacks;
  private readonly icons = new Map<ItemId, string>();
  private mood: DatouMood = 'calm';
  private garlandWorn = false;
  private toastTimer: number | null = null;
  private hintDismissed = false;

  constructor(memories: Memories, backpack: Backpack, callbacks: ConsoleCallbacks) {
    this.memories = memories;
    this.backpack = backpack;
    this.callbacks = callbacks;

    this.btnLeash.addEventListener('click', () => callbacks.onLeashToggle());
    el<HTMLButtonElement>('btn-pack').addEventListener('click', () => {
      this.packPanel.hidden = !this.packPanel.hidden;
      if (!this.packPanel.hidden) this.renderPack();
    });
    el<HTMLButtonElement>('btn-memories').addEventListener('click', () => {
      this.memoriesPanel.hidden = !this.memoriesPanel.hidden;
      if (!this.memoriesPanel.hidden) this.renderMemories();
    });
    el<HTMLButtonElement>('memories-close').addEventListener('click', () => {
      this.memoriesPanel.hidden = true;
    });
    el<HTMLButtonElement>('pack-close').addEventListener('click', () => {
      this.packPanel.hidden = true;
    });

    memories.onChange(() => {
      if (!this.memoriesPanel.hidden) this.renderMemories();
    });
    backpack.onChange(() => {
      if (!this.packPanel.hidden) this.renderPack();
    });
    onLangChange(() => {
      applyStaticI18n();
      this.setMood(this.mood);
      if (!this.memoriesPanel.hidden) this.renderMemories();
      if (!this.packPanel.hidden) this.renderPack();
    });
  }

  setLeash(on: boolean): void {
    this.btnLeash.classList.toggle('active', on);
  }

  setGarlandWorn(on: boolean): void {
    this.garlandWorn = on;
    if (!this.packPanel.hidden) this.renderPack();
  }

  setMood(mood: DatouMood): void {
    this.mood = mood;
    this.moodWord.textContent = t(`mood.${mood}`);
  }

  setTrust(fraction: number): void {
    this.trustFill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  }

  setFoundToday(n: number, total: number): void {
    this.foundToday.textContent = t('console.foundToday', { n: String(n), total: String(total) });
  }

  showWant(kind: WantKind | null, screenX = 0, screenY = 0): void {
    if (!kind) {
      this.wantChip.hidden = true;
      return;
    }
    this.wantChip.hidden = false;
    this.wantChip.textContent = t(`want.${kind}`);
    this.wantChip.style.transform = `translate(${Math.round(screenX)}px, ${Math.round(screenY)}px) translate(-50%, -100%)`;
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastEl.style.opacity = '1';
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.style.opacity = '0';
      this.toastTimer = window.setTimeout(() => {
        this.toastEl.hidden = true;
      }, 400);
    }, 3200);
  }

  notifyInteracted(): void {
    if (this.hintDismissed) return;
    this.hintDismissed = true;
    this.hint.style.opacity = '0';
    window.setTimeout(() => {
      this.hint.hidden = true;
    }, 700);
  }

  /** Human line for a memory entry (also used for toasts). */
  memoryText(entry: MemoryEntry): string {
    if (entry.kind === 'discovery') {
      const [art, place] = entry.key.split('@');
      return t('memory.discovery', {
        thing: tDyn(`thing.${art}`),
        place: tDyn(`place.${place}`),
      });
    }
    if (entry.kind === 'want') {
      if (entry.key === 'fetch') return t('memory.fetch');
      if (entry.key === 'harvest') return t('memory.harvest');
      return tDyn(`memory.want.${entry.key}`);
    }
    if (entry.kind === 'comfort') return t('memory.comfort');
    return tDyn(`milestone.${entry.key}`);
  }

  private icon(id: ItemId): string {
    let url = this.icons.get(id);
    if (!url) {
      url = ICON_DRAW[id](7).canvas.toDataURL();
      this.icons.set(id, url);
    }
    return url;
  }

  private renderPack(): void {
    const held = this.backpack.held();
    this.packItems.replaceChildren();
    if (held.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pack-empty';
      empty.textContent = t('pack.empty');
      this.packItems.append(empty);
    }
    for (const id of held) {
      const btn = document.createElement('button');
      btn.className = 'pack-item';
      btn.type = 'button';
      btn.title = tDyn(`thing.${id}`);
      const img = document.createElement('img');
      img.src = this.icon(id);
      img.alt = btn.title;
      const count = document.createElement('span');
      count.className = 'pack-count';
      count.textContent = `×${this.backpack.count(id)}`;
      btn.append(img, count);
      const recipe = RECIPES.find((r) => r.id === id);
      if (recipe) {
        const use = document.createElement('span');
        use.className = 'pack-use';
        use.textContent =
          recipe.use === 'wear'
            ? t(this.garlandWorn ? 'use.unwear' : 'use.wear')
            : t(`use.${recipe.use}`);
        btn.append(use);
        btn.addEventListener('click', () => this.callbacks.onUseItem(recipe.id));
      } else {
        // Raw resources: clicking explains what they're for.
        btn.addEventListener('click', () => this.toast(t('craft.resourceHint')));
      }
      this.packItems.append(btn);
    }

    this.packRecipes.replaceChildren();
    for (const tier of [1, 2, 3] as const) {
      const head = document.createElement('div');
      head.className = 'recipe-tier';
      head.textContent = t(`craft.tier${tier}`);
      this.packRecipes.append(head);
      for (const recipe of RECIPES.filter((r) => r.tier === tier)) {
        const btn = document.createElement('button');
        btn.className = 'pack-recipe';
        btn.type = 'button';
        btn.disabled = !canCraft(recipe, this.backpack);
        const img = document.createElement('img');
        img.src = this.icon(recipe.id);
        img.alt = '';
        const text = document.createElement('span');
        const name = document.createElement('div');
        name.className = 'recipe-name';
        name.textContent = tDyn(`thing.${recipe.id}`);
        const needs = document.createElement('div');
        needs.className = 'recipe-needs';
        needs.textContent = Object.entries(recipe.needs)
          .map(([res, n]) => `${tDyn(`thing.${res}`)} ×${n}`)
          .join(' · ');
        text.append(name, needs);
        btn.append(img, text);
        btn.addEventListener('click', () => this.callbacks.onCraft(recipe.id));
        this.packRecipes.append(btn);
      }
    }
  }

  /** Close the backpack sheet (e.g. when entering placement mode). */
  closePack(): void {
    this.packPanel.hidden = true;
  }

  private renderMemories(): void {
    const entries = this.memories.list();
    this.memoriesList.replaceChildren();
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'memory-empty';
      empty.textContent = t('memories.empty');
      this.memoriesList.append(empty);
      return;
    }
    for (const entry of entries) {
      const card = document.createElement('div');
      card.className = `memory-card kind-${entry.kind}`;
      const text = document.createElement('div');
      text.className = 'memory-text';
      text.textContent = this.memoryText(entry);
      const time = document.createElement('div');
      time.className = 'memory-time';
      const d = new Date(entry.ts);
      const sameDay = d.toDateString() === new Date().toDateString();
      time.textContent = sameDay
        ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      card.append(text, time);
      this.memoriesList.append(card);
    }
  }
}
