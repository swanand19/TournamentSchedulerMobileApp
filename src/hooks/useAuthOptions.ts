import { useCallback } from 'react';

import { api } from '@/api/client';
import type { AuthOptions } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';

// Whether the server can text codes, so screens show mobile-number fields (sign-in, account,
// players). Asked once per screen, signed in or out; until the answer arrives — or if it can't be
// had — numbers stay hidden, the way the app worked before they existed.

const OFF: AuthOptions = { phone: false, defaultCountryCode: '+91' };

export function useAuthOptions(): AuthOptions {
  const fetcher = useCallback(() => api.call<AuthOptions>('AUTH_OPTIONS'), []);
  return useQuery(fetcher).data ?? OFF;
}

