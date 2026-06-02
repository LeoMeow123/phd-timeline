export type ItemType = 'phase' | 'milestone' | 'branch-paper' | 'decision-gate';
export type ItemStatus = 'planned' | 'in-progress' | 'done';
export type ZoomLevel = 'years' | 'quarters' | 'months' | 'weeks';

export interface TimelineItem {
  id: string;
  trackId: string;
  name: string;
  start: string;   // ISO date YYYY-MM-DD
  end: string;      // ISO date (== start for milestones)
  color: string;
  type: ItemType;
  status: ItemStatus;
  note?: string;
  dependsOn?: string[];
}

export interface Track {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
}

export interface ProgramConfig {
  startDate: string;
  durationYears: number;
}

export interface AppState {
  config: ProgramConfig;
  tracks: Track[];
  items: TimelineItem[];
  zoom: ZoomLevel;
  selectedItemId: string | null;
  setZoom: (z: ZoomLevel) => void;
  setConfig: (c: Partial<ProgramConfig>) => void;
  addTrack: (t: Omit<Track, 'id' | 'collapsed'>) => void;
  updateTrack: (id: string, t: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  addItem: (i: Omit<TimelineItem, 'id'>) => void;
  updateItem: (id: string, i: Partial<TimelineItem>) => void;
  deleteItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  importState: (data: { config: ProgramConfig; tracks: Track[]; items: TimelineItem[] }) => void;
}

export const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];
