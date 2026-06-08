import type { Inventory } from '../game/Inventory';

/**
 * Datou's backpack panel — a small cozy popover showing what Datou has fetched
 * (the backpack) and what's been deposited at the home post, with a "deposit
 * all" button. Plain DOM (like Settings.ts / FeatureUI.ts), created here so it
 * needs no index.html markup. Re-renders on inventory change.
 */
export class InventoryUI {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly badge: HTMLSpanElement;
  private readonly body: HTMLDivElement;
  private open = false;

  constructor(private readonly inventory: Inventory) {
    this.button = document.createElement('button');
    this.button.id = 'pack-button';
    this.button.type = 'button';
    this.button.title = "Datou's backpack";
    this.button.innerHTML = '🎒<span id="pack-badge" hidden>0</span>';

    this.badge = this.button.querySelector('#pack-badge') as HTMLSpanElement;

    this.panel = document.createElement('div');
    this.panel.id = 'pack-panel';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="pack-title">Datou's pack</div>
      <div id="pack-body"></div>
      <button id="pack-deposit" type="button">Deposit at home post</button>
    `;
    this.body = this.panel.querySelector('#pack-body') as HTMLDivElement;

    this.injectStyles();
    document.body.appendChild(this.button);
    document.body.appendChild(this.panel);

    this.button.addEventListener('click', () => this.toggle());
    this.panel.querySelector('#pack-deposit')?.addEventListener('click', () => {
      const moved = this.inventory.depositAll();
      if (moved > 0) this.render();
    });

    this.inventory.onChange(() => this.render());
    this.render();
  }

  private toggle(): void {
    this.open = !this.open;
    this.panel.hidden = !this.open;
    if (this.open) this.render();
  }

  private render(): void {
    const pack = this.inventory.backpack();
    const home = this.inventory.home();
    const n = this.inventory.backpackCount;

    this.badge.hidden = n === 0;
    this.badge.textContent = String(n);

    const row = (label: string, items: { name: string; count: number }[]): string => {
      if (items.length === 0) return `<div class="pack-empty">${label}: empty</div>`;
      const lis = items
        .map((i) => `<li>${escapeHtml(i.name)}${i.count > 1 ? ` ×${i.count}` : ''}</li>`)
        .join('');
      return `<div class="pack-section"><div class="pack-label">${label}</div><ul>${lis}</ul></div>`;
    };

    this.body.innerHTML = row('Carrying', pack) + row('At home post', home);
    const deposit = this.panel.querySelector('#pack-deposit') as HTMLButtonElement | null;
    if (deposit) deposit.disabled = pack.length === 0;
  }

  private injectStyles(): void {
    if (document.getElementById('pack-styles')) return;
    const style = document.createElement('style');
    style.id = 'pack-styles';
    style.textContent = `
      #pack-button {
        position: absolute; top: 16px; right: 64px; z-index: 7;
        width: 40px; height: 40px; border: none; border-radius: 50%;
        background: rgba(255,255,255,0.9); box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        font-size: 20px; cursor: pointer; line-height: 40px; padding: 0;
      }
      #pack-badge {
        position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px;
        background: #e8743b; color: #fff; border-radius: 999px; font-size: 11px;
        font-weight: 700; line-height: 16px; padding: 0 4px;
      }
      #pack-panel {
        position: absolute; top: 64px; right: 16px; z-index: 7; width: 220px;
        background: rgba(255,255,255,0.96); border-radius: 14px; padding: 14px 16px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.18); color: #2a3540; font-size: 13px;
      }
      #pack-panel .pack-title { font-weight: 700; margin-bottom: 8px; }
      #pack-panel .pack-section { margin-bottom: 8px; }
      #pack-panel .pack-label { font-weight: 600; opacity: 0.7; font-size: 11px; text-transform: uppercase; }
      #pack-panel ul { margin: 4px 0 0; padding-left: 18px; }
      #pack-panel .pack-empty { opacity: 0.55; font-style: italic; margin-bottom: 6px; }
      #pack-deposit {
        margin-top: 6px; width: 100%; padding: 7px; border: none; border-radius: 8px;
        background: #e8a23b; color: #2a3540; font-weight: 600; cursor: pointer;
      }
      #pack-deposit:disabled { background: #e0d8cc; color: #8a8378; cursor: default; }
    `;
    document.head.appendChild(style);
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}
