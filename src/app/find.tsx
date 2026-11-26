import Screen from '@/components/Screen';
import FindContent from '@/features/find/FindContent';

// Find as a screen of its own: what Home's Find tab shows (features/find/FindContent), for links that open /find.
export default function FindScreen() {
  return (
    <Screen>
      <FindContent leaveOnOpen />
    </Screen>
  );
}
