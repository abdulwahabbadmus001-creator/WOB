import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCampaignProgress,
  advanceComboStreak,
  applyIncomingDamage,
  applyUpgradePurchase,
  buildRunSummary,
  canPurchaseUpgrade,
  clampDeltaTime,
  COMBO_WINDOW_SECONDS,
  computeChapterBossConfig,
  computeComboRewards,
  computeEpisodeConfig,
  computePlayerStats,
  createInitialUpgrades,
  EMP_COOLDOWN_SECONDS,
  EMP_STUN_SECONDS,
  EPISODES_PER_CHAPTER,
  getUpgradeCost,
  getDailyChallenge,
  isShipSkinUnlocked,
  loadShipSkin,
  saveShipSkin,
  SHIP_SKIN_STORAGE_KEY,
  loadHighScore,
  MAX_COMBO_MULTIPLIER,
  pickEnemyKind,
  POLLY_ASSIST_COOLDOWN,
  POLLY_ASSIST_DURATION,
  POLLY_AUTO_ENEMY_THRESHOLD,
  resolveEpisodeDefeat,
  saveHighScore,
  TACTICAL_SHIELD_COOLDOWN,
  TACTICAL_SHIELD_DURATION,
} from './rules';

test('upgrade cost and purchase flow deduct shards and cap at maxLevel', () => {
  const upgrades = createInitialUpgrades();
  const speedCost0 = getUpgradeCost('speed', 0);
  assert.equal(speedCost0, 8);
  assert.equal(canPurchaseUpgrade('speed', upgrades, 7), false);
  assert.equal(canPurchaseUpgrade('speed', upgrades, 8), true);

  const first = applyUpgradePurchase('speed', upgrades, 20);
  assert.equal(first.purchased, true);
  assert.equal(first.upgrades.speed, 1);
  assert.equal(first.shards, 12);

  // Max out multishot (maxLevel = 4)
  let current = createInitialUpgrades();
  let shards = 500;
  for (let i = 0; i < 4; i++) {
    const res = applyUpgradePurchase('multishot', current, shards);
    assert.equal(res.purchased, true);
    current = res.upgrades;
    shards = res.shards;
  }
  assert.equal(current.multishot, 4);
  const blocked = applyUpgradePurchase('multishot', current, shards);
  assert.equal(blocked.purchased, false);
});

test('computePlayerStats scales Tommy speed, shots, shield, and magnet radius', () => {
  const base = computePlayerStats(createInitialUpgrades());
  assert.equal(base.shotCount, 1);
  assert.equal(base.maxHp, 100);
  assert.equal(base.maxShield, 0);

  const upgraded = computePlayerStats({
    speed: 2,
    multishot: 3,
    shield: 2,
    magnet: 2,
  });
  assert.ok(upgraded.moveSpeed > base.moveSpeed);
  assert.equal(upgraded.shotCount, 4);
  assert.equal(upgraded.maxHp, 140);
  assert.equal(upgraded.maxShield, 60);
  assert.ok(upgraded.magnetRadius > base.magnetRadius);
});

test('computeEpisodeConfig escalates across Chapters 1..N and Episodes 1..10', () => {
  assert.equal(EPISODES_PER_CHAPTER, 10);

  const ch1ep1 = computeEpisodeConfig(1, 1);
  const ch1ep5 = computeEpisodeConfig(1, 5);
  const ch1ep10 = computeEpisodeConfig(1, 10);
  const ch2ep1 = computeEpisodeConfig(2, 1);

  assert.equal(ch1ep1.isBossEpisode, false);
  assert.equal(ch1ep1.shouldSpawnSubBoss, false);
  assert.equal(ch1ep5.shouldSpawnSubBoss, true);
  assert.equal(ch1ep10.isBossEpisode, true);
  assert.equal(ch1ep10.durationSeconds, 0);

  assert.ok(ch1ep5.speedMultiplier > ch1ep1.speedMultiplier);
  assert.ok(ch1ep5.spawnInterval < ch1ep1.spawnInterval);
  assert.ok(ch2ep1.hpMultiplier > ch1ep1.hpMultiplier);
  assert.ok(ch2ep1.speedMultiplier > ch1ep1.speedMultiplier);

  assert.equal(pickEnemyKind(0.1, ch1ep1.weights), 'block');
  assert.equal(pickEnemyKind(0.7, ch1ep1.weights), 'firewall');
  assert.equal(pickEnemyKind(0.95, ch1ep1.weights), 'interceptor');
});

test('computeChapterBossConfig produces unique Gigantic Bosses that scale endlessly per Chapter', () => {
  const b1 = computeChapterBossConfig(1);
  const b2 = computeChapterBossConfig(2);
  const b3 = computeChapterBossConfig(3);
  const b4 = computeChapterBossConfig(4);
  const b5 = computeChapterBossConfig(5);

  assert.equal(b1.title, 'CORE SENTINEL');
  assert.equal(b2.title, 'VOID FIREWALL MATRIX');
  assert.equal(b3.title, 'OMEGA SWARM NEXUS');
  assert.equal(b4.title, 'ABYSSAL BREACH CORE');
  assert.ok(b5.title.includes('MK-2'));

  assert.ok(b2.hp > b1.hp);
  assert.ok(b2.speed > b1.speed);
  assert.ok(b2.bulletSpeedMult > b1.bulletSpeedMult);
  assert.ok(b3.aggressionRate > b2.aggressionRate);
  assert.ok(b5.hp > b4.hp);
});

test('advanceCampaignProgress and resolveEpisodeDefeat enforce 10-episode chapters and Ep 10 penalty', () => {
  const stepEp = advanceCampaignProgress(1, 4);
  assert.deepEqual(stepEp, {
    nextChapter: 1,
    nextEpisode: 5,
    chapterCleared: false,
  });

  const clearCh = advanceCampaignProgress(2, 10);
  assert.deepEqual(clearCh, {
    nextChapter: 3,
    nextEpisode: 1,
    chapterCleared: true,
  });

  // Defeat in Episodes 1-9 does not trigger Ep 10 chapter reset
  const normalDefeat = resolveEpisodeDefeat(2, 7);
  assert.deepEqual(normalDefeat, {
    defeatedByBoss10: false,
    resumeChapter: 1,
    resumeEpisode: 1,
  });

  // Defeat by Episode 10 Boss resets to Episode 1 of that SAME chapter
  const boss10Defeat = resolveEpisodeDefeat(3, 10);
  assert.deepEqual(boss10Defeat, {
    defeatedByBoss10: true,
    resumeChapter: 3,
    resumeEpisode: 1,
  });
});

test('applyIncomingDamage absorbs with shield first and handles lethal overflow', () => {
  const partialShield = applyIncomingDamage(100, 30, 20);
  assert.deepEqual(partialShield, {
    hp: 100,
    shield: 10,
    shieldBroken: false,
    lethal: false,
  });

  const breakAndOverflow = applyIncomingDamage(50, 15, 25);
  assert.deepEqual(breakAndOverflow, {
    hp: 40,
    shield: 0,
    shieldBroken: true,
    lethal: false,
  });

  const lethalHit = applyIncomingDamage(20, 0, 25);
  assert.deepEqual(lethalHit, {
    hp: 0,
    shield: 0,
    shieldBroken: false,
    lethal: true,
  });
});

test('clampDeltaTime caps large spikes and rejects invalid inputs', () => {
  assert.equal(clampDeltaTime(0.016), 0.016);
  assert.equal(clampDeltaTime(0.25), 0.05);
  assert.equal(clampDeltaTime(-0.1), 0);
  assert.equal(clampDeltaTime(Number.NaN), 0);
});

test('high score storage persists only strictly higher scores and builds summary', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  assert.equal(loadHighScore(mockStorage), 0);
  assert.equal(saveHighScore(1250, mockStorage), 1250);
  assert.equal(loadHighScore(mockStorage), 1250);
  assert.equal(saveHighScore(900, mockStorage), 1250);

  const summary = buildRunSummary({
    score: 1500,
    previousHighScore: 1250,
    chapterReached: 2,
    episodeReached: 10,
    defeatedByBoss10: true,
    bossNameAtDefeat: 'VOID FIREWALL MATRIX',
    enemiesDefeated: 42,
    shardsCollected: 65,
    survivalSeconds: 98.4,
  });
  assert.equal(summary.isNewHighScore, true);
  assert.equal(summary.highScore, 1500);
  assert.equal(summary.chapterReached, 2);
  assert.equal(summary.episodeReached, 10);
  assert.equal(summary.defeatedByBoss10, true);
  assert.equal(summary.survivalSeconds, 98);
});

test('combo multiplier, EMP, Tactical Shield, and Polly partner constants are balanced', () => {
  const first = advanceComboStreak(0);
  assert.equal(first.streak, 1);
  assert.equal(first.multiplier, 1);
  assert.equal(first.timer, COMBO_WINDOW_SECONDS);

  const second = advanceComboStreak(first.streak);
  assert.equal(second.multiplier, 2);

  const capped = advanceComboStreak(MAX_COMBO_MULTIPLIER - 1);
  assert.equal(capped.multiplier, MAX_COMBO_MULTIPLIER);

  const streak5 = computeComboRewards(100, 2, 5);
  assert.equal(streak5.score, 500);
  assert.ok(streak5.shards > 2);

  assert.equal(EMP_COOLDOWN_SECONDS, 30);
  assert.equal(EMP_STUN_SECONDS, 2.5);
  assert.ok(TACTICAL_SHIELD_DURATION > 0 && TACTICAL_SHIELD_COOLDOWN > TACTICAL_SHIELD_DURATION);
  assert.ok(POLLY_ASSIST_DURATION > 0 && POLLY_ASSIST_COOLDOWN > POLLY_ASSIST_DURATION);
  assert.ok(POLLY_AUTO_ENEMY_THRESHOLD >= 5);
});

test('daily challenge is stable within a UTC date and rotates between challenge presets', () => {
  const firstDay = new Date('2026-04-10T02:00:00Z');
  const laterSameDay = new Date('2026-04-10T22:00:00Z');
  const nextDay = new Date('2026-04-11T02:00:00Z');

  assert.deepEqual(getDailyChallenge(firstDay), getDailyChallenge(laterSameDay));
  assert.notEqual(getDailyChallenge(firstDay).id, getDailyChallenge(nextDay).id);
  assert.ok(getDailyChallenge(firstDay).description.length > 0);
});

test('high-score milestones unlock and persist cosmetic ship skins', () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  };

  assert.equal(isShipSkinUnlocked('violet', 4999), false);
  assert.equal(isShipSkinUnlocked('violet', 5000), true);
  assert.equal(isShipSkinUnlocked('gold', 19999), false);
  saveShipSkin('violet', storage);
  assert.equal(memory.get(SHIP_SKIN_STORAGE_KEY), 'violet');
  assert.equal(loadShipSkin(4999, storage), 'cyan');
  assert.equal(loadShipSkin(5000, storage), 'violet');
});
