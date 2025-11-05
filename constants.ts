import { type PlayerStats, type Enemy, type Gear, GearSlot, type SubAction, GameAction, type Quest, Rarity, type Entity } from './types';

export const GAME_TICK_MS = 100;

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
};

export const getXpForNextLevel = (level: number): number => {
    return Math.floor(100 * Math.pow(1.5, level - 1));
};

export const GEAR_POOL: Record<string, Gear> = {
    'rusty_sword': { id: 'rusty_sword', name: 'Rusty Sword', slot: GearSlot.WEAPON, basePowerBonus: 1, baseGoldBonus: 0, powerUpgradeBonus: 0.2, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 10, rarity: 'Common' },
    'wooden_shield': { id: 'wooden_shield', name: 'Wooden Shield', slot: GearSlot.ARMOR, basePowerBonus: 1, baseGoldBonus: 0, powerUpgradeBonus: 0.1, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 10, rarity: 'Common' },
    'goblin_smasher': { id: 'goblin_smasher', name: 'Goblin Smasher', slot: GearSlot.WEAPON, basePowerBonus: 5, baseGoldBonus: 0, powerUpgradeBonus: 0.5, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 25, rarity: 'Uncommon' },
    'leather_vest': { id: 'leather_vest', name: 'Leather Vest', slot: GearSlot.ARMOR, basePowerBonus: 3, baseGoldBonus: 0, powerUpgradeBonus: 0.3, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 25, rarity: 'Uncommon' },
    'lucky_coin': { id: 'lucky_coin', name: 'Lucky Coin', slot: GearSlot.ACCESSORY, basePowerBonus: 0, baseGoldBonus: 10, powerUpgradeBonus: 0, goldUpgradeBonus: 0.5, maxUpgradeLevel: 50, sellValue: 50, rarity: 'Uncommon' },
    'orcish_cleaver': { id: 'orcish_cleaver', name: 'Orcish Cleaver', slot: GearSlot.WEAPON, basePowerBonus: 15, baseGoldBonus: 0, powerUpgradeBonus: 1, goldUpgradeBonus: 0, maxUpgradeLevel: 100, sellValue: 75, rarity: 'Rare' },
};

export const ENEMIES_LIST: Omit<Enemy, 'currentHp'>[] = [
  { name: 'Slime', maxHp: 10, goldReward: 5, xpReward: 10, powerLevel: 1, unlockPower: 1, gearDrops: [{ gearId: 'rusty_sword', chance: 0.1 }] },
  { name: 'Goblin', maxHp: 30, goldReward: 15, xpReward: 25, powerLevel: 5, unlockPower: 10, gearDrops: [{ gearId: 'wooden_shield', chance: 0.1 }, { gearId: 'goblin_smasher', chance: 0.05 }] },
  { name: 'Orc', maxHp: 100, goldReward: 50, xpReward: 75, powerLevel: 20, unlockPower: 40, gearDrops: [{ gearId: 'leather_vest', chance: 0.15 }, { gearId: 'orcish_cleaver', chance: 0.05 }, { gearId: 'lucky_coin', chance: 0.02 }] },
  { name: 'Ogre', maxHp: 500, goldReward: 200, xpReward: 300, powerLevel: 100, unlockPower: 150, gearDrops: [] },
  { name: 'Mini Dragon', maxHp: 2000, goldReward: 1000, xpReward: 1500, powerLevel: 500, unlockPower: 600, gearDrops: [] },
];

export const SUB_ACTIONS: Record<string, SubAction> = {
    'pushups': { id: 'pushups', name: 'Push-ups', category: GameAction.TRAINING, duration: 50, xpReward: 2, powerGain: 1, description: 'Basic strength building.' },
    'situps': { id: 'situps', name: 'Sit-ups', category: GameAction.TRAINING, duration: 70, xpReward: 3, powerGain: 1, description: 'Core workout.' },
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
        id: 'q2', title: 'First Blood', description: 'Your power grows. Time to test it. Defeat a Slime.',
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
        id: 'q6', title: 'Growing Power', description: 'You feel a new potential welling up inside. Reach level 5.',
        objective: { type: 'level', target: 5 },
        reward: { xp: 200, gold: 100, unlocks: 'explore_cave' }
    }
];

export const ENTITY_FIND_CHANCE = 0.05; // 5% chance per completed exploration action

export const ENTITIES_POOL: Omit<Entity, 'progress'>[] = [
    { id: 'training_wisp', name: 'Training Wisp', type: GameAction.TRAINING, level: 1, automationSpeed: 0.2 }
];