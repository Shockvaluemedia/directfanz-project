# DirectFanz stage design direction

November 2026. Applies to the fan-facing pages of the repositioned product:
the home page (which opens on the community), drop and presale pages,
membership, listening parties and premieres, and every checkout entry point. Builds on `DESIGN.md` (archetype "creator economy
stage") and does not replace it.

## The brief

"Cutting edge and modern ... captures attention, but shows that we're
enterprise level." Two jobs at once:

- **Attention** comes from the artist, not the interface: huge artist names,
  full-bleed artwork, one live timer, one clear action.
- **Enterprise** comes from restraint and consistency: one type family, one
  accent, stepped dark surfaces, hairline borders, real focus states, honest
  numbers, and the same component doing the same job everywhere.

## What DirectFanz is for

DirectFanz is where an artist's music and film come out first: singles and
projects, and shorts, documentaries, films and other video work. Every page
treats a video release as a first-class release, not an attachment.

- **Positioning line:** "Music and film, released here first." The format strip
  under the hero names the formats: Singles, Projects (music); Shorts,
  Documentaries, Films (video).
- **Releases, not just drops:** the community and membership pages group
  releases by medium. Music sits in a square grid; film and video in a wider
  16:9 grid. A group only appears when it has something in it.
- **Format labels:** every release shows its format, with runtime for video
  ("Short · 13 min"). Today the format is read from the attached files (one
  track is a Single, more are a Project; a video up to 40 minutes is a Short,
  longer is a Film, several videos are a Series). Documentary needs an explicit
  format field, which the video work can add.
- **Video drop page:** a 16:9 player slot replaces the square artwork. It plays a
  public trailer when one exists, and otherwise shows the poster with a plain
  note ("Unlocks when you buy", "Premieres when the drop opens"). The full film
  never streams from the sales page.
- **Premieres:** listening parties are presented as "listening parties and
  premieres", so a film premiere fits the same live room.

## What the research pointed to

| Pattern | Seen at | How we use it |
|---|---|---|
| One release, one timer, one action | Spotify Countdown Pages | The headliner hero shows the headliner's next drop or party, a countdown and one primary button. |
| Name your price with a visible minimum | Bandcamp | Pay-what-you-want drops prefill the minimum, offer three quick amounts and say "Minimum $X". |
| Real timers and real stock only | Shopify, Replo, FTC guidance on fake urgency | Countdowns and "N of M left" come straight from the drop's own times and counts. Nothing resets on reload. Sold out says so plainly and points to what's next. |
| Tiers off the main stage | Patreon's 2025 creator page | Membership is sold in context (on a drop: "Pay $4 instead of $5", "Get in before the public sale") and on its own page, not as a pricing table on the home. |
| Pre-show, live, ended states | Weverse LIVE, Stationhead | The party page has three states, and the room itself stays on `/stream/:id`. |
| Near-black, stepped surfaces, one accent | Linear, Vercel Geist, Apple HIG (dark mode) | Five surface steps, two border steps, one electric accent, one warm highlight. |
| Visible focus, contrast, target size, reduced motion | WCAG 2.2 (2.4.11, 2.4.13, 2.5.8, 1.4.3), MDN | 2px accent focus ring, 4.5:1 minimum for text, 44px targets, sticky bar never covers focus, all motion off under reduced motion. |

## Color

Dark only. The stage is a room with the lights down (Apple HIG: a dark UI lets
media lead).

| Token | Hex | Job |
|---|---|---|
| `stage-ink` | #07070A | Page ground |
| `stage-base` | #0C0C11 | Alternate band |
| `stage-surface` | #13131A | Cards, panels |
| `stage-raised` | #1B1B24 | Artwork fallback, raised panels |
| `stage-line` / `line-strong` | #262631 / #383845 | Hairlines, control borders |
| `stage-text` | #F4F4F6 | Primary text |
| `stage-muted` | #A6A6B3 | Secondary text (8.4:1 on ink) |
| `stage-subtle` | #8A8A97 | Labels, meta (5.4:1 on surface) |
| `stage-pulse` | #A594FF | The one accent: primary buttons, focus ring, links, "on sale" (ink text on it 7.9:1) |
| `stage-ember` | #FFB547 | Time and scarcity only: presale, "going fast", member price |
| `stage-live` | #FF4D6A | Live only |

Electric violet keeps continuity with the existing DirectFanz purple while
avoiding corporate blue. Ember is the warm highlight `DESIGN.md` asks for and
is never decorative: if it is on screen, it means time or scarcity.

## Type

Geist Sans and Geist Mono (self-hosted through the `geist` package, so builds
never fetch fonts from the network).

- **Display:** Geist Sans 800, tracking -0.035em, line height 0.92, sized with
  `clamp()` up to 11rem for the headliner. The artist name is the visual.
- **Body:** Geist Sans 400 to 600, 16 to 18px, 1.6 line height.
- **Labels and figures:** Geist Mono, uppercase, 0.14 to 0.22em tracking for
  eyebrows; tabular figures for prices and countdowns so digits never jump.

## Layout

- 7xl container (80rem), 16/24/32px gutters, 4px spacing grid.
- Radius: 10px for media and cards, 6px for controls (from `DESIGN.md`).
- Community home order: headliner hero (Nahvee) first, then drops, listening
  parties, then the rest of the roster. Nahvee is never a card among cards.
- Drop page: media left (sticky on desktop), decision right: status, format,
  title, price, timer, stock, buy panel, details. Music uses square artwork;
  video uses a wider column with the 16:9 player slot.
- Header: the dark glass header shows on fan pages (home, community, drops,
  parties, membership). Dashboards, settings and sign-in keep the light app
  header.
- Mobile: a sticky buy bar with title, price and one button on buyable drops;
  `scroll-padding-bottom` keeps focused fields clear of it.

## Motion

Energetic but controlled. One entrance (a 12px rise with a stagger in the
hero), hover lifts on artwork, a pulsing dot for live. Easing
`cubic-bezier(0.2, 0.8, 0.2, 1)`. Under `prefers-reduced-motion` all of it
stops; the pages are complete without it.

## Components (`src/components/stage/`)

- `StagePill`: status label; text always carries the meaning, color only
  reinforces it.
- `Countdown`, `LocalTime`: fan's own time zone; one calm screen-reader summary
  instead of a ticking stream.
- `DropCard`, `PartyCard`, `ArtistTile`, `ScarcityMeter`, `Artwork` (initials
  monogram when there is no art), `ReleaseGrid` (music and video groups).
- `MediaBadge` (format and runtime), `MediaStage` (16:9 player slot),
  `FormatStrip` (the formats DirectFanz is built for).
- `DropBuyPanel`, `TicketBuyPanel`, `MembershipJoinButton`: call the existing
  checkout routes only. The server decides every price.
- Views: `CommunityView`, `DropView`, `PartyView`, `MembershipView`, all fed
  plain data so `/design-preview` can render them with sample data.

## Accessibility checklist

- Text contrast 4.5:1 or better everywhere (checked for every token pair used).
- 2px accent focus ring with 3px offset on every interactive element.
- Targets at least 44px tall for buy, amount and back controls.
- Countdown exposes `role="timer"` with a single summary label.
- Stock meter is a labelled `progressbar`.
- The pay-what-you-want field has a label, a hint tied by `aria-describedby`
  and `aria-invalid` when below the minimum.
- Errors from checkout are announced with `role="alert"`.

## Avoid

Everything in `DESIGN.md`'s Avoid list, plus: fake urgency, more than one
accent, gradient washes behind text, pricing-table cards for the membership,
numbering things that aren't a sequence, and lime-on-black "AI default" looks.
