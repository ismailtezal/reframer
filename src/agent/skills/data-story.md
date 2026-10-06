---
name: data-story
description: Load when the video centers on numbers, such as charts, KPIs, rankings, metric or financial updates, survey results, or animating a CSV or JSON dataset.
---

# Data story playbook

The data videos people loved had:
- one insight per chart;
- numbers that count up and land exactly;
- one accent color reserved for the series that matters;
- enough hold time to read.

Rankings, bar races and timelines built on real data travel especially well.

## Rules
- The title states the takeaway ("Signups tripled after launch"), not the axis ("Signups by month").
- Use only the data you were given. If you compute anything, explain how in the clip note. Put a source line on screen (≥28px, 60% opacity).
- Number formatting:
  - thousands separators, K/M/B, %, currency and fixed decimals;
  - counters land exactly on the true value, with no overshoot and no flicker after landing;
  - changing numbers use tabular or mono digits.
- Bars start at zero. Prefer direct labels to legends. ≤7 bars and ≤4 lines, sorted unless the order means something (such as time).
- The context series is neutral grey (#6B6B6B on dark, #A3A3A3 on light); the focus series is the accent. Gridlines ≤15% opacity.

## Components
- counter and money-counter for single numbers;
- bar-chart and line-chart;
- stat-grid for 3–4 KPIs;
- progress-bar for parts of a whole;
- spec-card for annotated numbers;
- map-route for geography;
- arrow-callout and circle-highlight for annotations.

## Timeline (30s)
| Time | Beat | Build |
|---|---|---|
| 0–3s | Hook stat | A counter to the hero number over 1.2–2.0s with smooth easing, so the last digits settle slowly. A 40–48px label below it; one hit when it lands. |
| 3–20s | 2–3 charts, 5–7s each | Each chart: axes/frame in 10–15f, then the data builds, then a hold of ≥2s, then annotate the key point with the accent color, an arrow-callout and a short label. Bars: staggered 3–5f, each growing over 18–24f (snappy, no bounce). Lines: draw left to right over 1.0–1.5s. |
| 20–27s | Summary | A stat-grid, cards staggered 4–6f, counters 30–45f. |
| 27–30s | Conclusion | A one-line takeaway, the source, and an end-card. |

## Patterns
- **Ranking (Top N):** reveal from #N up to #1 at 2–3s each. #1 gets 4–5s and its own treatment (accent, scale 1.1).
- **Bar race:**
  - advance one period every 0.5–1s;
  - re-sort with 12–18f smooth swaps;
  - show the period label as a large counter in a corner.
- **Before/after:** a split-screen with two counters, and the difference as a third, accent-colored number.
- **Money:** a money-counter with currency formatting that never runs past the target.

## Style
- A dark (#0F1115) or light (#F7F7F5) neutral base with one accent.
- Cards with 1px borders at 10% contrast. No 3D pie charts.
- Sizes:
  - labels ≥32px;
  - axis ticks ≥28px;
  - values ≥40px;
  - hero numbers 160–240px.

## Sound
- Music at 90–110 BPM.
- Soft ticks under the hero counter only, and one hit when it lands.
- Land chart builds on beats where possible.

## Banned
- Invented data, or numbers rounded for drama.
- Pie charts with more than 4 slices; 3D charts that distort values.
- Truncated axes without a note; dual axes; rainbow palettes.
- Every element animating at once; numbers that change after landing.
- Unlabeled units; tick labels under 28px; charts on screen for less than 4s.

## Self-check before finishing
- [ ] Every number matches the source exactly (spot-check at least 3).
- [ ] Each chart has a takeaway title and ≥2s of still hold.
- [ ] The focus series is in the accent and the context in grey.
- [ ] A source line is on screen.
- [ ] Ran the self-review skill.
