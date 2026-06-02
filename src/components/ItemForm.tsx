import { useState, useEffect } from 'react';
import { useStore } from '../store';
import type { ItemType, ItemStatus, TimelineItem } from '../types';
import { COLORS } from '../types';
import { formatDateShort } from '../utils';

interface ItemFormProps {
  editItem?: TimelineItem | null;
  onClose: () => void;
}

export default function ItemForm({ editItem, onClose }: ItemFormProps) {
  const { tracks, items, addItem, updateItem, deleteItem, selectItem } = useStore();
  const isEdit = !!editItem;

  const [name, setName] = useState(editItem?.name ?? '');
  const [trackId, setTrackId] = useState(editItem?.trackId ?? tracks[0]?.id ?? '');
  const [start, setStart] = useState(editItem?.start ?? new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(editItem?.end ?? new Date().toISOString().slice(0, 10));
  const [color, setColor] = useState(editItem?.color ?? COLORS[0]);
  const [type, setType] = useState<ItemType>(editItem?.type ?? 'phase');
  const [status, setStatus] = useState<ItemStatus>(editItem?.status ?? 'planned');
  const [note, setNote] = useState(editItem?.note ?? '');
  const [dependsOn, setDependsOn] = useState<string[]>(editItem?.dependsOn ?? []);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setTrackId(editItem.trackId);
      setStart(editItem.start);
      setEnd(editItem.end);
      setColor(editItem.color);
      setType(editItem.type);
      setStatus(editItem.status);
      setNote(editItem.note ?? '');
      setDependsOn(editItem.dependsOn ?? []);
    }
  }, [editItem]);

  const isMilestoneType = type === 'milestone' || type === 'decision-gate';

  // Other items available as dependencies (exclude self)
  const otherItems = items.filter((i) => i.id !== editItem?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalEnd = isMilestoneType ? start : end;
    const data = {
      name: name.trim(),
      trackId,
      start,
      end: finalEnd,
      color,
      type,
      status,
      note: note.trim() || undefined,
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
    };

    if (isEdit && editItem) {
      updateItem(editItem.id, data);
    } else {
      addItem({ ...data, dependsOn: data.dependsOn ?? [] });
    }
    onClose();
  };

  const handleDelete = () => {
    if (editItem && confirm(`Delete "${editItem.name}"?`)) {
      deleteItem(editItem.id);
      selectItem(null);
      onClose();
    }
  };

  const toggleDep = (id: string) => {
    setDependsOn((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <form
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold text-gray-800">{isEdit ? 'Edit project' : 'Add project'}</h3>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Track</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={type}
              onChange={(e) => setType(e.target.value as ItemType)}
            >
              <option value="phase">Phase</option>
              <option value="milestone">Milestone</option>
              <option value="branch-paper">Branch paper</option>
              <option value="decision-gate">Decision gate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
            >
              <option value="planned">Planned</option>
              <option value="in-progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Start date</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          {!isMilestoneType && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">End date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                min={start}
              />
            </div>
          )}
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

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Note (optional)</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One-line note..."
          />
        </div>

        {/* Dependencies */}
        {otherItems.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Depends on {dependsOn.length > 0 && <span className="text-blue-500">({dependsOn.length})</span>}
            </label>
            <div className="max-h-28 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {otherItems.map((oi) => (
                <label key={oi.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={dependsOn.includes(oi.id)}
                    onChange={() => toggleDep(oi.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: oi.color }} />
                  <span className="truncate text-gray-700">{oi.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {isEdit && editItem && (
          <div className="text-xs text-gray-400">
            {formatDateShort(editItem.start)} – {formatDateShort(editItem.end)}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {isEdit ? 'Save' : 'Add'}
          </button>
          {isEdit && (
            <button
              type="button"
              className="bg-red-50 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-100 transition-colors"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
