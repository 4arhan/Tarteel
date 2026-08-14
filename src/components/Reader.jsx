import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toArabicIndic } from '../lib/arabicNumbers.js';

const PAD_X = 3; // px of horizontal breathing room around segment rects
const PAD_Y = 6; // px of vertical padding so tall stacked marks aren't shaved

/**
 * The mushaf paragraph. Each ayah is an inline element whose text is a
 * SINGLE text node (never wrap individual letters — that destroys ligatures
 * and contextual forms), followed by its always-dimmed end-of-ayah marker.
 * Rendered twice (Layer A dimmed, Layer B masked) with identical metrics.
 */
function PageParagraph({ verses, fontSize, registerAyah }) {
  return (
    <p className="reader-text m-0" style={{ fontSize: `${fontSize}px` }}>
      {verses.map((v, i) => {
        const ayahNumber = v.key.split(':')[1];
        return (
          <span key={v.key}>
            <span data-ayah={i} ref={registerAyah ? (el) => registerAyah(i, el) : undefined}>
              {v.text}
            </span>
            <span className="mx-2 select-none align-middle opacity-40" style={{ fontSize: '0.7em' }}>
              {'﴿' + toArabicIndic(Number(ayahNumber)) + '﴾'}
            </span>
          </span>
        );
      })}
    </p>
  );
}

/**
 * Two stacked copies of the page:
 *  - Layer A (bottom, in normal flow — defines height): full page, dimmed.
 *  - Highlight layer: soft rounded rectangles that slide between segments.
 *  - Layer B (top): identical page at full opacity, clip-path'd so only the
 *    current segment shows. Rects come from a DOM Range over the ayah's
 *    text node, so RTL and line wraps need no special-casing.
 */
export default function Reader({ verses, segment, settings, onTapNext, onTapBack }) {
  const containerRef = useRef(null);
  const ayahRefs = useRef([]);
  const [rects, setRects] = useState([]);

  const registerAyah = useCallback((i, el) => {
    ayahRefs.current[i] = el;
  }, []);

  const computeRects = useCallback(() => {
    const container = containerRef.current;
    if (!container || !segment) {
      setRects([]);
      return;
    }
    const ayahEl = ayahRefs.current[segment.verseIdx];
    const textNode = ayahEl?.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      setRects([]);
      return;
    }
    const max = textNode.textContent.length;
    const range = document.createRange();
    range.setStart(textNode, Math.min(segment.startIndex, max));
    range.setEnd(textNode, Math.min(segment.endIndex, max));
    const containerRect = container.getBoundingClientRect();
    const raw = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0);

    // Merge rects that sit on the same line (browsers may split them).
    const merged = [];
    for (const r of raw) {
      const rect = {
        left: r.left - containerRect.left,
        top: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      };
      const prev = merged[merged.length - 1];
      if (prev && Math.abs(prev.top - rect.top) < rect.height / 2) {
        const left = Math.min(prev.left, rect.left);
        const right = Math.max(prev.left + prev.width, rect.left + rect.width);
        prev.left = left;
        prev.width = right - left;
        prev.top = Math.min(prev.top, rect.top);
        prev.height = Math.max(prev.height, rect.height);
      } else {
        merged.push(rect);
      }
    }
    setRects(
      merged.map((r) => ({
        left: r.left - PAD_X,
        top: r.top - PAD_Y,
        width: r.width + 2 * PAD_X,
        height: r.height + 2 * PAD_Y,
      })),
    );
  }, [segment]);

  // Recompute on segment change / layout, after fonts load, and on resize.
  useLayoutEffect(() => {
    computeRects();
    const raf = requestAnimationFrame(computeRects);
    return () => cancelAnimationFrame(raf);
  }, [computeRects, verses, settings.fontSize]);

  useLayoutEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => alive && computeRects());
    return () => {
      alive = false;
    };
  }, [computeRects]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => computeRects());
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeRects]);

  const clipPath =
    rects.length > 0
      ? `path('${rects
          .map(
            (r) =>
              `M ${r.left} ${r.top} H ${r.left + r.width} V ${r.top + r.height} H ${r.left} Z`,
          )
          .join(' ')}')`
      : undefined;

  const handleTap = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) onTapNext();
    else onTapBack();
  };

  return (
    <div
      ref={containerRef}
      dir="rtl"
      lang="ar"
      className="relative mx-auto max-w-3xl cursor-pointer select-none px-4 py-6"
      onClick={handleTap}
    >
      {/* Layer A — full page, dimmed (defines layout height) */}
      <div style={{ opacity: settings.dim }} aria-hidden="true">
        <PageParagraph verses={verses} fontSize={settings.fontSize} />
      </div>

      {/* Highlight rectangles, sliding between segments */}
      {rects.map((r, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-xl"
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            backgroundColor: settings.highlightColor,
            opacity: 0.18,
            transition: 'left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease',
          }}
        />
      ))}

      {/* Layer B — identical page, masked to the current segment */}
      <div
        className="pointer-events-none absolute inset-0 px-4 py-6"
        style={{ clipPath, visibility: clipPath ? 'visible' : 'hidden' }}
      >
        <PageParagraph verses={verses} fontSize={settings.fontSize} registerAyah={registerAyah} />
      </div>
    </div>
  );
}
