/**
 * character — who Datou IS (docs/CHARACTER_REFACTOR_PLAN.md §1, BINDING canon
 * from docs/基于角色个性特征的机器狗行为模式探索.pdf).
 *
 * 大头 BOBO: a one-earth-year-old ENFP robot-dog inventor from 2049 who fell
 * through a time machine. His seven traits are FIXED — what changes over a
 * relationship is how much of himself he shows. This module is the single
 * source for that scaling: familiarity stage from bond, the expressiveness
 * amplitude (refactor plan R1 — strangers get the calm baseline robot, the
 * wild side is earned), gaze urgency (turn speed encodes familiarity), and
 * which signature moves each stage permits.
 *
 * Pure constants and functions. No state, no rendering, no RNG.
 */

/** The seven canon traits (性格提取) — never mutated, never extended ad hoc. */
export type TraitId =
  | 'curious' // 好奇
  | 'lively' // 活泼
  | 'helpful' // 乐于助人
  | 'brave' // 勇敢
  | 'humorous' // 幽默
  | 'mischievous' // 调皮
  | 'chatty'; // 话痨

export const TRAITS: readonly TraitId[] = [
  'curious',
  'lively',
  'helpful',
  'brave',
  'humorous',
  'mischievous',
  'chatty',
];

/**
 * Relationship stages, derived from the existing Bond integer so no save
 * migration is needed. The bible's own arc: strangers get the polite,
 * proactive BOBO; only close friends see 发癫.
 */
export type FamiliarityStage = 'stranger' | 'friend' | 'closeFriend' | 'bestFriend';

export function familiarityStage(bond: number): FamiliarityStage {
  if (bond >= 90) return 'bestFriend';
  if (bond >= 50) return 'closeFriend';
  if (bond >= 15) return 'friend';
  return 'stranger';
}

/**
 * The expressiveness scalar (R1/R2): multiplies signature-move size, idle
 * micro-motion, and chatter frequency. Stranger-tier BOBO must sit entirely
 * inside the design baseline's calm envelope.
 */
const AMPLITUDE: Record<FamiliarityStage, number> = {
  stranger: 0.35,
  friend: 0.6,
  closeFriend: 0.85,
  bestFriend: 1,
};

export function amplitude(stage: FamiliarityStage): number {
  return AMPLITUDE[stage];
}

/**
 * Gaze urgency (bible: head-turn SPEED encodes familiarity — uniform, lazy
 * tracking for strangers; quick response for people he knows).
 */
const GAZE_URGENCY: Record<FamiliarityStage, number> = {
  stranger: 0.25,
  friend: 0.55,
  closeFriend: 0.8,
  bestFriend: 1,
};

export function gazeUrgency(stage: FamiliarityStage): number {
  return GAZE_URGENCY[stage];
}

/**
 * Signature motion clips the rig can perform (refactor plan §4.4 item 5).
 * Kept here (not in the rig) because *permission* is a character question:
 * big moves are earned (R1).
 */
export type SignatureClip =
  | 'spin' // praised → 原地转圈
  | 'backTurn' // miffed → turns his back
  | 'shiver' // afraid / cold
  | 'stretch' // biological idle 伸懒腰
  | 'stomp' // his unconscious tic 跺脚
  | 'shyTurn'; // over-praised → half turn away

const CLIP_STAGE: Record<SignatureClip, FamiliarityStage> = {
  // Functional / biological reads are fine from day one.
  shiver: 'stranger',
  stretch: 'stranger',
  stomp: 'stranger',
  // Personality bursts are earned.
  spin: 'friend',
  backTurn: 'friend',
  shyTurn: 'closeFriend',
};

const STAGE_ORDER: Record<FamiliarityStage, number> = {
  stranger: 0,
  friend: 1,
  closeFriend: 2,
  bestFriend: 3,
};

export function clipAllowed(clip: SignatureClip, stage: FamiliarityStage): boolean {
  return STAGE_ORDER[stage] >= STAGE_ORDER[CLIP_STAGE[clip]];
}
