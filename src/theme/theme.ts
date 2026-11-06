// The look of the app: two themes with the same token names, so a screen reads `theme.accent` and
// gets the right colour in either.
//  - Dark is "N · Liquid Glass" (2026-11-03, the Claude Design canvas): a deep colour wallpaper per
//    sport, clear glass for the floating controls, frosted panels for content, white text.
//  - Light is "B · Sight-screen": white, hairlines, Outfit.
// Each font weight is its own family (Inter_600SemiBold), because fontWeight can't pick a weight out
// of a custom font. Use `type.*` rather than setting fontWeight on text.

import type { TextStyle } from 'react-native';

// Each theme has its own type as well as its own colours: the glass theme speaks in Inter, bold
// for figures and titles, sentence case throughout (it stands in for SF Pro and reads the same on
// iPhone and Android); the light "sight-screen" theme in one airy family, Outfit, with thin
// figures. Screens read both through useTypography() so they follow the person's choice.
const darkFonts = {
  display: 'Inter_700Bold',
  condensed: 'Inter_600SemiBold',
  condensedMedium: 'Inter_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  /** The biggest figures (the score). */
  thin: 'Inter_700Bold',
};

export type Fonts = typeof darkFonts;

/** Outfit tops out at Medium on purpose: the light theme never shouts. */
const lightFonts: Fonts = {
  display: 'Outfit_300Light',
  condensed: 'Outfit_500Medium',
  condensedMedium: 'Outfit_400Regular',
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_400Regular',
  bodySemiBold: 'Outfit_500Medium',
  bodyBold: 'Outfit_500Medium',
  thin: 'Outfit_200ExtraLight',
};

// The glass theme. Content sits on frosted panels (`cream`, `deck`) over the wallpaper, so "ink"
// and "onDark" are both white and every secondary text is the sport's soft lilac or sage. Every
// text colour here passes 4.5:1 on the frosted panels and the wallpaper (measured on the lightest
// spot each one sits on).
const shared = {
  /** A content panel: frosted, so the wallpaper's colour shows through. */
  cream: 'rgba(20,22,52,0.55)',
  ink: '#FFFFFF',
  /** Secondary text, replaced per sport below. */
  muted: '#B0B4CA',
  /** A plain fill inside a panel or on glass: chips, keys, option tiles. */
  chip: 'rgba(255,255,255,0.09)',
  danger: '#E5484D',
  success: '#8FEFB4',
  /** Success words on the dark ground: 11.6:1. */
  successInk: '#8FEFB4',
  /** Fills behind white labels: 5.3:1 and 5.4:1. */
  successSolid: '#25795A',
  dangerSolid: '#C0392B',
  /** Amber words for "incomplete": 10.2:1. */
  warnInk: '#FFC46B',
  tintAlt: 'rgba(255,196,107,0.16)',
  onDark: '#FFFFFF',
  onDarkSoft: '#B0B4CA',
  surfaceOnDark: 'rgba(255,255,255,0.07)',
  borderOnDark: 'rgba(255,255,255,0.14)',
  /** The yellow of a booking. */
  yellowCard: '#FFD84D',
  /** Text on a danger fill. */
  onDanger: '#FFFFFF',
  /** Hairline between rows inside a panel. */
  cardDivider: 'rgba(255,255,255,0.10)',
  /** A text field inside a panel or sheet. */
  field: 'rgba(255,255,255,0.06)',
  fieldBorder: 'rgba(255,255,255,0.14)',
  placeholderInk: '#B0B4CA',
  /** The ground under screens that belong to no sport (sign-in, the base profile, the inbox). */
  night: '#0B1020',
  /** A red card, as drawn on a stat tile (red is reserved for red cards and wickets). */
  redCard: '#E5484D',
  /** Behind a sheet or a menu: the screen recedes but stays readable. */
  scrim: 'rgba(0,0,0,0.45)',
  /** A wicket or red card drawn as a ring rather than a fill: the pale inside, and its text. */
  dangerTint: 'rgba(229,72,77,0.18)',
  dangerInk: '#FFB3B0',
  /** A chosen "success" option drawn as a ring: the pale inside. */
  successTint: 'rgba(143,239,180,0.16)',
  /** Text on the grey pill of an extra (wd, nb). */
  extraInk: '#E2E4EE',
  /** Clear glass for floating controls: fill, edge, the bright top rim, and a chosen segment. */
  glassFill: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.18)',
  glassRim: 'rgba(255,255,255,0.30)',
  glassSelected: 'rgba(255,255,255,0.22)',
  /** Glass where a real blur isn't drawn (Android, Reduce Transparency): a denser fill. */
  glassSolid: 'rgba(40,44,84,0.88)',
  /** A glass sheet's own fill, over the dimmed screen. */
  sheetFill: 'rgba(34,38,86,0.62)',
  /** The light the wallpaper's colour glows through, behind tinted glass. */
  glow: 'rgba(90,110,255,0.45)',
  /** The wallpaper's coloured glows, drawn over `page` (CSS radial gradients). */
  wall: '',
};

export type Sport = 'Football' | 'Cricket';

/** Dark is "N · Liquid Glass" (2026-11-03); light is the "sight-screen" look (2026-10-22). */
export type ThemeMode = 'dark' | 'light';

export const footballTheme = {
  ...shared,
  mode: 'dark' as ThemeMode,
  key: 'Football' as Sport,
  label: 'Football',
  /** Sea-glass teal: 10.4:1 as text on a panel; the tinted primary carries dark ink (12.4:1). */
  accent: '#7FE8DC',
  accentInk: '#08191C',
  /** Accent words and icons (the light theme's darker ink; here the accent itself). */
  deep: '#7FE8DC',
  tint: 'rgba(127,232,220,0.16)',
  accentSoft: 'rgba(127,232,220,0.16)',
  /** The deep teal base the wallpaper's glows sit on. */
  page: '#08191C',
  cream: 'rgba(10,32,36,0.58)',
  muted: '#B0C4C4',
  onDarkSoft: '#B0C4C4',
  placeholderInk: '#B0C4C4',
  /** The scoreboard panel and other weightier groups: a denser frost. */
  deck: 'rgba(8,30,34,0.66)',
  /** A raised control: a plain fill. */
  deckRaised: 'rgba(255,255,255,0.10)',
  glassSolid: 'rgba(18,58,62,0.9)',
  sheetFill: 'rgba(14,52,58,0.66)',
  glow: 'rgba(60,200,180,0.35)',
  /** The tinted primary: a lit pane of the accent, brighter at the top. */
  accentGradient: 'linear-gradient(180deg, #A3F0E7, #6FD9CD)',
  /** A quieter accent edge (the 4 key, a four in "This over"), and the faint fill inside it. */
  ring: 'rgba(127,232,220,0.75)',
  ringFill: 'rgba(127,232,220,0.08)',
  wall:
    'radial-gradient(60% 34% at 8% 6%, rgba(15,110,116,1) 0%, rgba(15,110,116,0) 70%), radial-gradient(50% 32% at 100% 40%, rgba(29,79,140,1) 0%, rgba(29,79,140,0) 70%), radial-gradient(80% 40% at 30% 100%, rgba(27,127,106,1) 0%, rgba(27,127,106,0) 72%)',
  placeholder: 'e.g. Summer Cup 2026',
};

export type AppTheme = typeof footballTheme;

export const cricketTheme: AppTheme = {
  ...shared,
  mode: 'dark',
  key: 'Cricket',
  label: 'Cricket',
  /** Periwinkle: 7.7:1 as text on a panel; the tinted primary carries dark ink (9.2:1). */
  accent: '#9DB0FF',
  accentInk: '#0B0D24',
  deep: '#9DB0FF',
  tint: 'rgba(157,176,255,0.18)',
  accentSoft: 'rgba(157,176,255,0.18)',
  page: '#0B0D24',
  cream: 'rgba(20,22,52,0.55)',
  muted: '#B0B0CA',
  onDarkSoft: '#B0B0CA',
  placeholderInk: '#B0B0CA',
  deck: 'rgba(16,18,46,0.66)',
  deckRaised: 'rgba(255,255,255,0.10)',
  glassSolid: 'rgba(40,44,96,0.9)',
  sheetFill: 'rgba(34,38,86,0.62)',
  glow: 'rgba(90,110,255,0.45)',
  accentGradient: 'linear-gradient(180deg, #B3C2FF, #8AA0FA)',
  ring: 'rgba(157,176,255,0.8)',
  ringFill: 'rgba(157,176,255,0.08)',
  wall:
    'radial-gradient(60% 34% at 10% 6%, rgba(59,63,176,1) 0%, rgba(59,63,176,0) 70%), radial-gradient(50% 30% at 100% 22%, rgba(106,63,168,1) 0%, rgba(106,63,168,0) 70%), radial-gradient(80% 40% at 40% 100%, rgba(28,90,156,1) 0%, rgba(28,90,156,0) 72%)',
  placeholder: 'e.g. Premier League T20',
};

/** The wallpaper under screens that belong to no sport: the blue of cricket meeting football's teal. */
export const neutralWall = {
  page: '#0B1020',
  wall:
    'radial-gradient(60% 34% at 8% 6%, rgba(59,63,176,1) 0%, rgba(59,63,176,0) 70%), radial-gradient(55% 32% at 100% 46%, rgba(15,110,116,1) 0%, rgba(15,110,116,0) 70%), radial-gradient(80% 40% at 30% 100%, rgba(74,58,140,1) 0%, rgba(74,58,140,0) 72%)',
};

/**
 * The glass theme outside any tournament (sign-in, Home's frame, the profile, the inbox): the
 * neutral wallpaper with periwinkle light. It still answers to football's key, as the default
 * sport always has, so nothing that asks "which sport" changes.
 */
export const neutralTheme: AppTheme = {
  ...cricketTheme,
  key: 'Football',
  label: 'Football',
  page: neutralWall.page,
  wall: neutralWall.wall,
  cream: 'rgba(18,22,46,0.56)',
  muted: '#B0B4CA',
  onDarkSoft: '#B0B4CA',
  placeholderInk: '#B0B4CA',
  placeholder: 'e.g. Summer Cup 2026',
};

export const SPORTS: AppTheme[] = [footballTheme, cricketTheme];

// The light theme keeps every token's job and changes what it holds: the "pitch" is plain white,
// the scoreboard deck a soft grey panel, text a soft slate instead of chalk. Each sport keeps one
// colour — leaf green for football, sky blue for cricket — as its accent, filled with white text.
// Every text colour here passes 4.5:1 on white and on the deck grey.
const lightShared: typeof shared = {
  ...shared,
  cream: '#FFFFFF',
  ink: '#232B36',
  /** Secondary text on white: 4.95:1 (4.55:1 on the deck grey). */
  muted: '#687180',
  chip: '#F1F3F6',
  tintAlt: '#FBF0DF',
  onDark: '#232B36',
  onDarkSoft: '#687180',
  surfaceOnDark: '#F6F8FA',
  borderOnDark: '#EDF0F3',
  /** The hairline between rows: the light theme's only divider. */
  cardDivider: '#EDF0F3',
  field: '#FFFFFF',
  fieldBorder: '#D8DEE5',
  placeholderInk: '#7A8391',
  night: '#FFFFFF',
  scrim: 'rgba(35,43,54,0.35)',
  /** #A32F2E on #FDF0EF: 6.6:1. */
  dangerTint: '#FDF0EF',
  dangerInk: '#A32F2E',
  successTint: '#EEF6E6',
  /** On the extra pill (#F1F3F6): 5.6:1. */
  extraInk: '#5A6372',
  // The light theme has no glass; these keep shared components safe if they ever read them.
  glassFill: '#FFFFFF',
  glassBorder: '#D8DEE5',
  glassRim: '#FFFFFF',
  glassSelected: '#F1F3F6',
  glassSolid: '#FFFFFF',
  sheetFill: '#FFFFFF',
  glow: 'rgba(0,0,0,0)',
  wall: '',
};

// No panels: everything sits on the same white, so the "deck" is white too and groups are told
// apart by space and hairlines alone.
const lightGround = {
  ...lightShared,
  mode: 'light' as ThemeMode,
  accentInk: '#FFFFFF',
  page: '#FFFFFF',
  deck: '#FFFFFF',
  deckRaised: '#FFFFFF',
};

export const footballLightTheme: AppTheme = {
  ...footballTheme,
  ...lightGround,
  /** Leaf green: 5.0:1 under white text and as text on white. */
  accent: '#2E7D4F',
  /** Leaf ink, for accent text: 6.3:1 on white, 5.6:1 on the tint. */
  deep: '#276B45',
  tint: '#E8F4EC',
  accentSoft: '#E8F4EC',
  accentGradient: 'linear-gradient(180deg, #2E7D4F, #2E7D4F)',
  ring: '#8CC2A2',
  ringFill: '#F4FAF6',
};

export const cricketLightTheme: AppTheme = {
  ...cricketTheme,
  ...lightGround,
  /** Sky blue: 5.1:1 under white text and as text on white. */
  accent: '#2F6FB5',
  /** Sky ink, for accent text: 6.2:1 on white, 5.6:1 on the tint. */
  deep: '#2A619E',
  tint: '#EAF2FB',
  accentSoft: '#EAF2FB',
  accentGradient: 'linear-gradient(180deg, #2F6FB5, #2F6FB5)',
  ring: '#8FB2DA',
  ringFill: '#F5F9FD',
};

/** Falls back to football for anything unrecognised, including undefined. */
export function themeFor(sport: string | undefined, mode: ThemeMode = 'dark'): AppTheme {
  if (mode === 'light') return sport === 'Cricket' ? cricketLightTheme : footballLightTheme;
  return sport === 'Cricket' ? cricketTheme : footballTheme;
}

/** Spacing steps. One step per level of grouping; 16 is the standard gutter. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Nested corners are concentric: outer = inner + the padding between them (a 12 pill in a
 *  4-padded track sits in a 16 track). */
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999, glass: 24, sheet: 40 } as const;

/** Referenced rather than inlined so `as const` below doesn't turn it into a readonly tuple. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * The glass type scale: one family in sentence case, the iOS scale's sizes (17 body headline, 34
 * large title), bold for titles and figures. The score is the one big thing on a match screen:
 * heavy, tight, tabular so a ticking figure doesn't jitter sideways.
 */
const darkType = {
  caption: { fontFamily: darkFonts.body, fontSize: 13, lineHeight: 17 },
  body: { fontFamily: darkFonts.body, fontSize: 15, lineHeight: 20 },
  bodyStrong: { fontFamily: darkFonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  lead: { fontFamily: darkFonts.bodySemiBold, fontSize: 17, lineHeight: 22 },
  /** Small field and column labels. */
  label: { fontFamily: darkFonts.bodySemiBold, fontSize: 13, lineHeight: 17 },
  /** Context above a heading. */
  eyebrow: { fontFamily: darkFonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  /** Section and sheet headings. */
  headline: { fontFamily: darkFonts.bodyBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  /** Match lettering: the period, the over, "Sudden death". */
  board: { fontFamily: darkFonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  /** Team names on fixtures and scoreboards. */
  heading: { fontFamily: darkFonts.bodyBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  /** Screen titles: the large left-aligned title. */
  title: { fontFamily: darkFonts.bodyBold, fontSize: 32, lineHeight: 39, letterSpacing: -0.6 },
  /** Button labels. */
  action: { fontFamily: darkFonts.bodySemiBold, fontSize: 16, lineHeight: 20 },
  /** Scoreboard figures. */
  score: { fontFamily: darkFonts.display, fontSize: 56, lineHeight: 62, letterSpacing: -1.5, fontVariant: TABULAR },
  scoreLarge: { fontFamily: darkFonts.display, fontSize: 72, lineHeight: 80, letterSpacing: -2, fontVariant: TABULAR },
  /** Figures in a table or beside a name. */
  figure: { fontFamily: darkFonts.display, fontSize: 20, lineHeight: 24, fontVariant: TABULAR },
} satisfies Record<string, TextStyle>;

export type TypeScale = { [K in keyof typeof darkType]: TextStyle };

/**
 * The light type scale ("B · Sight-screen"): one family, a size step up because Outfit runs small,
 * weight instead of capitals for emphasis, and the figures drawn thin and large. No letter-spaced
 * board lettering — the period and the over read as quiet sentence-case text.
 */
const lightType: TypeScale = {
  caption: { fontFamily: lightFonts.body, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: lightFonts.body, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: lightFonts.bodySemiBold, fontSize: 15, lineHeight: 21 },
  lead: { fontFamily: lightFonts.bodySemiBold, fontSize: 17, lineHeight: 23 },
  label: { fontFamily: lightFonts.body, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: lightFonts.body, fontSize: 14, lineHeight: 19 },
  headline: { fontFamily: lightFonts.body, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  board: { fontFamily: lightFonts.body, fontSize: 15, lineHeight: 20 },
  heading: { fontFamily: lightFonts.bodySemiBold, fontSize: 19, lineHeight: 24 },
  title: { fontFamily: lightFonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  action: { fontFamily: lightFonts.bodySemiBold, fontSize: 16, lineHeight: 20 },
  // Proportional figures throughout (see figure): one shape of "1" everywhere.
  score: { fontFamily: lightFonts.thin, fontSize: 60, lineHeight: 66, letterSpacing: -1 },
  scoreLarge: { fontFamily: lightFonts.thin, fontSize: 80, lineHeight: 86, letterSpacing: -2 },
  // Proportional: Outfit's tabular "1" grows a foot. Counts don't tick, so they don't need it.
  figure: { fontFamily: lightFonts.display, fontSize: 22, lineHeight: 26 },
};

/**
 * `figures` is the numeral style for stylesheets that draw numbers: tabular on the dark board (a
 * ticking figure doesn't jitter), proportional in the light theme, where Outfit's tabular "1"
 * grows a foot.
 */
export type Typography = { fonts: Fonts; type: TypeScale; figures: TextStyle['fontVariant'] };

const typographies: Record<ThemeMode, Typography> = {
  dark: { fonts: darkFonts, type: darkType, figures: TABULAR },
  light: { fonts: lightFonts, type: lightType, figures: [] },
};

/** The fonts and type scale of a theme. Screens use useTypography(); this is for the hook. */
export function typographyFor(mode: ThemeMode): Typography {
  return typographies[mode];
}

/** A row that stands on its own. Glass: a frosted pane with the big, concentric corner of the
 *  design. Light: no card — the row is open, flush with the screen's edge, closed by a hairline (so
 *  it goes after the row's own background and padding). */
export const lip = (theme: { mode: ThemeMode; cardDivider: string }) =>
  theme.mode === 'light'
    ? {
        backgroundColor: 'transparent',
        borderRadius: 0,
        paddingHorizontal: 0,
        borderBottomWidth: 1,
        borderBottomColor: theme.cardDivider,
      }
    : { borderRadius: radius.glass, borderCurve: 'continuous' as const };
