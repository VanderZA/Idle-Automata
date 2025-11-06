// FIX: The import was circular ('./types'). Changed to './constants' where the types are actually defined.
import { type PlayerStats, type Enemy, type Gear, GearSlot, type SubAction, GameAction, type Quest, type Rarity, type Entity, type GameLogMessage } from './constants';

export const GAME_TICK_MS = 100;

export type LogType = GameLogMessage['type'];
export type LogCategory = 'All' | 'System' | 'Combat' | 'Loot' | 'Automation';

export const LOG_CATEGORY_MAP: Record<LogType, LogCategory> = {
    story: 'System',
    quest: 'System',
    danger: 'Combat',
    success: 'Combat',
    loot: 'Loot',
    automation: 'Automation',
};

export const INITIAL_PLAYER_STATS: PlayerStats = {
  power: 1,
  gold: 0,
  xp: 0,
  level: 1,
  xpToNextLevel: 100,
};

export const UNLOCKS = {
    FIGHTING_ACTION: { level: 2 },
    EXPLORING_ACTION: { level: 3 },
    CAVE_SUB_ACTION: { level: 5 },
    SPARRING_SUB_ACTION: { level: 10 },
};

export const getXpForNextLevel = (level: number): number => {
    return Math.floor(100 * Math.pow(1.5, level - 1));
};

export const getEntityUpgradeCost = (level: number): number => {
    return Math.floor(50 * Math.pow(1.8, level));
};


export const GEAR_POOL: Record<string, Gear> = {
    // Common
    'rusty_sword': { id: 'rusty_sword', name: 'Rusty Sword', slot: GearSlot.WEAPON, basePowerBonus: 1, baseGoldBonus: 0, powerUpgradeBonus: 0.2, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 10, rarity: 'Common' },
    'wooden_shield': { id: 'wooden_shield', name: 'Wooden Shield', slot: GearSlot.ARMOR, basePowerBonus: 1, baseGoldBonus: 0, powerUpgradeBonus: 0.1, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 10, rarity: 'Common' },
    // Uncommon
    'goblin_smasher': { id: 'goblin_smasher', name: 'Goblin Smasher', slot: GearSlot.WEAPON, basePowerBonus: 5, baseGoldBonus: 0, powerUpgradeBonus: 0.5, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 25, rarity: 'Uncommon' },
    'leather_vest': { id: 'leather_vest', name: 'Leather Vest', slot: GearSlot.ARMOR, basePowerBonus: 3, baseGoldBonus: 0, powerUpgradeBonus: 0.3, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 25, rarity: 'Uncommon' },
    'lucky_coin': { id: 'lucky_coin', name: 'Lucky Coin', slot: GearSlot.ACCESSORY, basePowerBonus: 0, baseGoldBonus: 10, powerUpgradeBonus: 0, goldUpgradeBonus: 0.5, maxUpgradeLevel: 50, sellValue: 50, rarity: 'Uncommon' },
    // Rare
    'orcish_cleaver': { id: 'orcish_cleaver', name: 'Orcish Cleaver', slot: GearSlot.WEAPON, basePowerBonus: 15, baseGoldBonus: 0, powerUpgradeBonus: 1, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 75, rarity: 'Rare' },
    'dragonscale_shield': { id: 'dragonscale_shield', name: 'Dragonscale Shield', slot: GearSlot.ARMOR, basePowerBonus: 10, baseGoldBonus: 5, powerUpgradeBonus: 0.8, goldUpgradeBonus: 0.1, maxUpgradeLevel: 100, sellValue: 150, rarity: 'Rare'},
    'golem_crusher': { id: 'golem_crusher', name: 'Golem Crusher', slot: GearSlot.WEAPON, basePowerBonus: 30, baseGoldBonus: 0, powerUpgradeBonus: 2, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 200, rarity: 'Rare'},
    // Epic
    'wyrmstooth_blade': { id: 'wyrmstooth_blade', name: 'Wyrmstooth Blade', slot: GearSlot.WEAPON, basePowerBonus: 75, baseGoldBonus: 0, powerUpgradeBonus: 5, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 500, rarity: 'Epic'},
    'amulet_of_swiftness': { id: 'amulet_of_swiftness', name: 'Amulet of Swiftness', slot: GearSlot.ACCESSORY, basePowerBonus: 10, baseGoldBonus: 25, powerUpgradeBonus: 1, goldUpgradeBonus: 1, maxUpgradeLevel: 50, sellValue: 750, rarity: 'Epic'},
};

export const ENEMIES_LIST: Omit<Enemy, 'currentHp'>[] = [
  { name: 'Slime', maxHp: 10, goldReward: 5, xpReward: 10, powerLevel: 1, unlockPower: 1, gearDrops: [{ gearId: 'rusty_sword', chance: 0.1 }] },
  { name: 'Goblin', maxHp: 30, goldReward: 15, xpReward: 25, powerLevel: 5, unlockPower: 10, gearDrops: [{ gearId: 'wooden_shield', chance: 0.1 }, { gearId: 'goblin_smasher', chance: 0.05 }] },
  { name: 'Orc', maxHp: 100, goldReward: 50, xpReward: 75, powerLevel: 20, unlockPower: 40, gearDrops: [{ gearId: 'leather_vest', chance: 0.15 }, { gearId: 'orcish_cleaver', chance: 0.05 }, { gearId: 'lucky_coin', chance: 0.02 }] },
  { name: 'Stone Golem', maxHp: 250, goldReward: 120, xpReward: 200, powerLevel: 50, unlockPower: 75, gearDrops: [{ gearId: 'golem_crusher', chance: 0.05 }] },
  { name: 'Ogre', maxHp: 500, goldReward: 200, xpReward: 300, powerLevel: 100, unlockPower: 150, gearDrops: [] },
  { name: 'Dragon Whelp', maxHp: 800, goldReward: 400, xpReward: 600, powerLevel: 200, unlockPower: 250, gearDrops: [{ gearId: 'dragonscale_shield', chance: 0.1 }, { gearId: 'wyrmstooth_blade', chance: 0.02 }] },
  { name: 'Mini Dragon', maxHp: 2000, goldReward: 1000, xpReward: 1500, powerLevel: 500, unlockPower: 600, gearDrops: [{ gearId: 'amulet_of_swiftness', chance: 0.05 }] },
];

export const SUB_ACTIONS: Record<string, SubAction> = {
    'pushups': { id: 'pushups', name: 'Push-ups', category: GameAction.TRAINING, duration: 50, xpReward: 2, powerGain: 1, description: 'Basic strength building.' },
    'situps': { id: 'situps', name: 'Sit-ups', category: GameAction.TRAINING, duration: 70, xpReward: 3, powerGain: 1, description: 'Core workout.' },
    'sparring': { id: 'sparring', name: 'Sparring', category: GameAction.TRAINING, duration: 200, xpReward: 15, powerGain: 5, description: 'Practice combat techniques.'},
    'look_bush': { id: 'look_bush', name: 'Look in a bush', category: GameAction.EXPLORING, duration: 100, xpReward: 5, goldFind: 2, description: 'You might find something.' },
    'explore_cave': { id: 'explore_cave', name: 'Explore the Cave', category: GameAction.EXPLORING, duration: 300, xpReward: 20, goldFind: 15, description: 'Dark and mysterious.' },
    'attack': { id: 'attack', name: 'Attack', category: GameAction.FIGHTING, duration: 20, xpReward: 0, description: 'Repeatedly attack the current enemy.' },
};

export const QUESTS: Quest[] = [
    { 
        id: 'q1', title: 'Getting Started', description: 'Strength is everything. Do 10 push-ups to begin your journey.',
        objective: { type: 'sub_action_complete', target: 10, qualifier: 'pushups' },
        reward: { xp: 50, gold: 10 }
    },
    { 
        id: 'q2', title: 'First Blood', description: "Your power grows. Time to test it. Defeat a Slime. (Fighting unlocks at Level 2)",
        objective: { type: 'kill', target: 1, qualifier: 'Slime' },
        reward: { xp: 100, gold: 20 }
    },
    {
        id: 'q3', title: 'A New Horizon', description: 'Your journey is just beginning. Reach level 3 to unlock the ability to explore your surroundings.',
        objective: { type: 'level', target: 3 },
        reward: { xp: 150, gold: 50, unlocks: 'look_bush' }
    },
    { 
        id: 'q4', title: 'Pathfinder', description: 'The world is larger than you think. Look in a bush 5 times.',
        objective: { type: 'sub_action_complete', target: 5, qualifier: 'look_bush' },
        reward: { xp: 150, gold: 50 }
    },
    {
        id: 'q5', title: 'Whispers in the Woods', description: "While exploring, you sense a strange presence. Find what's hiding out there.",
        objective: { type: 'find_entity', target: 1 },
        reward: { xp: 200, gold: 100 }
    },
    { 
        id: 'q6', title: 'Goblin Menace', description: 'Goblins are causing trouble nearby. Thin their numbers.',
        objective: { type: 'kill', target: 5, qualifier: 'Goblin' },
        reward: { xp: 250, gold: 150 }
    },
    { 
        id: 'q7', title: 'Growing Power', description: 'You feel a new potential welling up inside. Reach level 5.',
        objective: { type: 'level', target: 5 },
        reward: { xp: 200, gold: 100, unlocks: 'explore_cave' }
    },
    {
        id: 'q8', title: 'Automated Aggression', description: "There are rumors of a more aggressive automaton. Perhaps exploring deeper, in a cave, would reveal it.",
        objective: { type: 'find_entity', target: 2 },
        reward: { xp: 300, gold: 200 }
    },
    { 
        id: 'q9', title: 'Bigger and Badder', description: "An Orc has been spotted. It's a significant threat, but the rewards are great.",
        objective: { type: 'kill', target: 1, qualifier: 'Orc' },
        reward: { xp: 400, gold: 250 }
    },
     { 
        id: 'q10', title: 'Stepping Up', description: 'Basic training is no longer enough. Reach level 10 to unlock a new training method.',
        objective: { type: 'level', target: 10 },
        reward: { xp: 500, gold: 500, unlocks: 'sparring' }
    },
    {
        id: 'q11', title: 'Greedy Little Helpers', description: "You've heard tales of a creature that loves shiny things and helps those who explore. Find it by exploring the caves.",
        objective: { type: 'find_entity', target: 3 },
        reward: { xp: 750, gold: 500 }
    },
];

export const ENTITY_FIND_CHANCE = 0.05; // 5% chance per completed exploration action

const baseEntityStats = {
    xpGained: 0,
    powerGained: 0,
    goldGained: 0,
    enemiesDefeated: 0,
};

export const ENTITIES_POOL: Omit<Entity, 'progress'>[] = [
    { id: 'training_wisp', name: 'Training Wisp', type: GameAction.TRAINING, level: 1, automationSpeed: 0.2, stats: {...baseEntityStats} },
    { id: 'combat_drone', name: 'Combat Drone', type: GameAction.FIGHTING, level: 1, automationSpeed: 0.1, stats: {...baseEntityStats} },
    { id: 'scavenging_gremlin', name: 'Scavenging Gremlin', type: GameAction.EXPLORING, level: 1, automationSpeed: 0.15, stats: {...baseEntityStats} },
];