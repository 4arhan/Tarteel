export default function Controls({ page, onGoToPage, progress }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 pb-1">
      <div className="flex items-center gap-2 text-sm">
        <button
          className="rounded-lg border border-stone-700 px-3 py-1 opacity-70 hover:opacity-100"
          onClick={() => onGoToPage(page - 1)}
          disabled={page <= 1}
        >
          ‹ Prev
        </button>
        <label className="flex items-center gap-1 opacity-80">
          Page
          <input
            type="number"
            min={1}
            max={604}
            value={page}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 1 && n <= 604) onGoToPage(n);
            }}
            className="w-16 rounded-lg border border-stone-700 bg-transparent px-2 py-1 text-center"
          />
          <span className="opacity-50">/ 604</span>
        </label>
        <button
          className="rounded-lg border border-stone-700 px-3 py-1 opacity-70 hover:opacity-100"
          onClick={() => onGoToPage(page + 1)}
          disabled={page >= 604}
        >
          Next ›
        </button>
      </div>
      <p className="text-xs tracking-wide opacity-50">{progress}</p>
    </div>
  );
}
