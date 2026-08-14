import { describe, it, expect } from 'vitest';
import { segmentAyah, clusterize, checkInvariants, DEFAULT_ANCHORS } from './segmenter.js';

// Exact text_uthmani strings from api.quran.com (page 1, Al-Fātiḥah),
// code points verified against the live API.
const FATIHA = {
  '1:1': 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
  '1:2': 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
  '1:3': 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
  '1:4': 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
  '1:5': 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
  '1:6': 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
  '1:7': 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
};

const seg = (text, s) => text.slice(s.startIndex, s.endIndex);

describe('clusterize', () => {
  it('attaches combining marks to their base letter', () => {
    const clusters = clusterize('بِسْ');
    expect(clusters).toHaveLength(2);
    expect(clusters[0].marks).toEqual([0x0650]);
    expect(clusters[1].marks).toEqual([0x0652]);
  });

  it('attaches tatweel (and the dagger alif it carries) to the preceding cluster', () => {
    // مَـٰ = meem + fatha + tatweel + dagger alif → one cluster
    const clusters = clusterize('مَـٰ');
    expect(clusters).toHaveLength(1);
    expect(clusters[0].marks).toContain(0x0670);
  });

  it('gives whitespace its own cluster', () => {
    const clusters = clusterize('اب ج');
    expect(clusters.filter((c) => c.isSpace)).toHaveLength(1);
  });
});

describe('worked examples from the spec (page 1)', () => {
  it('1:1 — first segment is بِسْ (sukoon on س), next begins at مِ', () => {
    const text = FATIHA['1:1'];
    const segments = segmentAyah(text);
    expect(seg(text, segments[0])).toBe('بِسْ');
    expect(segments[0].trigger).toBe('sukoon');
    expect(segments[1].startIndex).toBe(segments[0].endIndex);
    expect(seg(text, segments[1]).trimStart().startsWith('مِ')).toBe(true);
  });

  it('1:2 — رَبِّ splits at the shadda: one segment ends with بِّ, the next starts with that same بِّ', () => {
    const text = FATIHA['1:2'];
    const segments = segmentAyah(text);
    const closing = segments.find(
      (s) => s.trigger === 'shadda' && seg(text, s).endsWith('بِّ'),
    );
    expect(closing).toBeDefined();
    const idx = segments.indexOf(closing);
    const opening = segments[idx + 1];
    expect(seg(text, opening).startsWith('بِّ')).toBe(true);
    // The shadda cluster بِّ (3 code units) is shared by both segments.
    expect(closing.endIndex - opening.startIndex).toBe(3);
  });
});

describe('anchor rules', () => {
  it('sukoon: U+0652 and U+06E1 both close a segment', () => {
    for (const mark of ['ْ', 'ۡ']) {
      const text = `بِسْمِ`.replace('ْ', mark);
      const segments = segmentAyah(text);
      expect(segments[0].trigger).toBe('sukoon');
      expect(seg(text, segments[0])).toBe('بِس' + mark);
    }
  });

  it('tanween: fathatan includes its bare seat alif in the segment', () => {
    // عَفُوًّا غَفُورًا style: رًا — ra + fathatan + seat alif
    const text = 'غَفُورًا';
    const segments = segmentAyah(text);
    const t = segments.find((s) => s.trigger === 'tanween');
    expect(t).toBeDefined();
    expect(seg(text, t).endsWith('رًا')).toBe(true);
    expect(t.endIndex).toBe(text.length);
  });

  it('tanween: dammatan closes without consuming anything after it', () => {
    const text = 'عَلِيمٌ حَكِيمٌ';
    const segments = segmentAyah(text);
    const first = segments.find((s) => s.trigger === 'tanween');
    expect(seg(text, first).endsWith('مٌ')).toBe(true);
  });

  it('tanween: Uthmani open forms U+08F0–U+08F2 fire too', () => {
    const text = 'عَلِيمࣱ'; // open dammatan
    const segments = segmentAyah(text);
    expect(segments.some((s) => s.trigger === 'tanween')).toBe(true);
  });

  it('madd: bare alif after fatha', () => {
    const text = 'قَالَ';
    const segments = segmentAyah(text);
    expect(seg(text, segments[0])).toBe('قَا');
    expect(segments[0].trigger).toBe('madd');
  });

  it('madd: bare waw after damma, bare yeh after kasra', () => {
    let segments = segmentAyah('يَقُولُ');
    expect(segments.some((s) => s.trigger === 'madd')).toBe(true);
    segments = segmentAyah('قِيلَ');
    expect(segments.some((s) => s.trigger === 'madd')).toBe(true);
  });

  it('madd: dagger alif (riding tatweel) fires — ٱلرَّحْمَـٰنِ', () => {
    const text = FATIHA['1:3'];
    const segments = segmentAyah(text);
    const madd = segments.find((s) => s.trigger === 'madd');
    expect(madd).toBeDefined();
    expect(seg(text, madd).endsWith('مَـٰ')).toBe(true);
  });

  it('madd: maddah U+0653 fires — ٱلضَّآلِّينَ', () => {
    const text = FATIHA['1:7'];
    const segments = segmentAyah(text);
    const madds = segments.filter((s) => s.trigger === 'madd');
    // The API encodes آ as bare alif + combining maddah (U+0627 U+0653).
    expect(madds.some((s) => seg(text, s).includes('آ'))).toBe(true);
  });

  it('hamzat wasl U+0671 is an ordinary letter, never a madd', () => {
    const text = FATIHA['1:6']; // starts with ٱهْدِنَا
    const segments = segmentAyah(text);
    // First segment closes on the sukoon of هْ, not on the initial ٱ.
    expect(seg(text, segments[0])).toBe('ٱهْ');
    expect(segments[0].trigger).toBe('sukoon');
  });

  it('noon sakinah: bare noon (unmarked, idghām context) is a boundary', () => {
    const text = 'مِن رَّبِّهِمْ';
    const segments = segmentAyah(text);
    expect(segments[0].trigger).toBe('noonSakinah');
    expect(seg(text, segments[0])).toBe('مِن');
  });

  it('noon with its own vowel is NOT a boundary', () => {
    const text = 'نَعْبُدُ';
    const segments = segmentAyah(text);
    expect(segments[0].trigger).not.toBe('noonSakinah');
    expect(seg(text, segments[0])).toBe('نَعْ');
  });

  it('shadda on the first cluster of an ayah does not create a duplicate segment', () => {
    const text = 'رَّبِهِ';
    const segments = segmentAyah(text);
    expect(segments[0].startIndex).toBe(0);
    const problems = checkInvariants(text, segments);
    expect(problems).toEqual([]);
  });

  it('shadda + tanween on the same cluster yields a legitimate one-cluster segment', () => {
    const text = 'حَقٌّ';
    const segments = segmentAyah(text);
    const last = segments[segments.length - 1];
    expect(last.trigger).toBe('tanween');
    expect(seg(text, last)).toBe('قٌّ');
    // and the previous segment ends with that same shadda cluster
    const prev = segments[segments.length - 2];
    expect(prev.trigger).toBe('shadda');
    expect(seg(text, prev).endsWith('قٌّ')).toBe(true);
  });

  it('waqf marks attach to the previous cluster and never fire by themselves', () => {
    const text = 'قَالَۖ وَعَمِلَ'; // waqf ṣalā after قَالَ's lam
    const segments = segmentAyah(text);
    const problems = checkInvariants(text, segments);
    expect(problems).toEqual([]);
    // no segment consists solely of the waqf mark
    for (const s of segments) {
      expect(seg(text, s).replace(/[ۖ-ۜ\s]/g, '')).not.toBe('');
    }
  });

  it('silent letters (U+06DF) are absorbed into the closing segment — قَالُوا۟', () => {
    const text = 'قَالُوا۟ كَذَٰلِكَ';
    const segments = segmentAyah(text);
    const madd = segments.find((s) => s.trigger === 'madd' && seg(text, s).includes('لُو'));
    expect(madd).toBeDefined();
    expect(seg(text, madd).includes('ا۟')).toBe(true);
  });
});

describe('anchor toggles', () => {
  it('disabling an anchor removes its boundaries', () => {
    const text = FATIHA['1:1'];
    const off = { ...DEFAULT_ANCHORS, sukoon: false };
    const segments = segmentAyah(text, off);
    expect(segments.some((s) => s.trigger === 'sukoon')).toBe(false);
    expect(checkInvariants(text, segments)).toEqual([]);
  });

  it('all anchors off yields one whole-ayah segment', () => {
    const text = FATIHA['1:4'];
    const segments = segmentAyah(text, {
      sukoon: false,
      madd: false,
      tanween: false,
      noonSakinah: false,
      shadda: false,
    });
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startIndex: 0, endIndex: text.length, trigger: 'end' });
  });
});

describe('coverage invariants on all of page 1', () => {
  for (const [key, text] of Object.entries(FATIHA)) {
    it(`${key}: full coverage, ordered, shadda-only overlaps`, () => {
      const segments = segmentAyah(text);
      expect(checkInvariants(text, segments)).toEqual([]);
      // Every non-space character is inside at least one segment.
      const covered = new Array(text.length).fill(false);
      for (const s of segments) {
        for (let i = s.startIndex; i < s.endIndex; i++) covered[i] = true;
      }
      expect(covered.every(Boolean)).toBe(true);
    });
  }

  it('end of ayah always closes the final segment', () => {
    for (const text of Object.values(FATIHA)) {
      const segments = segmentAyah(text);
      expect(segments[segments.length - 1].endIndex).toBe(text.length);
    }
  });
});
