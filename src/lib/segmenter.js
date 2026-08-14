/**
 * Segmentation engine for Uthmani Quran text.
 *
 * Input: one ayah's Uthmani string.
 * Output: ordered array of segments { startIndex, endIndex, trigger }
 * (UTF-16 code-unit indices into the same string, endIndex exclusive).
 *
 * Invariants:
 *  - every character belongs to at least one segment, in order, no gaps;
 *  - the only overlaps between consecutive segments are shadda clusters
 *    (the doubled letter belongs to both the closing and the opening segment).
 *
 * Pure module — no DOM, no fetch. Unit-tested in segmenter.test.js.
 */

// ---- Unicode code points -------------------------------------------------

const SUKUN = 0x0652;
const SMALL_HIGH_DOTLESS_KHAH = 0x06e1; // the Madani/Uthmani sukoon mark

const FATHATAN = 0x064b;
const DAMMATAN = 0x064c;
const KASRATAN = 0x064d;
const OPEN_FATHATAN = 0x08f0;
const OPEN_DAMMATAN = 0x08f1;
const OPEN_KASRATAN = 0x08f2;

const FATHA = 0x064e;
const DAMMA = 0x064f;
const KASRA = 0x0650;
const SHADDA = 0x0651;

const DAGGER_ALIF = 0x0670;
const MADDAH = 0x0653;
const SMALL_WAW = 0x06e5; // category Lm, not Mn — attached explicitly
const SMALL_YEH = 0x06e6; // category Lm, not Mn — attached explicitly

const ALIF = 0x0627;
const WAW = 0x0648;
const YEH = 0x064a;
const ALIF_MAKSURA = 0x0649;
const NOON = 0x0646;
const TATWEEL = 0x0640;

const SMALL_HIGH_ROUNDED_ZERO = 0x06df; // marks a silent letter

const TANWEEN = new Set([
  FATHATAN,
  DAMMATAN,
  KASRATAN,
  OPEN_FATHATAN,
  OPEN_DAMMATAN,
  OPEN_KASRATAN,
]);

// Marks that make a letter "not bare" for madd/seat-alif/noon purposes.
const VOWELISH = new Set([
  FATHATAN,
  DAMMATAN,
  KASRATAN,
  OPEN_FATHATAN,
  OPEN_DAMMATAN,
  OPEN_KASRATAN,
  FATHA,
  DAMMA,
  KASRA,
  SHADDA,
  SUKUN,
  SMALL_HIGH_DOTLESS_KHAH,
]);

const MN_RE = /\p{Mn}/u;

function isAttachingMark(cp) {
  // Combining marks (harakat, waqf signs U+06D6–U+06DC, annotation signs…)
  // attach to the preceding cluster and never start one. Tatweel attaches to
  // the preceding cluster (in Uthmani text it often carries the dagger alif).
  // Small waw/yeh are Lm, not Mn, but behave as attached madd marks.
  return (
    cp === TATWEEL ||
    cp === SMALL_WAW ||
    cp === SMALL_YEH ||
    MN_RE.test(String.fromCodePoint(cp))
  );
}

export const DEFAULT_ANCHORS = {
  sukoon: true,
  madd: true,
  tanween: true,
  noonSakinah: true,
  shadda: true,
};

// ---- Clustering ----------------------------------------------------------

/**
 * Split a string into letter clusters: a base character plus all attaching
 * marks that follow it. Whitespace forms its own (isSpace) cluster.
 */
export function clusterize(text) {
  const clusters = [];
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i);
    const len = cp > 0xffff ? 2 : 1;
    const prev = clusters[clusters.length - 1];
    if (isAttachingMark(cp) && prev && !prev.isSpace) {
      prev.end = i + len;
      prev.marks.push(cp);
    } else if (/\s/.test(String.fromCodePoint(cp))) {
      clusters.push({ start: i, end: i + len, base: cp, marks: [], isSpace: true });
    } else {
      clusters.push({ start: i, end: i + len, base: cp, marks: [], isSpace: false });
    }
    i += len;
  }
  return clusters;
}

// ---- Anchor predicates ---------------------------------------------------

const hasMark = (cluster, cp) => cluster.marks.includes(cp);
const hasAnyMark = (cluster, set) => cluster.marks.some((m) => set.has(m));
const isBare = (cluster) => !hasAnyMark(cluster, VOWELISH);

function isSukoon(cluster) {
  return hasMark(cluster, SUKUN) || hasMark(cluster, SMALL_HIGH_DOTLESS_KHAH);
}

function isTanween(cluster) {
  return hasAnyMark(cluster, TANWEEN);
}

function hasTanweenFath(cluster) {
  return hasMark(cluster, FATHATAN) || hasMark(cluster, OPEN_FATHATAN);
}

function isMadd(cluster, prev) {
  // Explicit madd marks on the cluster itself (dagger alif often rides a
  // tatweel that was attached to this cluster).
  if (
    hasMark(cluster, DAGGER_ALIF) ||
    hasMark(cluster, MADDAH) ||
    hasMark(cluster, SMALL_WAW) ||
    hasMark(cluster, SMALL_YEH)
  ) {
    return true;
  }
  // Bare madd letters need the immediately preceding letter in the same word.
  // Hamzat wasl U+0671 is an ordinary letter, never a madd.
  if (!prev || prev.isSpace) return false;
  if (cluster.base === ALIF && isBare(cluster) && hasMark(prev, FATHA)) return true;
  if (cluster.base === WAW && isBare(cluster) && hasMark(prev, DAMMA)) return true;
  if (
    (cluster.base === YEH || cluster.base === ALIF_MAKSURA) &&
    isBare(cluster) &&
    hasMark(prev, KASRA)
  ) {
    return true;
  }
  return false;
}

function isNoonSakinah(cluster) {
  // Noon carrying sukoon is caught by the sukoon rule; the Uthmani text
  // deliberately leaves noon unmarked in idghām/ikhfā contexts, so a bare
  // noon is a boundary too.
  return cluster.base === NOON && isBare(cluster);
}

// ---- Segmentation --------------------------------------------------------

/**
 * Segment one ayah's Uthmani string.
 * @param {string} text
 * @param {object} anchors toggles: { sukoon, madd, tanween, noonSakinah, shadda }
 * @returns {{startIndex:number, endIndex:number, trigger:string}[]}
 */
export function segmentAyah(text, anchors = DEFAULT_ANCHORS) {
  const on = { ...DEFAULT_ANCHORS, ...anchors };
  const clusters = clusterize(text);
  const segments = [];
  let segStart = 0;

  for (let ci = 0; ci < clusters.length; ci++) {
    const c = clusters[ci];
    if (c.isSpace) continue;

    // Shadda split first: the doubled letter closes the current segment
    // (including this cluster) and the next segment starts AT this same
    // cluster — the only permitted overlap. Skip the split when the segment
    // already starts at this cluster (nothing to close before it).
    if (on.shadda && hasMark(c, SHADDA) && segStart < c.start) {
      segments.push({ startIndex: segStart, endIndex: c.end, trigger: 'shadda' });
      segStart = c.start;
    }

    // Remaining anchors apply within the (possibly just-opened) segment.
    let trigger = null;
    let endIdx = c.end;

    if (on.sukoon && isSukoon(c)) {
      trigger = 'sukoon';
    } else if (on.tanween && isTanween(c)) {
      trigger = 'tanween';
      // Tanwīn fatḥ followed by its bare seat alif: include the alif.
      const next = clusters[ci + 1];
      if (
        hasTanweenFath(c) &&
        next &&
        !next.isSpace &&
        (next.base === ALIF || next.base === ALIF_MAKSURA) &&
        isBare(next)
      ) {
        endIdx = next.end;
        ci++;
      }
    } else if (on.madd && isMadd(c, clusters[ci - 1])) {
      trigger = 'madd';
    } else if (on.noonSakinah && isNoonSakinah(c)) {
      trigger = 'noonSakinah';
    }

    if (trigger) {
      // Absorb immediately following silent letters (small high rounded
      // zero, e.g. the silent alif of قَالُوا۟) into the closing segment.
      while (
        clusters[ci + 1] &&
        !clusters[ci + 1].isSpace &&
        hasMark(clusters[ci + 1], SMALL_HIGH_ROUNDED_ZERO)
      ) {
        ci++;
        endIdx = clusters[ci].end;
      }
      segments.push({ startIndex: segStart, endIndex: endIdx, trigger });
      segStart = endIdx;
    }
  }

  // End of ayah always closes the final segment.
  if (segStart < text.length) {
    if (text.slice(segStart).trim() === '' && segments.length > 0) {
      // Only trailing whitespace remains — fold it into the last segment.
      segments[segments.length - 1].endIndex = text.length;
    } else {
      segments.push({ startIndex: segStart, endIndex: text.length, trigger: 'end' });
    }
  }

  return segments;
}

/**
 * Validate the coverage invariants for a segmentation. Returns a list of
 * problem descriptions (empty = valid). Used by tests and debug mode.
 */
export function checkInvariants(text, segments) {
  const problems = [];
  if (text.length === 0) return problems;
  if (segments.length === 0) {
    problems.push('no segments for non-empty text');
    return problems;
  }
  if (segments[0].startIndex !== 0) problems.push('first segment does not start at 0');
  if (segments[segments.length - 1].endIndex !== text.length) {
    problems.push('last segment does not end at text end');
  }
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const cur = segments[i];
    if (cur.startIndex > prev.endIndex) {
      problems.push(`gap between segment ${i - 1} and ${i}`);
    } else if (cur.startIndex < prev.endIndex) {
      // Overlap — allowed only for a shadda cluster: the previous segment
      // must have closed on shadda exactly at this cluster.
      const overlap = text.slice(cur.startIndex, prev.endIndex);
      if (prev.trigger !== 'shadda' || !overlap.includes('ّ')) {
        problems.push(`illegal overlap between segment ${i - 1} and ${i}`);
      }
    }
  }
  return problems;
}
