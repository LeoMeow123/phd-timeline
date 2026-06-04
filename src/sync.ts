const SYNC_KEY = 'phd-timeline-sync-config';
const DATA_PATH = 'public/timeline-data.json';

export interface SyncConfig {
  token: string;
  owner: string;
  repo: string;
}

export function getSyncConfig(): SyncConfig | null {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null');
  } catch { return null; }
}

export function setSyncConfig(config: SyncConfig) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(config));
}

export async function loadFromCloud(config?: SyncConfig | null): Promise<any | null> {
  const cfg = config ?? getSyncConfig();

  // If we have a token, use GitHub API (instant, no Pages rebuild delay)
  if (cfg?.token) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`,
        { headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github.v3.raw' } },
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.config && data?.tracks && data?.items) return data;
      }
    } catch {}
  }

  // Fallback: fetch from GitHub Pages static file (no auth needed)
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}timeline-data.json?t=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.config && data?.tracks && data?.items) ? data : null;
  } catch { return null; }
}

export async function saveToCloud(
  data: { config: any; tracks: any; items: any },
): Promise<boolean> {
  const cfg = getSyncConfig();
  if (!cfg?.token) return false;

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  // Get current file SHA (needed for update, not needed for create)
  let sha: string | undefined;
  try {
    const res = await fetch(url, { headers });
    if (res.ok) sha = (await res.json()).sha;
  } catch {}

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Sync timeline ${new Date().toISOString().slice(0, 16)}`,
        content,
        ...(sha ? { sha } : {}),
      }),
    });
    return res.ok;
  } catch { return false; }
}
