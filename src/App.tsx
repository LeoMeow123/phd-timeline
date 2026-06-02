import { useState, useRef } from 'react';
import { useStore } from './store';
import type { ZoomLevel } from './types';
import { COLORS } from './types';
import Timeline from './components/Timeline';
import ItemForm from './components/ItemForm';

function ZoomControl() {
  const { zoom, setZoom } = useStore();
  const levels: { key: ZoomLevel; label: string }[] = [
    { key: 'years', label: 'Years' },
    { key: 'quarters', label: 'Quarters' },
    { key: 'months', label: 'Months' },
  ];
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      {levels.map((l) => (
        <button
          key={l.key}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            zoom === l.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setZoom(l.key)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function TrackForm({ onClose }: { onClose: () => void }) {
  const { addTrack } = useStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addTrack({ name: name.trim(), color });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <form
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold text-gray-800">Add track</h3>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: color === c ? '#1e293b' : 'transparent' }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
            Add
          </button>
          <button type="button" className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const { config, tracks, items, selectedItemId, selectItem, importState, setConfig } = useStore();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) ?? null : null;

  const handleExport = () => {
    const data = JSON.stringify({ config, tracks, items }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phd-timeline-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.config && data.tracks && data.items) {
          importState(data);
        } else {
          alert('Invalid file format');
        }
      } catch {
        alert('Failed to parse JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">PhD research timeline</h1>
        <div className="w-px h-6 bg-gray-200" />
        <ZoomControl />
        <div className="w-px h-6 bg-gray-200" />

        <button
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => setShowAddItem(true)}
        >
          + Project
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          onClick={() => setShowAddTrack(true)}
        >
          + Track
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500">Start:</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
            value={config.startDate}
            onChange={(e) => setConfig({ startDate: e.target.value })}
          />
          <label className="text-xs text-gray-500">Years:</label>
          <input
            type="number"
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-14"
            value={config.durationYears}
            min={1}
            max={10}
            onChange={(e) => setConfig({ durationYears: parseInt(e.target.value) || 4 })}
          />
          <div className="w-px h-6 bg-gray-200" />
          <button
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            onClick={handleExport}
          >
            Export JSON
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 p-4 overflow-hidden">
        <Timeline />
      </div>

      {/* Modals */}
      {showAddItem && <ItemForm onClose={() => setShowAddItem(false)} />}
      {showAddTrack && <TrackForm onClose={() => setShowAddTrack(false)} />}
      {selectedItem && (
        <ItemForm
          editItem={selectedItem}
          onClose={() => { selectItem(null); }}
        />
      )}
    </div>
  );
}
