/**
 * Console — the companion interface around the world.
 *
 * Status capsule (name, mood, trust) top-left; three soft actions at the
 * bottom (leash · backpack · memories); a thought chip near Datou; the
 * backpack sheet on the left and memory cards on the right. Plain DOM over
 * the canvas, baseline tokens.
 */

import { applyStaticI18n, onLangChange, t, tDyn } from '../i18n';
import type { DatouMood } from '../physics/PhysicsAdapter';
import type { Memories, MemoryEntry } from '../game/Memories';
import type { WantKind } from '../game/Companion';
import type { Backpack, ItemId, PackId } from '../game/Backpack';
import type { LandmarkInspection } from '../world/landmarks';
import { verbFor } from '../game/placed';
import { parseItemId, itemName } from '../game/workshop/items';
import { itemSpriteUrl } from '../game/workshop/sprites';
import {
  drawArchway,
  drawBench,
  drawBerry,
  drawBirdbath,
  drawBolt,
  drawBundle,
  drawCairn,
  drawCampfire,
  drawDiscovery,
  drawFence,
  drawFlower,
  drawGarland,
  drawLamp,
  drawMushroom,
  drawPebble,
  drawPinecone,
  drawReed,
  drawShelter,
  drawSoil,
  drawStick,
  drawStonepile,
  drawTwig,
  drawWindchime,
} from '../art/props';
import { drawFood } from '../art/orchard';
import { drawAcorn } from '../art/critters';

export interface ConsoleCallbacks {
  onLeashToggle(): void;
  /** A pack item with a verb was tapped (legacy crafted id OR Workshop ItemId). */
  onUseItem(id: PackId): void;
  /** A raw material was tapped — the pack is a launchpad, not a label. */
  onResourceTap(id: PackId): void;
  /** The placing bar's ✕ — cancel placement (the item stays in the pack). */
  onCancelPlace(): void;
  /** Pickup card actions for the keepsake the Game is currently offering. */
  onPickupTake(): void;
  onPickupMove(): void;
}

const ICON_DRAW: Record<ItemId, (seed: number) => { canvas: HTMLCanvasElement }> = {
  twig: drawTwig,
  pebble: drawPebble,
  berry: drawBerry,
  flower: drawFlower,
  mushroom: drawMushroom,
  pinecone: drawPinecone,
  // The Meadow Orchard (E4).
  apple: (seed) => drawFood('apple', seed),
  pear: (seed) => drawFood('pear', seed),
  plum: (seed) => drawFood('plum', seed),
  pumpkin: (seed) => drawFood('pumpkin', seed),
  turnip: (seed) => drawFood('turnip', seed),
  carrot: (seed) => drawFood('carrot', seed),
  // The squirrel's gift (E5).
  acorn: drawAcorn,
  // Coffer-granted finds (landmark plan §9).
  feather: (seed) => drawDiscovery('feather', seed),
  reed: drawReed,
  'old-bolt': drawBolt,
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
  private readonly sayChip = el<HTMLDivElement>('say-chip');
  private readonly landmarkInfo = el<HTMLDivElement>('landmark-info');
  private readonly landmarkInfoArea = el<HTMLDivElement>('landmark-info-area');
  private readonly landmarkInfoTitle = el<HTMLDivElement>('landmark-info-title');
  private readonly landmarkInfoBody = el<HTMLDivElement>('landmark-info-body');
  private readonly toastEl = el<HTMLDivElement>('toast');
  private readonly nameChip = el<HTMLDivElement>('name-chip');
  private readonly nameChipTitle = el<HTMLDivElement>('name-chip-title');
  private readonly nameChipLine = el<HTMLDivElement>('name-chip-line');
  private readonly memoriesPanel = el<HTMLDivElement>('memories-panel');
  private readonly memoriesList = el<HTMLDivElement>('memories-list');
  private readonly packPanel = el<HTMLDivElement>('pack-panel');
  private readonly packItems = el<HTMLDivElement>('pack-items');
  private readonly btnLeash = el<HTMLButtonElement>('btn-leash');
  private readonly placingBar = el<HTMLDivElement>('placing-bar');
  private readonly placingLabel = el<HTMLSpanElement>('placing-label');
  private readonly pickupCard = el<HTMLDivElement>('pickup-card');
  private readonly pickupTitle = el<HTMLDivElement>('pickup-title');

  private readonly memories: Memories;
  private readonly backpack: Backpack;
  private readonly callbacks: ConsoleCallbacks;
  private readonly icons = new Map<PackId, string>();
  private mood: DatouMood = 'calm';
  private garlandWorn = false;
  private toastTimer: number | null = null;
  private nameTimer: number | null = null;
  private hintDismissed = false;
  private currentLandmarkInfo: LandmarkInspection | null = null;

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
    el<HTMLButtonElement>('placing-cancel').addEventListener('click', () =>
      callbacks.onCancelPlace(),
    );
    el<HTMLButtonElement>('pickup-take').addEventListener('click', () =>
      callbacks.onPickupTake(),
    );
    el<HTMLButtonElement>('pickup-move').addEventListener('click', () =>
      callbacks.onPickupMove(),
    );

    memories.onChange(() => {
      if (!this.memoriesPanel.hidden) this.renderMemories();
    });
    backpack.onChange(() => {
      if (!this.packPanel.hidden) this.renderPack();
    });
    onLangChange(() => {
      applyStaticI18n();
      this.setMood(this.mood);
      this.renderLandmarkInfo();
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

  /** BOBO speaking — one quiet voice line floating near him (§C4). */
  showSay(text: string | null, screenX = 0, screenY = 0): void {
    if (!text) {
      this.sayChip.hidden = true;
      return;
    }
    if (this.sayChip.textContent !== text) this.sayChip.textContent = text;
    this.sayChip.hidden = false;
    this.sayChip.style.transform = `translate(${Math.round(screenX)}px, ${Math.round(screenY)}px) translate(-50%, -100%)`;
  }

  showLandmarkInfo(info: LandmarkInspection): void {
    this.currentLandmarkInfo = info;
    this.renderLandmarkInfo();
  }

  positionLandmarkInfo(screenX: number, screenY: number, visible: boolean): void {
    if (!this.currentLandmarkInfo || !visible) {
      this.landmarkInfo.hidden = true;
      return;
    }
    this.landmarkInfo.hidden = false;
    const pad = 16;
    const halfWidth = Math.min(160, window.innerWidth / 2 - pad);
    const x = Math.min(window.innerWidth - halfWidth - pad, Math.max(halfWidth + pad, screenX));
    const y = Math.min(window.innerHeight - 28, Math.max(130, screenY));
    this.landmarkInfo.style.left = `${Math.round(x)}px`;
    this.landmarkInfo.style.top = `${Math.round(y)}px`;
  }

  hideLandmarkInfo(): void {
    this.currentLandmarkInfo = null;
    this.landmarkInfo.hidden = true;
  }

  /** Persistent placement state: "Placing {thing} — tap the ground · ✕". */
  showPlacing(thing: string): void {
    this.notifyInteracted(); // the placing bar takes the onboarding hint's spot
    this.placingLabel.textContent = t('place.banner', { thing });
    this.placingBar.hidden = false;
  }

  hidePlacing(): void {
    this.placingBar.hidden = true;
  }

  /** Offer to pick up / move the placed keepsake under the player's tap. */
  showPickup(title: string): void {
    this.pickupTitle.textContent = title;
    el<HTMLButtonElement>('pickup-take').textContent = t('pickup.take');
    el<HTMLButtonElement>('pickup-move').textContent = t('pickup.move');
    this.pickupCard.hidden = false;
  }

  positionPickup(screenX: number, screenY: number, visible: boolean): void {
    if (this.pickupCard.hidden) return;
    if (!visible) {
      this.pickupCard.style.visibility = 'hidden';
      return;
    }
    this.pickupCard.style.visibility = '';
    const pad = 16;
    const half = 90;
    const x = Math.min(window.innerWidth - half - pad, Math.max(half + pad, screenX));
    const y = Math.min(window.innerHeight - 28, Math.max(110, screenY));
    this.pickupCard.style.left = `${Math.round(x)}px`;
    this.pickupCard.style.top = `${Math.round(y)}px`;
  }

  hidePickup(): void {
    this.pickupCard.hidden = true;
  }

  private renderLandmarkInfo(): void {
    const info = this.currentLandmarkInfo;
    if (!info) return;
    this.landmarkInfoArea.textContent = tDyn(`landmark.${info.area}.arrive`);
    this.landmarkInfoTitle.textContent = tDyn(`landmark.inspect.${info.key}.name`);
    this.landmarkInfoBody.textContent = tDyn(`landmark.inspect.${info.key}.desc`);
  }

  /** Name what was touched (E1): one quiet two-line pill, one at a time. */
  showName(title: string, line: string): void {
    this.nameChipTitle.textContent = title;
    this.nameChipLine.textContent = line;
    this.nameChipLine.hidden = line === '';
    this.nameChip.hidden = false;
    this.nameChip.style.opacity = '1';
    if (this.nameTimer !== null) window.clearTimeout(this.nameTimer);
    this.nameTimer = window.setTimeout(() => {
      this.nameChip.style.opacity = '0';
      this.nameTimer = window.setTimeout(() => {
        this.nameChip.hidden = true;
      }, 400);
    }, 2600);
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
      if (entry.key === 'forage') return t('memory.forage');
      if (entry.key === 'coffer') return t('memory.coffer');
      if (entry.key.startsWith('landmark.')) return tDyn(`memory.${entry.key}`);
      if (entry.key.startsWith('setpiece.')) return tDyn(`memory.${entry.key}`);
      if (entry.key.startsWith('made:')) {
        const spec = parseItemId(entry.key.slice(5));
        return t('workshop.made', { thing: spec ? itemName(spec) : '' });
      }
      return tDyn(`memory.want.${entry.key}`);
    }
    if (entry.kind === 'comfort') return t('memory.comfort');
    return tDyn(`milestone.${entry.key}`);
  }

  private icon(id: PackId): string {
    let url = this.icons.get(id);
    if (!url) {
      const draw = (ICON_DRAW as Partial<Record<string, (typeof ICON_DRAW)[ItemId]>>)[id];
      url = draw ? draw(7).canvas.toDataURL() : itemSpriteUrl(id);
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
      const spec = parseItemId(id);
      // Unknown id from a stale save — skip rather than crash the pack.
      if (!spec && !(id in ICON_DRAW)) continue;
      const btn = document.createElement('button');
      btn.className = 'pack-item';
      btn.type = 'button';
      btn.title = spec ? itemName(spec) : tDyn(`thing.${id}`);
      const img = document.createElement('img');
      img.src = this.icon(id);
      img.alt = btn.title;
      const count = document.createElement('span');
      count.className = 'pack-count';
      count.textContent = `×${this.backpack.count(id)}`;
      btn.append(img, count);
      const verb = verbFor(id);
      if (verb) {
        const use = document.createElement('span');
        use.className = 'pack-use';
        use.textContent =
          verb === 'wear' ? t(this.garlandWorn ? 'use.unwear' : 'use.wear') : t(`use.${verb}`);
        btn.append(use);
        btn.addEventListener('click', () => this.callbacks.onUseItem(id));
      } else {
        // Raw materials launch the bench (with the explainer as a toast subtitle).
        btn.addEventListener('click', () => this.callbacks.onResourceTap(id));
      }
      this.packItems.append(btn);
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
