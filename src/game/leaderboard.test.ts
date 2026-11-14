import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatShareRunText,
  getProjectedRank,
  insertLeaderboardEntry,
  loadLeaderboard,
  MAX_LEADERBOARD_ENTRIES,
  qualifiesForLeaderboard,
  sanitizeInitials,
  saveLeaderboard,
} from './leaderboard';

test('sanitizeInitials normalizes uppercase alphanumeric 3-letter tags', () => {
  assert.equal(sanitizeInitials('tmy'), 'TMY');
  assert.equal(sanitizeInitials('a1-b9'), 'A1B');
  assert.equal(sanitizeInitials('   '), 'TMY');
});

test('leaderboard enforces Top 10 sorting, qualification, and persistence', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  let board = loadLeaderboard(mockStorage);
  assert.equal(board.length, 0);
  assert.equal(qualifiesForLeaderboard(0, board), false);
  assert.equal(qualifiesForLeaderboard(100, board), true);

  for (let i = 1; i <= 12; i++) {
    board = insertLeaderboardEntry(board, {
      initials: `P${i}`,
      score: i * 1000,
      chapterReached: Math.ceil(i / 4),
      episodeReached: ((i - 1) % 10) + 1,
      maxCombo: Math.min(10, i),
      dateIso: `2026-11-13T00:00:${String(i).padStart(2, '0')}.000Z`,
    });
  }

  assert.equal(board.length, MAX_LEADERBOARD_ENTRIES);
  assert.equal(board[0].score, 12000);
  assert.equal(board[9].score, 3000);

  assert.equal(qualifiesForLeaderboard(2500, board), false);
  assert.equal(qualifiesForLeaderboard(3500, board), true);
  assert.equal(getProjectedRank(15000, board), 1);

  saveLeaderboard(board, mockStorage);
  const reloaded = loadLeaderboard(mockStorage);
  assert.equal(reloaded.length, 10);
  assert.equal(reloaded[0].initials, 'P12');
  assert.equal(reloaded[0].chapterReached, 3);
});

test('formatShareRunText produces crisp WOB summary with Chapter and Episode', () => {
  const text = formatShareRunText({
    mode: 'campaign',
    score: 14200,
    highScore: 14200,
    isNewHighScore: true,
    qualifiesForLeaderboard: true,
    chapterReached: 2,
    episodeReached: 7,
    chaptersCleared: 1,
    defeatedByBoss10: false,
    enemiesDefeated: 120,
    bossesDefeated: 2,
    shardsCollected: 88,
    maxCombo: 10,
    survivalSeconds: 320,
  });
  assert.equal(
    text,
    '⚡ WOB | Score: 14,200 | Chapter 2 · Episode 7/10 | Max Combo: 10x | Beat my score!',
  );
});
