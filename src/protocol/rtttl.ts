const MAX_NOTES = 63;
const DURATIONS = [1, 2, 4, 8, 16, 32];
const SEMITONES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, h: 11 };
const NOTE = /^(\d{1,2})?([a-hp])(#?)(\.?)([1-8]?)(\.?)$/i;

export const EXAMPLE_RTTTL = 'Chime:d=8,o=6,b=120:c,e,g,4c7';

export function parseRtttl(text: string): {
  bpm: number;
  notes: { midi: number; length: number }[];
} {
  const parts = text.replace(/\s+/g, '').split(':');
  if (parts.length !== 3) throw new Error('Enter RTTTL in name:settings:notes format.');
  const [, settings, sequence] = parts;
  const defaults = new Map([
    ['d', 4],
    ['o', 6],
    ['b', 63],
  ]);
  if (settings) {
    for (const setting of settings.split(',')) {
      const match = /^([dob])=(\d+)$/i.exec(setting);
      if (!match)
        throw new Error('Use d for duration, o for octave, and b for tempo in RTTTL settings.');
      defaults.set(match[1].toLowerCase(), Number(match[2]));
    }
  }
  const duration = defaults.get('d') ?? 4;
  const octave = defaults.get('o') ?? 6;
  const bpm = defaults.get('b') ?? 63;
  if (!DURATIONS.includes(duration) || octave < 1 || octave > 8 || bpm < 25 || bpm > 900)
    throw new Error(
      'Use an RTTTL duration of 1, 2, 4, 8, 16, or 32, an octave from 1 to 8, and a tempo from 25 to 900.',
    );

  const tokens = sequence.split(',').filter(Boolean);
  if (!tokens.length) throw new Error('Enter at least one note.');
  if (tokens.length > MAX_NOTES) throw new Error(`Use at most ${MAX_NOTES} notes and rests.`);
  const notes = tokens.map((token, index) => {
    const match = NOTE.exec(token);
    if (!match) throw new Error(`Invalid RTTTL note ${index + 1}.`);
    const [, noteDuration, letter, sharp, dotBefore, noteOctave, dotAfter] = match;
    const divisor = noteDuration ? Number(noteDuration) : duration;
    const pitch = letter.toLowerCase();
    const midi =
      pitch === 'p'
        ? 0
        : (Number(noteOctave || octave) + 1) * 12 + SEMITONES[pitch] + Number(!!sharp);
    if (!DURATIONS.includes(divisor) || (pitch !== 'p' && (midi < 24 || midi > 119)))
      throw new Error(`Invalid RTTTL note ${index + 1}.`);
    return { midi, length: (64 / divisor) * (dotBefore || dotAfter ? 1.5 : 1) };
  });
  return { bpm, notes };
}
