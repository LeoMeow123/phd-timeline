import { useRef, useMemo, useCallback } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';
import { parseISO, addDays, differenceInCalendarDays, format } from 'date-fns';
import { useStore } from '../store';
import { getTimeColumns, totalTimelineWidth, computeSubRows, pixelsPerDay, dateToX, snapDate } from '../utils';
import type { Track as TrackType, TimelineItem } from '../types';
import Bar from './Bar';

const HEADER_WIDTH = 200;
const AXIS_HEIGHT = 40;
const BAR_HEIGHT = 28;
const MIN_LANE_HEIGHT = 40;

function TrackDropZone({ track, children, laneHeight }: { track: TrackType; children: React.ReactNode; laneHeight: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `track-${track.id}` });
  return (
    <div
      ref={setNodeRef}
      className="relative border-b border-gray-100"
      style={{
        height: laneHeight,
        background: isOver ? `${track.color}08` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function SortableTrackHeader({
  track,
  laneHeight,
  onToggle,
  onDelete,
  itemCount,
}: {
  track: TrackType;
  laneHeight: number;
  onToggle: () => void;
  onDelete: () => void;
  itemCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const style = {
    height: laneHeight,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 flex items-center gap-2 px-3 group/track hover:bg-gray-100 transition-colors"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
        title="Drag to reorder"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" /><circle cx="7" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" /><circle cx="7" cy="13" r="1.5" />
        </svg>
      </div>
      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: track.color }} />
      <span
        className="text-sm font-medium text-gray-700 truncate cursor-pointer"
        onClick={onToggle}
      >
        {track.name}
      </span>
      <span className="text-[10px] text-gray-400">{itemCount}</span>
      <div className="ml-auto flex items-center gap-1">
        {/* Delete button */}
        <button
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover/track:opacity-100 transition-opacity p-0.5"
          title="Delete track"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
        {/* Collapse toggle */}
        <span
          className="text-xs text-gray-400 cursor-pointer px-1"
          onClick={onToggle}
        >
          {track.collapsed ? '+' : '-'}
        </span>
      </div>
    </div>
  );
}

// SVG arrow between two items
function DependencyArrow({
  from,
  to,
  programStart,
  zoom,
  fromSubRow,
  toSubRow,
  fromTrackOffset,
  toTrackOffset,
}: {
  from: TimelineItem;
  to: TimelineItem;
  programStart: string;
  zoom: string;
  fromSubRow: number;
  toSubRow: number;
  fromTrackOffset: number;
  toTrackOffset: number;
}) {
  const fromX = dateToX(from.end, programStart, zoom as any);
  const toX = dateToX(to.start, programStart, zoom as any);
  const fromY = fromTrackOffset + fromSubRow * (BAR_HEIGHT + 4) + 4 + BAR_HEIGHT / 2;
  const toY = toTrackOffset + toSubRow * (BAR_HEIGHT + 4) + 4 + BAR_HEIGHT / 2;

  const midX = (fromX + toX) / 2;

  return (
    <g>
      <path
        d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeDasharray="4 2"
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}

export default function Timeline() {
  const { config, tracks, items, zoom, selectedItemId, updateItem, selectItem, updateTrack, deleteTrack, reorderTracks } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => getTimeColumns(config.startDate, config.durationYears, zoom), [config, zoom]);
  const totalWidth = useMemo(() => totalTimelineWidth(config.startDate, config.durationYears, zoom), [config, zoom]);
  const ppd = pixelsPerDay(zoom);

  const todayX = dateToX(new Date(), config.startDate, zoom);

  // Group items by track and compute sub-rows
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

  // Compute lane heights and track Y offsets
  const { laneHeights, trackOffsets } = useMemo(() => {
    const laneHeights = new Map<string, number>();
    const trackOffsets = new Map<string, number>();
    let y = 0;
    for (const track of tracks) {
      const td = trackData.get(track.id);
      const rows = td ? td.maxRow + 1 : 1;
      const h = track.collapsed ? 24 : Math.max(MIN_LANE_HEIGHT, rows * (BAR_HEIGHT + 4) + 8);
      laneHeights.set(track.id, h);
      trackOffsets.set(track.id, y);
      y += h;
    }
    return { laneHeights, trackOffsets };
  }, [tracks, trackData]);

  // Dependency arrows data
  const arrows = useMemo(() => {
    const result: {
      from: TimelineItem; to: TimelineItem;
      fromSubRow: number; toSubRow: number;
      fromTrackOffset: number; toTrackOffset: number;
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
          from: dep,
          to: item,
          fromSubRow: fromTd.subRows.get(dep.id) ?? 0,
          toSubRow: toTd.subRows.get(item.id) ?? 0,
          fromTrackOffset: trackOffsets.get(dep.trackId) ?? 0,
          toTrackOffset: trackOffsets.get(item.trackId) ?? 0,
        });
      }
    }
    return result;
  }, [items, trackData, trackOffsets]);

  // Sensors: separate contexts for bar drag vs track reorder
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleBarDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const data = active.data.current;
    if (!data || data.type !== 'bar-move') return;

    const itemId = data.itemId as string;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const daysDelta = Math.round(delta.x / ppd);
    const newStart = snapDate(addDays(parseISO(item.start), daysDelta), zoom);
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
        if (newTrackId !== item.trackId) {
          changes.trackId = newTrackId;
        }
      }
    }

    updateItem(itemId, changes);
  };

  const handleTrackDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderTracks(oldIndex, newIndex);
    }
  }, [tracks, reorderTracks]);

  const handleScroll = () => {
    if (scrollRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  };

  const handleDeleteTrack = (trackId: string, trackName: string) => {
    if (confirm(`Delete track "${trackName}" and all its items?`)) {
      deleteTrack(trackId);
    }
  };

  const totalLaneHeight = Array.from(laneHeights.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-1 overflow-hidden bg-white border border-gray-200 rounded-lg print-timeline">
      {/* Fixed track headers with sortable reorder */}
      <div className="flex-shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: HEADER_WIDTH }}>
        <div className="border-b border-gray-200 flex items-center justify-center text-xs text-gray-400 font-medium" style={{ height: AXIS_HEIGHT }}>
          Tracks
        </div>
        <div ref={headerScrollRef} className="overflow-hidden" style={{ maxHeight: `calc(100vh - ${AXIS_HEIGHT + 120}px)` }}>
          <DndContext sensors={sensors} onDragEnd={handleTrackDragEnd}>
            <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tracks.map((track) => {
                const laneHeight = laneHeights.get(track.id) ?? MIN_LANE_HEIGHT;
                const td = trackData.get(track.id);
                return (
                  <SortableTrackHeader
                    key={track.id}
                    track={track}
                    laneHeight={laneHeight}
                    itemCount={td?.items.length ?? 0}
                    onToggle={() => updateTrack(track.id, { collapsed: !track.collapsed })}
                    onDelete={() => handleDeleteTrack(track.id, track.name)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Scrollable timeline */}
      <DndContext sensors={sensors} onDragEnd={handleBarDragEnd}>
        <div ref={scrollRef} className="flex-1 overflow-auto timeline-scroll" onScroll={handleScroll}>
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
              {/* Gridlines */}
              {columns.map((col) => (
                <div
                  key={`grid-${col.key}`}
                  className="absolute top-0 border-r border-gray-50"
                  style={{ left: col.x, height: totalLaneHeight }}
                />
              ))}

              {/* Today line */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div className="absolute top-0 z-10 pointer-events-none" style={{ left: todayX, height: totalLaneHeight }}>
                  <div className="w-0.5 h-full bg-red-400 opacity-60" />
                  <div className="absolute -top-0 -left-3 bg-red-400 text-white text-[10px] px-1 rounded-b">
                    Today
                  </div>
                </div>
              )}

              {/* Dependency arrows SVG overlay */}
              {arrows.length > 0 && (
                <svg
                  className="absolute top-0 left-0 pointer-events-none z-5"
                  style={{ width: totalWidth, height: totalLaneHeight }}
                >
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                    </marker>
                  </defs>
                  {arrows.map((a, i) => (
                    <DependencyArrow
                      key={i}
                      from={a.from}
                      to={a.to}
                      programStart={config.startDate}
                      zoom={zoom}
                      fromSubRow={a.fromSubRow}
                      toSubRow={a.toSubRow}
                      fromTrackOffset={a.fromTrackOffset}
                      toTrackOffset={a.toTrackOffset}
                    />
                  ))}
                </svg>
              )}

              {/* Lanes */}
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
                            <div
                              key={item.id}
                              className="absolute h-2 rounded-sm"
                              style={{
                                left: x, width: w, background: item.color,
                                opacity: item.status === 'done' ? 0.3 : 0.6,
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      td.items.map((item) => (
                        <Bar
                          key={item.id}
                          item={item}
                          programStart={config.startDate}
                          zoom={zoom}
                          subRow={td.subRows.get(item.id) ?? 0}
                          isSelected={selectedItemId === item.id}
                          onClick={() => selectItem(item.id)}
                          onUpdate={updateItem}
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
