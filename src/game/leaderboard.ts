import { EPISODES_PER_CHAPTER } from './rules';
import type { GameMode, LeaderboardEntry, RunSummary } from './types';

export const LEADERBOARD_STORAGE_KEY = 'wob_leaderboard_v1';
export const MAX_LEADERBOARD_ENTRIES = 10;

export function sanitizeInitials(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  return cleaned.length > 0 ? cleaned : 'TMY';
}

export function sortLeaderboard(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.chapterReached !== a.chapterReached) {
        return b.chapterReached - a.chapterReached;
      }
      if (b.episodeReached !== a.episodeReached) {
        return b.episodeReached - a.episodeReached;
      }
      return b.dateIso.localeCompare(a.dateIso);
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function qualifiesForLeaderboard(
  score: number,
  entries: readonly LeaderboardEntry[],
): boolean {
  const cleanScore = Math.max(0, Math.round(score));
  if (cleanScore <= 0) return false;
  const sorted = sortLeaderboard(entries);
  if (sorted.length < MAX_LEADERBOARD_ENTRIES) return true;
  return cleanScore > sorted[sorted.length - 1].score;
}

export function getProjectedRank(
  score: number,
  entries: readonly LeaderboardEntry[],
): number {
  const cleanScore = Math.max(0, Math.round(score));
  const sorted = sortLeaderboard(entries);
  let rank = 1;
  for (const entry of sorted) {
    if (cleanScore > entry.score) break;
    rank++;
  }
  return rank;
}

export function insertLeaderboardEntry(
  entries: readonly LeaderboardEntry[],
  input: {
    initials: string;
    score: number;
    chapterReached: number;
    episodeReached: number;
    maxCombo: number;
    mode?: GameMode;
    dateIso?: string;
  },
): LeaderboardEntry[] {
  const cleanScore = Math.max(0, Math.round(input.score));
  const entry: LeaderboardEntry = {
    id: `wob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    initials: sanitizeInitials(input.initials),
    score: cleanScore,
    chapterReached: Math.max(1, Math.round(input.chapterReached)),
    episodeReached: Math.max(
      1,
      Math.min(EPISODES_PER_CHAPTER, Math.round(input.episodeReached)),
    ),
    maxCombo: Math.max(1, Math.round(input.maxCombo)),
    mode: input.mode ?? 'campaign',
    dateIso: input.dateIso ?? new Date().toISOString(),
  };

  return sortLeaderboard([...entries, entry]);
}

export function loadLeaderboard(
  storage?: Pick<Storage, 'getItem'> | null,
): LeaderboardEntry[] {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return [];
    const raw = target.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const valid: LeaderboardEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Partial<LeaderboardEntry> & { waveReached?: number };
      const score = Number(obj.score);
      if (!Number.isFinite(score) || score <= 0) continue;
      valid.push({
        id: typeof obj.id === 'string' ? obj.id : `legacy-${valid.length}`,
        initials: sanitizeInitials(
          typeof obj.initials === 'string' ? obj.initials : 'TMY',
        ),
        score: Math.round(score),
        chapterReached: Math.max(1, Math.round(Number(obj.chapterReached) || 1)),
        episodeReached: Math.max(
          1,
          Math.min(
            EPISODES_PER_CHAPTER,
            Math.round(Number(obj.episodeReached ?? obj.waveReached) || 1),
          ),
        ),
        maxCombo: Math.max(1, Math.round(Number(obj.maxCombo) || 1)),
        mode: obj.mode ?? 'campaign',
        dateIso:
          typeof obj.dateIso === 'string'
            ? obj.dateIso
            : new Date(0).toISOString(),
      });
    }
    return sortLeaderboard(valid);
  } catch {
    return [];
  }
}

export function saveLeaderboard(
  entries: readonly LeaderboardEntry[],
  storage?: Pick<Storage, 'setItem'> | null,
): LeaderboardEntry[] {
  const sorted = sortLeaderboard(entries);
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (target) {
      target.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(sorted));
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
  return sorted;
}

export function formatLeaderboardDate(dateIso: string): string {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShareRunText(summary: RunSummary): string {
  return `⚡ WOB | Score: ${summary.score.toLocaleString()} | Chapter ${summary.chapterReached} · Episode ${summary.episodeReached}/${EPISODES_PER_CHAPTER} | Max Combo: ${summary.maxCombo}x | Beat my score!`;
}
