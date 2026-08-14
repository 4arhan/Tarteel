const ANCHOR_LABELS = {
  sukoon: 'Sukoon',
  madd: 'Madd',
  tanween: 'Tanween',
  noonSakinah: 'Noon sakinah',
  shadda: 'Shadda',
};

const SWATCHES = ['#e8a94c', '#7fb7a3', '#c98bd9', '#6ba7e0', '#e08b8b'];

export default function SettingsPanel({ settings, onChange, onClose }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const setAnchor = (key, value) =>
    onChange({ ...settings, anchors: { ...settings.anchors, [key]: value } });

  return (
    <div className="mx-auto mb-2 w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900/90 p-4 text-sm backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium opacity-90">Settings</h2>
        <button className="opacity-60 hover:opacity-100" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <label className="mb-3 block">
        <span className="opacity-70">Dim level — {Math.round(settings.dim * 100)}%</span>
        <input
          type="range"
          min={0.1}
          max={0.6}
          step={0.02}
          value={settings.dim}
          onChange={(e) => set({ dim: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <label className="mb-3 block">
        <span className="opacity-70">Font size — {settings.fontSize}px</span>
        <input
          type="range"
          min={28}
          max={56}
          step={1}
          value={settings.fontSize}
          onChange={(e) => set({ fontSize: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <div className="mb-3">
        <span className="opacity-70">Highlight color</span>
        <div className="mt-1 flex gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              className="h-7 w-7 rounded-full border-2"
              style={{
                backgroundColor: c,
                borderColor: settings.highlightColor === c ? 'white' : 'transparent',
              }}
              onClick={() => set({ highlightColor: c })}
              aria-label={`Highlight color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="mb-3">
        <span className="opacity-70">Segment anchors</span>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {Object.entries(ANCHOR_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.anchors[key]}
                onChange={(e) => setAnchor(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-700 pt-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.light}
            onChange={(e) => set({ light: e.target.checked })}
          />
          <span>Light mode</span>
        </label>
        <label className="flex items-center gap-2 opacity-70">
          <input
            type="checkbox"
            checked={settings.debug}
            onChange={(e) => set({ debug: e.target.checked })}
          />
          <span>Debug / teacher mode</span>
        </label>
      </div>
    </div>
  );
}
