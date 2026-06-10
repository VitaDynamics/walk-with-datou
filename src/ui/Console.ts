/**
 * Console — the companion interface around the diorama.
 *
 * Not a game HUD: a thin, quiet product layer. A status capsule (name, mood,
 * trust) up top; three soft actions at the bottom (sit with me · let it
 * choose · memories); a small thought chip that floats near Datou when it
 * wants something; and memory cards in a side sheet. Plain DOM over the
 * canvas, styled with the baseline tokens in index.html.
 */

import { applyStaticI18n, onLangChange, t, tDyn } from '../i18n';
import type { DatouMood } from '../physics/PhysicsAdapter';
import type { Memories, MemoryEntry } from '../game/Memories';
import type { WantKind } from '../game/Companion';

export type Stance = 'follow' | 'idle';

export interface ConsoleCallbacks {
  onStance(stance: Stance): void;
}

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
  private readonly panel = el<HTMLDivElement>('memories-panel');
  private readonly memoriesList = el<HTMLDivElement>('memories-list');
  private readonly btnSit = el<HTMLButtonElement>('btn-sit');
  private readonly btnRoam = el<HTMLButtonElement>('btn-roam');
  private readonly btnMemories = el<HTMLButtonElement>('btn-memories');

  private readonly memories: Memories;
  private mood: DatouMood = 'calm';
  private toastTimer: number | null = null;
  private hintDismissed = false;

  constructor(memories: Memories, callbacks: ConsoleCallbacks) {
    this.memories = memories;

    this.btnSit.addEventListener('click', () => {
      this.setStance('follow');
      callbacks.onStance('follow');
    });
    this.btnRoam.addEventListener('click', () => {
      this.setStance('idle');
      callbacks.onStance('idle');
    });
    this.btnMemories.addEventListener('click', () => {
      this.panel.hidden = !this.panel.hidden;
      if (!this.panel.hidden) this.renderMemories();
    });
    el<HTMLButtonElement>('memories-close').addEventListener('click', () => {
      this.panel.hidden = true;
    });

    memories.onChange(() => {
      if (!this.panel.hidden) this.renderMemories();
    });
    onLangChange(() => {
      applyStaticI18n();
      this.setMood(this.mood);
      if (!this.panel.hidden) this.renderMemories();
    });

    this.setStance('idle');
  }

  setStance(stance: Stance): void {
    this.btnSit.classList.toggle('active', stance === 'follow');
    this.btnRoam.classList.toggle('active', stance === 'idle');
  }

  setMood(mood: DatouMood): void {
    this.mood = mood;
    this.moodWord.textContent = t(`mood.${mood}`);
  }

  /** Trust as 0..1 — rendered as a thin quiet bar, never a number. */
  setTrust(fraction: number): void {
    this.trustFill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  }

  setFoundToday(n: number, total: number): void {
    this.foundToday.textContent = t('console.foundToday', {
      n: String(n),
      total: String(total),
    });
  }

  /** Float the thought chip near Datou (screen px), or hide it. */
  showWant(kind: WantKind | null, screenX = 0, screenY = 0): void {
    if (!kind) {
      this.wantChip.hidden = true;
      return;
    }
    this.wantChip.hidden = false;
    this.wantChip.textContent = t(`want.${kind}`);
    this.wantChip.style.transform = `translate(${Math.round(screenX)}px, ${Math.round(screenY)}px) translate(-50%, -100%)`;
  }

  /** One quiet line of feedback; fades on its own. */
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

  /** First meaningful interaction: let the onboarding hint go. */
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
    if (entry.kind === 'want') return tDyn(`memory.want.${entry.key}`);
    if (entry.kind === 'comfort') return t('memory.comfort');
    return tDyn(`milestone.${entry.key}`);
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
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      time.textContent = sameDay
        ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      card.append(text, time);
      this.memoriesList.append(card);
    }
  }
}
