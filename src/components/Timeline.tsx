import { useRef, useMemo } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
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

export default function Timeline() {
  const { config, tracks, items, zoom, selectedItemId, updateItem, selectItem, updateTrack } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => getTimeColumns(config.startDate, config.durationYears, zoom), [config, zoom]);
  const totalWidth = useMemo(() => totalTimelineWidth(config.startDate, config.durationYears, zoom), [config, zoom]);
  const ppd = pixelsPerDay(zoom);

  // Today line
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

  // dnd-kit sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const data = active.data.current;
    if (!data || data.type !== 'bar-move') return;

    const itemId = data.itemId as string;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    // Compute new dates from horizontal delta
    const daysDelta = Math.round(delta.x / ppd);
    const newStart = snapDate(addDays(parseISO(item.start), daysDelta), zoom);
    const dur = differenceInCalendarDays(parseISO(item.end), parseISO(item.start));
    const newEnd = addDays(newStart, dur);

    const changes: Partial<TimelineItem> = {
      start: format(newStart, 'yyyy-MM-dd'),
      end: format(newEnd, 'yyyy-MM-dd'),
    };

    // Cross-track drop
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

  // Sync vertical scroll between headers and content
  const handleScroll = () => {
    if (scrollRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 overflow-hidden bg-white border border-gray-200 rounded-lg">
        {/* Fixed track headers */}
        <div className="flex-shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: HEADER_WIDTH }}>
          {/* Axis spacer */}
          <div className="border-b border-gray-200 flex items-center justify-center text-xs text-gray-400 font-medium" style={{ height: AXIS_HEIGHT }}>
            Tracks
          </div>
          {/* Track headers */}
          <div ref={headerScrollRef} className="overflow-hidden" style={{ maxHeight: `calc(100vh - ${AXIS_HEIGHT + 120}px)` }}>
            {tracks.map((track) => {
              const td = trackData.get(track.id);
              const rows = td ? td.maxRow + 1 : 1;
              const laneHeight = track.collapsed
                ? 24
                : Math.max(MIN_LANE_HEIGHT, rows * (BAR_HEIGHT + 4) + 8);
              return (
                <div
                  key={track.id}
                  className="border-b border-gray-100 flex items-center gap-2 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  style={{ height: laneHeight }}
                  onClick={() => updateTrack(track.id, { collapsed: !track.collapsed })}
                >
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: track.color }} />
                  <span className="text-sm font-medium text-gray-700 truncate">{track.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{track.collapsed ? '+' : '-'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable timeline */}
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
                  className="absolute top-0 bottom-0 border-r border-gray-50"
                  style={{ left: col.x }}
                />
              ))}

              {/* Today line */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: todayX }}>
                  <div className="w-0.5 h-full bg-red-400 opacity-60" />
                  <div className="absolute -top-0 -left-3 bg-red-400 text-white text-[10px] px-1 rounded-b">
                    Today
                  </div>
                </div>
              )}

              {/* Lanes */}
              {tracks.map((track) => {
                const td = trackData.get(track.id);
                if (!td) return null;
                const rows = td.maxRow + 1;
                const laneHeight = track.collapsed
                  ? 24
                  : Math.max(MIN_LANE_HEIGHT, rows * (BAR_HEIGHT + 4) + 8);

                return (
                  <TrackDropZone key={track.id} track={track} laneHeight={laneHeight}>
                    {track.collapsed ? (
                      // Collapsed: thin summary bars
                      <div className="h-full flex items-center px-1 gap-0.5">
                        {td.items.map((item) => {
                          const x = dateToX(item.start, config.startDate, zoom);
                          const w = Math.max(dateToX(item.end, config.startDate, zoom) - x, 3);
                          return (
                            <div
                              key={item.id}
                              className="absolute h-2 rounded-sm opacity-60"
                              style={{ left: x, width: w, background: item.color }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      // Expanded: full bars
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
      </div>
    </DndContext>
  );
}
