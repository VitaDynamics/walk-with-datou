import type { Feature } from '../game/features';
import { featureText, onLangChange, t } from '../i18n';

/**
 * Plain-DOM overlay for the named-feature interaction (matches the framework-
 * free style of Settings.ts). Two pieces:
 *  - a **hover tooltip** that follows the cursor and shows the hovered feature's
 *    name (so you can tell what an object is just by pointing at it);
 *  - an **info card** opened on click, with the feature's name + description and
 *    a small note that Datou is heading over to investigate.
 *
 * All text is localised through i18n (featureText / t), and the card re-renders
 * if the language changes while it's open.
 *
 * The game drives this: it raycasts the feature hitboxes and calls `showTip` /
 * `hideTip` on hover and `openCard` on click. The DOM markup lives in index.html.
 */
export class FeatureUI {
  private readonly tip = document.getElementById('feature-tip');
  private readonly card = document.getElementById('feature-card');
  private readonly cardTitle = document.getElementById('feature-card-title');
  private readonly cardDesc = document.getElementById('feature-card-desc');
  private readonly cardNote = document.getElementById('feature-card-note');

  /** The currently-open feature (so we can re-render it on a language switch). */
  private openFeatureId: string | null = null;
  /** The note key in play for the open card, re-resolved on language switch. */
  private openNoteKey: 'invite.investigate' | 'invite.onway' | null = null;

  constructor() {
    const close = document.getElementById('feature-card-close');
    close?.addEventListener('click', () => this.closeCard());
    close?.setAttribute('aria-label', t('card.close'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeCard();
    });
    // Re-render the open card in the new language.
    onLangChange(() => {
      close?.setAttribute('aria-label', t('card.close'));
      if (this.openFeatureId) this.renderCard(this.openFeatureId, this.openNoteKey);
    });
  }

  /** Show the hover tooltip with a feature's localised name at pixel (x, y). */
  showTip(featureId: string, x: number, y: number): void {
    this.showText(featureText(featureId).name, x, y);
  }

  /** Show the hover tooltip with arbitrary text at pixel (x, y). Used for
   *  interactable catalog/movable props, which aren't named "features". */
  showText(text: string, x: number, y: number): void {
    if (!this.tip) return;
    this.tip.textContent = text;
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.hidden = false;
  }

  hideTip(): void {
    if (this.tip) this.tip.hidden = true;
  }

  /**
   * Open the info card for a feature. `noteKey` chooses the "Datou is heading
   * over" line (null to hide it).
   */
  openCard(feature: Feature, noteKey: 'invite.investigate' | 'invite.onway' | null): void {
    this.renderCard(feature.id, noteKey);
    if (this.card) this.card.hidden = false;
  }

  private renderCard(
    featureId: string,
    noteKey: 'invite.investigate' | 'invite.onway' | null,
  ): void {
    this.openFeatureId = featureId;
    this.openNoteKey = noteKey;
    const text = featureText(featureId);
    if (this.cardTitle) this.cardTitle.textContent = text.name;
    if (this.cardDesc) this.cardDesc.textContent = text.description;
    if (this.cardNote) {
      this.cardNote.textContent = noteKey ? t(noteKey) : '';
      this.cardNote.hidden = noteKey === null;
    }
  }

  closeCard(): void {
    this.openFeatureId = null;
    this.openNoteKey = null;
    if (this.card) this.card.hidden = true;
  }

  get isCardOpen(): boolean {
    return this.card ? !this.card.hidden : false;
  }
}
