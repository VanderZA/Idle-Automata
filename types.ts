export enum GameAction {
  TRAINING = 'Training',
  FIGHTING = 'Fighting',
  EXPLORING = 'Exploring',
}

export enum GearSlot {
    WEAPON = 'Weapon',
    ARMOR = 'Armor',
    ACCESSORY = 'Accessory',
}

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';

export interface Gear {
    id: string;
    name: string;
    slot: GearSlot;
    // Base stats
    basePowerBonus: number;
    baseGoldBonus: number; // as a percentage
    // Upgrade stats
    powerUpgradeBonus: number;
    goldUpgradeBonus: number;
    maxUpgradeLevel: number;
    sellValue: number;
    rarity: Rarity;
}

export interface InventoryItem {
    instanceId: string;
    gear: Gear;
    upgradeLevel: number;
}

export type EquippedGear = {
    [key in GearSlot]?: InventoryItem;
}

export interface PlayerStats {
  power: number; // Base power
  gold: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
}

export interface SubAction {
    id: string;
    name: string;
    category: GameAction;
    duration: number; // Ticks to complete
    xpReward: number;
    description: string;
    powerGain?: number;
    goldFind?: number;
}

export interface Entity {
  id: string;
  name: string;
  type: GameAction; // Automates a whole category
  level: number;
  progress: number;
  automationSpeed: number; // Ticks per game loop
}

export interface Enemy {
  name: string;
  maxHp: number;
  currentHp: number;
  goldReward: number;
  xpReward: number;
  powerLevel: number;
  unlockPower: number;
  gearDrops: { gearId: string; chance: number }[];
}

export interface Quest {
    id:string;
    title: string;
    description: string;
    objective: {
        type: 'level' | 'power' | 'kill' | 'sub_action_complete' | 'find_entity';
        target: number;
        qualifier?: string; // e.g. enemy name or sub-action id
    };
    reward: {
        xp?: number;
        gold?: number;
        unlocks?: GameAction | string; // GameAction category or SubAction id
    };
}

export interface GameLogMessage {
  id: number;
  text: string;
  type: 'success' | 'danger' | 'info' | 'special' | 'quest' | 'story';
}