
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
    QuestIcon, InventoryIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon, WeaponIcon, ArmorIcon, AccessoryIcon
} from './components/icons';
import ProgressBar from './components/ProgressBar';
import Tooltip from './components/Tooltip';

const SAVE_KEY = 'idleAutomataSave';

const StatDisplay: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string; onMouseEnter?: () => void; onMouseLeave?: () => void; }> = ({ icon, label, value, color, onMouseEnter, onMouseLeave }) => (
  <div className={`flex items-center space-x-2 bg-gray-800/50 p-2 rounded-lg ${color}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    {icon}
    <span className="font-semibold">{label}:</span>
    <span className="font-mono">{value}</span>
  </div>
);

const App: React.FC = () => {
    // Core Game State
    const [isLoaded, setIsLoaded] = useState(false);
    const [playerStats, setPlayerStats] = useState<PlayerStats>(INITIAL_PLAYER_STATS);
    const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
    const [foundEntities, setFoundEntities] = useState<Entity[]>([]);
    const [gameLog, setGameLog] = useState<GameLogMessage[]>([{id: Date.now(), text: "A feeling of determination washes over you.", type: 'story', category: 'System'}]);
    
    // Manual Action State
    const [activeManualSubActionId, setActiveManualSubActionId] = useState<string | null>(null);
    const [manualProgress, setManualProgress] = useState(0);
    const [activeManualActionCategory, setActiveManualActionCategory] = useState<GameAction>(GameAction.TRAINING);

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

    // UI & Settings State
    const [activeTab, setActiveTab] = useState('Quests');
    const [activeLogTab, setActiveLogTab] = useState<LogCategory>('All');
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: React.ReactNode; x: number; y: number }>({ visible: false, content: null, x: 0, y: 0 });
    const [offlineProgressEnabled, setOfflineProgressEnabled] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    const gameLoopRef = useRef<number>();

    // Logging Utility
    const addLog = useCallback((text: string, type: GameLogMessage['type']) => {
        const category = LOG_CATEGORY_MAP[type];
        setGameLog(prev => [{ id: Date.now(), text, type, category }, ...prev.slice(0, 199)]);
    }, []);

    const handleLevelUp = useCallback((stats: PlayerStats, logFn: (text: string, type: GameLogMessage['type']) => void) => {
        let newStats = { ...stats };
        let leveledUp = false;
        while (newStats.xp >= newStats.xpToNextLevel) {
            leveledUp = true;
            newStats.xp -= newStats.xpToNextLevel;
            newStats.level += 1;
            newStats.power += 1; // Base power gain
            newStats.xpToNextLevel = getXpForNextLevel(newStats.level);
            logFn(`Ding! You reached level ${newStats.level}!`, 'quest');
        }
        return newStats;
    }, []);

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

    const handleMouseMove = useCallback((e: React.MouseEvent) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY })), []);
    const showTooltip = useCallback((content: React.ReactNode) => setTooltip(prev => ({ ...prev, visible: true, content })), []);
    const hideTooltip = useCallback(() => setTooltip(prev => ({ ...prev, visible: false, content: null })), []);

    // Save/Load Logic
    const saveGame = useCallback(() => {
        const stateToSave = {
            playerStats, currentEnemyIndex, foundEntities, unlockedActions, unlockedSubActions,
            questCompletion, questProgress, activeQuestId, unlockedEnemyNames, subActionCompletionCounts,
            enemyDropHistory, inventory, equippedGear, offlineProgressEnabled, activeManualActionCategory,
            lastSaveTimestamp: Date.now(),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
    }, [
        playerStats, currentEnemyIndex, foundEntities, unlockedActions, unlockedSubActions,
        questCompletion, questProgress, activeQuestId, unlockedEnemyNames, subActionCompletionCounts,
        enemyDropHistory, inventory, equippedGear, offlineProgressEnabled, activeManualActionCategory
    ]);

    // Auto-save timer
    useEffect(() => {
        if (!isLoaded) return;
        const saveInterval = setInterval(saveGame, 30000);
        window.addEventListener('beforeunload', saveGame);
        return () => {
            clearInterval(saveInterval);
            window.removeEventListener('beforeunload', saveGame);
        };
    }, [saveGame, isLoaded]);

    // Load game on initial mount
    useEffect(() => {
        const savedDataJSON = localStorage.getItem(SAVE_KEY);
        if (!savedDataJSON) {
            setIsLoaded(true);
            return;
        }

        try {
            const savedData = JSON.parse(savedDataJSON);
            const offlineTimeMs = Date.now() - savedData.lastSaveTimestamp;
            const offlineTimeSec = offlineTimeMs / 1000;
            let reportLogs: {text: string, type: GameLogMessage['type']}[] = [];

            if (savedData.offlineProgressEnabled && offlineTimeSec > 60) {
                // Perform offline calculations
                let tempPlayerStats = { ...savedData.playerStats };
                let tempEntities = [...savedData.foundEntities];
                let tempQuestProgress = {...savedData.questProgress};
                
                let offlineGains = { xp: 0, gold: 0, power: 0, actions: 0 };

                tempEntities.forEach((entity, index) => {
                    const subAction = entity.assignedSubActionId ? SUB_ACTIONS[entity.assignedSubActionId] : null;
                    if (!subAction) return;

                    const effectiveSpeed = entity.automationSpeed * (entity.level / 2 + 0.5);
                    const ticksToComplete = 100 / effectiveSpeed;
                    const timePerAction = (ticksToComplete * GAME_TICK_MS) / 1000;
                    const actionsCompleted = Math.floor(offlineTimeSec / timePerAction);

                    if (actionsCompleted <= 0) return;

                    offlineGains.actions += actionsCompleted;
                    let entityGains = { xp: 0, power: 0, gold: 0, enemies: 0 };

                    if (subAction.category === GameAction.FIGHTING) {
                        const enemyData = ENEMIES_LIST.find(e => e.name === savedData.unlockedEnemyNames[savedData.currentEnemyIndex]);
                        if(enemyData) {
                            const autoDamage = Math.max(1, (totalPlayerStats.power / 10) * (entity.level / 2 + 0.5));
                            const hitsToKill = Math.ceil(enemyData.maxHp / autoDamage);
                            const timeToKill = (hitsToKill * SUB_ACTIONS['attack'].duration * GAME_TICK_MS) / 1000;
                            const enemiesDefeated = Math.floor(offlineTimeSec / timeToKill);
                            entityGains.enemies = enemiesDefeated;
                            entityGains.gold = enemiesDefeated * enemyData.goldReward;
                            entityGains.xp = enemiesDefeated * enemyData.xpReward;
                        }
                    } else {
                        entityGains.xp = actionsCompleted * subAction.xpReward;
                        entityGains.power = actionsCompleted * (subAction.powerGain || 0);
                        entityGains.gold = actionsCompleted * (subAction.goldFind || 0);

                         if (subAction.category === GameAction.EXPLORING) {
                            // Simplified offline entity finding
                            const findRolls = Math.floor(actionsCompleted * ENTITY_FIND_CHANCE);
                            if (findRolls > 0) {
                                const undiscovered = ENTITIES_POOL.filter(p_entity => !tempEntities.find(f_entity => f_entity.id === p_entity.id));
                                if (undiscovered.length > 0) {
                                    const newEntity = { ...undiscovered[0], progress: 0 };
                                    tempEntities.push(newEntity);
                                    reportLogs.push({ text: `Your ${entity.name} discovered a ${newEntity.name} while you were away!`, type: 'automation'});
                                }
                            }
                        }
                    }

                    // Update stats
                    tempPlayerStats.xp += entityGains.xp;
                    tempPlayerStats.power += entityGains.power;
                    tempPlayerStats.gold += entityGains.gold;
                    
                    // Update quest progress
                    const activeQuest = QUESTS.find(q => q.id === savedData.activeQuestId);
                    if (activeQuest && activeQuest.objective.type === 'sub_action_complete' && activeQuest.objective.qualifier === subAction.id) {
                         tempQuestProgress[activeQuest.id] = (tempQuestProgress[activeQuest.id] || 0) + actionsCompleted;
                    }

                    // Update entity lifetime stats
                    tempEntities[index].stats.xpGained += entityGains.xp;
                    tempEntities[index].stats.powerGained += entityGains.power;
                    tempEntities[index].stats.goldGained += entityGains.gold;
                    tempEntities[index].stats.enemiesDefeated += entityGains.enemies;
                });
                
                const initialLevel = tempPlayerStats.level;
                tempPlayerStats = handleLevelUp(tempPlayerStats, (text, type) => reportLogs.push({text, type}));

                reportLogs.unshift({ text: `While you were away for ${Math.floor(offlineTimeSec / 60)} minutes, your automations were busy!`, type: 'story' });
                if(tempPlayerStats.level > initialLevel) reportLogs.push({ text: `You gained ${tempPlayerStats.level - initialLevel} level(s)!`, type: 'success' });
            
                // Apply calculated state
                setPlayerStats(tempPlayerStats);
                setFoundEntities(tempEntities);
                setQuestProgress(tempQuestProgress);
            } else {
                // Standard load without offline progress
                setPlayerStats(savedData.playerStats);
                setFoundEntities(savedData.foundEntities);
                setQuestProgress(savedData.questProgress);
            }

            // Load the rest of the state
            setCurrentEnemyIndex(savedData.currentEnemyIndex);
            setUnlockedActions(savedData.unlockedActions);
            setUnlockedSubActions(savedData.unlockedSubActions);
            setQuestCompletion(savedData.questCompletion);
            setActiveQuestId(savedData.activeQuestId);
            setUnlockedEnemyNames(savedData.unlockedEnemyNames);
            setSubActionCompletionCounts(savedData.subActionCompletionCounts);
            setEnemyDropHistory(savedData.enemyDropHistory);
            setInventory(savedData.inventory);
            setEquippedGear(savedData.equippedGear);
            setOfflineProgressEnabled(savedData.offlineProgressEnabled);
            setActiveManualActionCategory(savedData.activeManualActionCategory || GameAction.TRAINING);

            const reversedLogs = reportLogs.reverse();
            setGameLog(prev => [...reversedLogs.map(log => ({...log, id: Date.now() + Math.random(), category: LOG_CATEGORY_MAP[log.type]})), ...prev]);

        } catch (error) {
            console.error("Failed to load saved data:", error);
            localStorage.removeItem(SAVE_KEY); // Clear corrupted data
        } finally {
            setIsLoaded(true);
        }
    }, [handleLevelUp]); // Run only once on mount

    const resetProgress = () => {
        if (window.confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
            clearInterval(gameLoopRef.current);
            localStorage.removeItem(SAVE_KEY);
            window.location.reload();
        }
    };
    
    // Progression Unlocks
    useEffect(() => {
        if (playerStats.level >= UNLOCKS.FIGHTING_ACTION.level && !unlockedActions.includes(GameAction.FIGHTING)) {
            setUnlockedActions(prev => [...prev, GameAction.FIGHTING]);
            setUnlockedSubActions(prev => [...prev, 'attack']);
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

    const startNewFight = useCallback((index: number) => {
        if (unlockedEnemyNames.length === 0 || index < 0 || index >= unlockedEnemyNames.length) {
            setCurrentEnemy(null); return;
        }
        const enemyName = unlockedEnemyNames[index];
        const enemyData = ENEMIES_LIST.find(e => e.name === enemyName);
        if (enemyData) {
            setCurrentEnemy({ ...enemyData, currentHp: enemyData.maxHp });
            addLog(`A wild ${enemyData.name} appears!`, 'danger');
        }
    }, [unlockedEnemyNames, addLog]);

    // Auto-select first enemy when available
    useEffect(() => {
        if (isLoaded && unlockedActions.includes(GameAction.FIGHTING) && unlockedEnemyNames.length > 0 && !currentEnemy) {
            startNewFight(currentEnemyIndex);
        }
    }, [isLoaded, unlockedEnemyNames, currentEnemy, unlockedActions, startNewFight, currentEnemyIndex]);

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
            setPlayerStats(prev => handleLevelUp({ ...prev, ...statsUpdate }, addLog));
        }
    }, [activeQuest, questCompletion, questProgress, playerStats, totalPlayerStats.power, handleLevelUp, addLog]);
    
    useEffect(() => { if(activeQuestId && questCompletion[activeQuestId]){ startNextQuest(); } }, [questCompletion, activeQuestId, startNextQuest]);
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
                const newEntity = { ...newEntityTemplate, progress: 0, assignedSubActionId: availableSubActions.length > 0 ? availableSubActions[0].id : undefined };
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
        if (subAction.category === GameAction.EXPLORING) findNewEntity();
        setSubActionCompletionCounts(prev => ({...prev, [subAction.id]: (prev[subAction.id] || 0) + 1}));
        setPlayerStats(prev => handleLevelUp({ ...prev, ...statsUpdate }, addLog));
        updateQuestProgress('sub_action_complete', subAction.id);
    }, [playerStats, totalPlayerStats.goldBonus, handleLevelUp, updateQuestProgress, addLog, findNewEntity]);

    const attackEnemy = useCallback(() => {
        if (!currentEnemy) { startNewFight(currentEnemyIndex); return; }
        const playerDamage = Math.max(1, totalPlayerStats.power - Math.floor(currentEnemy.powerLevel / 2));
        const newHp = currentEnemy.currentHp - playerDamage;
        if (newHp <= 0) {
            addLog(`You defeated the ${currentEnemy.name}! +${currentEnemy.goldReward} Gold, +${currentEnemy.xpReward} XP.`, 'success');
            setSubActionCompletionCounts(prev => ({...prev, 'attack': (prev['attack'] || 0) + 1}));
            currentEnemy.gearDrops.forEach(drop => {
                if (Math.random() < drop.chance) {
                     setEnemyDropHistory(prev => {
                        const newHistory = {...prev};
                        if (!newHistory[currentEnemy.name]) newHistory[currentEnemy.name] = {};
                        newHistory[currentEnemy.name][drop.gearId] = (newHistory[currentEnemy.name][drop.gearId] || 0) + 1;
                        return newHistory;
                    });
                    const gear = GEAR_POOL[drop.gearId as keyof typeof GEAR_POOL];
                    const newItem: InventoryItem = { instanceId: `item_${Date.now()}_${Math.random()}`, gear, upgradeLevel: 0 };
                    setInventory(prev => [...prev, newItem]);
                    addLog(`Looted a ${gear.name}!`, 'loot');
                }
            });
            updateQuestProgress('kill', currentEnemy.name);
            setPlayerStats(prev => handleLevelUp({ ...prev, gold: prev.gold + currentEnemy.goldReward, xp: prev.xp + currentEnemy.xpReward }, addLog));
            startNewFight(currentEnemyIndex);
        } else {
            setCurrentEnemy(prev => prev ? {...prev, currentHp: newHp} : null);
        }
    }, [currentEnemy, totalPlayerStats.power, addLog, updateQuestProgress, handleLevelUp, currentEnemyIndex, startNewFight]);

     const completeAutomatedSubAction = useCallback((subAction: SubAction, entityId: string) => {
        let statGains = { xp: 0, power: 0, gold: 0, enemies: 0 };
        if (subAction.category === GameAction.FIGHTING) {
            if (!currentEnemy) return;
            const entity = foundEntities.find(e => e.id === entityId); if (!entity) return;
            const autoDamage = Math.max(1, (totalPlayerStats.power / 10) * (entity.level / 2 + 0.5));
            const newHp = currentEnemy.currentHp - autoDamage;
            if (newHp <= 0) {
                 addLog(`${entity.name} defeated the ${currentEnemy.name}!`, 'automation');
                 statGains.enemies = 1;
                 startNewFight(currentEnemyIndex);
            } else { setCurrentEnemy(prev => prev ? {...prev, currentHp: newHp} : null); }
        } else {
            statGains.xp = subAction.xpReward; statGains.power = subAction.powerGain || 0; statGains.gold = subAction.goldFind || 0;
            setPlayerStats(prev => handleLevelUp({ ...prev, xp: prev.xp + statGains.xp, power: prev.power + statGains.power, gold: prev.gold + statGains.gold }, addLog));
            if (subAction.category === GameAction.EXPLORING) {
                 updateQuestProgress('find_entity');
                 findNewEntity(); 
            }
            updateQuestProgress('sub_action_complete', subAction.id);
        }
        setSubActionCompletionCounts(prev => ({...prev, [subAction.id]: (prev[subAction.id] || 0) + 1}));
        setFoundEntities(prev => prev.map(e => e.id === entityId ? { ...e, stats: { xpGained: e.stats.xpGained + statGains.xp, powerGained: e.stats.powerGained + statGains.power, goldGained: e.stats.goldGained + statGains.gold, enemiesDefeated: e.stats.enemiesDefeated + statGains.enemies } } : e ));
    }, [handleLevelUp, addLog, updateQuestProgress, currentEnemy, totalPlayerStats.power, startNewFight, currentEnemyIndex, foundEntities, findNewEntity]);

    // Game Loop
    useEffect(() => {
        if (!isLoaded) return;
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
                    } return newProgress;
                });
            }
            setFoundEntities(currentEntities => {
                if (currentEntities.length === 0) return currentEntities;
                return currentEntities.map(entity => {
                    const subAction = entity.assignedSubActionId ? SUB_ACTIONS[entity.assignedSubActionId] : null;
                    if (!subAction) return entity;
                    const newProgress = entity.progress + (entity.automationSpeed * (entity.level / 2 + 0.5));
                    if (newProgress >= 100) {
                        completeAutomatedSubAction(subAction, entity.id);
                        return { ...entity, progress: newProgress - 100 };
                    } return { ...entity, progress: newProgress };
                });
            });
        }, GAME_TICK_MS);
        return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
    }, [isLoaded, activeManualSubActionId, attackEnemy, completeManualSubAction, completeAutomatedSubAction]);
    
    useEffect(() => { if (isLoaded) startNewFight(currentEnemyIndex); }, [isLoaded, currentEnemyIndex]);

    const handleActionClick = (subActionId: string) => {
        if (activeManualSubActionId === subActionId) { setActiveManualSubActionId(null); setManualProgress(0); }
        else { if(subActionId === 'attack' && !currentEnemy) startNewFight(currentEnemyIndex); setActiveManualSubActionId(subActionId); setManualProgress(0); }
    };
    
    const changeEnemy = (direction: -1 | 1) => { const newIndex = currentEnemyIndex + direction; if (newIndex >= 0 && newIndex < unlockedEnemyNames.length) { setCurrentEnemyIndex(newIndex); startNewFight(newIndex); } };

    const handleInventoryClick = (item: InventoryItem, e: React.MouseEvent) => {
        if (e.shiftKey) {
            const sellValue = item.gear.sellValue * (1 + item.upgradeLevel * 0.2);
            setPlayerStats(prev => ({...prev, gold: prev.gold + Math.floor(sellValue)}));
            setInventory(prev => prev.filter(invItem => invItem.instanceId !== item.instanceId));
            addLog(`Sold ${item.gear.name} for ${Math.floor(sellValue)} gold.`, 'loot');
        } else if (e.ctrlKey) {
            const equippedItem = equippedGear[item.gear.slot];
            if (equippedItem && equippedItem.gear.id === item.gear.id) {
                if (equippedItem.upgradeLevel < equippedItem.gear.maxUpgradeLevel) {
                    setEquippedGear(prev => ({...prev, [item.gear.slot]: { ...equippedItem, upgradeLevel: equippedItem.upgradeLevel + 1 }}));
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

    const unequipItem = (slot: GearSlot) => { const item = equippedGear[slot]; if (item) { setInventory(prev => [...prev, item]); setEquippedGear(prev => { const newGear = {...prev}; delete newGear[slot]; return newGear; }); } };
    const handleUpgradeEntity = (entityId: string) => { setFoundEntities(prev => { const entity = prev.find(e => e.id === entityId); if (!entity) return prev; const cost = getEntityUpgradeCost(entity.level); if (playerStats.gold >= cost) { setPlayerStats(ps => ({...ps, gold: ps.gold - cost})); addLog(`Upgraded ${entity.name} to Level ${entity.level + 1}!`, 'automation'); return prev.map(e => e.id === entityId ? {...e, level: e.level + 1} : e); } else { addLog(`Not enough gold to upgrade ${entity.name}.`, 'automation'); return prev; } }); };
    const handleAssignEntityTask = (entityId: string, subActionId: string) => setFoundEntities(prev => prev.map(e => e.id === entityId ? {...e, assignedSubActionId: subActionId, progress: 0} : e));

    const rarityColor: Record<Rarity, string> = { Common: 'text-gray-300', Uncommon: 'text-green-400', Rare: 'text-blue-400', Epic: 'text-purple-400' };
    const rarityBorder: Record<Rarity, string> = { Common: 'border-gray-600', Uncommon: 'border-green-600', Rare: 'border-blue-600', Epic: 'border-purple-600' };

    const createItemTooltip = (item: InventoryItem, equippedItem?: InventoryItem) => {
      const powerFromUpgrades = item.upgradeLevel * item.gear.powerUpgradeBonus;
      const goldFromUpgrades = item.upgradeLevel * item.gear.goldUpgradeBonus;
      const totalPower = item.gear.basePowerBonus + powerFromUpgrades;
      const totalGold = item.gear.baseGoldBonus + goldFromUpgrades;

      let comparison = null;
      if (equippedItem) {
        const equippedPower = equippedItem.gear.basePowerBonus + (equippedItem.upgradeLevel * equippedItem.gear.powerUpgradeBonus);
        const equippedGold = equippedItem.gear.baseGoldBonus + (equippedItem.upgradeLevel * equippedItem.gear.goldUpgradeBonus);
        const powerDiff = totalPower - equippedPower;
        const goldDiff = totalGold - equippedGold;
        comparison = (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <h4 className="font-bold text-gray-400">Comparison:</h4>
            <p className={powerDiff > 0 ? 'text-green-400' : powerDiff < 0 ? 'text-red-400' : ''}>
              Power: {powerDiff >= 0 ? '+' : ''}{powerDiff.toFixed(1)}
            </p>
            <p className={goldDiff > 0 ? 'text-green-400' : goldDiff < 0 ? 'text-red-400' : ''}>
              Gold Bonus: {goldDiff >= 0 ? '+' : ''}{goldDiff.toFixed(1)}%
            </p>
          </div>
        );
      }
      
      return (
        <div>
          <h3 className={`font-bold text-lg ${rarityColor[item.gear.rarity]}`}>{item.gear.name} {item.upgradeLevel > 0 && `+${item.upgradeLevel}`}</h3>
          <p className="text-sm text-gray-500">{item.gear.rarity} {item.gear.slot}</p>
          <div className="my-2">
              <p>Power: <span className="font-semibold">{totalPower.toFixed(1)}</span></p>
              {totalGold > 0 && <p>Gold Bonus: <span className="font-semibold">{totalGold.toFixed(1)}%</span></p>}
          </div>
          {comparison}
          <div className="mt-2 text-xs text-gray-500 italic">
            <p>Click to Equip</p>
            <p>Shift+Click to Sell</p>
            <p>Ctrl+Click with matching equipped to Upgrade</p>
          </div>
        </div>
      );
    };
    
    const createSubActionTooltip = (subAction: SubAction) => (
        <div>
            <h3 className="font-bold text-lg">{subAction.name}</h3>
            <p className="text-sm text-gray-400 mb-2">{subAction.description}</p>
            <p>Duration: <span className="font-mono">{(subAction.duration / 10).toFixed(1)}s</span></p>
            <p>XP Reward: <span className="font-mono text-purple-300">{subAction.xpReward}</span></p>
            {subAction.powerGain && <p>Power Gain: <span className="font-mono text-red-400">{subAction.powerGain}</span></p>}
            {subAction.goldFind && <p>Gold Find: <span className="font-mono text-yellow-400">~{subAction.goldFind}</span></p>}
            {(subActionCompletionCounts[subAction.id] || 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                    <p>Times Completed: <span className="font-mono">{subActionCompletionCounts[subAction.id]}</span></p>
                </div>
            )}
        </div>
    );
    
    const createEntityTooltip = (entity: Entity) => (
        <div>
            <h3 className="font-bold text-lg">{entity.name} (Lvl {entity.level})</h3>
            <p className="text-sm text-gray-400 mb-2">Automates {entity.type} tasks.</p>
            <p>Speed: <span className="font-mono">{(entity.automationSpeed * (entity.level / 2 + 0.5)).toFixed(2)} ticks/frame</span></p>
            <div className="mt-2 pt-2 border-t border-gray-700">
                <h4 className="font-bold text-gray-400">Lifetime Stats:</h4>
                <p>XP Gained: {Math.floor(entity.stats.xpGained)}</p>
                <p>Power Gained: {Math.floor(entity.stats.powerGained)}</p>
                <p>Gold Gained: {Math.floor(entity.stats.goldGained)}</p>
                <p>Enemies Defeated: {entity.stats.enemiesDefeated}</p>
            </div>
        </div>
    );

    const displayedLog = useMemo(() => { if (activeLogTab === 'All') return gameLog; return gameLog.filter(msg => msg.category === activeLogTab); }, [gameLog, activeLogTab]);
    useEffect(() => { if (logContainerRef.current) { logContainerRef.current.scrollTop = 0; } }, [displayedLog, activeLogTab]);

    const actionIcons: Record<GameAction, React.ReactNode> = { [GameAction.TRAINING]: <TrainingIcon />, [GameAction.FIGHTING]: <FightingIcon />, [GameAction.EXPLORING]: <ExploringIcon />, };
    const gearSlotIcons: Record<GearSlot, React.ReactNode> = { [GearSlot.WEAPON]: <WeaponIcon />, [GearSlot.ARMOR]: <ArmorIcon />, [GearSlot.ACCESSORY]: <AccessoryIcon />, };
    const completedQuests = useMemo(() => QUESTS.filter(q => questCompletion[q.id]), [questCompletion]);

    if (!isLoaded) { return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-2xl text-purple-300">Loading your adventure...</div> }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 flex flex-col items-center" onMouseMove={handleMouseMove}>
            <div className="w-full max-w-7xl mx-auto">
                <header className="flex justify-between items-center bg-gray-800/30 p-4 rounded-xl shadow-lg">
                    <h1 className="text-3xl font-bold text-purple-300 tracking-wider">Idle Automata</h1>
                    <div className="flex space-x-4">
                        <StatDisplay icon={<PowerIcon className="w-5 h-5"/>} label="Power" value={totalPlayerStats.power} color="text-red-400" />
                        <StatDisplay icon={<GoldIcon className="w-5 h-5"/>} label="Gold" value={Math.floor(playerStats.gold)} color="text-yellow-400" />
                        <StatDisplay icon={<XPIcon className="w-5 h-5"/>} label="XP" value={`${Math.floor(playerStats.xp)} / ${playerStats.xpToNextLevel}`} color="text-purple-400" />
                        <StatDisplay icon={<LevelIcon className="w-5 h-5"/>} label="Level" value={playerStats.level} color="text-blue-400" />
                    </div>
                </header>
                 <div className="mt-4">
                    <ProgressBar 
                        progress={(playerStats.xp / playerStats.xpToNextLevel) * 100} 
                        fillColor="bg-purple-500"
                        text={`Level ${playerStats.level} XP`}
                    />
                </div>
                <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col space-y-4">
                        <h2 className="text-2xl font-bold text-center text-purple-300">Manual Actions</h2>
                        <div className="flex justify-center bg-gray-900/50 rounded-lg p-1">
                            {unlockedActions.map(action => (
                                <button key={action} onClick={() => setActiveManualActionCategory(action)} className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 font-semibold transition-colors duration-200 rounded-md ${activeManualActionCategory === action ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
                                    {actionIcons[action]}
                                    <span>{action}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex-grow space-y-2">
                             {Object.values(SUB_ACTIONS)
                                .filter(sa => sa.category === activeManualActionCategory && unlockedSubActions.includes(sa.id))
                                .map(subAction => (
                                <button key={subAction.id} onClick={() => handleActionClick(subAction.id)} 
                                        className={`w-full p-3 font-semibold rounded-md transition-colors text-left ${activeManualSubActionId === subAction.id ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        onMouseEnter={() => showTooltip(createSubActionTooltip(subAction))}
                                        onMouseLeave={hideTooltip}
                                >
                                    {subAction.name}
                                </button>
                            ))}
                        </div>
                        <div className="h-20">
                            {activeManualSubActionId && (
                                <div className="space-y-2">
                                    <p className="text-center font-semibold">{SUB_ACTIONS[activeManualSubActionId].name}</p>
                                    <ProgressBar progress={manualProgress} fillColor="bg-green-500" />
                                </div>
                            )}
                        </div>
                        {activeManualActionCategory === GameAction.FIGHTING && (
                            <div className="bg-gray-900/50 p-3 rounded-lg">
                                {currentEnemy ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-bold text-lg">{currentEnemy.name}</h3>
                                            <span className="text-sm text-gray-400">Power: {currentEnemy.powerLevel}</span>
                                        </div>
                                        <ProgressBar progress={(currentEnemy.currentHp / currentEnemy.maxHp) * 100} text={`${currentEnemy.currentHp} / ${currentEnemy.maxHp}`} fillColor="bg-red-500" />
                                        <div className="flex justify-center items-center space-x-4 mt-2">
                                            <button onClick={() => changeEnemy(-1)} disabled={currentEnemyIndex === 0} className="p-2 bg-gray-700 rounded-full disabled:opacity-50 hover:bg-gray-600"><ChevronLeftIcon /></button>
                                            <span className="font-mono text-sm">{currentEnemyIndex + 1} / {unlockedEnemyNames.length}</span>
                                            <button onClick={() => changeEnemy(1)} disabled={currentEnemyIndex === unlockedEnemyNames.length - 1} className="p-2 bg-gray-700 rounded-full disabled:opacity-50 hover:bg-gray-600"><ChevronRightIcon /></button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500">No enemy selected or available.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col">
                        <h2 className="text-2xl font-bold text-center text-purple-300 border-b border-gray-700 pb-2">Event Log</h2>
                        <div className="flex border-b border-gray-700">
                             {(['All', 'System', 'Combat', 'Loot', 'Automation'] as LogCategory[]).map(tab => (
                                <button key={tab} onClick={() => setActiveLogTab(tab)} className={`py-1 px-3 text-sm font-semibold transition-colors duration-200 ${activeLogTab === tab ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>
                            ))}
                        </div>
                        <div ref={logContainerRef} className="flex-grow space-y-1 overflow-y-auto mt-2 pr-2 flex flex-col-reverse" style={{maxHeight: '400px'}}>
                            {displayedLog.map((msg, index) => {
                                const colors: Record<GameLogMessage['type'], string> = { story: 'text-cyan-300', quest: 'text-yellow-300', danger: 'text-red-400', success: 'text-green-400', loot: 'text-blue-300', automation: 'text-gray-400' };
                                return <p key={`${msg.id}-${index}`} className={`text-sm ${colors[msg.type]}`}>{msg.text}</p>
                            })}
                        </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col lg:col-span-2">
                        <div className="flex border-b border-gray-700 mb-4">
                            {[ {name: 'Quests', icon: <QuestIcon />}, {name: 'Completed', icon: <QuestIcon />}, {name: 'Equipment', icon: <InventoryIcon />}, {name: 'Automations', icon: <PowerIcon />}, {name: 'Settings', icon: <SettingsIcon />} ].map(tab => (
                                <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex items-center space-x-2 py-2 px-4 font-semibold transition-colors duration-200 ${activeTab === tab.name ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-500 hover:text-gray-300'}`}>
                                    {React.cloneElement(tab.icon as React.ReactElement, { className: 'w-5 h-5' })}
                                    <span>{tab.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex-grow min-h-[300px]">
                             {activeTab === 'Quests' && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Active Quest</h2>
                                    {activeQuest ? (
                                        <div className="bg-gray-900/50 p-4 rounded-lg">
                                            <h3 className="text-xl font-semibold text-yellow-300">{activeQuest.title}</h3>
                                            <p className="text-gray-400 mt-1 italic">"{activeQuest.description}"</p>
                                            <div className="mt-4">
                                                <p className="font-semibold">Objective:</p>
                                                {activeQuest.objective.type === 'level' && <p>Reach Level {activeQuest.objective.target}</p>}
                                                {activeQuest.objective.type === 'power' && <p>Reach {activeQuest.objective.target} Power</p>}
                                                {activeQuest.objective.type === 'kill' && <p>Defeat {activeQuest.objective.target} {activeQuest.objective.qualifier}(s)</p>}
                                                {activeQuest.objective.type === 'sub_action_complete' && <p>Perform '{SUB_ACTIONS[activeQuest.objective.qualifier!].name}' {activeQuest.objective.target} times</p>}
                                                {activeQuest.objective.type === 'find_entity' && <p>Discover {activeQuest.objective.target} new entity/entities.</p>}
                                            </div>
                                            <div className="mt-2">
                                                {activeQuest.objective.type !== 'level' && activeQuest.objective.type !== 'power' ? (
                                                     <ProgressBar progress={((questProgress[activeQuestId] || 0) / activeQuest.objective.target) * 100} text={`${questProgress[activeQuestId] || 0} / ${activeQuest.objective.target}`} fillColor="bg-yellow-500"/>
                                                ) : activeQuest.objective.type === 'level' ? (
                                                     <ProgressBar progress={(playerStats.level / activeQuest.objective.target) * 100} text={`${playerStats.level} / ${activeQuest.objective.target}`} fillColor="bg-yellow-500"/>
                                                ): (
                                                     <ProgressBar progress={(totalPlayerStats.power / activeQuest.objective.target) * 100} text={`${totalPlayerStats.power} / ${activeQuest.objective.target}`} fillColor="bg-yellow-500"/>
                                                )}
                                            </div>
                                            <div className="mt-4">
                                                <p className="font-semibold">Rewards:</p>
                                                <ul className="list-disc list-inside text-gray-300">
                                                    {activeQuest.reward.xp && <li>{activeQuest.reward.xp} XP</li>}
                                                    {activeQuest.reward.gold && <li>{activeQuest.reward.gold} Gold</li>}
                                                    {activeQuest.reward.unlocks && <li>Unlocks: {SUB_ACTIONS[activeQuest.reward.unlocks as keyof typeof SUB_ACTIONS]?.name || activeQuest.reward.unlocks}</li>}
                                                </ul>
                                            </div>
                                        </div>
                                    ) : ( <p className="text-center text-gray-500">No active quests.</p> )}
                                </div>
                            )}
                            {activeTab === 'Completed' && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Completed Quests</h2>
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                        {completedQuests.length > 0 ? completedQuests.map(q => (
                                            <div key={q.id} className="bg-gray-900/50 p-3 rounded-md opacity-70">
                                                <h3 className="font-semibold text-gray-400">{q.title}</h3>
                                            </div>
                                        )) : <p className="text-center text-gray-500">No quests completed yet.</p>}
                                    </div>
                                </div>
                            )}
                             {activeTab === 'Equipment' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-xl font-bold mb-2 text-center">Equipped</h3>
                                        <div className="bg-gray-900/50 p-4 rounded-lg space-y-2">
                                            {(Object.keys(GearSlot) as Array<keyof typeof GearSlot>).map(key => {
                                                const slot = GearSlot[key];
                                                const item = equippedGear[slot];
                                                return (
                                                    <div key={slot} onClick={() => unequipItem(slot)} onMouseEnter={() => item && showTooltip(createItemTooltip(item))} onMouseLeave={hideTooltip} className={`flex items-center space-x-3 p-2 rounded-md border-2 ${item ? rarityBorder[item.gear.rarity] : 'border-gray-700 border-dashed'} ${item ? 'cursor-pointer hover:bg-red-900/50' : ''}`}>
                                                        <div className="w-8 h-8 flex items-center justify-center">{gearSlotIcons[slot]}</div>
                                                        <div className="flex-grow">
                                                            <p className="font-semibold text-gray-500">{slot}</p>
                                                            {item && <p className={`${rarityColor[item.gear.rarity]}`}>{item.gear.name} {item.upgradeLevel > 0 && `+${item.upgradeLevel}`}</p>}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                     <div>
                                        <h3 className="text-xl font-bold mb-2 text-center">Inventory ({inventory.length})</h3>
                                        <div className="bg-gray-900/50 p-4 rounded-lg max-h-96 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {inventory.map(item => (
                                                <div key={item.instanceId} onClick={(e) => handleInventoryClick(item, e)} onMouseEnter={() => showTooltip(createItemTooltip(item, equippedGear[item.gear.slot]))} onMouseLeave={hideTooltip}
                                                    className={`p-2 rounded-md border-2 ${rarityBorder[item.gear.rarity]} bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors flex flex-col items-center text-center`}
                                                >
                                                    <div className="w-8 h-8">{gearSlotIcons[item.gear.slot]}</div>
                                                    <p className={`text-xs truncate w-full ${rarityColor[item.gear.rarity]}`}>{item.gear.name}</p>
                                                    {item.upgradeLevel > 0 && <span className="text-xs font-bold">+${item.upgradeLevel}</span>}
                                                </div>
                                            ))}
                                            {inventory.length === 0 && <p className="text-center text-gray-500 col-span-full">Your inventory is empty.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                             {activeTab === 'Automations' && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Automations</h2>
                                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                        {foundEntities.length > 0 ? foundEntities.map(entity => (
                                            <div key={entity.id} className="bg-gray-900/50 p-4 rounded-lg" onMouseEnter={() => showTooltip(createEntityTooltip(entity))} onMouseLeave={hideTooltip}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-xl font-semibold">{entity.name} - Lvl {entity.level}</h3>
                                                        <p className="text-sm text-gray-400">Automating {entity.type}</p>
                                                    </div>
                                                    <button onClick={() => handleUpgradeEntity(entity.id)} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1 px-3 rounded text-sm">
                                                        Upgrade ({getEntityUpgradeCost(entity.level)}G)
                                                    </button>
                                                </div>
                                                <div className="mt-2">
                                                     <ProgressBar progress={entity.progress} fillColor="bg-blue-500" text={SUB_ACTIONS[entity.assignedSubActionId!]?.name || 'Idle'}/>
                                                </div>
                                                <div className="mt-2">
                                                    <select value={entity.assignedSubActionId} onChange={(e) => handleAssignEntityTask(entity.id, e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1">
                                                         {Object.values(SUB_ACTIONS).filter(sa => sa.category === entity.type && unlockedSubActions.includes(sa.id)).map(sa => (
                                                            <option key={sa.id} value={sa.id}>{sa.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )) : <p className="text-center text-gray-500">You have not discovered any automations yet. Try exploring.</p>}
                                    </div>
                                </div>
                            )}
                             {activeTab === 'Settings' && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Settings</h2>
                                    <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg max-w-md mx-auto">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="offlineProgress" className="font-semibold text-gray-300">Enable Offline Progress</label>
                                            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                                <input type="checkbox" name="offlineProgress" id="offlineProgress" checked={offlineProgressEnabled} onChange={() => setOfflineProgressEnabled(!offlineProgressEnabled)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                                                <label htmlFor="offlineProgress" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-700 cursor-pointer"></label>
                                            </div>
                                        </div>
                                         <p className="text-xs text-gray-500 -mt-2">Allows your automations to work for you while the game is closed. Takes effect on next load.</p>
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                                            <button onClick={saveGame} className="w-full p-2 font-semibold rounded-md bg-blue-600 hover:bg-blue-500 transition-colors">
                                                Save Game
                                            </button>
                                            <button onClick={resetProgress} className="w-full p-2 font-semibold rounded-md bg-red-800 hover:bg-red-700 transition-colors">
                                                Reset Progress
                                            </button>
                                        </div>
                                    </div>
                                    <style>{`.toggle-checkbox:checked { right: 0; border-color: #8b5cf6; } .toggle-checkbox:checked + .toggle-label { background-color: #8b5cf6; }`}</style>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
            <Tooltip visible={tooltip.visible} content={tooltip.content} x={tooltip.x} y={tooltip.y} />
        </div>
    );
};

export default App;
