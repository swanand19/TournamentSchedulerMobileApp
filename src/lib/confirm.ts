import { Alert, Platform } from 'react-native';

// The one way to ask "are you sure?" before anything irreversible. It's drawn by <ConfirmHost />
// in the app's own scoreboard styling, not the platform's white alert, so it reads as part of the
// app. Hosts register themselves; the most recently mounted one answers, which is the tournament
// layout's (in its sport's colours) whenever a tournament is open. With no host mounted it falls
// back to the platform alert, so a call can never hang.

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button, for actions that lose something. */
  destructive?: boolean;
  cancelLabel?: string;
};

export type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

const hosts: ((request: ConfirmRequest) => void)[] = [];

/** Called by a mounted <ConfirmHost />. Returns the unregister function. */
export function registerConfirmHost(show: (request: ConfirmRequest) => void) {
  hosts.push(show);
  return () => {
    const i = hosts.lastIndexOf(show);
    if (i >= 0) hosts.splice(i, 1);
  };
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  const host = hosts[hosts.length - 1];
  if (host) return new Promise((resolve) => host({ ...options, resolve }));
  return platformConfirm(options);
}

function platformConfirm({ title, message, confirmLabel, destructive, cancelLabel = 'Cancel' }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
