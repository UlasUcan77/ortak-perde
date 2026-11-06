import type { SwipeAction } from '@ortak-perde/shared';

export interface Vec {
  x: number;
  y: number;
}

/** Distance (px) a card must travel before releasing it counts as a swipe. */
export const SWIPE_THRESHOLD = 110;
/** A fast flick counts even if the distance is shorter. */
export const FLICK_VELOCITY = 700;
const FLICK_MIN_DISTANCE = 40;

/**
 * Decides what a released drag means. Upwards wins when the vertical movement dominates.
 * Returns null when the card should spring back.
 */
export function getSwipeDecision(
  offset: Vec,
  velocity: Vec = { x: 0, y: 0 },
  threshold = SWIPE_THRESHOLD,
): SwipeAction | null {
  const upward = -offset.y;
  const vertical = upward > Math.abs(offset.x);
  if (
    vertical &&
    (upward >= threshold || (velocity.y <= -FLICK_VELOCITY && upward >= FLICK_MIN_DISTANCE))
  ) {
    return 'super';
  }
  if (!vertical) {
    if (offset.x >= threshold || (velocity.x >= FLICK_VELOCITY && offset.x >= FLICK_MIN_DISTANCE))
      return 'like';
    if (
      offset.x <= -threshold ||
      (velocity.x <= -FLICK_VELOCITY && offset.x <= -FLICK_MIN_DISTANCE)
    )
      return 'nope';
  }
  return null;
}

/** Which stamp to emphasise while dragging (0 → 1 as the threshold is approached). */
export function stampStrength(
  offset: Vec,
  threshold = SWIPE_THRESHOLD,
): Record<SwipeAction, number> {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const upward = -offset.y;
  const vertical = upward > Math.abs(offset.x);
  return {
    like: vertical ? 0 : clamp(offset.x / threshold),
    nope: vertical ? 0 : clamp(-offset.x / threshold),
    super: vertical ? clamp(upward / threshold) : 0,
  };
}

/** Maps keyboard keys to actions (desktop testing / accessibility). */
export function keyToAction(key: string): SwipeAction | 'undo' | null {
  switch (key) {
    case 'ArrowRight':
      return 'like';
    case 'ArrowLeft':
      return 'nope';
    case 'ArrowUp':
      return 'super';
    case 'Backspace':
    case 'z':
    case 'Z':
      return 'undo';
    default:
      return null;
  }
}
