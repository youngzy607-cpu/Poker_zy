const AchievementConfig = [
    // --- 游戏结果类 ---
    { id: 'win_1', type: 'win_count', target: 1, reward: 1500, title: '初尝胜果', desc: '赢得第 1 场胜利' },
    { id: 'win_5', type: 'win_count', target: 5, reward: 2000, title: '渐入佳境', desc: '累计赢得 5 场胜利' },
    { id: 'win_10', type: 'win_count', target: 10, reward: 5000, title: '常胜将军', desc: '累计赢得 10 场胜利' },
    { id: 'win_20', type: 'win_count', target: 20, reward: 10000, title: '独孤求败', desc: '累计赢得 20 场胜利' },

    { id: 'loss_1', type: 'loss_count', target: 1, reward: 200, title: '胜败兵家常事', desc: '第一次输掉比赛' },
    { id: 'loss_5', type: 'loss_count', target: 5, reward: 500, title: '越挫越勇', desc: '累计输掉 5 场比赛' },
    { id: 'loss_10', type: 'loss_count', target: 10, reward: 1000, title: '卧薪尝胆', desc: '累计输掉 10 场比赛' },
    { id: 'loss_20', type: 'loss_count', target: 20, reward: 2000, title: '百折不挠', desc: '累计输掉 20 场比赛' },

    { id: 'play_1', type: 'play_count', target: 1, reward: 500, title: '初出茅庐', desc: '完成第 1 局游戏' },
    { id: 'play_5', type: 'play_count', target: 5, reward: 1000, title: '牌桌常客', desc: '完成 5 局游戏' },
    { id: 'play_10', type: 'play_count', target: 10, reward: 2000, title: '老练牌手', desc: '完成 10 局游戏' },
    { id: 'play_20', type: 'play_count', target: 20, reward: 5000, title: '德扑专家', desc: '完成 20 局游戏' },

    // --- 牌型胜利类 (Rank 1-9) ---
    // Rank 1: High Card (高牌)
    { id: 'win_rank_1_1', type: 'win_rank_1', target: 1, reward: 500, title: '高牌险胜', desc: '第一次用高牌赢得底池' },
    { id: 'win_rank_1_5', type: 'win_rank_1', target: 5, reward: 1000, title: '偷鸡高手', desc: '累计 5 次用高牌赢得底池' },
    
    // Rank 2: Pair (对子)
    { id: 'win_rank_2_1', type: 'win_rank_2', target: 1, reward: 500, title: '成双成对', desc: '第一次用对子赢得底池' },
    { id: 'win_rank_2_5', type: 'win_rank_2', target: 5, reward: 1000, title: '好事成双', desc: '累计 5 次用对子赢得底池' },

    // Rank 3: Two Pair (两对) - 用户没明确提，但我补上
    { id: 'win_rank_3_1', type: 'win_rank_3', target: 1, reward: 600, title: '双喜临门', desc: '第一次用两对赢得底池' },

    // Rank 4: Three of a Kind (三条)
    { id: 'win_rank_4_1', type: 'win_rank_4', target: 1, reward: 800, title: '三足鼎立', desc: '第一次用三条赢得底池' },
    { id: 'win_rank_4_5', type: 'win_rank_4', target: 5, reward: 1500, title: '三羊开泰', desc: '累计 5 次用三条赢得底池' },

    // Rank 5: Straight (顺子)
    { id: 'win_rank_5_1', type: 'win_rank_5', target: 1, reward: 1000, title: '顺风顺水', desc: '第一次用顺子赢得底池' },
    { id: 'win_rank_5_5', type: 'win_rank_5', target: 5, reward: 2000, title: '一气呵成', desc: '累计 5 次用顺子赢得底池' },

    // Rank 6: Flush (同花)
    { id: 'win_rank_6_1', type: 'win_rank_6', target: 1, reward: 1200, title: '花开富贵', desc: '第一次用同花赢得底池' },
    { id: 'win_rank_6_5', type: 'win_rank_6', target: 5, reward: 2500, title: '繁花似锦', desc: '累计 5 次用同花赢得底池' },

    // Rank 7: Full House (葫芦)
    { id: 'win_rank_7_1', type: 'win_rank_7', target: 1, reward: 1500, title: '五谷丰登', desc: '第一次用葫芦赢得底池' },
    { id: 'win_rank_7_5', type: 'win_rank_7', target: 5, reward: 3000, title: '满载而归', desc: '累计 5 次用葫芦赢得底池' },

    // Rank 8: Four of a Kind (四条)
    { id: 'win_rank_8_1', type: 'win_rank_8', target: 1, reward: 2000, title: '四海升平', desc: '第一次用四条赢得底池' },
    
    // Rank 9: Straight Flush (同花顺)
    { id: 'win_rank_9_1', type: 'win_rank_9', target: 1, reward: 5000, title: '至尊王者', desc: '第一次用同花顺赢得底池' },

    // --- 资产类 ---
    { id: 'chips_1w', type: 'chips_reach', target: 10000, reward: 1000, title: '万元户', desc: '持有筹码达到 10,000' },
    { id: 'chips_5w', type: 'chips_reach', target: 50000, reward: 5000, title: '小富即安', desc: '持有筹码达到 50,000' },
    { id: 'chips_10w', type: 'chips_reach', target: 100000, reward: 10000, title: '腰缠万贯', desc: '持有筹码达到 100,000' },
    { id: 'chips_100w', type: 'chips_reach', target: 1000000, reward: 50000, title: '百万富翁', desc: '持有筹码达到 1,000,000' },
];

class AchievementManager {
    static check(stats, currentChips) {
        const unlocked = [];
        const profile = DataManager.load();
        const achievedIds = new Set(profile.achievements || []);

        AchievementConfig.forEach(ach => {
            if (achievedIds.has(ach.id)) return; // Already achieved

            let met = false;
            switch (ach.type) {
                case 'win_count':
                    if (stats.wins >= ach.target) met = true;
                    break;
                case 'loss_count':
                    if ((stats.totalHands - stats.wins) >= ach.target) met = true;
                    break;
                case 'play_count':
                    if (stats.totalHands >= ach.target) met = true;
                    break;
                case 'chips_reach':
                    if (currentChips >= ach.target) met = true;
                    break;
                default:
                    // Check win_rank_X
                    if (ach.type.startsWith('win_rank_')) {
                        const rank = parseInt(ach.type.split('_')[2]);
                        const count = stats.rankWins ? (stats.rankWins[rank] || 0) : 0;
                        if (count >= ach.target) met = true;
                    }
                    break;
            }

            if (met) {
                unlocked.push(ach);
                achievedIds.add(ach.id);
            }
        });

        if (unlocked.length > 0) {
            // Save unlocked IDs
            profile.achievements = Array.from(achievedIds);
            
            // Add rewards
            let totalReward = 0;
            unlocked.forEach(u => totalReward += u.reward);
            profile.chips += totalReward;
            
            DataManager.save(profile);
            
            return unlocked;
        }
        
        return [];
    }
    
    static getProgress(achId) {
        const ach = AchievementConfig.find(a => a.id === achId);
        if (!ach) return 0;
        
        const profile = DataManager.load();
        const stats = profile.stats;
        
        // If already achieved, return target
        if (profile.achievements && profile.achievements.includes(achId)) return ach.target;

        let current = 0;
        switch (ach.type) {
            case 'win_count': current = stats.wins; break;
            case 'loss_count': current = stats.totalHands - stats.wins; break;
            case 'play_count': current = stats.totalHands; break;
            case 'chips_reach': current = profile.chips; break;
            default:
                if (ach.type.startsWith('win_rank_')) {
                    const rank = parseInt(ach.type.split('_')[2]);
                    current = stats.rankWins ? (stats.rankWins[rank] || 0) : 0;
                }
                break;
        }
        return Math.min(current, ach.target);
    }
}
