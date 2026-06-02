import {
  parseISO, differenceInCalendarDays, addDays, startOfMonth, addMonths,
  startOfYear, addYears, format, startOfQuarter, addQuarters,
} from 'date-fns';
import type { ZoomLevel, TimelineItem } from './types';

// Pixels per time unit at each zoom level
const PX_PER_MONTH = 120;
const PX_PER_QUARTER = 200;
const PX_PER_YEAR = 300;

export function pixelsPerDay(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'months': return PX_PER_MONTH / 30;
    case 'quarters': return PX_PER_QUARTER / 91;
    case 'years': return PX_PER_YEAR / 365;
  }
}

export function dateToX(date: string | Date, programStart: string, zoom: ZoomLevel): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const start = parseISO(programStart);
  const days = differenceInCalendarDays(d, start);
  return days * pixelsPerDay(zoom);
}

export function xToDate(x: number, programStart: string, zoom: ZoomLevel): Date {
  const start = parseISO(programStart);
  const days = Math.round(x / pixelsPerDay(zoom));
  return addDays(start, days);
}

export function snapDate(date: Date, zoom: ZoomLevel): Date {
  switch (zoom) {
    case 'months': {
      const ms = startOfMonth(date);
      const mid = addDays(ms, 15);
      return date >= mid ? startOfMonth(addMonths(date, 1)) : ms;
    }
    case 'quarters': {
      const qs = startOfQuarter(date);
      const mid = addDays(qs, 45);
      return date >= mid ? startOfQuarter(addQuarters(date, 1)) : qs;
    }
    case 'years': {
      const ys = startOfYear(date);
      const mid = addDays(ys, 182);
      return date >= mid ? startOfYear(addYears(date, 1)) : ys;
    }
  }
}

export interface TimeColumn {
  key: string;
  label: string;
  x: number;
  width: number;
}

export function getTimeColumns(
  programStart: string, durationYears: number, zoom: ZoomLevel,
): TimeColumn[] {
  const start = parseISO(programStart);
  const ppd = pixelsPerDay(zoom);
  const cols: TimeColumn[] = [];

  switch (zoom) {
    case 'months': {
      let cur = startOfMonth(start);
      const end = addYears(start, durationYears);
      while (cur < end) {
        const next = addMonths(cur, 1);
        const x = differenceInCalendarDays(cur, start) * ppd;
        const w = differenceInCalendarDays(next, cur) * ppd;
        cols.push({ key: format(cur, 'yyyy-MM'), label: format(cur, 'MMM yyyy'), x, width: w });
        cur = next;
      }
      break;
    }
    case 'quarters': {
      let cur = startOfQuarter(start);
      const end = addYears(start, durationYears);
      while (cur < end) {
        const next = addQuarters(cur, 1);
        const x = differenceInCalendarDays(cur, start) * ppd;
        const w = differenceInCalendarDays(next, cur) * ppd;
        const q = Math.ceil((cur.getMonth() + 1) / 3);
        cols.push({ key: format(cur, 'yyyy') + '-Q' + q, label: `Q${q} ${format(cur, 'yyyy')}`, x, width: w });
        cur = next;
      }
      break;
    }
    case 'years': {
      let cur = startOfYear(start);
      const end = addYears(start, durationYears + 1);
      let yearNum = 0;
      while (cur < end) {
        yearNum++;
        const next = addYears(cur, 1);
        const x = differenceInCalendarDays(cur, start) * ppd;
        const w = differenceInCalendarDays(next, cur) * ppd;
        cols.push({ key: format(cur, 'yyyy'), label: `Year ${yearNum} (${format(cur, 'yyyy')})`, x, width: w });
        cur = next;
      }
      break;
    }
  }
  return cols;
}

export function totalTimelineWidth(programStart: string, durationYears: number, zoom: ZoomLevel): number {
  const start = parseISO(programStart);
  const end = addYears(start, durationYears);
  return differenceInCalendarDays(end, start) * pixelsPerDay(zoom);
}

// Compute sub-row indices for overlapping items within a track
export function computeSubRows(items: TimelineItem[]): Map<string, number> {
  const result = new Map<string, number>();
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start));
  // rows[i] = end date of last item in sub-row i
  const rows: string[] = [];

  for (const item of sorted) {
    let placed = false;
    for (let r = 0; r < rows.length; r++) {
      if (item.start >= rows[r]) {
        rows[r] = item.end;
        result.set(item.id, r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      result.set(item.id, rows.length);
      rows.push(item.end);
    }
  }
  return result;
}

export function formatDateShort(d: string): string {
  return format(parseISO(d), 'MMM d, yyyy');
}
