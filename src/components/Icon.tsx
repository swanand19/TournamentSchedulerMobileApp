import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

// One icon set for the whole app (Material Community: it has the whistle, cards, stumps and ball).
// Icons are decoration next to a label, so they are hidden from screen readers by default.

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = { name: IconName; size?: number; color: string; label?: string };

export default function Icon({ name, size = 20, color, label }: Props) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
