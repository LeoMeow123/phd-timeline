import {
  parseISO, differenceInCalendarDays, addDays, startOfMonth, addMonths,
  startOfYear, addYears, format,
  startOfWeek, addWeeks,
} from 'date-fns';
import type { ZoomLevel, TimelineItem } from './types';

// Trimester helpers (3 quarters per year, 4 months each)
function startOfTrimester(date: Date): Date {
  const m = date.getMonth(); // 0-11
  const tMonth = m - (m % 4);       // 0, 4, 8
  return new Date(date.getFullYear(), tMonth, 1);
}
function addTrimesters(date: Date, n: number): Date {
  return addMonths(date, n * 4);
}
function trimesterIndex(date: Date): number {
  return Math.floor(date.getMonth() / 4) + 1; // 1, 2, 3
}

// Pixels per time unit at each zoom level
const PX_PER_WEEK = 120;
const PX_PER_MONTH = 120;
const PX_PER_QUARTER = 260; // 4 months per trimester
const PX_PER_YEAR = 300;

export function pixelsPerDay(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'weeks': return PX_PER_WEEK / 7;
    case 'months': return PX_PER_MONTH / 30;
    case 'quarters': return PX_PER_QUARTER / 122; // ~4 months
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
    case 'weeks': {
      const ws = startOfWeek(date, { weekStartsOn: 1 });
      const mid = addDays(ws, 3);
      return date >= mid ? startOfWeek(addWeeks(date, 1), { weekStartsOn: 1 }) : ws;
    }
    case 'months': {
      const ms = startOfMonth(date);
      const mid = addDays(ms, 15);
      return date >= mid ? startOfMonth(addMonths(date, 1)) : ms;
    }
    case 'quarters': {
      const qs = startOfTrimester(date);
      const mid = addDays(qs, 60); // midpoint of 4-month block
      return date >= mid ? startOfTrimester(addTrimesters(date, 1)) : qs;
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
    case 'weeks': {
      let cur = startOfWeek(start, { weekStartsOn: 1 });
      const end = addYears(start, durationYears);
      while (cur < end) {
        const next = addWeeks(cur, 1);
        const x = differenceInCalendarDays(cur, start) * ppd;
        const w = differenceInCalendarDays(next, cur) * ppd;
        cols.push({ key: format(cur, 'yyyy-ww'), label: format(cur, 'MMM d'), x, width: w });
        cur = next;
      }
      break;
    }
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
      let cur = startOfTrimester(start);
      const end = addYears(start, durationYears);
      while (cur < end) {
        const next = addTrimesters(cur, 1);
        const x = differenceInCalendarDays(cur, start) * ppd;
        const w = differenceInCalendarDays(next, cur) * ppd;
        const q = trimesterIndex(cur);
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

// Compute row indices for checkpoint labels so overlapping ones stack vertically
// Returns map of cpId → row, plus maxRow count
import type { Checkpoint } from './types';

const CP_LABEL_CHAR_PX = 4.5;  // approx px per char at font-size 8
const CP_LABEL_PAD = 16;       // tick width + margin

export function computeCheckpointRows(
  checkpoints: Checkpoint[],
  barLeft: number,
  programStart: string,
  zoom: ZoomLevel,
): { rows: Map<string, number>; maxRow: number } {
  const result = new Map<string, number>();
  if (!checkpoints.length) return { rows: result, maxRow: 0 };

  // Compute x position and estimated label width for each checkpoint
  const items = checkpoints
    .map((cp) => {
      const x = dateToX(cp.date, programStart, zoom) - barLeft;
      const labelWidth = cp.label.length * CP_LABEL_CHAR_PX + CP_LABEL_PAD;
      return { id: cp.id, x, right: x + labelWidth };
    })
    .sort((a, b) => a.x - b.x);

  // Greedy row assignment — same as computeSubRows but using pixel ranges
  const rowEnds: number[] = []; // rightmost x of last label placed in each row

  for (const item of items) {
    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (item.x >= rowEnds[r]) {
        rowEnds[r] = item.right;
        result.set(item.id, r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      result.set(item.id, rowEnds.length);
      rowEnds.push(item.right);
    }
  }

  return { rows: result, maxRow: rowEnds.length };
}

// Returns 'white' or '#1e293b' based on background luminance
export function textColorForBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1e293b' : 'white';
}
