import type { AchievementStoreState } from './achievements';
import {
  ACHIEVEMENTS_STORAGE_KEY,
  loadAchievementState,
  saveAchievementState,
} from './achievements';
import {
  LEADERBOARD_STORAGE_KEY,
  loadLeaderboard,
  saveLeaderboard,
} from './leaderboard';
import type { HangarStoreState, SavedCampaignProgress } from './rules';
import {
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  FLIGHT_SETTINGS_STORAGE_KEY,
  HANGAR_STORAGE_KEY,
  HIGH_SCORE_STORAGE_KEY,
  loadFlightControlSettings,
  loadHangarState,
  loadHighScore,
  loadSavedCampaignProgress,
  loadShipSkin,
  saveCampaignProgress,
  saveFlightControlSettings,
  saveHangarState,
  saveHighScore,
  saveShipSkin,
  SHIP_SKIN_STORAGE_KEY,
} from './rules';
import type { FlightControlSettings, LeaderboardEntry, ShipSkin } from './types';

const IDB_NAME = 'wob_offline_db_v1';
const IDB_STORE = 'kv_store';
export const SYNC_QUEUE_STORAGE_KEY = 'wob_sync_queue_v1';
export const DAILY_BEST_STORAGE_KEY = 'wob_daily_best_v1';

export interface DailyBestRecord {
  dateKey: string;
  challengeId: string;
  bestScore: number;
  bestChapter: number;
  bestEpisode: number;
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function syncAllProgressToIndexedDb(): Promise<void> {
  const highScore = loadHighScore();
  const skin = loadShipSkin(highScore);
  const hangar = loadHangarState();
  const achievements = loadAchievementState();
  const leaderboard = loadLeaderboard();
  const syncQueue = loadPendingSyncQueue();
  const dailyBest = loadDailyBestMap();
  const campaignProgress = loadSavedCampaignProgress();
  const flightSettings = loadFlightControlSettings();

  await Promise.all([
    idbSet(HIGH_SCORE_STORAGE_KEY, highScore),
    idbSet(SHIP_SKIN_STORAGE_KEY, skin),
    idbSet(HANGAR_STORAGE_KEY, hangar),
    idbSet(ACHIEVEMENTS_STORAGE_KEY, achievements),
    idbSet(LEADERBOARD_STORAGE_KEY, leaderboard),
    idbSet(SYNC_QUEUE_STORAGE_KEY, syncQueue),
    idbSet(DAILY_BEST_STORAGE_KEY, dailyBest),
    idbSet(CAMPAIGN_PROGRESS_STORAGE_KEY, campaignProgress),
    idbSet(FLIGHT_SETTINGS_STORAGE_KEY, flightSettings),
  ]);
}

export async function hydrateProgressFromIndexedDb(callbacks?: {
  onHighScore?: (score: number) => void;
  onHangar?: (state: HangarStoreState) => void;
  onAchievements?: (state: AchievementStoreState) => void;
  onLeaderboard?: (entries: LeaderboardEntry[]) => void;
  onSkin?: (skin: ShipSkin) => void;
  onCampaignProgress?: (progress: SavedCampaignProgress) => void;
  onFlightSettings?: (settings: FlightControlSettings) => void;
}): Promise<void> {
  const [
    idbHigh,
    idbSkin,
    idbHangar,
    idbAch,
    idbBoard,
    idbCampaign,
    idbFlight,
  ] = await Promise.all([
    idbGet<number>(HIGH_SCORE_STORAGE_KEY),
    idbGet<ShipSkin>(SHIP_SKIN_STORAGE_KEY),
    idbGet<HangarStoreState>(HANGAR_STORAGE_KEY),
    idbGet<AchievementStoreState>(ACHIEVEMENTS_STORAGE_KEY),
    idbGet<LeaderboardEntry[]>(LEADERBOARD_STORAGE_KEY),
    idbGet<SavedCampaignProgress>(CAMPAIGN_PROGRESS_STORAGE_KEY),
    idbGet<FlightControlSettings>(FLIGHT_SETTINGS_STORAGE_KEY),
  ]);

  const localHigh = loadHighScore();
  if (typeof idbHigh === 'number' && idbHigh > localHigh) {
    saveHighScore(idbHigh);
    callbacks?.onHighScore?.(idbHigh);
  } else if (localHigh > 0) {
    void idbSet(HIGH_SCORE_STORAGE_KEY, localHigh);
  }

  const bestHigh = Math.max(localHigh, typeof idbHigh === 'number' ? idbHigh : 0);
  if (idbSkin) {
    saveShipSkin(idbSkin);
    callbacks?.onSkin?.(loadShipSkin(bestHigh));
  }

  if (idbHangar && typeof idbHangar.scrap === 'number') {
    const localHangar = loadHangarState();
    const localTotalRanks =
      localHangar.levels.thruster +
      localHangar.levels.hull +
      localHangar.levels.overclock +
      localHangar.levels.regen;
    const idbTotalRanks =
      (idbHangar.levels?.thruster ?? 0) +
      (idbHangar.levels?.hull ?? 0) +
      (idbHangar.levels?.overclock ?? 0) +
      (idbHangar.levels?.regen ?? 0);
    if (idbTotalRanks > localTotalRanks || idbHangar.scrap > localHangar.scrap) {
      saveHangarState(idbHangar);
      callbacks?.onHangar?.(idbHangar);
    }
  }

  if (idbAch && Array.isArray(idbAch.unlockedIds)) {
    const localAch = loadAchievementState();
    if (idbAch.unlockedIds.length > localAch.unlockedIds.length) {
      saveAchievementState(idbAch);
      callbacks?.onAchievements?.(idbAch);
    }
  }

  if (Array.isArray(idbBoard) && idbBoard.length > 0) {
    const localBoard = loadLeaderboard();
    if (localBoard.length === 0 || idbBoard[0].score > (localBoard[0]?.score ?? 0)) {
      const merged = saveLeaderboard([...localBoard, ...idbBoard]);
      callbacks?.onLeaderboard?.(merged);
    }
  }

  if (idbCampaign && typeof idbCampaign.highestChapter === 'number') {
    const localCampaign = loadSavedCampaignProgress();
    if (
      idbCampaign.highestChapter > localCampaign.highestChapter ||
      idbCampaign.bankedShards > localCampaign.bankedShards
    ) {
      saveCampaignProgress(idbCampaign);
      callbacks?.onCampaignProgress?.(idbCampaign);
    }
  }

  if (idbFlight && typeof idbFlight.touchMode === 'string') {
    saveFlightControlSettings(idbFlight);
    callbacks?.onFlightSettings?.(idbFlight);
  }
}

export function loadDailyBestMap(): Record<string, DailyBestRecord> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(DAILY_BEST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function recordDailyChallengeRun(
  challengeId: string,
  score: number,
  chapter: number,
  episode: number,
  date = new Date(),
): DailyBestRecord {
  const dateKey = date.toISOString().slice(0, 10);
  const map = loadDailyBestMap();
  const existing = map[dateKey];
  const updated: DailyBestRecord = {
    dateKey,
    challengeId,
    bestScore: Math.max(score, existing?.bestScore ?? 0),
    bestChapter: Math.max(chapter, existing?.bestChapter ?? 1),
    bestEpisode: Math.max(episode, existing?.bestEpisode ?? 1),
  };
  map[dateKey] = updated;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DAILY_BEST_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage quota
  }
  void idbSet(DAILY_BEST_STORAGE_KEY, map);
  return updated;
}

export function loadPendingSyncQueue(): LeaderboardEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePendingSyncQueue(queue: LeaderboardEntry[]): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Ignore storage error
  }
  void idbSet(SYNC_QUEUE_STORAGE_KEY, queue);
}

export function enqueueLeaderboardSync(entry: LeaderboardEntry): LeaderboardEntry[] {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const queue = loadPendingSyncQueue();
  if (!isOnline) {
    const nextQueue = [...queue.filter((item) => item.id !== entry.id), { ...entry, synced: false }];
    savePendingSyncQueue(nextQueue);
    // Request Service Worker background sync when connectivity returns
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((reg) => {
          const syncReg = reg as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          };
          return syncReg.sync?.register('wob-leaderboard-sync');
        })
        .catch(() => {});
    }
    return nextQueue;
  }
  return queue;
}

export function flushLeaderboardSyncQueue(
  currentBoard: LeaderboardEntry[],
): {
  board: LeaderboardEntry[];
  flushedCount: number;
} {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    return { board: currentBoard, flushedCount: 0 };
  }
  const queue = loadPendingSyncQueue();
  if (queue.length === 0) {
    const allSynced = currentBoard.map((item) => ({ ...item, synced: true }));
    return { board: allSynced, flushedCount: 0 };
  }

  const syncedIds = new Set(queue.map((q) => q.id));
  const updatedBoard = currentBoard.map((entry) =>
    syncedIds.has(entry.id) || entry.synced === false
      ? { ...entry, synced: true }
      : { ...entry, synced: true },
  );
  saveLeaderboard(updatedBoard);
  savePendingSyncQueue([]);
  void idbSet(LEADERBOARD_STORAGE_KEY, updatedBoard);
  return { board: updatedBoard, flushedCount: queue.length };
}
