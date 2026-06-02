import { useRef, useState, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';
import type { TimelineItem, ZoomLevel } from '../types';
import { pixelsPerDay, snapDate, dateToX } from '../utils';

const BAR_HEIGHT = 28;
const MILESTONE_SIZE = 20;
const HANDLE_WIDTH = 8;

interface BarProps {
  item: TimelineItem;
  programStart: string;
  zoom: ZoomLevel;
  subRow: number;
  isSelected: boolean;
  onClick: () => void;
  onUpdate: (id: string, changes: Partial<TimelineItem>) => void;
}

export default function Bar({ item, programStart, zoom, subRow, isSelected, onClick, onUpdate }: BarProps) {
  const ppd = pixelsPerDay(zoom);
  const isMilestone = item.type === 'milestone' || item.type === 'decision-gate';

  const baseLeft = dateToX(item.start, programStart, zoom);
  const baseRight = dateToX(item.end, programStart, zoom);
  const baseWidth = Math.max(baseRight - baseLeft, isMilestone ? 0 : 4);

  // Resize state (pointer events for handles)
  const [resizeDelta, setResizeDelta] = useState<{ side: 'left' | 'right'; dx: number } | null>(null);

  // Compute visual position (incorporating resize preview)
  let left = baseLeft;
  let width = baseWidth;
  if (resizeDelta) {
    if (resizeDelta.side === 'left') {
      left = baseLeft + resizeDelta.dx;
      width = baseWidth - resizeDelta.dx;
    } else {
      width = baseWidth + resizeDelta.dx;
    }
    if (width < 4) width = 4;
  }

  const top = subRow * (BAR_HEIGHT + 4) + 4;

  // dnd-kit draggable for body movement
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bar-${item.id}`,
    data: { type: 'bar-move', itemId: item.id, trackId: item.trackId },
  });

  // Snap transform to grid
  let dragOffsetX = 0;
  if (isDragging && transform) {
    const daysDelta = Math.round(transform.x / ppd);
    const snappedDate = snapDate(addDays(parseISO(item.start), daysDelta), zoom);
    dragOffsetX = differenceInCalendarDays(snappedDate, parseISO(item.start)) * ppd;
  }

  // Resize handles via pointer events
  const startResize = useCallback((e: React.PointerEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (me: PointerEvent) => {
      setResizeDelta({ side, dx: me.clientX - startX });
    };
    const onUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const dx = ue.clientX - startX;
      const daysDelta = Math.round(dx / ppd);
      if (side === 'left') {
        const newStart = snapDate(addDays(parseISO(item.start), daysDelta), zoom);
        if (newStart <= parseISO(item.end)) {
          onUpdate(item.id, { start: format(newStart, 'yyyy-MM-dd') });
        }
      } else {
        const newEnd = snapDate(addDays(parseISO(item.end), daysDelta), zoom);
        if (newEnd >= parseISO(item.start)) {
          onUpdate(item.id, { end: format(newEnd, 'yyyy-MM-dd') });
        }
      }
      setResizeDelta(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [item, ppd, zoom, onUpdate]);

  // Tooltip text
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Compute preview dates for tooltip during drag
  let previewStart = item.start;
  let previewEnd = item.end;
  if (isDragging && transform) {
    const daysDelta = Math.round(transform.x / ppd);
    const s = snapDate(addDays(parseISO(item.start), daysDelta), zoom);
    const dur = differenceInCalendarDays(parseISO(item.end), parseISO(item.start));
    previewStart = format(s, 'yyyy-MM-dd');
    previewEnd = format(addDays(s, dur), 'yyyy-MM-dd');
  }
  if (resizeDelta) {
    if (resizeDelta.side === 'left') {
      const s = snapDate(addDays(parseISO(item.start), Math.round(resizeDelta.dx / ppd)), zoom);
      previewStart = format(s, 'yyyy-MM-dd');
    } else {
      const e = snapDate(addDays(parseISO(item.end), Math.round(resizeDelta.dx / ppd)), zoom);
      previewEnd = format(e, 'yyyy-MM-dd');
    }
  }

  if (isMilestone) {
    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="absolute cursor-grab active:cursor-grabbing group"
        style={{
          left: left + dragOffsetX - MILESTONE_SIZE / 2,
          top: top + (BAR_HEIGHT - MILESTONE_SIZE) / 2,
          zIndex: isDragging ? 100 : isSelected ? 50 : 1,
          opacity: isDragging ? 0.85 : 1,
        }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Diamond */}
        <div
          className="transition-shadow"
          style={{
            width: MILESTONE_SIZE,
            height: MILESTONE_SIZE,
            background: item.color,
            transform: 'rotate(45deg)',
            borderRadius: 3,
            boxShadow: isSelected ? `0 0 0 3px ${item.color}40` : undefined,
          }}
        />
        {/* Label */}
        <div
          className="absolute whitespace-nowrap text-xs font-medium text-gray-700 pointer-events-none"
          style={{ left: MILESTONE_SIZE + 4, top: 0, lineHeight: `${MILESTONE_SIZE}px` }}
        >
          {item.name}
        </div>
        {/* Tooltip */}
        {(showTooltip || isDragging) && (
          <div ref={tooltipRef} className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
            {format(parseISO(previewStart), 'MMM d, yyyy')}
          </div>
        )}
      </div>
    );
  }

  const typeLabel = item.type === 'branch-paper' ? 'Branch paper' : item.type === 'decision-gate' ? 'Decision gate' : '';
  const barStyle = item.type === 'branch-paper'
    ? { background: `repeating-linear-gradient(135deg, ${item.color}, ${item.color} 4px, ${item.color}cc 4px, ${item.color}cc 8px)` }
    : { background: item.color };

  return (
    <div
      ref={setNodeRef}
      className="absolute group"
      style={{
        left: left + dragOffsetX,
        top,
        width: Math.max(width, 4),
        height: BAR_HEIGHT,
        zIndex: isDragging ? 100 : isSelected ? 50 : 1,
        opacity: isDragging ? 0.85 : 1,
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Bar body (draggable) */}
      <div
        {...attributes}
        {...listeners}
        className="w-full h-full rounded-md cursor-grab active:cursor-grabbing transition-shadow overflow-hidden flex items-center px-2"
        style={{
          ...barStyle,
          boxShadow: isSelected ? `0 0 0 3px ${item.color}40, 0 2px 4px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.08)',
        }}
      >
        <span className="text-white text-xs font-medium truncate drop-shadow-sm select-none">
          {item.name}
        </span>
      </div>

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 h-full cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: HANDLE_WIDTH }}
        onPointerDown={(e) => startResize(e, 'left')}
      >
        <div className="w-1 h-3 bg-white/80 rounded-full absolute left-1 top-1/2 -translate-y-1/2" />
      </div>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 h-full cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: HANDLE_WIDTH }}
        onPointerDown={(e) => startResize(e, 'right')}
      >
        <div className="w-1 h-3 bg-white/80 rounded-full absolute right-1 top-1/2 -translate-y-1/2" />
      </div>

      {/* Tooltip */}
      {(showTooltip || isDragging || resizeDelta) && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
          {format(parseISO(previewStart), 'MMM d')} – {format(parseISO(previewEnd), 'MMM d, yyyy')}
          {typeLabel && <span className="ml-1 opacity-70">({typeLabel})</span>}
        </div>
      )}
    </div>
  );
}
