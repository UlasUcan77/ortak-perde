import { describe, expect, it } from 'vitest';
import { getSwipeDecision, keyToAction, stampStrength, SWIPE_THRESHOLD } from './swipe';

describe('swipe threshold', () => {
  it('springs back below the threshold', () => {
    expect(getSwipeDecision({ x: SWIPE_THRESHOLD - 1, y: 0 })).toBeNull();
    expect(getSwipeDecision({ x: -(SWIPE_THRESHOLD - 1), y: 10 })).toBeNull();
    expect(getSwipeDecision({ x: 0, y: -(SWIPE_THRESHOLD - 1) })).toBeNull();
    expect(getSwipeDecision({ x: 0, y: 300 })).toBeNull(); // downwards is not an action
  });

  it('decides like / nope / super past the threshold', () => {
    expect(getSwipeDecision({ x: SWIPE_THRESHOLD, y: 0 })).toBe('like');
    expect(getSwipeDecision({ x: -SWIPE_THRESHOLD, y: 0 })).toBe('nope');
    expect(getSwipeDecision({ x: 20, y: -SWIPE_THRESHOLD })).toBe('super');
  });

  it('uses the dominant axis', () => {
    expect(getSwipeDecision({ x: 150, y: -120 })).toBe('like');
    expect(getSwipeDecision({ x: 100, y: -160 })).toBe('super');
  });

  it('accepts a fast flick with a shorter distance', () => {
    expect(getSwipeDecision({ x: 50, y: 0 }, { x: 900, y: 0 })).toBe('like');
    expect(getSwipeDecision({ x: 20, y: 0 }, { x: 900, y: 0 })).toBeNull();
    expect(getSwipeDecision({ x: 0, y: -60 }, { x: 0, y: -1000 })).toBe('super');
  });

  it('reports stamp strength while dragging', () => {
    expect(stampStrength({ x: SWIPE_THRESHOLD / 2, y: 0 })).toEqual({
      like: 0.5,
      nope: 0,
      super: 0,
    });
    expect(stampStrength({ x: 0, y: -SWIPE_THRESHOLD * 2 }).super).toBe(1);
  });

  it('maps arrow keys', () => {
    expect(keyToAction('ArrowRight')).toBe('like');
    expect(keyToAction('ArrowLeft')).toBe('nope');
    expect(keyToAction('ArrowUp')).toBe('super');
    expect(keyToAction('Backspace')).toBe('undo');
    expect(keyToAction('a')).toBeNull();
  });
});
