# DirectFanz Design Direction

## Archetype

Creator economy stage.

DirectFanz should feel energetic, intimate, fan-powered, and premium. The product should make creators feel like they are hosting a digital stage and fans feel like they have meaningful access.

## User Feeling

Creators should feel in control of their audience. Fans should feel closer to the creator than they do on generic social platforms.

## Visual Direction

- Media-forward layouts
- Creator profiles
- Membership tiers
- Content previews
- Launch moments
- Strong visual contrast

## Token Direction

- Radius: 10px for media, 6px for controls
- Density: medium-loose
- Typography: bold display plus clean sans
- Palette: dark base, electric accent, warm highlight
- Icons: filled or expressive icons
- Motion: energetic but controlled

## Avoid

- B2B dashboard defaults
- Bland subscription cards
- Corporate blue
- Empty social-network clones
- Generic creator marketplace patterns

## AI Prompt Recipe

```text
Design a creator-to-fan membership platform with media-forward profiles, premium subscription tiers, energetic contrast, and intimate fan access. It should feel like a digital stage and backstage pass, not a corporate SaaS dashboard.
```

## QA Checklist

- Is media treated as a first-class surface?
- Does the UI feel creator-led rather than admin-led?
- Are membership tiers emotionally clear and visually distinct?
- Would the screen still feel like DirectFanz without the logo?

## Shared Guide

The shared arsenal design system lives in `Shockvaluemedia/svm-operator-core/docs/arsenal-design-bible.md`.

## Stage System (fan-facing pages)

The home page, community, drops (music and video), presales, membership,
listening parties and premieres use the
stage tokens and components described in
[`docs/design/stage-design-direction.md`](docs/design/stage-design-direction.md):
Geist type, near-black stepped surfaces, one electric violet accent
(`stage-pulse`), ember only for time and scarcity, red only for live.
Components live in `src/components/stage/`; `/design-preview` renders every
page with sample data (off in production unless `DESIGN_PREVIEW=on`).
