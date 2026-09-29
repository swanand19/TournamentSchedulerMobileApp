// A sideways swipe between hub pages starts with a finger on whatever card is underneath. When the
// swipe ends, that card must not also count it as a tap. The pager stamps the moment a swipe
// begins; a press that went down before that moment is swallowed.
//
// A module value rather than React state: it's read in press handlers, never rendered, and only
// one pager is ever being swiped at a time.

let lastSwipeStart = 0;

export function markSwipeStart() {
  lastSwipeStart = Date.now();
}

/**
 * True when a swipe began after this press went down, i.e. the "tap" was really a swipe. A press
 * with no touch-down (0) — keyboard, TalkBack's double-tap — is never a swipe.
 */
export function swipedSince(pressedAt: number) {
  return pressedAt > 0 && lastSwipeStart > pressedAt;
}
