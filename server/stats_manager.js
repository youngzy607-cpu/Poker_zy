// 战绩统计管理器 - Supabase 版本
const { supabase } = require('./supabase_client');

class StatsManager {
    // 获取用户战绩
    async getStats(username) {
        try {
            const { data, error } = await supabase
                .from('game_statistics')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) {
                console.log(`⚠️ 未找到用户战绩: ${username}，返回默认值`);
                return this._getDefaultStats();
            }

            return this._formatStats(data);
        } catch (e) {
            console.error('获取战绩异常:', e);
            return this._getDefaultStats();
        }
    }

    // 记录一局游戏结果
    async recordHand(username, result) {
        try {
            // 先获取当前战绩
            const currentStats = await this.getStats(username);
            
            // 计算新的统计数据
            const newStats = {
                total_hands: currentStats.totalHands + 1,
                wins: result.profit > 0 ? currentStats.wins + 1 : currentStats.wins,
                total_profit: currentStats.totalProfit + result.profit,
                biggest_pot: result.profit > 0 && result.pot > currentStats.biggestPot 
                    ? result.pot 
                    : currentStats.biggestPot,
                updated_at: new Date().toISOString()
            };

            // 更新 rank_wins（各牌型胜场）
            if (result.profit > 0 && result.hand && result.hand.rank) {
                const rankWins = { ...currentStats.rankWins };
                const rank = result.hand.rank;
                rankWins[rank] = (rankWins[rank] || 0) + 1;
                newStats.rank_wins = rankWins;
            }

            // 更新 best_hand（最佳牌型）
            if (result.hand && result.hand.rank > currentStats.bestHand.rank) {
                newStats.best_hand = {
                    rank: result.hand.rank,
                    name: result.hand.name,
                    cards: result.cards || []
                };
            }

            // 更新 history（历史记录，保留最近20局）
            const history = currentStats.history || [];
            history.unshift({
                date: new Date().toLocaleString('zh-CN'),
                profit: result.profit,
                handName: result.hand ? result.hand.name : '弃牌',
                pot: result.pot
            });
            if (history.length > 20) history.pop();
            newStats.history = history;

            // 写入数据库
            const { error } = await supabase
                .from('game_statistics')
                .update(newStats)
                .eq('username', username);

            if (error) {
                console.error('记录战绩失败:', error);
                return false;
            }

            console.log(`📊 战绩已记录: ${username} (${result.profit > 0 ? '+' : ''}${result.profit})`);
            return true;

        } catch (e) {
            console.error('记录战绩异常:', e);
            return false;
        }
    }

    // 更新成就列表
    async updateAchievements(username, achievementIds) {
        try {
            const { error } = await supabase
                .from('game_statistics')
                .update({ achievements: achievementIds })
                .eq('username', username);

            if (error) {
                console.error('更新成就失败:', error);
                return false;
            }

            console.log(`🏆 成就已更新: ${username}`);
            return true;
        } catch (e) {
            console.error('更新成就异常:', e);
            return false;
        }
    }

    // 重置战绩
    async resetStats(username) {
        try {
            const { error } = await supabase
                .from('game_statistics')
                .update(this._getDefaultStatsForDB())
                .eq('username', username);

            return !error;
        } catch (e) {
            console.error('重置战绩异常:', e);
            return false;
        }
    }

    // 格式化数据库数据为前端格式
    _formatStats(dbData) {
        return {
            totalHands: dbData.total_hands || 0,
            wins: dbData.wins || 0,
            totalProfit: dbData.total_profit || 0,
            biggestPot: dbData.biggest_pot || 0,
            bestHand: dbData.best_hand || { rank: 0, name: '无', cards: [] },
            rankWins: dbData.rank_wins || {},
            achievements: dbData.achievements || [],
            history: dbData.history || []
        };
    }

    // 默认战绩（前端格式）
    _getDefaultStats() {
        return {
            totalHands: 0,
            wins: 0,
            totalProfit: 0,
            biggestPot: 0,
            bestHand: { rank: 0, name: '无', cards: [] },
            rankWins: {},
            achievements: [],
            history: []
        };
    }

    // 默认战绩（数据库格式）
    _getDefaultStatsForDB() {
        return {
            total_hands: 0,
            wins: 0,
            total_profit: 0,
            biggest_pot: 0,
            best_hand: { rank: 0, name: '无', cards: [] },
            rank_wins: {},
            achievements: [],
            history: [],
            updated_at: new Date().toISOString()
        };
    }
}

module.exports = StatsManager;
