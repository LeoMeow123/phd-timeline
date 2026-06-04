import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format, addMonths } from 'date-fns';
import type { AppState, Track, TimelineItem, ProgramConfig } from './types';
import { COLORS } from './types';

let _id = 0;
const uid = () => `id-${Date.now()}-${++_id}`;

function seedData(): { config: ProgramConfig; tracks: Track[]; items: TimelineItem[] } {
  const start = new Date('2026-10-01');
  const d = (monthsFromStart: number) => format(addMonths(start, monthsFromStart), 'yyyy-MM-dd');

  const tracks: Track[] = [
    { id: 'setup', name: 'Setup', color: '#6366f1', collapsed: false },
    { id: 'tmaze', name: 'T-maze', color: '#3b82f6', collapsed: false },
    { id: 'lcaav', name: 'LC-AAV', color: '#06b6d4', collapsed: false },
    { id: 'hcm', name: 'Home-cage monitoring', color: '#10b981', collapsed: false },
    { id: 'drinking', name: 'Drinking branch', color: '#f59e0b', collapsed: false },
    { id: 'multiomics', name: 'Multiomics', color: '#8b5cf6', collapsed: false },
    { id: 'als', name: 'ALS', color: '#ec4899', collapsed: false },
    { id: 'milestones', name: 'Milestones', color: '#ef4444', collapsed: false },
  ];

  const items: TimelineItem[] = [
    {
      id: uid(), trackId: 'setup', name: 'Build 60 cages + tune cameras/model',
      start: d(0), end: d(3), color: '#6366f1', type: 'phase', status: 'in-progress',
      checkpoints: [
        { id: uid(), label: 'First 20 cages wired', date: d(1), done: false },
        { id: uid(), label: 'Camera calibration done', date: d(2), done: false },
      ],
    },
    { id: uid(), trackId: 'tmaze', name: 'Submit T-maze paper', start: d(2), end: d(2), color: '#3b82f6', type: 'milestone', status: 'planned' },
    {
      id: uid(), trackId: 'tmaze', name: 'Add +3mo / +24mo timepoints',
      start: d(3), end: d(9), color: '#3b82f6', type: 'phase', status: 'planned',
      checkpoints: [
        { id: uid(), label: '3mo cohort complete', date: d(5), done: false },
        { id: uid(), label: '24mo cohort complete', date: d(8), done: false },
        { id: uid(), label: 'Analysis & figures', date: d(9), done: false },
      ],
    },
    { id: uid(), trackId: 'lcaav', name: 'LC enhancement study', start: d(8), end: d(16), color: '#06b6d4', type: 'branch-paper', status: 'planned' },
    { id: uid(), trackId: 'hcm', name: '3mo WT baseline', start: d(1), end: d(4), color: '#10b981', type: 'phase', status: 'planned' },
    { id: uid(), trackId: 'hcm', name: 'WT + Tau recording 3-12mo (n=120)', start: d(4), end: d(28), color: '#10b981', type: 'phase', status: 'planned' },
    { id: uid(), trackId: 'hcm', name: 'CNS #1 — early detection', start: d(30), end: d(30), color: '#10b981', type: 'decision-gate', status: 'planned' },
    { id: uid(), trackId: 'drinking', name: 'HY thirst gene + drinking (new PhD lead)', start: d(14), end: d(26), color: '#f59e0b', type: 'branch-paper', status: 'planned' },
    { id: uid(), trackId: 'multiomics', name: 'snRNA+snATAC analysis 1.24M cells', start: d(6), end: d(34), color: '#8b5cf6', type: 'phase', status: 'planned' },
    { id: uid(), trackId: 'multiomics', name: 'CNS #2 — divergence-not-acceleration', start: d(40), end: d(40), color: '#8b5cf6', type: 'milestone', status: 'planned' },
    { id: uid(), trackId: 'als', name: 'Co-author, shared pipeline', start: d(4), end: d(14), color: '#ec4899', type: 'phase', status: 'planned' },
    { id: uid(), trackId: 'milestones', name: 'Defense / graduate', start: d(46), end: d(46), color: '#ef4444', type: 'milestone', status: 'planned' },
  ];

  return {
    config: { startDate: '2026-10-01', durationYears: 4 },
    tracks,
    items,
  };
}

export const useStore = create<AppState>()(
  persist(
    (set) => {
      const seed = seedData();
      return {
        config: seed.config,
        tracks: seed.tracks,
        items: seed.items,
        zoom: 'quarters' as const,
        selectedItemId: null,

        setZoom: (zoom) => set({ zoom }),
        setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),

        addTrack: (t) => set((s) => ({
          tracks: [...s.tracks, { ...t, id: uid(), collapsed: false }],
        })),
        updateTrack: (id, t) => set((s) => ({
          tracks: s.tracks.map((tr) => (tr.id === id ? { ...tr, ...t } : tr)),
        })),
        deleteTrack: (id) => set((s) => ({
          tracks: s.tracks.filter((tr) => tr.id !== id),
          items: s.items.filter((i) => i.trackId !== id),
        })),
        reorderTracks: (fromIndex, toIndex) => set((s) => {
          const newTracks = [...s.tracks];
          const [moved] = newTracks.splice(fromIndex, 1);
          newTracks.splice(toIndex, 0, moved);
          return { tracks: newTracks };
        }),

        addItem: (i) => set((s) => ({
          items: [...s.items, { ...i, id: uid() }],
        })),
        updateItem: (id, i) => set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, ...i } : it)),
        })),
        deleteItem: (id) => set((s) => ({
          items: s.items.filter((it) => it.id !== id),
          selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
        })),

        selectItem: (id) => set({ selectedItemId: id }),

        addCheckpoint: (itemId, label, date) => set((s) => ({
          items: s.items.map((it) =>
            it.id === itemId
              ? { ...it, checkpoints: [...(it.checkpoints ?? []), { id: uid(), label, date, done: false }] }
              : it,
          ),
        })),
        updateCheckpoint: (itemId, cpId, changes) => set((s) => ({
          items: s.items.map((it) =>
            it.id === itemId
              ? { ...it, checkpoints: (it.checkpoints ?? []).map((cp) => cp.id === cpId ? { ...cp, ...changes } : cp) }
              : it,
          ),
        })),
        deleteCheckpoint: (itemId, cpId) => set((s) => ({
          items: s.items.map((it) =>
            it.id === itemId
              ? { ...it, checkpoints: (it.checkpoints ?? []).filter((cp) => cp.id !== cpId) }
              : it,
          ),
        })),

        importState: (data) => set({
          config: data.config,
          tracks: data.tracks,
          items: data.items,
          selectedItemId: null,
        }),
      };
    },
    {
      name: 'phd-timeline-storage',
      version: 2,
      migrate: (persisted: any, version: number) => {
        // Upgrade old data: ensure all items have status + checkpoints fields
        if (persisted && persisted.items) {
          persisted.items = persisted.items.map((item: any) => ({
            ...item,
            status: item.status ?? 'planned',
            checkpoints: item.checkpoints ?? [],
          }));
        }
        return persisted;
      },
    },
  ),
);
