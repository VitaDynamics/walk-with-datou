/**
 * The walker's avatar preference (boy / girl) — chosen in ⚙ settings,
 * persisted in localStorage, applied live to the HumanRig (no reload).
 */

import type { AvatarStyle } from '../art/humanParts';

export type { AvatarStyle };

const KEY = 'wwd.avatar';

export function readSavedAvatar(): AvatarStyle {
  try {
    // One-off URL override (?avatar=girl), like ?physics= — handy for QA.
    const q = new URLSearchParams(window.location.search).get('avatar');
    if (q === 'girl' || q === 'boy') return q;
    return localStorage.getItem(KEY) === 'girl' ? 'girl' : 'boy';
  } catch {
    return 'boy';
  }
}

export function saveAvatarPreference(style: AvatarStyle): void {
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // Private mode etc. — the choice just won't survive a reload.
  }
}
