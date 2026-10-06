---
name: article-highlight
description: Load when animating screenshots of articles, headlines, posts, documents, PDFs, reviews or web pages in the documentary highlight style with slow 3D tilt, zooms and marker sweeps.
---

# Article and screenshot highlight

One of the two most-liked entries in Remotion's own prompt gallery works like this:
- a news screenshot padded on white blurs into focus;
- it slowly zooms and turns about 15° in 3D;
- a marker sweeps across two key phrases, behind the text.

The look works for video essays, news recaps, investor updates and social proof.

## Inputs
- A high-resolution screenshot: at least 1600px wide for 1080p output, ideally captured at 2× scale. Never upscale a blurry capture.
- The exact phrases to highlight (at most 2 per document), plus the source and date.
- Word positions: use the image's text-position data (OCR), or ask the user to point at the phrases. The highlight must sit exactly under the words.

## Layout
- Present the document as a card:
  - 6–10% padding;
  - corner radius 8–16px;
  - drop-shadow with radius 40–60, offset y 20–30, opacity 0.25–0.35.
- Background: warm off-white #F4F1EA with paper-texture, or a dark desk #161616 with vignette 0.25. The card fills 60–75% of the frame width.
- Keep the publication and date visible, or add a small label (≥28px).

## Timeline per document (6s)
| Time | Action |
|---|---|
| 0–1.0s | Enter: blur 24px → 0 over 24–30f with smooth easing while scaling 1.04→1.00 (or a rise-blur in-animation). |
| 0–6s | Continuous camera for the whole clip: scale 1.00→1.08; rotate Y from +8° to −8° (about 15° in total) and X from 4° to 2°; ease in and out. |
| 1.2–2.2s | Highlighter-sweep left to right under phrase 1: 18–24f per line, lines staggered 6–8f. |
| 2.4–3.4s | Phrase 2 (optional), same timing. |
| 3.4–4.6s | Optional push toward the highlighted line: scale up to 1.4–1.8, centered on the phrase, over 30–45f, smooth. |
| 4.6–6s | Hold still on the phrase for ≥1.5s so it can be read, then cut. |

## Marker look
- Yellow #FFE45C (or the brand accent):
  - on light paper, 85–100% with multiply blend;
  - on dark, 40–60% opacity.
- Slightly rough edges and ±2px of vertical wobble make it look hand-drawn.
- The marker never covers or recolors the text.

## Variations
- **Montage:** 3–5 sources at 2–3s each, alternating the tilt direction, with hard cuts on beats. Or cascade the cards so they stack with 6–8f staggers.
- **Annotations:** a circle-highlight around a number, an arrow-callout to a margin note, an underline sweep for headlines.
- **Redaction:** solid black bars over private data.
- **Tweets and posts:** a social-post component, real content only.

## Sound
- Subtle foley: a paper slide on enter and a marker squeak on the sweep (≤ −18 dB).
- With a voiceover, the highlight starts as the phrase is spoken (±3f).

## Ethics
- Use only real screenshots, supplied by the user or captured from URLs they give.
- Never generate, edit or reword headlines, quotes or posts.
- Keep the context: never highlight in a way that flips the meaning.

## Banned
- Fabricated or generated screenshots.
- A marker drawn on top of the text.
- Rotation beyond 20°; spins or flips.
- Blurry upscales.
- More than 2 highlights per document.
- Reading the whole article on screen.
- A camera still moving while the phrase needs to be read.

## Self-check before finishing
- [ ] The highlight is aligned to the exact words on its final frame.
- [ ] The source and date are visible.
- [ ] Text is crisp at full zoom (no soft upscale).
- [ ] Each highlighted phrase gets ≥1.5s of still hold.
- [ ] Ran the self-review skill.
