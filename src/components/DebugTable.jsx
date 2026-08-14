import { useMemo } from 'react';
import { clusterize } from '../lib/segmenter.js';

const TRIGGER_COLORS = {
  sukoon: '#6ba7e0',
  madd: '#7fb7a3',
  tanween: '#c98bd9',
  noonSakinah: '#e0c36b',
  shadda: '#e08b8b',
  end: '#8a8a8a',
};

/**
 * Teacher/acceptance tool: every segment of the current page with its
 * trigger anchor colored inline. Shadda clusters appear in two consecutive
 * rows — once closing a segment, once opening the next.
 */
export default function DebugTable({ verses, segments, currentPos }) {
  // Pre-cluster each verse once so we can locate a segment's trigger cluster.
  const clustersByVerse = useMemo(() => verses.map((v) => clusterize(v.text)), [verses]);

  return (
    <section dir="ltr" className="mx-auto w-full max-w-4xl px-4 pb-10 text-xs">
      <h2 className="mb-2 font-medium opacity-70">Debug — segments on this page</h2>
      <div className="overflow-x-auto rounded-xl border border-stone-700">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-700 text-left opacity-60">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Ayah</th>
              <th className="px-2 py-1">Segment text</th>
              <th className="px-2 py-1">Trigger</th>
              <th className="px-2 py-1">Range</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s, i) => {
              const text = verses[s.verseIdx].text;
              const color = TRIGGER_COLORS[s.trigger];
              // The trigger anchor is carried by the last letter cluster of
              // the segment (tanween seat alif / silent letters included in
              // the colored tail for visibility).
              const clusters = clustersByVerse[s.verseIdx];
              let tailStart = s.endIndex;
              if (s.trigger !== 'end') {
                const last = [...clusters]
                  .reverse()
                  .find((c) => !c.isSpace && c.end <= s.endIndex && c.start >= s.startIndex);
                if (last) tailStart = last.start;
              }
              const head = text.slice(s.startIndex, tailStart);
              const tail = text.slice(tailStart, s.endIndex);
              return (
                <tr
                  key={i}
                  className={`border-b border-stone-800 ${i === currentPos ? 'bg-stone-800/60' : ''}`}
                >
                  <td className="px-2 py-1 opacity-60">{i + 1}</td>
                  <td className="px-2 py-1 opacity-60">{s.verseKey}</td>
                  <td dir="rtl" lang="ar" className="px-2 py-1 text-lg leading-loose">
                    {head}
                    <span style={{ color }}>{tail}</span>
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium text-stone-900"
                      style={{ backgroundColor: color }}
                    >
                      {s.trigger}
                    </span>
                  </td>
                  <td className="px-2 py-1 font-mono opacity-60">
                    {s.startIndex}–{s.endIndex}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
