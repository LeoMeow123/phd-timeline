import { useRef, useMemo, useCallback, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, pointerWithin } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';
import { parseISO, addDays, differenceInCalendarDays, format } from 'date-fns';
import { useStore } from '../store';
import { getTimeColumns, totalTimelineWidth, computeSubRows, pixelsPerDay, dateToX, snapDate, formatDateShort } from '../utils';
import type { Track as TrackType, TimelineItem } from '../types';
import Bar, { BAR_HEIGHT, CP_ROW_HEIGHT, ROW_GAP, itemCpRows } from './Bar';

const HEADER_WIDTH = 280;
const AXIS_HEIGHT = 40;
const MIN_LANE_HEIGHT = 40;

function TrackDropZone({ track, children, laneHeight }: { track: TrackType; children: React.ReactNode; laneHeight: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `track-${track.id}` });
  return (
    <div
      ref={setNodeRef}
      className="relative border-b border-gray-100"
      style={{ height: laneHeight, background: isOver ? `${track.color}08` : undefined }}
    >
      {children}
    </div>
  );
}

// Inline form for adding a checkpoint
function AddCheckpointForm({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { addCheckpoint } = useStore();
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    addCheckpoint(itemId, label.trim(), date);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="pl-7 pr-2 py-1 flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
      <input
        className="flex-1 min-w-0 text-[11px] border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-blue-400"
        placeholder="Label..."
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
      />
      <input
        type="date"
        className="text-[10px] border border-gray-300 rounded px-1 py-0.5 outline-none focus:border-blue-400"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button type="submit" className="text-[10px] text-blue-600 font-medium hover:text-blue-800">Add</button>
      <button type="button" className="text-[10px] text-gray-400 hover:text-gray-600" onClick={onClose}>&#10005;</button>
    </form>
  );
}

// Left panel: sortable track header with expandable items + checkpoints
function TrackPanel({
  track,
  trackItems,
  laneHeight,
  expandedItems,
  toggleItem,
  addingCpFor,
  setAddingCpFor,
  onToggleTrack,
  onDeleteTrack,
  onSelectItem,
  selectedItemId,
}: {
  track: TrackType;
  trackItems: TimelineItem[];
  laneHeight: number;
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
  addingCpFor: string | null;
  setAddingCpFor: (id: string | null) => void;
  onToggleTrack: () => void;
  onDeleteTrack: () => void;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
}) {
  const { updateCheckpoint, deleteCheckpoint } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const style = {
    height: laneHeight,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border-b border-gray-100 flex flex-col">
      {/* Track header row */}
      <div className="flex items-center gap-1.5 px-2 py-1 group/track hover:bg-gray-100 transition-colors flex-shrink-0">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
          title="Drag to reorder"
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
            <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
          </svg>
        </div>
        <span
          className="text-xs text-gray-400 cursor-pointer select-none"
          onClick={onToggleTrack}
        >
          {track.collapsed ? '▶' : '▼'}
        </span>
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: track.color }} />
        <span
          className="text-xs font-semibold text-gray-700 truncate cursor-pointer flex-1"
          onClick={onToggleTrack}
        >
          {track.name}
        </span>
        <span className="text-[10px] text-gray-400">{trackItems.length}</span>
        <button
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover/track:opacity-100 transition-opacity p-0.5"
          title="Delete track"
          onClick={(e) => { e.stopPropagation(); onDeleteTrack(); }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>

      {/* Items list (when track is expanded) — scrollable */}
      {!track.collapsed && <div className="overflow-y-auto flex-1 min-h-0">
      {trackItems.map((item) => {
        const isExpanded = expandedItems.has(item.id);
        const cps = item.checkpoints ?? [];
        const cpDone = cps.filter((c) => c.done).length;
        const isSelected = selectedItemId === item.id;

        return (
          <div key={item.id}>
            {/* Item row */}
            <div
              className={`flex items-center gap-1 pl-5 pr-2 py-0.5 cursor-pointer hover:bg-blue-50 transition-colors group/item ${isSelected ? 'bg-blue-50' : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              {/* Expand toggle (only if has or can have checkpoints) */}
              <span
                className="text-[10px] text-gray-400 w-3 text-center cursor-pointer select-none"
                onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              >
                {cps.length > 0 ? (isExpanded ? '▼' : '▶') : '·'}
              </span>
              <span className="text-[11px] text-gray-600 truncate flex-1" title={item.name}>
                {item.name}
              </span>
              {cps.length > 0 && (
                <span className="text-[9px] text-gray-400 flex-shrink-0">{cpDone}/{cps.length}</span>
              )}
              {/* Add checkpoint button */}
              <button
                className="text-gray-300 hover:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity text-[10px] flex-shrink-0"
                title="Add checkpoint"
                onClick={(e) => { e.stopPropagation(); setAddingCpFor(addingCpFor === item.id ? null : item.id); toggleItem(item.id); }}
              >
                +
              </button>
            </div>

            {/* Checkpoints (when item is expanded) */}
            {isExpanded && cps.map((cp) => (
              <div
                key={cp.id}
                className="flex items-center gap-1 pl-9 pr-2 py-0.5 group/cp hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={cp.done}
                  onChange={() => updateCheckpoint(item.id, cp.id, { done: !cp.done })}
                  className="w-3 h-3 rounded border-gray-300 flex-shrink-0"
                />
                <span
                  className="text-[10px] truncate flex-1"
                  style={{
                    color: cp.done ? '#9ca3af' : '#4b5563',
                    textDecoration: cp.done ? 'line-through' : undefined,
                  }}
                  title={`${cp.label} — ${formatDateShort(cp.date)}`}
                >
                  {cp.label}
                </span>
                <span className="text-[9px] text-gray-400 flex-shrink-0">
                  {format(parseISO(cp.date), 'MMM d')}
                </span>
                <button
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover/cp:opacity-100 transition-opacity text-[10px] flex-shrink-0"
                  onClick={() => deleteCheckpoint(item.id, cp.id)}
                >
                  &#10005;
                </button>
              </div>
            ))}

            {/* Add checkpoint form */}
            {addingCpFor === item.id && (
              <AddCheckpointForm itemId={item.id} onClose={() => setAddingCpFor(null)} />
            )}
          </div>
        );
      })}
      </div>}
    </div>
  );
}

// SVG arrow between two items
function DependencyArrow({
  from, to, programStart, zoom, fromSubRow, toSubRow, fromTrackOffset, toTrackOffset, fromPitch, toPitch,
}: {
  from: TimelineItem; to: TimelineItem; programStart: string; zoom: string;
  fromSubRow: number; toSubRow: number; fromTrackOffset: number; toTrackOffset: number;
  fromPitch: number; toPitch: number;
}) {
  const fromX = dateToX(from.end, programStart, zoom as any);
  const toX = dateToX(to.start, programStart, zoom as any);
  const fromY = fromTrackOffset + fromSubRow * fromPitch + ROW_GAP + BAR_HEIGHT / 2;
  const toY = toTrackOffset + toSubRow * toPitch + ROW_GAP + BAR_HEIGHT / 2;
  const midX = (fromX + toX) / 2;

  return (
    <path
      d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
      fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2"
      markerEnd="url(#arrowhead)"
    />
  );
}

export default function Timeline() {
  const { config, tracks, items, zoom, selectedItemId, updateItem, selectItem, updateTrack, deleteTrack, reorderTracks } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const scrollSourceRef = useRef<'left' | 'right' | null>(null);

  // Local UI state for expanded items in left panel
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [addingCpFor, setAddingCpFor] = useState<string | null>(null);

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const columns = useMemo(() => getTimeColumns(config.startDate, config.durationYears, zoom), [config, zoom]);
  const totalWidth = useMemo(() => totalTimelineWidth(config.startDate, config.durationYears, zoom), [config, zoom]);
  const ppd = pixelsPerDay(zoom);
  const todayX = dateToX(new Date(), config.startDate, zoom);

  const trackData = useMemo(() => {
    const map = new Map<string, { items: TimelineItem[]; subRows: Map<string, number>; maxRow: number }>();
    for (const track of tracks) {
      const trackItems = items.filter((i) => i.trackId === track.id);
      const subRows = computeSubRows(trackItems);
      const maxRow = trackItems.length > 0 ? Math.max(...Array.from(subRows.values())) : -1;
      map.set(track.id, { items: trackItems, subRows, maxRow });
    }
    return map;
  }, [tracks, items]);

  // Compute max checkpoint sub-rows per track and per-item row pitch
  const trackRowPitch = useMemo(() => {
    const map = new Map<string, number>();
    for (const track of tracks) {
      const td = trackData.get(track.id);
      if (!td || td.items.length === 0) {
        map.set(track.id, BAR_HEIGHT + ROW_GAP);
        continue;
      }
      // Find max checkpoint rows across all items in this track
      let maxCpRows = 0;
      for (const item of td.items) {
        const barLeft = dateToX(item.start, config.startDate, zoom);
        const cpRows = itemCpRows(item, barLeft, config.startDate, zoom);
        if (cpRows > maxCpRows) maxCpRows = cpRows;
      }
      map.set(track.id, BAR_HEIGHT + maxCpRows * CP_ROW_HEIGHT + ROW_GAP);
    }
    return map;
  }, [tracks, trackData, config.startDate, zoom]);

  const { laneHeights, trackOffsets } = useMemo(() => {
    const laneHeights = new Map<string, number>();
    const trackOffsets = new Map<string, number>();
    let y = 0;
    for (const track of tracks) {
      const td = trackData.get(track.id);
      const rows = td ? td.maxRow + 1 : 1;
      const pitch = trackRowPitch.get(track.id) ?? (BAR_HEIGHT + ROW_GAP);
      const h = track.collapsed ? 24 : Math.max(MIN_LANE_HEIGHT, rows * pitch + 8);
      laneHeights.set(track.id, h);
      trackOffsets.set(track.id, y);
      y += h;
    }
    return { laneHeights, trackOffsets };
  }, [tracks, trackData, trackRowPitch]);

  const arrows = useMemo(() => {
    const result: {
      from: TimelineItem; to: TimelineItem;
      fromSubRow: number; toSubRow: number;
      fromTrackOffset: number; toTrackOffset: number;
      fromPitch: number; toPitch: number;
    }[] = [];
    for (const item of items) {
      if (!item.dependsOn?.length) continue;
      const toTd = trackData.get(item.trackId);
      if (!toTd) continue;
      for (const depId of item.dependsOn) {
        const dep = items.find((i) => i.id === depId);
        if (!dep) continue;
        const fromTd = trackData.get(dep.trackId);
        if (!fromTd) continue;
        result.push({
          from: dep, to: item,
          fromSubRow: fromTd.subRows.get(dep.id) ?? 0,
          toSubRow: toTd.subRows.get(item.id) ?? 0,
          fromTrackOffset: trackOffsets.get(dep.trackId) ?? 0,
          toTrackOffset: trackOffsets.get(item.trackId) ?? 0,
          fromPitch: trackRowPitch.get(dep.trackId) ?? (BAR_HEIGHT + ROW_GAP),
          toPitch: trackRowPitch.get(item.trackId) ?? (BAR_HEIGHT + ROW_GAP),
        });
      }
    }
    return result;
  }, [items, trackData, trackOffsets, trackRowPitch]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleBarDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const data = active.data.current;
    if (!data || data.type !== 'bar-move') return;
    const itemId = data.itemId as string;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const daysDelta = Math.round(delta.x / ppd);
    const newStart = snapDate(addDays(parseISO(item.start), daysDelta), zoom, config.startDate);
    const dur = differenceInCalendarDays(parseISO(item.end), parseISO(item.start));
    const newEnd = addDays(newStart, dur);
    const changes: Partial<TimelineItem> = {
      start: format(newStart, 'yyyy-MM-dd'),
      end: format(newEnd, 'yyyy-MM-dd'),
    };
    if (over) {
      const overId = over.id as string;
      if (overId.startsWith('track-')) {
        const newTrackId = overId.replace('track-', '');
        if (newTrackId !== item.trackId) changes.trackId = newTrackId;
      }
    }
    updateItem(itemId, changes);
  };

  const handleTrackDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) reorderTracks(oldIndex, newIndex);
  }, [tracks, reorderTracks]);

  const handleRightScroll = () => {
    if (scrollSourceRef.current === 'left') return;
    scrollSourceRef.current = 'right';
    if (scrollRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => { scrollSourceRef.current = null; });
  };

  const handleLeftScroll = () => {
    if (scrollSourceRef.current === 'right') return;
    scrollSourceRef.current = 'left';
    if (scrollRef.current && headerScrollRef.current) {
      scrollRef.current.scrollTop = headerScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => { scrollSourceRef.current = null; });
  };

  const handleDeleteTrack = (trackId: string, trackName: string) => {
    if (confirm(`Delete track "${trackName}" and all its items?`)) deleteTrack(trackId);
  };

  const totalLaneHeight = Array.from(laneHeights.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-1 overflow-hidden bg-white border border-gray-200 rounded-lg print-timeline">
      {/* Left panel — track tree */}
      <div className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col" style={{ width: HEADER_WIDTH }}>
        <div className="border-b border-gray-200 flex items-center justify-center text-xs text-gray-400 font-medium flex-shrink-0" style={{ height: AXIS_HEIGHT }}>
          Projects
        </div>
        <div ref={headerScrollRef} className="flex-1 min-h-0 overflow-y-auto left-panel-scroll" onScroll={handleLeftScroll}>
          <DndContext sensors={sensors} onDragEnd={handleTrackDragEnd}>
            <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tracks.map((track) => {
                const td = trackData.get(track.id);
                const laneHeight = laneHeights.get(track.id) ?? MIN_LANE_HEIGHT;
                return (
                  <TrackPanel
                    key={track.id}
                    track={track}
                    trackItems={td?.items ?? []}
                    laneHeight={laneHeight}
                    expandedItems={expandedItems}
                    toggleItem={toggleItem}
                    addingCpFor={addingCpFor}
                    setAddingCpFor={setAddingCpFor}
                    onToggleTrack={() => updateTrack(track.id, { collapsed: !track.collapsed })}
                    onDeleteTrack={() => handleDeleteTrack(track.id, track.name)}
                    onSelectItem={(id) => selectItem(id)}
                    selectedItemId={selectedItemId}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Scrollable timeline */}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleBarDragEnd}>
        <div ref={scrollRef} className="flex-1 overflow-auto timeline-scroll" onScroll={handleRightScroll}>
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Time axis */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200" style={{ height: AXIS_HEIGHT }}>
              <div className="relative h-full">
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="absolute top-0 h-full flex items-center justify-center text-xs font-medium text-gray-500 border-r border-gray-200"
                    style={{ left: col.x, width: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Track lanes */}
            <div className="relative" onClick={() => selectItem(null)}>
              {columns.map((col) => (
                <div
                  key={`grid-${col.key}`}
                  className="absolute top-0 border-r border-gray-50"
                  style={{ left: col.x, height: totalLaneHeight }}
                />
              ))}

              {todayX >= 0 && todayX <= totalWidth && (
                <div className="absolute top-0 z-10 pointer-events-none" style={{ left: todayX, height: totalLaneHeight }}>
                  <div className="w-0.5 h-full bg-red-400 opacity-60" />
                  <div className="absolute top-0 -left-3 bg-red-400 text-white text-[10px] px-1 rounded-b">Today</div>
                </div>
              )}

              {arrows.length > 0 && (
                <svg className="absolute top-0 left-0 pointer-events-none z-[5]" style={{ width: totalWidth, height: totalLaneHeight }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                    </marker>
                  </defs>
                  {arrows.map((a, i) => (
                    <DependencyArrow
                      key={i} from={a.from} to={a.to} programStart={config.startDate} zoom={zoom}
                      fromSubRow={a.fromSubRow} toSubRow={a.toSubRow}
                      fromTrackOffset={a.fromTrackOffset} toTrackOffset={a.toTrackOffset}
                      fromPitch={a.fromPitch} toPitch={a.toPitch}
                    />
                  ))}
                </svg>
              )}

              {tracks.map((track) => {
                const td = trackData.get(track.id);
                if (!td) return null;
                const laneHeight = laneHeights.get(track.id) ?? MIN_LANE_HEIGHT;
                return (
                  <TrackDropZone key={track.id} track={track} laneHeight={laneHeight}>
                    {track.collapsed ? (
                      <div className="h-full flex items-center px-1 gap-0.5">
                        {td.items.map((item) => {
                          const x = dateToX(item.start, config.startDate, zoom);
                          const w = Math.max(dateToX(item.end, config.startDate, zoom) - x, 3);
                          return (
                            <div key={item.id} className="absolute h-2 rounded-sm"
                              style={{ left: x, width: w, background: item.color, opacity: item.status === 'done' ? 0.3 : 0.6 }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      td.items.map((item) => (
                        <Bar key={item.id} item={item} programStart={config.startDate} zoom={zoom}
                          subRow={td.subRows.get(item.id) ?? 0}
                          rowHeight={trackRowPitch.get(track.id) ?? (BAR_HEIGHT + ROW_GAP)}
                          isSelected={selectedItemId === item.id}
                          onClick={() => selectItem(item.id)} onUpdate={updateItem}
                        />
                      ))
                    )}
                  </TrackDropZone>
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}
