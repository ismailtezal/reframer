import type { AudioClip, Clip, Project } from "@/core/schema";

/**
 * What a listener would notice about the soundtrack, read straight from the timeline (no audio
 * render needed): silence, music that drops out or gets cut off mid-phrase, cuts that miss the
 * beat, and sound effects that are missing or crowded. Feeds critique_video, whose critic can only
 * see frames.
 */

const ON_BEAT_SEC = 0.09; // under 3 frames at 30 fps

const clock = (sec: number) => {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

type Range = [number, number];

const union = (ranges: Range[]) => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 0.05) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
};

export const measureSound = (project: Project, durationSec: number): string[] => {
  const fps = project.settings.fps;
  const { width: W, height: H } = project.settings;
  const tracks = new Map(project.tracks.map((t) => [t.id, t]));
  const clips = Object.values(project.clips).filter((c) => !c.hidden && !tracks.get(c.trackId)?.hidden);
  const audible = (c: AudioClip) => !c.muted && c.volume > 0 && !tracks.get(c.trackId)?.muted;
  const audio = clips.filter((c): c is AudioClip => c.type === "audio" && audible(c));
  const beatsOf = (c: AudioClip) => project.assets[c.assetId]?.analysis?.beats ?? [];
  const music = audio.filter((c) => c.role === "music" || (!c.role && beatsOf(c).length > 0));
  const voice = audio.filter((c) => c.role === "voice");
  const sfx = audio.filter((c) => c.role === "sfx");
  const span = (c: Clip): Range => [c.start / fps, (c.start + c.duration) / fps];
  const findings: string[] = [];

  if (!music.length && !voice.length) {
    findings.push(
      sfx.length
        ? `No music: the soundtrack is ${sfx.length} sound effect${sfx.length > 1 ? "s" : ""} over silence. Add a music bed that fits the style (search_audio) and cut to its beats.`
        : "Silent: no music or voice on the timeline. Add a music bed that fits the style (search_audio) and cut to its beats.",
    );
    return findings;
  }

  // When sound starts, and where the music drops out.
  const sound = union([...music, ...voice].map(span));
  if (sound[0] && sound[0][0] > 0.5)
    findings.push(`Silent for the first ${sound[0][0].toFixed(1)} s: start the music (or the voice) on frame 0.`);
  if (music.length) {
    const bed = union(music.map(span));
    for (let i = 1; i < bed.length; i++) {
      const gap = bed[i][0] - bed[i - 1][1];
      if (gap > 0.6)
        findings.push(
          `The music drops out from ${clock(bed[i - 1][1])} to ${clock(bed[i][0])}: a gap reads as a fault unless it's an exact, deliberate stop (sound-design). Keep the music continuous and dip its volume instead.`,
        );
    }
    const end = bed[bed.length - 1][1];
    if (end < durationSec - 0.5)
      findings.push(`The music stops at ${clock(end)}, ${(durationSec - end).toFixed(1)} s before the video ends.`);
    // Cut off mid-track: the last music clip ends before its file does, with no fade.
    const last = [...music].sort((a, b) => a.start + a.duration - (b.start + b.duration)).pop();
    const asset = last ? project.assets[last.assetId] : undefined;
    if (last && asset?.durationSec) {
      const usedUntil = (last.trimStart + last.duration * last.speed) / fps;
      if (usedUntil < asset.durationSec - 1 && (last.fadeOut ?? 0) < fps * 0.5) {
        findings.push(
          `The music is cut off mid-track at ${clock((last.start + last.duration) / fps)} with no fade: end on the track's own ending or a downbeat, or fade out over at least 1 s.`,
        );
      }
    }
    // Splices: music clips that follow each other (within 3 s) where the track jumps or changes.
    const bars = (assetId: string) => project.assets[assetId]?.analysis?.downbeats ?? [];
    const onBar = (assetId: string, sourceFrame: number) => {
      const downbeats = bars(assetId);
      return downbeats.length ? downbeats.some((d) => Math.abs(d - sourceFrame / fps) < 0.1) : null;
    };
    const joins = [...music].sort((a, b) => a.start - b.start);
    for (let i = 1; i < joins.length; i++) {
      const a = joins[i - 1];
      const b = joins[i];
      const aEnd = a.start + a.duration;
      const gap = b.start - aEnd;
      if (gap > fps * 3) continue;
      // Where A's track would be when B starts had it kept playing (muted through a gap, not paused).
      const inTime = a.trimStart + (b.start - a.start) * a.speed;
      const sameTrack = a.assetId === b.assetId;
      if (sameTrack && Math.abs(b.trimStart - inTime) < fps * 0.1) continue;
      // Where A is left in its own track.
      const leaveAt = a.trimStart + (Math.min(aEnd, b.start) - a.start) * a.speed;
      const offBar = onBar(a.assetId, leaveAt) === false || onBar(b.assetId, b.trimStart) === false;
      if (gap > fps * 0.5) {
        // A pause, then music again: fine when a new track starts on its downbeat, never as a jump within one track.
        if (!sameTrack && !offBar) continue;
        findings.push(
          sameTrack
            ? `The music stops at ${clock(aEnd / fps)} and comes back ${(gap / fps).toFixed(1)} s later from another part of the track (${clock(leaveAt / fps)} → ${clock(b.trimStart / fps)}): listeners hear a fault. Keep the music continuous and dip its volume under the key line, or bring the track back in time on a downbeat (muted, not paused).`
            : `The music stops at ${clock(aEnd / fps)} and a different track starts ${(gap / fps).toFixed(1)} s later, off the downbeat: end on a downbeat and start the new track on one.`,
        );
        continue;
      }
      const overlap = aEnd - b.start;
      const crossfaded = overlap >= 4 && (a.fadeOut ?? 0) >= 4 && (b.fadeIn ?? 0) >= 4;
      if (crossfaded && !offBar) continue;
      const where = sameTrack
        ? ` (the track jumps from ${clock(leaveAt / fps)} to ${clock(b.trimStart / fps)})`
        : " (into a different track)";
      const how = [!crossfaded ? "a hard cut" : "", offBar ? "off the downbeat" : ""].filter(Boolean).join(", ");
      findings.push(
        `The music is spliced at ${clock(b.start / fps)}${where}, ${how}: listeners hear that. Start later in the track so its own ending lands on the end card, or cut both sides on downbeats and overlap them 6–10 frames with a fade-out and a fade-in.`,
      );
    }
    // A heavy low end under speech fights the voice for the same space.
    const heavy = music.find((m) => (project.assets[m.assetId]?.analysis?.profile?.bass ?? 0) > 0.4);
    if (heavy && voice.length)
      findings.push(
        `The music under the voice is bass-heavy (${Math.round((project.assets[heavy.assetId]?.analysis?.profile?.bass ?? 0) * 100)}% of its energy in the lows): it muddies the narration. Pick a track with a light low end (detect_beats shows the profile).`,
      );
  } else if (voice.length) {
    findings.push("No music under the voice: most explainers carry a quiet bed that ducks under speech.");
  }

  // Cuts against the beat: shot changes are starts of clips that fill most of the frame.
  const beats: number[] = [];
  for (const m of music) {
    const [s, e] = span(m);
    for (const b of beatsOf(m)) {
      const t = s + (b - m.trimStart / fps) / m.speed;
      if (t >= s && t <= e) beats.push(t);
    }
  }
  const fullFrame = (c: Clip) =>
    (c.type === "video" || c.type === "image" || c.type === "component" || c.type === "background") &&
    c.transform.width * c.transform.scale >= W * 0.8 &&
    c.transform.height * c.transform.scale >= H * 0.8;
  const cuts = [...new Set(clips.filter(fullFrame).map((c) => Math.round(c.start)))]
    .filter((f) => f > 0)
    .sort((a, b) => a - b)
    .map((f) => f / fps);
  if (music.length && !beats.length) {
    findings.push("The music hasn't been analyzed, so cuts can't follow it: run detect_beats on the track and cut on its beats.");
  } else if (beats.length && cuts.length >= 3 && !voice.length) {
    // (With a voiceover, the voice sets the pace; music-led pieces cut on the beat.)
    beats.sort((a, b) => a - b);
    const off = cuts
      .map((t) => {
        const nearest = beats.reduce((best, b) => (Math.abs(b - t) < Math.abs(best - t) ? b : best), beats[0]);
        return { t, nearest, miss: Math.abs(nearest - t) };
      })
      .filter((c) => c.miss > ON_BEAT_SEC);
    const onBeat = cuts.length - off.length;
    if (onBeat / cuts.length < 0.7) {
      const worst = off
        .sort((a, b) => b.miss - a.miss)
        .slice(0, 4)
        .map((c) => `${clock(c.t)} (${Math.round(c.miss * fps)} frames ${c.t > c.nearest ? "late" : "early"})`)
        .join(", ");
      findings.push(
        `Only ${onBeat} of ${cuts.length} cuts land on a beat; off the beat: ${worst}. Move cuts onto beats (downbeats for big moments).`,
      );
    }
  }

  // Sound effects: none in a cut piece feels flat; too many feels cheap. Animation (mostly code
  // components on screen) is scored like a cartoon: many small, quiet sounds.
  let animated = 0;
  for (const c of clips) if (c.type === "component" && fullFrame(c)) animated += c.duration;
  const isAnimation = animated / fps >= durationSec * 0.6;
  const perMinute = (sfx.length / Math.max(1, durationSec)) * 60;
  if (isAnimation && durationSec >= 15 && perMinute < 10) {
    findings.push(
      `${sfx.length} sound effect${sfx.length === 1 ? "" : "s"} in ${durationSec.toFixed(0)} s of animation feels empty: give the main motions small designed sounds (a pop as a shape appears, a swish as something flies, ticks on a counter, a swell into the reveal), about 20–40 a minute, mixed low (0.1–0.2).`,
    );
  } else if (!sfx.length && cuts.length >= 4 && !voice.length) {
    findings.push(
      "No sound effects: add 3–5 subtle ones where the picture moves (a whoosh on a reveal, a click on a UI action, a low hit on the end card).",
    );
  } else if (sfx.length > Math.max(6, durationSec / (isAnimation ? 1.4 : 2.5))) {
    findings.push(`${sfx.length} sound effects in ${durationSec.toFixed(0)} s is busy: keep the few that sell a moment.`);
  }
  return findings;
};

/** ITU-R BS.1770 K-weighting (high shelf, then high pass): loudness as the ear weighs it. */
const kWeight = (x: Float32Array, fs: number) => {
  const run = (input: Float32Array, [b0, b1, b2, a1, a2]: number[]) => {
    const y = new Float32Array(input.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const v = b0 * input[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = input[i];
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
    return y;
  };
  let k = Math.tan((Math.PI * 1681.974450955533) / fs);
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  const q1 = 0.7071752369554196;
  let a0 = 1 + k / q1 + k * k;
  const shelf = [
    (vh + (vb * k) / q1 + k * k) / a0,
    (2 * (k * k - vh)) / a0,
    (vh - (vb * k) / q1 + k * k) / a0,
    (2 * (k * k - 1)) / a0,
    (1 - k / q1 + k * k) / a0,
  ];
  k = Math.tan((Math.PI * 38.13547087602444) / fs);
  const q2 = 0.5003270373238773;
  a0 = 1 + k / q2 + k * k;
  return run(run(x, shelf), [1, -2, 1, (2 * (k * k - 1)) / a0, (1 - k / q2 + k * k) / a0]);
};

/** An audio file's loudness profile (K-weighted, LUFS-like): its sharpest 50 ms, and its level every 100 ms (400 ms windows). */
type Profile = { fastPeak: number; steps: number[]; median: number };
const profiles = new Map<string, Promise<Profile | null>>();

const profileOf = (src: string | undefined): Promise<Profile | null> => {
  if (!src) return Promise.resolve(null);
  let pending = profiles.get(src);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const audio = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await res.arrayBuffer());
        const n = audio.length;
        const mono = new Float32Array(n);
        for (let c = 0; c < audio.numberOfChannels; c++) {
          const d = audio.getChannelData(c);
          for (let i = 0; i < n; i++) mono[i] += d[i] / audio.numberOfChannels;
        }
        const k = kWeight(mono, audio.sampleRate);
        const loud = (from: number, to: number) => {
          let sum = 0;
          for (let i = from; i < to; i++) sum += k[i] * k[i];
          return -0.691 + 10 * Math.log10(sum / Math.max(1, to - from) + 1e-12);
        };
        const sr = audio.sampleRate;
        const fast = Math.round(sr * 0.05);
        let fastPeak = n <= fast ? loud(0, n) : -200;
        for (let s = 0; s + fast <= n; s += Math.round(fast / 2)) fastPeak = Math.max(fastPeak, loud(s, s + fast));
        const win = Math.round(sr * 0.4);
        const steps: number[] = [];
        for (let s = 0; s + win <= n; s += Math.round(sr * 0.1)) steps.push(loud(s, s + win));
        if (!steps.length) steps.push(loud(0, n));
        const audible = steps.filter((d) => d > -60).sort((a, b) => a - b);
        return { fastPeak, steps, median: audible.length ? audible[Math.floor(audible.length / 2)] : -60 };
      } catch {
        return null;
      }
    })();
    profiles.set(src, pending);
  }
  return pending;
};

/**
 * The mix, measured from the audio itself: sound effects that stick out of the music under them
 * (a whoosh on every cut, a crackling fire bed over the score), with the volume that would sit right.
 * Effects are judged by their sharpest 50 ms, the music by its own level where the effect plays.
 */
export const measureMix = async (project: Project): Promise<string[]> => {
  const fps = project.settings.fps;
  const tracks = new Map(project.tracks.map((t) => [t.id, t]));
  const clips = Object.values(project.clips).filter(
    (c): c is AudioClip => c.type === "audio" && !c.hidden && !c.muted && c.volume > 0 && !tracks.get(c.trackId)?.muted,
  );
  const music = clips.filter((c) => c.role === "music");
  const sfx = clips.filter((c) => c.role === "sfx");
  if (!music.length || !sfx.length) return [];
  const gain = (v: number) => 20 * Math.log10(Math.max(1e-4, v));
  const loud: string[] = [];
  for (const s of [...sfx].sort((a, b) => a.start - b.start)) {
    const bed = music.find((m) => m.start <= s.start && m.start + m.duration > s.start);
    if (!bed) continue;
    const [fx, bg] = await Promise.all([profileOf(project.assets[s.assetId]?.src), profileOf(project.assets[bed.assetId]?.src)]);
    if (!fx || !bg) continue;
    // The music's level around the effect (±1.5 s), in the track's own time.
    const at = bed.trimStart / fps + ((s.start - bed.start) / fps) * bed.speed;
    const i0 = Math.max(0, Math.round((at - 1.5) * 10));
    const i1 = Math.min(bg.steps.length, Math.round((at + 1.5 + s.duration / fps) * 10));
    const local = i1 > i0 ? 10 * Math.log10(bg.steps.slice(i0, i1).reduce((sum, d) => sum + 10 ** (d / 10), 0) / (i1 - i0)) : bg.median;
    const name = project.assets[s.assetId]?.name?.replace(/\.\w+$/, "") ?? "A sound effect";
    const fxLevel = fx.fastPeak + gain(s.volume);
    const bedLevel = local + gain(bed.volume);
    // An effect's sharpest 50 ms may reach the music's level (a payoff hit a little above); ambience beds stay well under it.
    const target = /hit|impact|boom|drop|thud|stinger/i.test(name) ? bedLevel + 4 : s.duration / fps > 3 ? bedLevel - 10 : bedLevel;
    if (fxLevel > target + 2) {
      const volume = Math.min(2, Math.max(0.02, s.volume * 10 ** ((target - fxLevel) / 20)));
      loud.push(`${name} at ${clock(s.start / fps)} (volume ${s.volume} → about ${volume.toFixed(2)})`);
    }
  }
  return loud.length
    ? [
        `Sound effects stick out of the music: ${loud.slice(0, 8).join("; ")}. An effect's sharpest moment should reach about the music's level, no higher (a payoff hit a little above it); ambience beds (fire, rain, crowd) stay well under it.`,
      ]
    : [];
};
