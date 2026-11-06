import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type View } from 'react-native';

// Keeping the field being typed in above the keyboard, for a screen's own scroll area.
//
// Android, edge-to-edge (the app's only mode): the window no longer shrinks when the keyboard opens,
// so a field in the lower part of a screen sat behind it (People & settings' "Add someone", 2026-10-27).
// While the keyboard is up this gives the screen back the part it covers — as bottom padding on the
// screen's root, so the scroll area ends at the keyboard — and scrolls the focused field into view,
// again whenever focus moves to another field. iOS: the scroll view's own
// automaticallyAdjustKeyboardInsets does this, so the room stays 0 there. Sheets lift themselves
// (components/Sheet).

type Scrollable = {
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

/** Clear space under the field, so its hint or error line and a button under it show too. */
const MARGIN = 96;
/** How often to notice that focus moved to another field while the keyboard stays up. */
const FOCUS_CHECK_MS = 250;

export function useKeyboardRoom<T extends Scrollable = Scrollable>() {
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<T>(null);
  const offset = useRef(0);
  const [room, setRoom] = useState(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    let keyboardTop = Infinity;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let focusTimer: ReturnType<typeof setInterval> | undefined;
    let lastField: unknown = null;

    const reveal = () => {
      const field = TextInput.State.currentlyFocusedInput();
      const root = rootRef.current;
      if (!field || !root || !Number.isFinite(keyboardTop)) return;
      root.measureInWindow((rx, ry, rw, rh) => {
        field.measureInWindow((fx, fy, fw, fh) => {
          // Only the screen the field is on: one behind it in the stack, or a tab page beside it, stays put.
          const cx = fx + fw / 2;
          if (cx < rx || cx > rx + rw || fy < ry || fy > ry + rh) return;
          const below = fy + fh + MARGIN - Math.min(ry + rh, keyboardTop);
          if (below <= 0) return;
          const y = offset.current + below;
          const scroll = scrollRef.current;
          if (scroll?.scrollTo) scroll.scrollTo({ y, animated: true });
          else scroll?.scrollToOffset?.({ offset: y, animated: true });
        });
      });
    };

    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      // The two readings differ by the navigation bar on some phones; the higher top is the safe one.
      keyboardTop = Math.min(e.endCoordinates.screenY, Dimensions.get('window').height - e.endCoordinates.height);
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        setRoom(Math.max(0, Math.round(y + h - keyboardTop)));
        clearTimeout(revealTimer);
        revealTimer = setTimeout(reveal, 80); // once the padding has been laid out
      });
      lastField = TextInput.State.currentlyFocusedInput();
      clearInterval(focusTimer);
      focusTimer = setInterval(() => {
        const field = TextInput.State.currentlyFocusedInput();
        if (field && field !== lastField) reveal();
        lastField = field;
      }, FOCUS_CHECK_MS);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop = Infinity;
      clearInterval(focusTimer);
      setRoom(0);
    });
    return () => {
      show.remove();
      hide.remove();
      clearTimeout(revealTimer);
      clearInterval(focusTimer);
    };
  }, []);

  return { rootRef, scrollRef, room, onScroll };
}
