import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS_STORAGE_KEY,
  applyAchievementDelta,
  createInitialAchievementState,
  loadAchievementState,
  saveAchievementState,
} from './achievements';

test('applyAchievementDelta unlocks first_kill and avoids duplicate unlocks', () => {
  const initial = createInitialAchievementState();
  const step1 = applyAchievementDelta(initial, { enemiesDefeated: 1 });
  assert.equal(step1.newlyUnlocked.length, 1);
  assert.equal(step1.newlyUnlocked[0]?.id, 'first_kill');
  assert.equal(step1.nextState.progress.totalEnemiesDefeated, 1);

  const step2 = applyAchievementDelta(step1.nextState, { enemiesDefeated: 1 });
  assert.equal(step2.newlyUnlocked.length, 0);
  assert.equal(step2.nextState.progress.totalEnemiesDefeated, 2);
});

test('applyAchievementDelta unlocks Chapter 2, Chapter 5, and Defeat 1000 Enemies milestones', () => {
  let state = createInitialAchievementState();
  const chRes = applyAchievementDelta(state, { chapterReached: 5 });
  state = chRes.nextState;
  const chIds = chRes.newlyUnlocked.map((a) => a.id);
  assert.ok(chIds.includes('chapter_2'));
  assert.ok(chIds.includes('chapter_5'));

  const killRes = applyAchievementDelta(state, { enemiesDefeated: 1000 });
  const killIds = killRes.newlyUnlocked.map((a) => a.id);
  assert.ok(killIds.includes('enemy_slayer_50'));
  assert.ok(killIds.includes('enemy_slayer_1000'));
});

test('combo, perfect-clear, and shard-hoarder milestones unlock from their progress', () => {
  const result = applyAchievementDelta(createInitialAchievementState(), {
    maxComboReached: 20,
    perfectEpisodesCleared: 1,
    shardsCollected: 500,
  });
  const ids = result.newlyUnlocked.map((achievement) => achievement.id);

  assert.ok(ids.includes('combo_master'));
  assert.ok(ids.includes('untouchable'));
  assert.ok(ids.includes('shard_hoarder'));
});

test('achievement state persists cleanly to storage and handles malformed data', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  const base = createInitialAchievementState();
  const updated = applyAchievementDelta(base, {
    enemiesDefeated: 12,
    shardsCollected: 25,
    bossesDefeated: 1,
  }).nextState;

  saveAchievementState(updated, mockStorage);
  const reloaded = loadAchievementState(mockStorage);
  assert.equal(reloaded.progress.totalEnemiesDefeated, 12);
  assert.equal(reloaded.progress.totalShardsCollected, 25);
  assert.ok(reloaded.unlockedIds.includes('first_kill'));
  assert.ok(reloaded.unlockedIds.includes('shard_collector_25'));
  assert.ok(reloaded.unlockedIds.includes('boss_hunter'));

  mem.set(ACHIEVEMENTS_STORAGE_KEY, '{bad json');
  const safe = loadAchievementState(mockStorage);
  assert.equal(safe.progress.totalEnemiesDefeated, 0);
  assert.deepEqual(safe.unlockedIds, []);
});
