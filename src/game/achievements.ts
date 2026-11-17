export type AchievementMetric =
  | 'totalEnemiesDefeated'
  | 'totalShardsCollected'
  | 'highestChapter'
  | 'totalBossesDefeated'
  | 'totalUpgradesBought'
  | 'highestCombo'
  | 'perfectEpisodesCleared';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  metric: AchievementMetric;
  target: number;
  accentColor: string;
}

export interface AchievementProgress {
  totalEnemiesDefeated: number;
  totalShardsCollected: number;
  highestChapter: number;
  totalBossesDefeated: number;
  totalUpgradesBought: number;
  highestCombo: number;
  perfectEpisodesCleared: number;
}

export interface AchievementStoreState {
  progress: AchievementProgress;
  unlockedIds: string[];
}

export const ACHIEVEMENTS_STORAGE_KEY = 'wob_achievements_v1';

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  {
    id: 'first_kill',
    title: 'First Purge',
    description: 'Help Tommy defeat his first corrupted threat',
    metric: 'totalEnemiesDefeated',
    target: 1,
    accentColor: '#00f5d4',
  },
  {
    id: 'shard_collector_25',
    title: 'Data Harvester',
    description: 'Collect 25 Data Shards across runs',
    metric: 'totalShardsCollected',
    target: 25,
    accentColor: '#38bdf8',
  },
  {
    id: 'boss_hunter',
    title: 'Sentinel Breaker',
    description: 'Defeat a Chapter Boss or Sub-Boss',
    metric: 'totalBossesDefeated',
    target: 1,
    accentColor: '#ff007f',
  },
  {
    id: 'chapter_2',
    title: 'Chapter II Breach',
    description: 'Defeat Core Sentinel (Ep. 10) and reach Chapter 2',
    metric: 'highestChapter',
    target: 2,
    accentColor: '#a3ff12',
  },
  {
    id: 'upgrade_architect',
    title: 'Tactical Engineer',
    description: 'Install 5 upgrades for Tommy between episodes',
    metric: 'totalUpgradesBought',
    target: 5,
    accentColor: '#00f5d4',
  },
  {
    id: 'enemy_slayer_50',
    title: 'Packet Shredder',
    description: 'Defeat 50 enemies across runs',
    metric: 'totalEnemiesDefeated',
    target: 50,
    accentColor: '#ff6b35',
  },
  {
    id: 'chapter_5',
    title: 'Endless Vanguard',
    description: 'Reach Chapter 5 in the WOB Campaign',
    metric: 'highestChapter',
    target: 5,
    accentColor: '#ff007f',
  },
  {
    id: 'enemy_slayer_1000',
    title: 'Defeat 1000 Enemies',
    description: 'Neutralize 1,000 corrupted threats across all runs',
    metric: 'totalEnemiesDefeated',
    target: 1000,
    accentColor: '#a3ff12',
  },
  {
    id: 'combo_master',
    title: 'Combo Master',
    description: 'Reach a 20x combo multiplier',
    metric: 'highestCombo',
    target: 20,
    accentColor: '#ff007f',
  },
  {
    id: 'untouchable',
    title: 'Untouchable',
    description: 'Clear an episode without taking damage',
    metric: 'perfectEpisodesCleared',
    target: 1,
    accentColor: '#00f5d4',
  },
  {
    id: 'shard_hoarder',
    title: 'Shard Hoarder',
    description: 'Collect 500 Data Shards across runs',
    metric: 'totalShardsCollected',
    target: 500,
    accentColor: '#38bdf8',
  },
] as const;

export function createInitialAchievementState(): AchievementStoreState {
  return {
    progress: {
      totalEnemiesDefeated: 0,
      totalShardsCollected: 0,
      highestChapter: 1,
      totalBossesDefeated: 0,
      totalUpgradesBought: 0,
      highestCombo: 1,
      perfectEpisodesCleared: 0,
    },
    unlockedIds: [],
  };
}

export type AchievementDelta = {
  enemiesDefeated?: number;
  shardsCollected?: number;
  chapterReached?: number;
  bossesDefeated?: number;
  upgradesBought?: number;
  maxComboReached?: number;
  perfectEpisodesCleared?: number;
};

export function applyAchievementDelta(
  current: AchievementStoreState,
  delta: AchievementDelta,
): {
  nextState: AchievementStoreState;
  newlyUnlocked: AchievementDefinition[];
} {
  const nextProgress: AchievementProgress = {
    totalEnemiesDefeated:
      current.progress.totalEnemiesDefeated + Math.max(0, delta.enemiesDefeated ?? 0),
    totalShardsCollected:
      current.progress.totalShardsCollected + Math.max(0, delta.shardsCollected ?? 0),
    highestChapter: Math.max(
      current.progress.highestChapter,
      Math.max(1, delta.chapterReached ?? 1),
    ),
    totalBossesDefeated:
      current.progress.totalBossesDefeated + Math.max(0, delta.bossesDefeated ?? 0),
    totalUpgradesBought:
      current.progress.totalUpgradesBought + Math.max(0, delta.upgradesBought ?? 0),
    highestCombo: Math.max(
      current.progress.highestCombo,
      Math.max(1, delta.maxComboReached ?? 1),
    ),
    perfectEpisodesCleared:
      current.progress.perfectEpisodesCleared +
      Math.max(0, delta.perfectEpisodesCleared ?? 0),
  };

  const unlockedSet = new Set(current.unlockedIds);
  const newlyUnlocked: AchievementDefinition[] = [];

  for (const achievement of ACHIEVEMENT_CATALOG) {
    if (unlockedSet.has(achievement.id)) continue;
    if (nextProgress[achievement.metric] >= achievement.target) {
      unlockedSet.add(achievement.id);
      newlyUnlocked.push(achievement);
    }
  }

  return {
    nextState: {
      progress: nextProgress,
      unlockedIds: Array.from(unlockedSet),
    },
    newlyUnlocked,
  };
}

export function loadAchievementState(
  storage?: Pick<Storage, 'getItem'> | null,
): AchievementStoreState {
  const fallback = createInitialAchievementState();
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return fallback;
    const raw = target.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AchievementStoreState>;
    if (!parsed || typeof parsed !== 'object') return fallback;

    const p = (parsed.progress ?? {}) as Partial<AchievementProgress> & {
      highestWave?: number;
    };
    const unlockedIds = Array.isArray(parsed.unlockedIds)
      ? parsed.unlockedIds.filter((id): id is string => typeof id === 'string')
      : [];

    return {
      progress: {
        totalEnemiesDefeated: Math.max(0, Number(p.totalEnemiesDefeated) || 0),
        totalShardsCollected: Math.max(0, Number(p.totalShardsCollected) || 0),
        highestChapter: Math.max(1, Number(p.highestChapter ?? p.highestWave) || 1),
        totalBossesDefeated: Math.max(0, Number(p.totalBossesDefeated) || 0),
        totalUpgradesBought: Math.max(0, Number(p.totalUpgradesBought) || 0),
        highestCombo: Math.max(1, Number(p.highestCombo) || 1),
        perfectEpisodesCleared: Math.max(0, Number(p.perfectEpisodesCleared) || 0),
      },
      unlockedIds,
    };
  } catch {
    return fallback;
  }
}

export function saveAchievementState(
  state: AchievementStoreState,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}
