// The look of the app, ported from the website's theme.js so both read as one product.
//
// Two differences from the web version, both forced by React Native:
//  - Each font weight is its own family (Inter_600SemiBold), because fontWeight can't pick a
//    weight out of a custom font. Use `type.*` rather than setting fontWeight on text.
//  - There is no CSS gradient, so the striped pitch is drawn by <PitchBackground /> from `stripes`.

import type { TextStyle } from 'react-native';

export const fonts = {
  display: 'Anton_400Regular',
  condensed: 'Teko_600SemiBold',
  condensedMedium: 'Teko_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

// Surfaces are chalk, not cream: the cool off-white of pitch markings and the cricket sight-screen.
// (`cream` keeps its name so every screen that reads it picks the change up.)
const shared = {
  cream: '#F1F3EE',
  ink: '#16201B',
  /** Secondary text on chalk: 5.7:1 (5.1:1 on a chip). */
  muted: '#58625A',
  chip: '#E2E7E0',
  danger: '#e24b4a',
  success: '#639922',
  successInk: '#3b6d11',
  /** Fills behind white labels: 6.2:1 and 5.1:1. */
  successSolid: '#3b6d11',
  dangerSolid: '#c63b3a',
  warnInk: '#8a4b1b',
  tintAlt: '#F3E5CD',
  onDark: '#EDF0EA',
  /** Secondary text on the pitch: 5.6:1. */
  onDarkSoft: 'rgba(237,240,234,0.68)',
  surfaceOnDark: 'rgba(237,240,234,0.06)',
  borderOnDark: 'rgba(237,240,234,0.13)',
  /** The yellow of a booking — distinct from the amber accent, so a card never reads as a button. */
  yellowCard: '#F4C430',
  /** Text on a danger fill. */
  onDanger: '#FFFFFF',
  /** Hairline divider inside a chalk card. */
  cardDivider: '#D5DBD2',
  /** Field background inside a chalk card. */
  field: '#FFFFFF',
  fieldBorder: '#C9D0C6',
  placeholderInk: '#7C857D',
  /** Behind a sheet: dark enough that the pitch recedes, light enough to stay oriented. */
  scrim: 'rgba(8,16,12,0.72)',
};

export type Sport = 'Football' | 'Cricket';

export const footballTheme = {
  ...shared,
  key: 'Football' as Sport,
  label: 'Football',
  accent: '#F2A93B',
  accentInk: '#1B1B1B',
  deep: '#1B4332',
  tint: '#DCEBDF',
  accentSoft: 'rgba(242,169,59,0.15)',
  /** The two alternating mown stripes — close in tone, so they read as texture, not pattern. */
  stripes: ['#19422F', '#173F2D'] as [string, string],
  page: '#173F2D',
  /** The scoreboard "deck" that floats above the pitch, and the fill of a sheet. */
  deck: '#0F291E',
  /** A raised control on the deck. */
  deckRaised: '#1D3A2D',
  placeholder: 'e.g. Summer Cup 2026',
};

export type AppTheme = typeof footballTheme;

export const cricketTheme: AppTheme = {
  ...shared,
  key: 'Cricket',
  label: 'Cricket',
  accent: '#E8B03A',
  accentInk: '#12243B',
  deep: '#12243B',
  tint: '#E1E8F2',
  accentSoft: 'rgba(232,176,58,0.15)',
  stripes: ['#112239', '#0F1F35'] as [string, string],
  page: '#0F1F35',
  deck: '#0A1627',
  deckRaised: '#1A2C45',
  placeholder: 'e.g. Premier League T20',
};

export const SPORTS: AppTheme[] = [footballTheme, cricketTheme];

/** Falls back to football for anything unrecognised, including undefined. */
export function themeFor(sport: string | undefined): AppTheme {
  return sport === 'Cricket' ? cricketTheme : footballTheme;
}

/** Spacing steps. One step per level of grouping; 16 is the standard gutter. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Nested corners are concentric: outer = inner + the padding between them (a 12 pill in a
 *  4-padded track sits in a 16 track). */
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;

/** Referenced rather than inlined so `as const` below doesn't turn it into a readonly tuple. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * The type scale. Two voices, kept apart on purpose:
 *  - The stadium board — Anton and condensed Teko capitals — speaks only for the match itself:
 *    scores, the clock, team names on a fixture, the period ("2ND HALF"), the scoring pads.
 *  - Everything around it — headings, labels, forms, lists — is Inter in sentence case, so the
 *    board is the one loud thing on the screen.
 */
export const type = {
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  lead: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  /** Small field and column labels. */
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  /** Context above a heading, in sentence case. */
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  /** Section and sheet headings. */
  headline: { fontFamily: fonts.bodySemiBold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  /** Scoreboard lettering: the period, the over, "Sudden death". Condensed capitals. */
  board: { fontFamily: fonts.condensed, fontSize: 17, lineHeight: 19, letterSpacing: 2 },
  /** Team names on fixtures and scoreboards. */
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  /** Screen titles. */
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36 },
  /** Button labels. */
  action: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, letterSpacing: 0.3 },
  /** Scoreboard figures. Tabular so a ticking clock or score doesn't jitter sideways. */
  score: { fontFamily: fonts.display, fontSize: 56, lineHeight: 62, fontVariant: TABULAR },
  scoreLarge: { fontFamily: fonts.display, fontSize: 72, lineHeight: 78, fontVariant: TABULAR },
  /** Figures in a table or beside a name. */
  figure: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, fontVariant: TABULAR },
} as const;

/** Card lip: a solid 2px edge instead of a blurred shadow, which washes out in sunlight. */
export const lip = (theme: { deck: string }) => ({ borderBottomWidth: 2, borderBottomColor: theme.deck });
