import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// FIX: The type definitions are in 'constants.ts', not 'types.ts'.
import { 
    GameAction, GearSlot, type PlayerStats, type Entity, type Enemy, type GameLogMessage, 
    type SubAction, type InventoryItem, type EquippedGear, type Quest, type Rarity, type Gear
} from './constants';
// FIX: The constant values are in 'types.ts', not 'constants.ts'.
import { 
    INITIAL_PLAYER_STATS, GAME_TICK_MS, getXpForNextLevel, getEntityUpgradeCost, ENEMIES_LIST, 
    ENTITY_FIND_CHANCE, UNLOCKS, SUB_ACTIONS, QUESTS, GEAR_POOL, ENTITIES_POOL, LOG_CATEGORY_MAP, LogCategory
} from './types';
import { 
    PowerIcon, GoldIcon, XPIcon, LevelIcon, TrainingIcon, FightingIcon, ExploringIcon,
    QuestIcon, InventoryIcon, ChevronLeftIcon, ChevronRightIcon
} from './components/icons';
import ProgressBar from './components/ProgressBar';
import Tooltip from './components/Tooltip';

const StatDisplay: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string; onMouseEnter?: () => void; onMouseLeave?: () => void; }> = ({ icon, label, value, color, onMouseEnter, onMouseLeave }) => (
  <div className={`flex items-center space-x-2 bg-gray-800/50 p-2 rounded-lg ${color}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    {icon}
    <span className="font-semibold">{label}:</span>
    <span className="font-mono">{value}</span>
  </div>
);

const App: React.FC = () => {
    // Core Game State
    const [playerStats, setPlayerStats] = useState<PlayerStats>(INITIAL_PLAYER_STATS);
    const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
    const [foundEntities, setFoundEntities] = useState<Entity[]>([]);
    const [gameLog, setGameLog] = useState<GameLogMessage[]>([{id: Date.now(), text: "A feeling of determination washes over you.", type: 'story', category: 'System'}]);
    
    // Manual Action State
    const [activeManualSubActionId, setActiveManualSubActionId] = useState<string | null>(null);
    const [manualProgress, setManualProgress] = useState(0);

    // Progression State
    const [unlockedActions, setUnlockedActions] = useState<GameAction[]>([GameAction.TRAINING]);
    const [unlockedSubActions, setUnlockedSubActions] = useState<string[]>(['pushups', 'situps']);
    const [questCompletion, setQuestCompletion] = useState<Record<string, boolean>>({});
    const [questProgress, setQuestProgress] = useState<Record<string, number>>({});
    const [activeQuestId, setActiveQuestId] = useState<string>(QUESTS[0].id);
    const [unlockedEnemyNames, setUnlockedEnemyNames] = useState<string[]>([]);
    const [currentEnemyIndex, setCurrentEnemyIndex] = useState<number>(0);
    const [subActionCompletionCounts, setSubActionCompletionCounts] = useState<Record<string, number>>({});
    const [enemyDropHistory, setEnemyDropHistory] = useState<Record<string, Record<string, number>>>({});


    // Inventory & Gear State
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [equippedGear, setEquippedGear] = useState<EquippedGear>({});

    // UI State
    const [activeTab, setActiveTab] = useState('Quests');
    const [activeLogTab, setActiveLogTab] = useState<LogCategory>('All');
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: React.ReactNode; x: number; y: number }>({ visible: false, content: null, x: 0, y: 0 });
    const logContainerRef = useRef<HTMLDivElement>(null);

    const gameLoopRef = useRef<number>();

    // Logging Utility
    const addLog = useCallback((text: string, type: GameLogMessage['type']) => {
        const category = LOG_CATEGORY_MAP[type];
        setGameLog(prev => [{ id: Date.now(), text, type, category }, ...prev.slice(0, 199)]);
    }, []);

    // Derived Stats
    const totalPlayerStats = useMemo(() => {
        let gearPowerBonus = 0;
        let gearGoldBonus = 0;

        (Object.keys(equippedGear) as GearSlot[]).forEach(slot => {
            const item = equippedGear[slot];
            if (item) {
                const powerFromUpgrades = item.upgradeLevel * item.gear.powerUpgradeBonus;
                const goldFromUpgrades = item.upgradeLevel * item.gear.goldUpgradeBonus;
                gearPowerBonus += item.gear.basePowerBonus + powerFromUpgrades;
                gearGoldBonus += item.gear.baseGoldBonus + goldFromUpgrades;
            }
        });
        
        return {
            power: playerStats.power + Math.floor(gearPowerBonus),
            goldBonus: gearGoldBonus,
            gearPowerBonus,
        };
    }, [playerStats.power, equippedGear]);

    const activeQuest = useMemo(() => QUESTS.find(q => q.id === activeQuestId), [activeQuestId]);

    // Tooltip Handlers
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    }, []);
    const showTooltip = useCallback((content: React.ReactNode) => setTooltip(prev => ({ ...prev, visible: true, content })), []);
    const hideTooltip = useCallback(() => setTooltip(prev => ({ ...prev, visible: false, content: null })), []);

    // Core Game Logic
    const handleLevelUp = useCallback((stats: PlayerStats) => {
        let newStats = { ...stats };
        let leveledUp = false;
        while (newStats.xp >= newStats.xpToNextLevel) {
            leveledUp = true;
            newStats.xp -= newStats.xpToNextLevel;
            newStats.level += 1;
            newStats.power += 1; // Base power gain
            newStats.xpToNextLevel = getXpForNextLevel(newStats.level);
            addLog(`Ding! You reached level ${newStats.level}!`, 'quest');
        }
        return newStats;
    }, [addLog]);
    
    // Progression Unlocks
    useEffect(() => {
        if (playerStats.level >= UNLOCKS.FIGHTING_ACTION.level && !unlockedActions.includes(GameAction.FIGHTING)) {
            setUnlockedActions(prev => [...prev, GameAction.FIGHTING]);
            addLog("The thrill of battle calls to you. You can now Fight!", 'story');
        }
        if (playerStats.level >= UNLOCKS.EXPLORING_ACTION.level && !unlockedActions.includes(GameAction.EXPLORING)) {
            setUnlockedActions(prev => [...prev, GameAction.EXPLORING]);
            addLog("You feel an urge to see the world. You can now Explore!", 'story');
        }
        const newlyUnlocked = ENEMIES_LIST.filter(enemy => 
            unlockedActions.includes(GameAction.FIGHTING) &&
            totalPlayerStats.power >= enemy.unlockPower && 
            !unlockedEnemyNames.includes(enemy.name)
        );
        if (newlyUnlocked.length > 0) {
            const newNames = newlyUnlocked.map(e => e.name);
            setUnlockedEnemyNames(prev => [...prev, ...newNames].sort((a,b) => ENEMIES_LIST.find(e=>e.name===a)!.powerLevel - ENEMIES_LIST.find(e=>e.name===b)!.powerLevel));
            addLog(`You feel strong enough to challenge: ${newNames.join(', ')}!`, 'story');
        }
    }, [playerStats.level, totalPlayerStats.power, unlockedActions, unlockedEnemyNames, addLog]);

    const startNextQuest = useCallback(() => {
        const currentQuestIndex = QUESTS.findIndex(q => q.id === activeQuestId);
        if (currentQuestIndex === -1 || questCompletion[activeQuestId] === false) return;

        const nextQuestIndex = currentQuestIndex + 1;
        if (nextQuestIndex < QUESTS.length) {
            const nextQuest = QUESTS[nextQuestIndex];
            if (activeQuestId !== nextQuest.id) {
                setActiveQuestId(nextQuest.id);
                addLog(`New Quest: ${nextQuest.title}`, 'quest');
            }
        } else if (activeQuestId) {
            addLog("You've completed all available quests for now!", 'quest');
            setActiveQuestId(''); // No more active quests
        }
    }, [activeQuestId, addLog, questCompletion]);

    const checkQuestCompletion = useCallback(() => {
        if (!activeQuest || questCompletion[activeQuestId]) return;

        const { objective } = activeQuest;
        let isComplete = false;

        if (objective.type === 'level') {
            if (playerStats.level >= objective.target) isComplete = true;
        } else if (objective.type === 'power') {
            if (totalPlayerStats.power >= objective.target) isComplete = true;
        } else {
            const progress = questProgress[activeQuest.id] || 0;
            if (progress >= objective.target) isComplete = true;
        }
        
        if (isComplete) {
            addLog(`Quest Complete: ${activeQuest.title}!`, 'quest');
            setQuestCompletion(prev => ({ ...prev, [activeQuest.id]: true }));
            
            let statsUpdate: Partial<PlayerStats> = {};
            if (activeQuest.reward.xp) statsUpdate.xp = playerStats.xp + activeQuest.reward.xp;
            if (activeQuest.reward.gold) statsUpdate.gold = playerStats.gold + activeQuest.reward.gold;
            
            if (activeQuest.reward.unlocks) {
                const unlock = activeQuest.reward.unlocks;
                if (SUB_ACTIONS[unlock as keyof typeof SUB_ACTIONS]) {
                    setUnlockedSubActions(prev => {
                        if (prev.includes(unlock)) return prev;
                        addLog(`You can now perform: ${SUB_ACTIONS[unlock as keyof typeof SUB_ACTIONS].name}!`, 'story');
                        return [...prev, unlock];
                    });
                }
            }
            setPlayerStats(prev => handleLevelUp({ ...prev, ...statsUpdate }));
        }
    }, [activeQuest, questCompletion, questProgress, playerStats, totalPlayerStats.power, handleLevelUp, addLog]);
    
    // Effect to start the next quest once the current one is completed
    useEffect(() => {
        if(activeQuestId && questCompletion[activeQuestId]){
            startNextQuest();
        }
    }, [questCompletion, activeQuestId, startNextQuest]);


    const updateQuestProgress = useCallback((type: Quest['objective']['type'], qualifier?: string, amount: number = 1) => {
        if (!activeQuest || questCompletion[activeQuestId] || activeQuest.objective.type === 'level' || activeQuest.objective.type === 'power') return;
        
        const { objective } = activeQuest;
        if (objective.type === type && (!objective.qualifier || objective.qualifier === qualifier)) {
            setQuestProgress(prev => ({ ...prev, [activeQuestId]: (prev[activeQuestId] || 0) + amount }));
        }
    }, [activeQuest, questCompletion, activeQuestId]);
    
    useEffect(() => { checkQuestCompletion(); }, [questProgress, playerStats.level, totalPlayerStats.power, checkQuestCompletion]);

    const findNewEntity = useCallback(() => {
        if (foundEntities.length < ENTITIES_POOL.length && Math.random() < ENTITY_FIND_CHANCE) {
            const undiscoveredEntities = ENTITIES_POOL.filter(p_entity => !foundEntities.find(f_entity => f_entity.id === p_entity.id));
            if (undiscoveredEntities.length > 0) {
                const newEntityTemplate = undiscoveredEntities[0];
                const availableSubActions = Object.values(SUB_ACTIONS).filter(sa => sa.category === newEntityTemplate.type && unlockedSubActions.includes(sa.id));
                const newEntity = { 
                    ...newEntityTemplate, 
                    progress: 0,
                    assignedSubActionId: availableSubActions.length > 0 ? availableSubActions[0].id : undefined
                };
                setFoundEntities(prev => [...prev, newEntity]);
                addLog(`You've discovered a ${newEntity.name}! It can automate ${newEntity.type} tasks.`, 'story');
                updateQuestProgress('find_entity');
            }
        }
    }, [foundEntities, unlockedSubActions, addLog, updateQuestProgress]);

    const completeManualSubAction = useCallback((subAction: SubAction) => {
        let statsUpdate: Partial<PlayerStats> = { xp: playerStats.xp + subAction.xpReward };
        if (subAction.powerGain) statsUpdate = { ...statsUpdate, power: playerStats.power + subAction.powerGain };
        if (subAction.goldFind) {
            const goldFound = Math.floor(subAction.goldFind * (1 + totalPlayerStats.goldBonus / 100));
            statsUpdate = { ...statsUpdate, gold: playerStats.gold + goldFound };
            addLog(`You found ${goldFound} gold.`, 'loot');
        }

        if (subAction.category === GameAction.EXPLORING) {
            findNewEntity();
        }
        
        setSubActionCompletionCounts(prev => ({...prev, [subAction.id]: (prev[subAction.id] || 0) + 1}));
        setPlayerStats(prev => handleLevelUp({ ...prev, ...statsUpdate }));
        updateQuestProgress('sub_action_complete', subAction.id);
    }, [playerStats, totalPlayerStats.goldBonus, handleLevelUp, updateQuestProgress, addLog, findNewEntity]);

    const startNewFight = useCallback((index: number) => {
        if (unlockedEnemyNames.length === 0 || index < 0 || index >= unlockedEnemyNames.length) {
            setCurrentEnemy(null);
            return;
        }
        const enemyName = unlockedEnemyNames[index];
        const enemyData = ENEMIES_LIST.find(e => e.name === enemyName);
        if (enemyData) {
            setCurrentEnemy({ ...enemyData, currentHp: enemyData.maxHp });
            addLog(`A wild ${enemyData.name} appears!`, 'danger');
        }
    }, [unlockedEnemyNames, addLog]);

    const attackEnemy = useCallback(() => {
        if (!currentEnemy) {
            startNewFight(currentEnemyIndex);
            return;
        }
        const playerDamage = Math.max(1, totalPlayerStats.power - Math.floor(currentEnemy.powerLevel / 2));
        const newHp = currentEnemy.currentHp - playerDamage;
        if (newHp <= 0) {
            addLog(`You defeated the ${currentEnemy.name}! +${currentEnemy.goldReward} Gold, +${currentEnemy.xpReward} XP.`, 'success');
            setSubActionCompletionCounts(prev => ({...prev, 'attack': (prev['attack'] || 0) + 1}));
            
            const availableDrops = currentEnemy.gearDrops.filter(drop => {
                const gearInfo = GEAR_POOL[drop.gearId as keyof typeof GEAR_POOL];
                const equippedVersion = equippedGear[gearInfo.slot];
                return !(equippedVersion && equippedVersion.gear.id === gearInfo.id && equippedVersion.upgradeLevel >= equippedVersion.gear.maxUpgradeLevel);
            });
            availableDrops.forEach(drop => {
                if (Math.random() < drop.chance) {
                     setEnemyDropHistory(prev => {
                        const newHistory = {...prev};
                        if (!newHistory[currentEnemy.name]) newHistory[currentEnemy.name] = {};
                        newHistory[currentEnemy.name][drop.gearId] = (newHistory[currentEnemy.name][drop.gearId] || 0) + 1;
                        return newHistory;
                    });
                    const gear = GEAR_POOL[drop.gearId as keyof typeof GEAR_POOL];
                    if (!gear) return;
                    const equippedVersion = equippedGear[gear.slot];
                    if (equippedVersion && equippedVersion.gear.id === gear.id && equippedVersion.upgradeLevel < gear.maxUpgradeLevel) {
                        setEquippedGear(prev => {
                            const newGear = {...prev};
                            const itemToUpgrade = newGear[gear.slot]!;
                            newGear[gear.slot] = { ...itemToUpgrade, upgradeLevel: itemToUpgrade.upgradeLevel + 1 };
                            return newGear;
                        });
                        addLog(`Your ${gear.name} was enhanced! [+${equippedVersion.upgradeLevel + 1}]`, 'loot');
                    } else {
                        const newItem: InventoryItem = { instanceId: `item_${Date.now()}_${Math.random()}`, gear, upgradeLevel: 0 };
                        setInventory(prev => [...prev, newItem]);
                        addLog(`Looted a ${gear.name}!`, 'loot');
                    }
                }
            });
            updateQuestProgress('kill', currentEnemy.name);
            setPlayerStats(prev => handleLevelUp({ ...prev, gold: prev.gold + currentEnemy.goldReward, xp: prev.xp + currentEnemy.xpReward }));
            startNewFight(currentEnemyIndex);
        } else {
            setCurrentEnemy(prev => prev ? {...prev, currentHp: newHp} : null);
        }
    }, [currentEnemy, totalPlayerStats.power, addLog, updateQuestProgress, handleLevelUp, equippedGear, currentEnemyIndex, startNewFight]);

     const completeAutomatedSubAction = useCallback((subAction: SubAction, entityId: string) => {
        let statGains = { xp: 0, power: 0, gold: 0, enemies: 0 };

        if (subAction.category === GameAction.FIGHTING) {
            if (!currentEnemy) return;
            const entity = foundEntities.find(e => e.id === entityId);
            if (!entity) return;

            const autoDamage = Math.max(1, (totalPlayerStats.power / 10) * (entity.level / 2 + 0.5));
            const newHp = currentEnemy.currentHp - autoDamage;
            if (newHp <= 0) {
                 addLog(`${entity.name} defeated the ${currentEnemy.name}!`, 'automation');
                 statGains.enemies = 1;
                 startNewFight(currentEnemyIndex);
            } else {
                setCurrentEnemy(prev => prev ? {...prev, currentHp: newHp} : null);
            }
        } else {
            statGains.xp = subAction.xpReward;
            statGains.power = subAction.powerGain || 0;
            statGains.gold = subAction.goldFind || 0;
            
            setPlayerStats(prev => handleLevelUp({ ...prev, xp: prev.xp + statGains.xp, power: prev.power + statGains.power, gold: prev.gold + statGains.gold }));
            
            if (subAction.category === GameAction.EXPLORING) {
                findNewEntity();
            }

            const entityName = foundEntities.find(e => e.id === entityId)?.name || 'Entity';
            let rewardText = `+${statGains.xp} XP`;
            if(statGains.power > 0) rewardText += `, +${statGains.power} Power`;
            if(statGains.gold > 0) rewardText += `, +${statGains.gold} Gold`;

            addLog(`${entityName} completed ${subAction.name}. (${rewardText})`, 'automation');
            updateQuestProgress('sub_action_complete', subAction.id);
        }
        
        setSubActionCompletionCounts(prev => ({...prev, [subAction.id]: (prev[subAction.id] || 0) + 1}));

        setFoundEntities(prev => prev.map(e => {
            if (e.id === entityId) {
                return {
                    ...e,
                    stats: {
                        xpGained: e.stats.xpGained + statGains.xp,
                        powerGained: e.stats.powerGained + statGains.power,
                        goldGained: e.stats.goldGained + statGains.gold,
                        enemiesDefeated: e.stats.enemiesDefeated + statGains.enemies,
                    }
                }
            }
            return e;
        }));
    }, [handleLevelUp, addLog, updateQuestProgress, currentEnemy, totalPlayerStats.power, startNewFight, currentEnemyIndex, foundEntities, findNewEntity]);

    // Game Loop
    useEffect(() => {
        gameLoopRef.current = window.setInterval(() => {
            if (activeManualSubActionId) {
                const subAction = SUB_ACTIONS[activeManualSubActionId as keyof typeof SUB_ACTIONS];
                if (!subAction) return;
                const speed = 100 / subAction.duration;
                setManualProgress(prev => {
                    const newProgress = prev + speed;
                    if (newProgress >= 100) {
                        if (subAction.category === GameAction.FIGHTING) attackEnemy();
                        else completeManualSubAction(subAction);
                        return 0;
                    }
                    return newProgress;
                });
            }

            setFoundEntities(currentEntities => {
                if (currentEntities.length === 0) return currentEntities;
                
                return currentEntities.map(entity => {
                    const subActionId = entity.assignedSubActionId;
                    if (!subActionId) return entity;
                    
                    const subAction = SUB_ACTIONS[subActionId as keyof typeof SUB_ACTIONS];
                    if (!subAction) return entity;

                    const newProgress = entity.progress + (entity.automationSpeed * (entity.level / 2 + 0.5));
                    if (newProgress >= 100) {
                        completeAutomatedSubAction(subAction, entity.id);
                        return { ...entity, progress: newProgress - 100 };
                    }
                    return { ...entity, progress: newProgress };
                });
            });

        }, GAME_TICK_MS);
        return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
    }, [activeManualSubActionId, attackEnemy, completeManualSubAction, completeAutomatedSubAction]);
    
    const handleActionClick = (subActionId: string) => {
        if (activeManualSubActionId === subActionId) {
            setActiveManualSubActionId(null);
            setManualProgress(0);
        } else {
            if(subActionId === 'attack' && !currentEnemy) startNewFight(currentEnemyIndex);
            setActiveManualSubActionId(subActionId);
            setManualProgress(0);
        }
    };
    
    const changeEnemy = (direction: -1 | 1) => {
        const newIndex = currentEnemyIndex + direction;
        if (newIndex >= 0 && newIndex < unlockedEnemyNames.length) {
            setCurrentEnemyIndex(newIndex);
            startNewFight(newIndex);
        }
    };

    const handleInventoryClick = (item: InventoryItem, e: React.MouseEvent) => {
        if (e.shiftKey) {
            const gear = item.gear;
            const sellValue = gear.sellValue * (1 + item.upgradeLevel * 0.2);
            setPlayerStats(prev => ({...prev, gold: prev.gold + Math.floor(sellValue)}));
            setInventory(prev => prev.filter(invItem => invItem.instanceId !== item.instanceId));
            addLog(`Sold ${gear.name} for ${Math.floor(sellValue)} gold.`, 'loot');
        } else if (e.ctrlKey) {
            const equippedItem = equippedGear[item.gear.slot];
            if (equippedItem && equippedItem.gear.id === item.gear.id) {
                if (equippedItem.upgradeLevel < equippedItem.gear.maxUpgradeLevel) {
                    setEquippedGear(prev => {
                        const newGear = {...prev};
                        const itemToUpgrade = newGear[item.gear.slot]!;
                        newGear[item.gear.slot] = { ...itemToUpgrade, upgradeLevel: itemToUpgrade.upgradeLevel + 1 };
                        return newGear;
                    });
                    setInventory(prev => prev.filter(invItem => invItem.instanceId !== item.instanceId));
                    addLog(`Used a duplicate to enhance your ${item.gear.name} to +${equippedItem.upgradeLevel + 1}!`, 'loot');
                } else { addLog(`${item.gear.name} is already at max level!`, 'automation'); }
            } else { addLog('You need to have a matching item equipped to upgrade it.', 'automation'); }
        } else {
            setEquippedGear(prev => {
                const newGear = {...prev};
                const currentItem = newGear[item.gear.slot];
                if (currentItem) setInventory(i => [...i, currentItem]);
                newGear[item.gear.slot] = item;
                setInventory(i => i.filter(invItem => invItem.instanceId !== item.instanceId));
                return newGear;
            });
        }
    };

    const unequipItem = (slot: GearSlot) => {
        const item = equippedGear[slot];
        if (item) {
            setInventory(prev => [...prev, item]);
            setEquippedGear(prev => {
                const newGear = {...prev};
                delete newGear[slot];
                return newGear;
            });
        }
    };

    const handleUpgradeEntity = (entityId: string) => {
        setFoundEntities(prev => {
            const entityToUpgrade = prev.find(e => e.id === entityId);
            if (!entityToUpgrade) return prev;
            
            const cost = getEntityUpgradeCost(entityToUpgrade.level);
            if (playerStats.gold >= cost) {
                setPlayerStats(ps => ({...ps, gold: ps.gold - cost}));
                addLog(`Upgraded ${entityToUpgrade.name} to Level ${entityToUpgrade.level + 1}!`, 'automation');
                return prev.map(e => e.id === entityId ? {...e, level: e.level + 1} : e);
            } else {
                addLog(`Not enough gold to upgrade ${entityToUpgrade.name}.`, 'automation');
                return prev;
            }
        });
    };
    
    const handleAssignEntityTask = (entityId: string, subActionId: string) => {
        setFoundEntities(prev => prev.map(e => e.id === entityId ? {...e, assignedSubActionId: subActionId, progress: 0} : e));
    };

    const rarityColor: Record<Rarity, string> = { Common: 'text-gray-300', Uncommon: 'text-green-400', Rare: 'text-blue-400', Epic: 'text-purple-400' };

    const createItemTooltip = (item: InventoryItem, equippedItem?: InventoryItem) => {
        const { gear, upgradeLevel } = item;
        const pwrBonus = gear.basePowerBonus + (upgradeLevel * gear.powerUpgradeBonus);
        const goldBonus = gear.baseGoldBonus + (upgradeLevel * gear.goldUpgradeBonus);
        let pwrDiffText = '', goldDiffText = '';
        if (equippedItem) {
            const equippedPwr = equippedItem.gear.basePowerBonus + (equippedItem.upgradeLevel * equippedItem.gear.powerUpgradeBonus);
            const equippedGold = equippedItem.gear.baseGoldBonus + (equippedItem.upgradeLevel * equippedItem.gear.goldUpgradeBonus);
            const pwrDiff = pwrBonus - equippedPwr; const goldDiff = goldBonus - equippedGold;
            if (pwrDiff !== 0) pwrDiffText = `(${pwrDiff > 0 ? '+' : ''}${pwrDiff.toFixed(1)})`;
            if (goldDiff !== 0) goldDiffText = `(${goldDiff > 0 ? '+' : ''}${goldDiff.toFixed(1)}%)`;
        }
        return (<div><h4 className={`font-bold ${rarityColor[gear.rarity]}`}>{gear.name} <span className="text-sm text-yellow-300">[+{upgradeLevel}]</span></h4><p className="text-gray-400">{gear.slot} <span className="text-sm">({gear.rarity})</span></p><p className="text-xs text-gray-500">Level: {upgradeLevel} / {gear.maxUpgradeLevel}</p><hr className="border-gray-700 my-1"/><p>Power: {pwrBonus.toFixed(1)} <span className={pwrDiffText.includes('+') ? 'text-green-400' : 'text-red-400'}>{pwrDiffText}</span></p><p>Gold Bonus: {goldBonus.toFixed(1)}% <span className={goldDiffText.includes('+') ? 'text-green-400' : 'text-red-400'}>{goldDiffText}</span></p></div>);
    };

    const createSubActionTooltip = (subAction: SubAction) => (
        <div><h4 className="font-bold">{subAction.name}</h4> <p className="text-gray-400 italic">{subAction.description}</p> <hr className="border-gray-700 my-1" /><p>XP: +{subAction.xpReward}</p>{subAction.powerGain && <p>Power: +{subAction.powerGain}</p>}{subAction.goldFind && <p>Gold Find: ~{subAction.goldFind}</p>}{subAction.category === GameAction.EXPLORING && <p className="text-indigo-300">Entity Find Chance: {(ENTITY_FIND_CHANCE * 100).toFixed(1)}%</p>}<p className="text-gray-500 mt-1">Duration: {(subAction.duration * GAME_TICK_MS / 1000).toFixed(1)}s</p><hr className="border-gray-700 my-1" /><p className="text-xs text-gray-400">Completed: {(subActionCompletionCounts[subAction.id] || 0).toLocaleString()} times</p></div>
    );
    
    const createEntityTooltip = (entity: Entity) => {
        const currentSpeed = entity.automationSpeed * (entity.level / 2 + 0.5);
        const nextLevelSpeed = entity.automationSpeed * ((entity.level + 1) / 2 + 0.5);
        
        let timePerAction = Infinity;
        const subAction = entity.assignedSubActionId ? SUB_ACTIONS[entity.assignedSubActionId] : null;
        if(subAction){
            timePerAction = (subAction.duration * GAME_TICK_MS / 1000) * (100 / (100 / subAction.duration)) / (currentSpeed);
        }

        return (
            <div>
                <h4 className="font-bold">{entity.name} <span className="text-sm text-yellow-300">[Lv.{entity.level}]</span></h4>
                <p className="text-gray-400">Automates {entity.type}</p>
                <hr className="border-gray-700 my-1"/>
                <p>Time per action: ~{isFinite(timePerAction) ? `${timePerAction.toFixed(2)}s` : 'N/A'}</p>
                <hr className="border-gray-700 my-1"/>
                <h5 className="font-semibold text-gray-300">Lifetime Stats:</h5>
                <ul className="text-xs text-gray-400 list-disc list-inside">
                    <li>XP Gained: {entity.stats.xpGained.toLocaleString()}</li>
                    {entity.stats.powerGained > 0 && <li>Power Gained: {entity.stats.powerGained.toLocaleString()}</li>}
                    {entity.stats.goldGained > 0 && <li>Gold Gained: {entity.stats.goldGained.toLocaleString()}</li>}
                    {entity.stats.enemiesDefeated > 0 && <li>Enemies Defeated: {entity.stats.enemiesDefeated.toLocaleString()}</li>}
                </ul>
                <hr className="border-gray-700 my-1"/>
                <p className="text-green-400">Next Level: Speed +{((nextLevelSpeed / currentSpeed - 1) * 100).toFixed(0)}%</p>
            </div>
        );
    };

    const displayedLog = useMemo(() => {
        if (activeLogTab === 'All') return gameLog;
        return gameLog.filter(msg => msg.category === activeLogTab);
    }, [gameLog, activeLogTab]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [displayedLog]);

    const actionIcons: Record<GameAction, React.ReactNode> = { [GameAction.TRAINING]: <TrainingIcon />, [GameAction.FIGHTING]: <FightingIcon />, [GameAction.EXPLORING]: <ExploringIcon />, };

    const completedQuests = useMemo(() => QUESTS.filter(q => questCompletion[q.id]), [questCompletion]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 flex flex-col items-center" onMouseMove={handleMouseMove}>
            <div className="w-full max-w-7xl mx-auto">
                <header className="text-center mb-6">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">Idle Automata</h1>
                </header>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <StatDisplay icon={<PowerIcon/>} label="Power" value={totalPlayerStats.power.toLocaleString()} color="text-red-400" onMouseEnter={() => showTooltip(<div><p>Base: {playerStats.power}</p><p>Gear: +{totalPlayerStats.gearPowerBonus.toFixed(1)}</p></div>)} onMouseLeave={hideTooltip} />
                    <StatDisplay icon={<GoldIcon/>} label="Gold" value={playerStats.gold.toLocaleString()} color="text-yellow-400" onMouseEnter={() => showTooltip(<div><p>Gold Find Bonus: {totalPlayerStats.goldBonus.toFixed(1)}%</p></div>)} onMouseLeave={hideTooltip} />
                    <StatDisplay icon={<XPIcon/>} label="XP" value={`${playerStats.xp.toLocaleString()} / ${playerStats.xpToNextLevel.toLocaleString()}`} color="text-green-400" />
                    <StatDisplay icon={<LevelIcon/>} label="Level" value={playerStats.level} color="text-blue-400" />
                </div>
                <ProgressBar progress={(playerStats.xp / playerStats.xpToNextLevel) * 100} text={`Level ${playerStats.level} Progress`} fillColor="bg-green-600" />
                <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="flex flex-col gap-6">
                        <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
                             <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Manual Actions</h2>
                             <div className="space-y-4">
                                {Object.values(GameAction).map(actionCategory => unlockedActions.includes(actionCategory) && (
                                    <div key={actionCategory}>
                                        <h3 className="flex items-center space-x-2 font-bold text-lg text-purple-200 mb-2 ml-2">{actionIcons[actionCategory]} <span>{actionCategory}</span></h3>
                                        <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg">
                                            {actionCategory === GameAction.FIGHTING ? (
                                                <div>
                                                    <button onClick={() => unlockedEnemyNames.length > 0 && handleActionClick('attack')} disabled={unlockedEnemyNames.length === 0} className="w-full text-left p-3 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors duration-200 flex items-center justify-between disabled:bg-gray-800 disabled:cursor-not-allowed" onMouseEnter={() => showTooltip(createSubActionTooltip(SUB_ACTIONS['attack']))} onMouseLeave={hideTooltip}>
                                                        <span className="font-semibold">Attack</span>
                                                        <span className={`px-3 py-1 text-sm rounded-full ${activeManualSubActionId === 'attack' ? `bg-red-500 animate-pulse` : 'bg-gray-600'}`}>{activeManualSubActionId === 'attack' ? 'Active' : 'Start'}</span>
                                                    </button>
                                                    {activeManualSubActionId === 'attack' && <div className="mt-3"><ProgressBar progress={manualProgress} fillColor="bg-red-500" /></div>}
                                                    {currentEnemy && (
                                                        <div className="mt-3">
                                                            <div onMouseEnter={() => showTooltip(<div><h4 className="font-bold text-red-400">{currentEnemy.name}</h4><p>Power: {currentEnemy.powerLevel}</p><p>Rewards: {currentEnemy.goldReward} Gold, {currentEnemy.xpReward} XP</p>{currentEnemy.gearDrops.length > 0 && ( <> <hr className="border-gray-600 my-1" /> <h5 className="font-semibold">Potential Drops:</h5><ul className="list-disc list-inside text-gray-400">{currentEnemy.gearDrops.map(drop => {
                                                                const dropCount = enemyDropHistory[currentEnemy.name]?.[drop.gearId] || 0;
                                                                return <li key={drop.gearId} className={dropCount > 0 ? 'text-green-400' : ''}>{GEAR_POOL[drop.gearId as keyof typeof GEAR_POOL].name} ({(drop.chance * 100).toFixed(1)}%){dropCount > 0 && <span className="text-yellow-300"> [Found: {dropCount}]</span>}</li>
                                                            })}</ul></>)}</div>)} onMouseLeave={hideTooltip}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <button onClick={() => changeEnemy(-1)} disabled={currentEnemyIndex <= 0} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeftIcon className="w-5 h-5"/></button>
                                                                    <p className="font-bold text-red-400">{currentEnemy.name}</p>
                                                                    <button onClick={() => changeEnemy(1)} disabled={currentEnemyIndex >= unlockedEnemyNames.length - 1} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRightIcon className="w-5 h-5"/></button>
                                                                </div>
                                                                <ProgressBar progress={(currentEnemy.currentHp / currentEnemy.maxHp) * 100} text={`${Math.ceil(currentEnemy.currentHp).toLocaleString()} / ${currentEnemy.maxHp.toLocaleString()}`} fillColor="bg-red-600" bgColor="bg-red-900/50" />
                                                            </div>
                                                            <div className="text-xs text-gray-400 flex justify-around items-center mt-2 px-2">
                                                                <span><strong className="font-semibold text-red-400/80">Power:</strong> {currentEnemy.powerLevel}</span>
                                                                <span><strong className="font-semibold text-yellow-400/80">Gold:</strong> {currentEnemy.goldReward}</span>
                                                                <span><strong className="font-semibold text-green-400/80">XP:</strong> {currentEnemy.xpReward}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : Object.values(SUB_ACTIONS).filter(sa => sa.category === actionCategory && unlockedSubActions.includes(sa.id)).map(subAction => (
                                                <div key={subAction.id}>
                                                    <button onClick={() => handleActionClick(subAction.id)} className="w-full text-left p-3 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors duration-200 flex items-center justify-between" onMouseEnter={() => showTooltip(createSubActionTooltip(subAction))} onMouseLeave={hideTooltip}>
                                                        <span className="font-semibold">{subAction.name}</span>
                                                        <span className={`px-3 py-1 text-sm rounded-full ${activeManualSubActionId === subAction.id ? `bg-blue-500 animate-pulse` : 'bg-gray-600'}`}>{activeManualSubActionId === subAction.id ? 'Active' : 'Start'}</span>
                                                    </button>
                                                    {activeManualSubActionId === subAction.id && <div className="mt-3"><ProgressBar progress={manualProgress} fillColor="bg-blue-500"/></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
                             <div className="flex justify-between items-center mb-4">
                               <h2 className="text-2xl font-bold text-purple-300">Event Log</h2>
                                <div className="flex border-b border-gray-700 text-sm">
                                    {(['All', 'System', 'Combat', 'Loot', 'Automation'] as LogCategory[]).map(tab => (<button key={tab} onClick={() => setActiveLogTab(tab)} className={`py-1 px-3 font-semibold transition-colors duration-200 ${activeLogTab === tab ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>))}
                                </div>
                            </div>
                            <div ref={logContainerRef} className="h-48 overflow-y-auto bg-gray-900/50 rounded-lg p-2 flex flex-col-reverse space-y-2 space-y-reverse">
                                {displayedLog.map(msg => (<p key={msg.id} className={`text-sm ${{success: 'text-green-400', danger: 'text-red-400', loot: 'text-yellow-300', quest: 'text-purple-300 font-bold', story: 'text-indigo-300 italic', automation: 'text-cyan-300'}[msg.type]}`}>- {msg.text}</p>))}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col">
                        <div className="flex border-b border-gray-700 mb-4">
                            {['Quests', 'Completed', 'Equipment', 'Automations'].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 px-4 font-semibold transition-colors duration-200 ${activeTab === tab ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>))}
                        </div>
                        <div className="flex-grow">
                            {activeTab === 'Quests' && (
                                <div className="space-y-4">
                                    <h2 className="text-2xl font-bold text-center text-purple-300">Quest Log</h2>
                                    {activeQuest ? (<div className="bg-gray-900/50 p-4 rounded-lg">
                                        <h3 className="font-bold text-lg text-yellow-300">{activeQuest.title}</h3> <p className="text-gray-400 italic mt-1">{activeQuest.description}</p>
                                        <div className="mt-3">
                                            <ProgressBar progress={Math.min(100, ((questProgress[activeQuestId] || (activeQuest.objective.type === 'level' ? playerStats.level : 0)) / activeQuest.objective.target) * 100)} text={`${(questProgress[activeQuestId] || (activeQuest.objective.type === 'level' ? playerStats.level : 0))} / ${activeQuest.objective.target}`} fillColor="bg-purple-500"/>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-700 text-sm text-center">
                                            <span className="font-bold text-gray-400">Rewards: </span>
                                            {activeQuest.reward.xp && <span className="text-green-400">{activeQuest.reward.xp} XP</span>}
                                            {activeQuest.reward.gold && <span className="text-yellow-400">, {activeQuest.reward.gold} Gold</span>}
                                        </div>
                                    </div>) : <p className="text-center text-gray-500 py-10">No active quest.</p>}
                                </div>
                            )}
                            {activeTab === 'Completed' && (
                                <div>
                                    <h2 className="text-2xl font-bold text-center text-purple-300 mb-4">Completed Quests</h2>
                                    <div className="h-96 overflow-y-auto space-y-2 pr-2">
                                        {completedQuests.length > 0 ? completedQuests.map(q => (
                                            <div key={q.id} className="bg-gray-900/50 p-3 rounded-lg opacity-70">
                                                <h3 className="font-bold text-gray-400 line-through">{q.title}</h3>
                                                <p className="text-gray-500 text-sm italic">{q.description}</p>
                                            </div>
                                        )) : <p className="text-center text-gray-500 py-10">No quests completed yet.</p>}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'Equipment' && (
                                <div className="space-y-4">
                                     <h2 className="text-2xl font-bold text-center text-purple-300">Equipment & Inventory</h2>
                                      <p className="text-center text-xs text-gray-500 -mt-2 mb-2">Click to equip. Ctrl+Click to upgrade. Shift+Click to sell.</p>
                                     <div className="grid grid-cols-3 gap-4 text-center mb-4">
                                         {(Object.values(GearSlot)).map(slot => {
                                            const item = equippedGear[slot];
                                            return (<div key={slot} className="bg-gray-900/50 p-2 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer" onClick={() => unequipItem(slot)} onMouseEnter={() => item && showTooltip(createItemTooltip(item))} onMouseLeave={hideTooltip}>
                                                 <p className="font-bold">{slot}</p>
                                                 {item ? <span className={rarityColor[item.gear.rarity]}>{item.gear.name} <span className="text-yellow-400">[+{item.upgradeLevel}]</span></span> : <span className="text-gray-600">Empty</span>}
                                             </div>);
                                         })}
                                     </div>
                                     <div className="h-64 overflow-y-auto bg-gray-900/50 p-2 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {inventory.map(item => (<div key={item.instanceId} onClick={(e) => handleInventoryClick(item, e)} onMouseEnter={() => showTooltip(createItemTooltip(item, equippedGear[item.gear.slot]))} onMouseLeave={hideTooltip} className={`p-2 rounded border-2 bg-gray-800 cursor-pointer ${rarityColor[item.gear.rarity]} border-gray-700 hover:border-purple-400`}>
                                            <p className="font-semibold">{item.gear.name} {item.upgradeLevel > 0 && <span className="text-yellow-400">[+{item.upgradeLevel}]</span>}</p>
                                            <p className="text-sm">Pwr: {(item.gear.basePowerBonus + item.upgradeLevel * item.gear.powerUpgradeBonus).toFixed(1)}</p>
                                        </div>))}
                                     </div>
                                </div>
                            )}
                           {activeTab === 'Automations' && (<div>
                                <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Automations</h2>
                                {foundEntities.length > 0 ? (<div className="space-y-4">{foundEntities.map(entity => {
                                    const upgradeCost = getEntityUpgradeCost(entity.level);
                                    const availableSubActions = Object.values(SUB_ACTIONS).filter(sa => sa.category === entity.type && unlockedSubActions.includes(sa.id));
                                    const assignedActionName = entity.assignedSubActionId ? SUB_ACTIONS[entity.assignedSubActionId]?.name : 'Idle';
                                    return (<div key={entity.id} className="bg-gray-900/50 p-4 rounded-lg" onMouseEnter={() => showTooltip(createEntityTooltip(entity))} onMouseLeave={hideTooltip}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-lg text-yellow-300 flex items-center space-x-2">{actionIcons[entity.type]}<span>{entity.name}</span></h3>
                                            <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">Lv. {entity.level}</span>
                                        </div>
                                        <p className="text-sm text-cyan-300 mb-2">
                                            Task: {entity.type === GameAction.FIGHTING ? `Attacking ${currentEnemy?.name || '...'}` : assignedActionName}
                                        </p>
                                        <ProgressBar progress={entity.progress} fillColor="bg-teal-500" />
                                        <div className="mt-3 grid grid-cols-2 gap-3 items-center">
                                            <select 
                                                value={entity.assignedSubActionId || ''} 
                                                onChange={(e) => handleAssignEntityTask(entity.id, e.target.value)}
                                                className="bg-gray-700 border border-gray-600 rounded-md p-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                                                disabled={availableSubActions.length === 0}
                                            >
                                                {entity.type !== GameAction.FIGHTING ? 
                                                    availableSubActions.map(sa => <option key={sa.id} value={sa.id}>{sa.name}</option>) :
                                                    <option value="attack">Attack</option>
                                                }
                                            </select>
                                            <button onClick={() => handleUpgradeEntity(entity.id)} disabled={playerStats.gold < upgradeCost} className="w-full p-2 text-sm font-semibold rounded-md bg-yellow-600 hover:bg-yellow-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400">
                                                Upgrade: {upgradeCost.toLocaleString()} Gold
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-3 border-t border-gray-700 pt-2 grid grid-cols-2 gap-x-4">
                                            <span>XP Gained: {entity.stats.xpGained.toLocaleString()}</span>
                                            {entity.stats.powerGained > 0 && <span>Power Gained: {entity.stats.powerGained.toLocaleString()}</span>}
                                            {entity.stats.goldGained > 0 && <span>Gold Gained: {entity.stats.goldGained.toLocaleString()}</span>}
                                            {entity.stats.enemiesDefeated > 0 && <span>Enemies Defeated: {entity.stats.enemiesDefeated.toLocaleString()}</span>}
                                        </div>
                                    </div>)})}</div>) : (<div className="text-center text-gray-500 py-10"><p>No entities found yet.</p><p>Complete 'Exploring' to find them!</p></div>)}
                            </div>)}
                        </div>
                    </div>
                </main>
            </div>
            <Tooltip visible={tooltip.visible} content={tooltip.content} x={tooltip.x} y={tooltip.y} />
        </div>
    );
};

export default App;