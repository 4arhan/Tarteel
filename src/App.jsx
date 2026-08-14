import { useCallback, useEffect, useMemo, useState } from 'react';
import Reader from './components/Reader.jsx';
import Controls from './components/Controls.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import DebugTable from './components/DebugTable.jsx';
import { fetchPage } from './lib/quranApi.js';
import { segmentAyah, DEFAULT_ANCHORS } from './lib/segmenter.js';
import { loadJSON, saveJSON } from './lib/storage.js';

const STATE_KEY = 'qtsr.state';
const SETTINGS_KEY = 'qtsr.settings';

const DEFAULT_SETTINGS = {
  dim: 0.32,
  fontSize: 40,
  highlightColor: '#e8a94c',
  light: false,
  debug: false,
  anchors: { ...DEFAULT_ANCHORS },
};

export default function App() {
  const [{ page, pos }, setPosition] = useState(() => {
    const s = loadJSON(STATE_KEY, { page: 1, pos: 0 });
    return { page: Math.min(604, Math.max(1, s.page || 1)), pos: Math.max(0, s.pos || 0) };
  });
  const [settings, setSettings] = useState(() => {
    const s = loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
    return { ...s, anchors: { ...DEFAULT_ANCHORS, ...s.anchors } };
  });
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => saveJSON(STATE_KEY, { page, pos }), [page, pos]);
  useEffect(() => saveJSON(SETTINGS_KEY, settings), [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.light);
  }, [settings.light]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchPage(page)
      .then((data) => {
        if (!alive) return;
        setPageData(data);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || 'Failed to load page');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page]);

  // All segments of the page, flattened in reading order.
  const segments = useMemo(() => {
    if (!pageData) return [];
    return pageData.verses.flatMap((v, verseIdx) =>
      segmentAyah(v.text, settings.anchors).map((s) => ({
        ...s,
        verseIdx,
        verseKey: v.key,
      })),
    );
  }, [pageData, settings.anchors]);

  const total = segments.length;
  const clampedPos = Math.min(pos, total); // pos === total ⇒ page complete
  const complete = total > 0 && clampedPos >= total;
  const current = !complete && total > 0 ? segments[clampedPos] : null;

  const goToPage = useCallback((n, startPos = 0) => {
    const target = Math.min(604, Math.max(1, n));
    setPosition({ page: target, pos: startPos });
  }, []);

  const next = useCallback(() => {
    setPosition((p) => ({ ...p, pos: Math.min(p.pos + 1, total) }));
  }, [total]);

  const back = useCallback(() => {
    setPosition((p) => ({ ...p, pos: Math.max(p.pos - 1, 0) }));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-3 text-sm opacity-80">
        <h1 className="select-none text-base font-semibold tracking-wide">
          <span style={{ color: settings.highlightColor }}>Tarteel</span>{' '}
          <span className="font-normal opacity-60">segment reader</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg px-2 py-1 text-lg opacity-70 hover:opacity-100"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <Controls
        page={page}
        onGoToPage={goToPage}
        progress={
          current
            ? `Segment ${clampedPos + 1}/${total} · Ayah ${current.verseKey} · Page ${page}`
            : complete
              ? `Page ${page} complete`
              : `Page ${page}`
        }
      />

      {settingsOpen && (
        <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      )}

      <main className="relative flex-1">
        {loading && (
          <p className="py-16 text-center text-sm opacity-50">Loading page {page}…</p>
        )}
        {error && (
          <div className="py-16 text-center text-sm">
            <p className="text-red-400">{error}</p>
            <button
              className="mt-3 rounded-lg border border-stone-600 px-3 py-1 opacity-80 hover:opacity-100"
              onClick={() => goToPage(page, clampedPos)}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && pageData && (
          <>
            <Reader
              verses={pageData.verses}
              segment={current}
              settings={settings}
              onTapNext={next}
              onTapBack={back}
            />
            {complete && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl bg-black/70 px-8 py-6 text-center shadow-xl backdrop-blur-sm">
                  <p className="mb-4 text-lg">Page {page} complete ✨</p>
                  <div className="flex justify-center gap-3">
                    <button
                      className="rounded-xl px-5 py-2 font-medium text-stone-900"
                      style={{ backgroundColor: settings.highlightColor }}
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= 604}
                    >
                      Next page →
                    </button>
                    <button
                      className="rounded-xl border border-stone-600 px-5 py-2 opacity-80 hover:opacity-100"
                      onClick={back}
                    >
                      Back
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Large thumb-reachable step buttons */}
      <nav className="sticky bottom-0 flex justify-center gap-4 px-4 pb-5 pt-2">
        <button
          className="min-w-[7rem] rounded-2xl border border-stone-700 bg-stone-900/80 px-6 py-4 text-lg backdrop-blur-sm active:scale-95"
          onClick={back}
          disabled={clampedPos === 0}
          style={{ opacity: clampedPos === 0 ? 0.4 : 1 }}
        >
          → Back
        </button>
        <button
          className="min-w-[7rem] rounded-2xl px-6 py-4 text-lg font-semibold text-stone-900 active:scale-95"
          style={{ backgroundColor: settings.highlightColor }}
          onClick={next}
          disabled={complete}
        >
          Next ←
        </button>
      </nav>

      {settings.debug && pageData && (
        <DebugTable verses={pageData.verses} segments={segments} currentPos={clampedPos} />
      )}
    </div>
  );
}
