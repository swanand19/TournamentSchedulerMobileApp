import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PhotoBadge } from '@/components/Badges';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { pickPicture, pictureUri, type PictureShape } from '@/lib/pictures';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// One picture on a card (HLD P-26): what it looks like now, "Choose" / "Change" and "Remove". The
// photo is picked, cropped and shrunk on the phone (lib/pictures), then sent with `upload`, which
// answers the new link; the server's refusal is shown here, as worded.

type Props = {
  label: string;
  hint?: string;
  shape: PictureShape;
  /** The current picture's link from the answer. */
  link: string | null | undefined;
  /** For the initials shown while there's no photo. */
  name: string;
  /** Sends the picture (base64 JPEG) and answers its new link. */
  upload: (image: string) => Promise<string | null>;
  remove: () => Promise<void>;
  /** After either: reload whatever shows the picture. */
  onChanged: () => void;
};

export default function PictureField({ label, hint, shape, link, name, upload, remove, onChanged }: Props) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const uri = pictureUri(link);

  const choose = async () => {
    const res = await action.run(async () => {
      const image = await pickPicture(shape);
      return image ? await upload(image) : undefined;
    });
    if (res.ok && res.value !== undefined) {
      haptic.success();
      onChanged();
    }
  };

  const clear = async () => {
    const ok = await confirm({
      title: `Remove the ${label.toLowerCase()}?`,
      message: 'It goes for everyone straight away. You can choose another any time.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(remove);
    if (res.ok) onChanged();
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.row}>
        {shape === 'square' && <PhotoBadge link={link} name={name} size={64} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.lead, { color: theme.ink }]}>{label}</Text>
          {!!hint && <Text style={[type.caption, { color: theme.muted }]}>{hint}</Text>}
        </View>
      </View>
      {shape === 'banner' &&
        (uri ? (
          <Image
            source={{ uri }}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={150}
            accessibilityLabel={label}
            style={[styles.banner, { backgroundColor: theme.mode === 'light' ? theme.tint : theme.glassFill }]}
          />
        ) : (
          <View style={[styles.banner, styles.empty, { borderColor: theme.cardDivider }]}>
            <Text style={[type.caption, { color: theme.muted }]}>No banner yet · 16:9</Text>
          </View>
        ))}
      <ErrorBanner message={action.error?.message} />
      <View style={styles.row}>
        <Button
          label={uri ? 'Change' : 'Choose a photo'}
          icon="image-outline"
          variant="secondary"
          busy={action.busy}
          onPress={choose}
          style={{ flex: 1 }}
        />
        {!!uri && <Button label="Remove" variant="ghost" disabled={action.busy} onPress={clear} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  banner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg },
  empty: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
