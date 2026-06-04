import { useState, useRef, useEffect } from 'react';
import { useStore } from './store';
import type { ZoomLevel } from './types';
import { COLORS } from './types';
import Timeline from './components/Timeline';
import ItemForm from './components/ItemForm';
import { getSyncConfig, setSyncConfig, loadFromCloud, saveToCloud } from './sync';
import type { SyncConfig } from './sync';

function ZoomControl() {
  const { zoom, setZoom } = useStore();
  const levels: { key: ZoomLevel; label: string }[] = [
    { key: 'years', label: 'Years' },
    { key: 'quarters', label: 'Quarters' },
    { key: 'months', label: 'Months' },
    { key: 'weeks', label: 'Weeks' },
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

function SyncSetupModal({ onClose }: { onClose: () => void }) {
  const existing = getSyncConfig();
  const [token, setToken] = useState(existing?.token ?? '');
  const [owner, setOwner] = useState(existing?.owner ?? 'LeoMeow123');
  const [repo, setRepo] = useState(existing?.repo ?? 'phd-timeline');

  const handleSave = () => {
    if (!token.trim()) return;
    setSyncConfig({ token: token.trim(), owner: owner.trim(), repo: repo.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-800">Cloud Sync Setup</h3>
        <p className="text-xs text-gray-500">
          Create a GitHub token at Settings &gt; Developer settings &gt; Fine-grained tokens.
          Give it <strong>Contents</strong> read+write on your repo.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">GitHub Token</label>
          <input
            type="password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_..."
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Owner</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Repo</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { config, tracks, items, selectedItemId, selectItem, importState, setConfig } = useStore();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [showSyncSetup, setShowSyncSetup] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'loading' | 'done' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) ?? null : null;

  // Auto-load from cloud on first visit (no local data yet)
  useEffect(() => {
    const hasLocal = localStorage.getItem('phd-timeline-storage');
    if (!hasLocal) {
      loadFromCloud().then((data) => {
        if (data) importState(data);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloudSave = async () => {
    const cfg = getSyncConfig();
    if (!cfg?.token) {
      setShowSyncSetup(true);
      return;
    }
    setSyncStatus('saving');
    const ok = await saveToCloud({ config, tracks, items });
    setSyncStatus(ok ? 'done' : 'error');
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  const handleCloudLoad = async () => {
    setSyncStatus('loading');
    const data = await loadFromCloud();
    if (data) {
      importState(data);
      setSyncStatus('done');
    } else {
      setSyncStatus('error');
    }
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

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

  const handlePrint = () => {
    window.print();
  };

  const syncLabel =
    syncStatus === 'saving' ? 'Saving...' :
    syncStatus === 'loading' ? 'Loading...' :
    syncStatus === 'done' ? 'Synced' :
    syncStatus === 'error' ? 'Failed' :
    'Save';
  const loadLabel = syncStatus === 'loading' ? '...' : 'Load';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 print:hidden">
        <h1 className="text-lg font-semibold text-gray-800">PhD research timeline</h1>
        <div className="w-px h-6 bg-gray-200" />
        <ZoomControl />
        <div className="w-px h-6 bg-gray-200" />

        <button
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => { selectItem(null); setShowAddItem(true); }}
        >
          + Project
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          onClick={() => { selectItem(null); setShowAddTrack(true); }}
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

          {/* Cloud sync */}
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              syncStatus === 'done' ? 'bg-green-50 text-green-700' :
              syncStatus === 'error' ? 'bg-red-50 text-red-700' :
              'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
            onClick={handleCloudSave}
            disabled={syncStatus === 'saving' || syncStatus === 'loading'}
          >
            {syncLabel}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            onClick={handleCloudLoad}
            disabled={syncStatus === 'saving' || syncStatus === 'loading'}
          >
            {loadLabel}
          </button>
          <button
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowSyncSetup(true)}
            title="Cloud sync settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>

          <div className="w-px h-6 bg-gray-200" />
          <button
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            onClick={handlePrint}
          >
            Print
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 p-4 overflow-hidden print:p-0">
        <Timeline />
      </div>

      {/* Modals */}
      {showAddItem && !selectedItem && <ItemForm onClose={() => setShowAddItem(false)} />}
      {showAddTrack && <TrackForm onClose={() => setShowAddTrack(false)} />}
      {selectedItem && (
        <ItemForm
          editItem={selectedItem}
          onClose={() => { selectItem(null); setShowAddItem(false); }}
        />
      )}
      {showSyncSetup && <SyncSetupModal onClose={() => setShowSyncSetup(false)} />}
    </div>
  );
}
