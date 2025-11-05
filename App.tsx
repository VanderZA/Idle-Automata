import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
    GameAction, GearSlot, type PlayerStats, type Entity, type Enemy, type GameLogMessage, 
    type SubAction, type InventoryItem, type EquippedGear, type Quest, type Rarity, Gear
} from './types';
import { 
    INITIAL_PLAYER_STATS, GAME_TICK_MS, getXpForNextLevel, ENEMIES_LIST, 
    ENTITY_FIND_CHANCE, UNLOCKS, SUB_ACTIONS, QUESTS, GEAR_POOL, ENTITIES_POOL
} from './constants';
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
    const [gameLog, setGameLog] = useState<GameLogMessage[]>([{id: Date.now(), text: "A feeling of determination washes over you.", type: 'story'}]);
    
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

    // Inventory & Gear State
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [equippedGear, setEquippedGear] = useState<EquippedGear>({});

    // UI State
    const [activeTab, setActiveTab] = useState('Quests');
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: React.ReactNode; x: number; y: number }>({ visible: false, content: null, x: 0, y: 0 });

    const gameLoopRef = useRef<number>();

    // Logging Utility
    const addLog = useCallback((text: string, type: GameLogMessage['type']) => {
        setGameLog(prev => [{ id: Date.now(), text, type }, ...prev.slice(0, 99)]);
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
            addLog(`Ding! You reached level ${newStats.level}!`, 'special');
        }
        return newStats;
    }, [addLog]);
    
    // Progression Unlocks
    useEffect(() => {
        // Actions
        if (playerStats.level >= UNLOCKS.FIGHTING_ACTION.level && !unlockedActions.includes(GameAction.FIGHTING)) {
            setUnlockedActions(prev => [...prev, GameAction.FIGHTING]);
            addLog("The thrill of battle calls to you. You can now Fight!", 'story');
        }
        if (playerStats.level >= UNLOCKS.EXPLORING_ACTION.level && !unlockedActions.includes(GameAction.EXPLORING)) {
            setUnlockedActions(prev => [...prev, GameAction.EXPLORING]);
            addLog("You feel an urge to see the world. You can now Explore!", 'story');
        }
        // Enemies
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
        if(currentQuestIndex + 1 < QUESTS.length) {
            const nextQuest = QUESTS[currentQuestIndex + 1];
            setActiveQuestId(nextQuest.id);
            addLog(`New Quest: ${nextQuest.title}`, 'quest');
        } else {
            addLog("You've completed all available quests for now!", 'quest');
            setActiveQuestId(''); // No more active quests
        }
    }, [activeQuestId, addLog]);

    const checkQuestCompletion = useCallback(() => {
        if (!activeQuest || questCompletion[activeQuestId]) return;
        const progress = questProgress[activeQuestId] || 0;
        if (progress >= activeQuest.objective.target) {
            addLog(`Quest Complete: ${activeQuest.title}!`, 'quest');
            setQuestCompletion(prev => ({ ...prev, [activeQuestId]: true }));
            let statsUpdate = {};
            if (activeQuest.reward.xp) statsUpdate = { ...statsUpdate, xp: playerStats.xp + activeQuest.reward.xp };
            if (activeQuest.reward.gold) statsUpdate = { ...statsUpdate, gold: playerStats.gold + activeQuest.reward.gold };
            
            // Handle unlocks from quests
            if (activeQuest.reward.unlocks) {
                const unlock = activeQuest.reward.unlocks;
                if (SUB_ACTIONS[unlock]) {
                    setUnlockedSubActions(prev => {
                        if (prev.includes(unlock)) return prev;
                        addLog(`You can now perform: ${SUB_ACTIONS[unlock].name}!`, 'special');
                        return [...prev, unlock];
                    });
                }
            }

            setPlayerStats(prev => handleLevelUp({ ...prev, ...statsUpdate }));
            startNextQuest();
        }
    }, [activeQuest, questCompletion, activeQuestId, questProgress, playerStats, handleLevelUp, startNextQuest, addLog]);

    const updateQuestProgress = useCallback((type: Quest['objective']['type'], qualifier?: string, amount: number = 1) => {
        if (!activeQuest || questCompletion[activeQuestId]) return;
        const { objective } = activeQuest;
        let shouldUpdate = false;
        if (objective.type === type && (!objective.qualifier || objective.qualifier === qualifier)) shouldUpdate = true;
        if(objective.type === 'level' && playerStats.level >= objective.target) shouldUpdate = true;
        if(objective.type === 'power' && totalPlayerStats.power >= objective.target) shouldUpdate = true;
        if (shouldUpdate) {
            const currentProgress = (type === 'level' || type === 'power') ? (type === 'level' ? playerStats.level : totalPlayerStats.power) : (questProgress[activeQuestId] || 0) + amount;
            setQuestProgress(prev => ({ ...prev, [activeQuestId]: currentProgress }));
        }
    }, [activeQuest, questCompletion, activeQuestId, questProgress, playerStats.level, totalPlayerStats.power]);
    
    useEffect(() => { checkQuestCompletion(); }, [questProgress, playerStats.level, totalPlayerStats.power, checkQuestCompletion]);

    const completeManualSubAction = useCallback((subAction: SubAction) => {
        let statsUpdate: Partial<PlayerStats> = { xp: playerStats.xp + subAction.xpReward };
        if (subAction.powerGain) statsUpdate = { ...statsUpdate, power: playerStats.power + subAction.powerGain };
        if (subAction.goldFind) {
            const goldFound = Math.floor(subAction.goldFind * (1 + totalPlayerStats.goldBonus / 100));
            statsUpdate = { ...statsUpdate, gold: playerStats.gold + goldFound };
            addLog(`You found ${goldFound} gold.`, 'info');
        }

        // Entity finding logic
        if (subAction.category === GameAction.EXPLORING) {
            if (foundEntities.length < ENTITIES_POOL.length && Math.random() < ENTITY_FIND_CHANCE) {
                const undiscoveredEntities = ENTITIES_POOL.filter(p_entity => !foundEntities.find(f_entity => f_entity.id === p_entity.id));
                if (undiscoveredEntities.length > 0) {
                    const newEntity = { ...undiscoveredEntities[0], progress: 0 };
                    setFoundEntities(prev => [...prev, newEntity]);
                    addLog(`You've discovered a ${newEntity.name}! It can automate ${newEntity.type} tasks.`, 'special');
                    updateQuestProgress('find_entity');
                }
            }
        }
        
        setPlayerStats(prev => handleLevelUp({ ...prev, ...statsUpdate }));
        updateQuestProgress('sub_action_complete', subAction.id);
    }, [playerStats, totalPlayerStats.goldBonus, handleLevelUp, updateQuestProgress, addLog, foundEntities]);

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
            const availableDrops = currentEnemy.gearDrops.filter(drop => {
                const gearInfo = GEAR_POOL[drop.gearId];
                const equippedVersion = equippedGear[gearInfo.slot];
                return !(equippedVersion && equippedVersion.gear.id === gearInfo.id && equippedVersion.upgradeLevel >= equippedVersion.gear.maxUpgradeLevel);
            });
            availableDrops.forEach(drop => {
                if (Math.random() < drop.chance) {
                    const gear = GEAR_POOL[drop.gearId];
                    if (!gear) return;
                    const equippedVersion = equippedGear[gear.slot];
                    if (equippedVersion && equippedVersion.gear.id === gear.id && equippedVersion.upgradeLevel < gear.maxUpgradeLevel) {
                        setEquippedGear(prev => {
                            const newGear = {...prev};
                            const itemToUpgrade = newGear[gear.slot]!;
                            newGear[gear.slot] = { ...itemToUpgrade, upgradeLevel: itemToUpgrade.upgradeLevel + 1 };
                            return newGear;
                        });
                        addLog(`Your ${gear.name} was enhanced! [+${equippedVersion.upgradeLevel + 1}]`, 'special');
                    } else {
                        const newItem: InventoryItem = { instanceId: `item_${Date.now()}_${Math.random()}`, gear, upgradeLevel: 0 };
                        setInventory(prev => [...prev, newItem]);
                        addLog(`Looted a ${gear.name}!`, 'special');
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

     const completeAutomatedSubAction = useCallback((subAction: SubAction, entityName: string) => {
        setPlayerStats(prev => {
            let statsUpdate: Partial<PlayerStats> = { xp: prev.xp + subAction.xpReward };
            if (subAction.powerGain) statsUpdate = { ...statsUpdate, power: prev.power + subAction.powerGain };
            if (subAction.goldFind) {
                // Automation doesn't get gold bonus for simplicity
                statsUpdate = { ...statsUpdate, gold: prev.gold + subAction.goldFind };
            }
            return handleLevelUp({ ...prev, ...statsUpdate });
        });
        
        let rewardText = `+${subAction.xpReward} XP`;
        if(subAction.powerGain) rewardText += `, +${subAction.powerGain} Power`;
        if(subAction.goldFind) rewardText += `, +${subAction.goldFind} Gold`;

        addLog(`${entityName} completed ${subAction.name}. (${rewardText})`, 'info');
        updateQuestProgress('sub_action_complete', subAction.id);
    }, [handleLevelUp, addLog, updateQuestProgress]);

    // Game Loop
    useEffect(() => {
        gameLoopRef.current = window.setInterval(() => {
            // Manual action progress
            if (activeManualSubActionId) {
                const subAction = SUB_ACTIONS[activeManualSubActionId];
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

            // Automation progress
            setFoundEntities(currentEntities => {
                if (currentEntities.length === 0) return currentEntities;
                
                const updatedEntities = currentEntities.map(entity => {
                    const newProgress = entity.progress + (entity.automationSpeed * (entity.level / 2 + 0.5));
                    if (newProgress >= 100) {
                        const availableSubActions = Object.values(SUB_ACTIONS).filter(sa => sa.category === entity.type && unlockedSubActions.includes(sa.id));
                        if (availableSubActions.length > 0) {
                            const randomSubAction = availableSubActions[Math.floor(Math.random() * availableSubActions.length)];
                            completeAutomatedSubAction(randomSubAction, entity.name);
                        }
                        return { ...entity, progress: newProgress - 100 };
                    }
                    return { ...entity, progress: newProgress };
                });
                if (JSON.stringify(currentEntities) !== JSON.stringify(updatedEntities)) {
                    return updatedEntities;
                }
                return currentEntities;
            });

        }, GAME_TICK_MS);
        return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
    }, [activeManualSubActionId, attackEnemy, completeManualSubAction, unlockedSubActions, completeAutomatedSubAction]);
    
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

    const equipItem = (item: InventoryItem) => {
        setEquippedGear(prev => {
            const newGear = {...prev};
            const currentItem = newGear[item.gear.slot];
            if (currentItem) setInventory(i => [...i, currentItem]);
            newGear[item.gear.slot] = item;
            setInventory(i => i.filter(invItem => invItem.instanceId !== item.instanceId));
            return newGear;
        });
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

    const handleInventoryClick = (item: InventoryItem, e: React.MouseEvent) => {
        if (e.shiftKey) { // Sell item
            const gear = item.gear;
            const sellValue = gear.sellValue * (1 + item.upgradeLevel * 0.2);
            setPlayerStats(prev => ({...prev, gold: prev.gold + Math.floor(sellValue)}));
            setInventory(prev => prev.filter(invItem => invItem.instanceId !== item.instanceId));
            addLog(`Sold ${gear.name} for ${Math.floor(sellValue)} gold.`, 'success');

        } else if (e.ctrlKey) { // Upgrade equipped item
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
                    addLog(`Used a duplicate to enhance your ${item.gear.name} to +${equippedItem.upgradeLevel + 1}!`, 'special');
                } else {
                    addLog(`${item.gear.name} is already at max level!`, 'info');
                }
            } else {
                addLog('You need to have a matching item equipped to upgrade it.', 'info');
            }
        } else { // Equip item
            equipItem(item);
        }
    };
    
    const rarityColor: Record<Rarity, string> = { Common: 'text-gray-300', Uncommon: 'text-green-400', Rare: 'text-blue-400', Epic: 'text-purple-400' };

    const createItemTooltip = (item: InventoryItem, equippedItem?: InventoryItem) => {
        const { gear, upgradeLevel } = item;
        const pwrBonus = gear.basePowerBonus + (upgradeLevel * gear.powerUpgradeBonus);
        const goldBonus = gear.baseGoldBonus + (upgradeLevel * gear.goldUpgradeBonus);

        let pwrDiffText = '';
        let goldDiffText = '';
        
        if (equippedItem) {
            const equippedPwr = equippedItem.gear.basePowerBonus + (equippedItem.upgradeLevel * equippedItem.gear.powerUpgradeBonus);
            const equippedGold = equippedItem.gear.baseGoldBonus + (equippedItem.upgradeLevel * equippedItem.gear.goldUpgradeBonus);
            const pwrDiff = pwrBonus - equippedPwr;
            const goldDiff = goldBonus - equippedGold;
            const diffColor = (diff: number) => diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
            if (pwrDiff !== 0) pwrDiffText = `(${pwrDiff > 0 ? '+' : ''}${pwrDiff.toFixed(1)})`;
            if (goldDiff !== 0) goldDiffText = `(${goldDiff > 0 ? '+' : ''}${goldDiff.toFixed(1)}%)`;
        }

        return (
            <div>
                <h4 className={`font-bold ${rarityColor[gear.rarity]}`}>{gear.name} <span className="text-sm text-yellow-300">[+{upgradeLevel}]</span></h4>
                <p className="text-gray-400">{gear.slot} <span className="text-sm">({gear.rarity})</span></p>
                <p className="text-xs text-gray-500">Level: {upgradeLevel} / {gear.maxUpgradeLevel}</p>
                <hr className="border-gray-700 my-1"/>
                <p>Power: {pwrBonus.toFixed(1)} <span className={pwrDiffText.includes('+') ? 'text-green-400' : 'text-red-400'}>{pwrDiffText}</span></p>
                <p>Gold Bonus: {goldBonus.toFixed(1)}% <span className={goldDiffText.includes('+') ? 'text-green-400' : 'text-red-400'}>{goldDiffText}</span></p>
            </div>
        );
    };

    const createEnemyTooltip = (enemy: Enemy) => (
        <div>
            <h4 className="font-bold text-red-400">{enemy.name}</h4>
            <p>Power: {enemy.powerLevel}</p>
            <p>Rewards: {enemy.goldReward} Gold, {enemy.xpReward} XP</p>
            {enemy.gearDrops.length > 0 && (
                <> <hr className="border-gray-600 my-1" /> <h5 className="font-semibold">Potential Drops:</h5>
                    <ul className="list-disc list-inside text-gray-400">
                        {enemy.gearDrops.map(drop => <li key={drop.gearId}>{GEAR_POOL[drop.gearId].name} ({(drop.chance * 100).toFixed(1)}%)</li>)}
                    </ul>
                </>
            )}
        </div>
    );

    const createSubActionTooltip = (subAction: SubAction) => (
        <div>
            <h4 className="font-bold">{subAction.name}</h4> <p className="text-gray-400 italic">{subAction.description}</p> <hr className="border-gray-700 my-1" />
            <p>XP: +{subAction.xpReward}</p>
            {subAction.powerGain && <p>Power: +{subAction.powerGain}</p>}
            {subAction.goldFind && <p>Gold Find: ~{subAction.goldFind}</p>}
            {subAction.category === GameAction.EXPLORING && <p className="text-indigo-300">Entity Find Chance: {(ENTITY_FIND_CHANCE * 100).toFixed(1)}%</p>}
            <p className="text-gray-500 mt-1">Duration: {(subAction.duration * GAME_TICK_MS / 1000).toFixed(1)}s</p>
        </div>
    );

    const actionIcons: Record<GameAction, React.ReactNode> = { [GameAction.TRAINING]: <TrainingIcon />, [GameAction.FIGHTING]: <FightingIcon />, [GameAction.EXPLORING]: <ExploringIcon />, };

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
                                                            <div onMouseEnter={() => showTooltip(createEnemyTooltip(currentEnemy))} onMouseLeave={hideTooltip}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <button onClick={() => changeEnemy(-1)} disabled={currentEnemyIndex <= 0} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeftIcon className="w-5 h-5"/></button>
                                                                    <p className="font-bold text-red-400">{currentEnemy.name}</p>
                                                                    <button onClick={() => changeEnemy(1)} disabled={currentEnemyIndex >= unlockedEnemyNames.length - 1} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRightIcon className="w-5 h-5"/></button>
                                                                </div>
                                                                <ProgressBar progress={(currentEnemy.currentHp / currentEnemy.maxHp) * 100} text={`${currentEnemy.currentHp.toLocaleString()} / ${currentEnemy.maxHp.toLocaleString()}`} fillColor="bg-red-600" bgColor="bg-red-900/50" />
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
                            <h2 className="text-2xl font-bold mb-4 text-center text-purple-300">Event Log</h2>
                            <div className="h-48 overflow-y-auto bg-gray-900/50 rounded-lg p-2 flex flex-col-reverse space-y-2 space-y-reverse">
                                {gameLog.map(msg => (<p key={msg.id} className={`text-sm ${{success: 'text-green-400', danger: 'text-red-400', special: 'text-yellow-300 font-bold', quest: 'text-purple-300', story: 'text-indigo-300 italic', info: 'text-gray-400'}[msg.type]}`}>- {msg.text}</p>))}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col">
                        <div className="flex border-b border-gray-700 mb-4">
                            {['Quests', 'Equipment', 'Automations'].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 px-4 font-semibold transition-colors duration-200 ${activeTab === tab ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>))}
                        </div>
                        <div className="flex-grow">
                            {activeTab === 'Quests' && (
                                <div className="space-y-4">
                                    <h2 className="text-2xl font-bold text-center text-purple-300">Quest Log</h2>
                                    {activeQuest ? (<div className="bg-gray-900/50 p-4 rounded-lg">
                                        <h3 className="font-bold text-lg text-yellow-300">{activeQuest.title}</h3> <p className="text-gray-400 italic mt-1">{activeQuest.description}</p>
                                        <div className="mt-3"><ProgressBar progress={Math.min(100, ((questProgress[activeQuestId] || 0) / activeQuest.objective.target) * 100)} text={`${questProgress[activeQuestId] || 0} / ${activeQuest.objective.target}`} fillColor="bg-purple-500"/></div>
                                    </div>) : <p className="text-center text-gray-500 py-10">No active quest.</p>}
                                </div>
                            )}
                            {activeTab === 'Equipment' && (
                                <div className="space-y-4">
                                     <h2 className="text-2xl font-bold text-center text-purple-300">Equipment & Inventory</h2>
                                      <p className="text-center text-xs text-gray-500 -mt-2 mb-2">
                                        Click to equip. Ctrl+Click to upgrade equipped. Shift+Click to sell.
                                      </p>
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
                                {foundEntities.length > 0 ? (<div className="space-y-4">{foundEntities.map(entity => (<div key={entity.id} className="bg-gray-900/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-lg text-yellow-300 flex items-center space-x-2">{actionIcons[entity.type]}<span>{entity.name}</span></h3>
                                        <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">Lv. {entity.level}</span>
                                    </div> <ProgressBar progress={entity.progress} fillColor="bg-teal-500" /></div>))}</div>) : (<div className="text-center text-gray-500 py-10"><p>No entities found yet.</p><p>Complete 'Exploring' to find them!</p></div>)}
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