import type { DatouState } from '../physics/PhysicsAdapter';
import type { CompanionActions } from './Companion';
import type { MovableProps } from './MovableProps';
import type { Inventory } from './Inventory';
import { catalog } from './World';

/**
 * The fetch-and-collect loop (INTERACTION_VERBS.md V6 give/take/fetch). The
 * player clicks an interactable prop → Datou trots over, picks it up (carries it
 * visibly in-mouth), brings it back to the player, and the item drops into
 * Datou's backpack (Inventory). The classic robot-dog "go get it" beat.
 *
 * This is a thin game-layer state machine on top of the existing levers:
 *  - steer Datou with CompanionActions.setMode('explore')/setTarget (no
 *    PhysicsAdapter change — same path investigate() uses);
 *  - MovableProps.carry(id,'datou')/drop for the in-world object;
 *  - Inventory.add when delivered.
 *
 * Deterministic given Datou's state + dt; holds at most one active fetch.
 */

type FetchPhase = 'idle' | 'going' | 'returning';

const PICKUP_DIST = 1.6; // how close Datou must get to grab the prop
const DELIVER_DIST = 2.2; // how close to the player to hand it over

export class DatouFetch {
  private phase: FetchPhase = 'idle';
  private propId: number | null = null;

  constructor(
    private readonly actions: CompanionActions,
    private readonly movables: MovableProps,
    private readonly inventory: Inventory,
  ) {}

  /** True while a fetch is in progress (so other wants don't fight it). */
  get isBusy(): boolean {
    return this.phase !== 'idle';
  }

  /** The prop Datou is currently carrying for a fetch, or null. */
  get carriedPropId(): number | null {
    return this.phase === 'returning' ? this.propId : null;
  }

  /**
   * Begin fetching a prop. Returns false if the prop isn't fetchable (must be an
   * interactable, carryable catalog kind) or a fetch is already running.
   */
  request(propId: number): boolean {
    if (this.isBusy) return false;
    const prop = this.movables.get(propId);
    if (!prop || prop.state === 'carried') return false;
    const kind = catalog.get(prop.kindId);
    if (!kind || !kind.interactable || !kind.verbs.has('carry')) return false;

    this.phase = 'going';
    this.propId = propId;
    this.actions.setMode('explore');
    this.actions.setTarget(prop.x, prop.z);
    return true;
  }

  /**
   * Advance the fetch each frame. `datou` is the live Datou state; `player` is
   * where to deliver. Call after physics.step, before MovableProps.step, so the
   * carry flag is set before the prop's transform is integrated this frame.
   */
  update(datou: DatouState, player: { x: number; z: number }): void {
    if (this.phase === 'idle' || this.propId === null) return;
    const prop = this.movables.get(this.propId);
    if (!prop) {
      this.reset();
      return;
    }

    if (this.phase === 'going') {
      // Keep steering at the prop (it may have rolled), grab when close enough.
      this.actions.setTarget(prop.x, prop.z);
      const d = Math.hypot(datou.position.x - prop.x, datou.position.z - prop.z);
      if (d <= PICKUP_DIST) {
        this.movables.carry(this.propId, 'datou');
        this.phase = 'returning';
        this.actions.setTarget(player.x, player.z);
      }
      return;
    }

    // returning: head back to the player, drop into the backpack on arrival.
    this.actions.setTarget(player.x, player.z);
    const d = Math.hypot(datou.position.x - player.x, datou.position.z - player.z);
    if (d <= DELIVER_DIST) {
      this.inventory.add(prop.kindId);
      // Remove the in-world prop (it's now in the backpack).
      this.movables.remove(this.propId);
      this.reset();
      // Let Datou return to following the player.
      this.actions.setMode('follow');
    }
  }

  private reset(): void {
    this.phase = 'idle';
    this.propId = null;
  }
}
