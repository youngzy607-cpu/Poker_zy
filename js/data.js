class DataManager {
    static KEY = 'texasholdem_profile_v1';
    static API_BASE = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : `${window.location.origin}/api`;

    static get defaultProfile() {
        return {
            chips: 1000, // Initial chips
            stats: {
                totalHands: 0,
                wins: 0,
                totalProfit: 0, // Net profit/loss
                biggestPot: 0,
                bestHand: { rank: 0, name: "无", cards: [] },
            },
            history: [], // List of recent games { date, profit, handName }
            achievements: [] // Placeholder for future
        };
    }

    // 获取当前登录用户名（从 sessionStorage 读取，确保每个标签页独立）
    static getCurrentUser() {
        const loginData = sessionStorage.getItem('loginData');
        if (!loginData) return null;
        try {
            return JSON.parse(loginData).username;
        } catch (e) {
            return null;
        }
    }

    // 从服务器加载战绩数据
    static async load() {
        const username = this.getCurrentUser();
        
        // 如果未登录，返回默认数据
        if (!username) {
            console.log('未登录，使用默认数据');
            return this.defaultProfile;
        }

        try {
            const response = await fetch(`${this.API_BASE}/stats/${username}`);
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 从服务器加载战绩:', username);
                // 构造返回格式与本地版本一致
                return {
                    chips: this._getChipsFromStorage(),
                    stats: result.data,
                    history: result.data.history || [],
                    achievements: result.data.achievements || []
                };
            } else {
                // 服务器返回失败，返回默认数据（不读取本地旧数据）
                console.warn('服务器返回失败，使用默认数据');
                return {
                    chips: this._getChipsFromStorage(),
                    stats: this.defaultProfile.stats,
                    history: [],
                    achievements: []
                };
            }
        } catch (e) {
            console.error('加载战绩失败:', e);
            // 网络错误时返回默认数据（不读取本地旧数据）
            return {
                chips: this._getChipsFromStorage(),
                stats: this.defaultProfile.stats,
                history: [],
                achievements: []
            };
        }
    }

    // 兼容旧版：从 localStorage 加载
    static _loadLocal() {
        const data = localStorage.getItem(this.KEY);
        if (!data) return this.defaultProfile;
        try {
            const parsed = JSON.parse(data);
            return { ...this.defaultProfile, ...parsed, stats: { ...this.defaultProfile.stats, ...parsed.stats } };
        } catch (e) {
            console.error("Data load error", e);
            return this.defaultProfile;
        }
    }

    // 获取筹码余额（从 sessionStorage 读取）
    static _getChipsFromStorage() {
        const loginData = sessionStorage.getItem('loginData');
        if (!loginData) return 1000;
        try {
            return JSON.parse(loginData).chips || 1000;
        } catch (e) {
            return 1000;
        }
    }

    // 保存数据（已弃用，但保留接口兼容）
    static save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    }

    // 更新筹码 - 同时更新本地存储和 sessionStorage 中的 loginData
    static updateChips(amount) {
        // 1. 更新本地游戏数据
        const data = this._loadLocal();
        data.chips = amount;
        this.save(data);
        
        // 2. 同步更新 sessionStorage 中的 chips（这是主界面读取的数据源）
        const loginData = sessionStorage.getItem('loginData');
        if (loginData) {
            try {
                const parsed = JSON.parse(loginData);
                parsed.chips = amount;
                sessionStorage.setItem('loginData', JSON.stringify(parsed));
                console.log(`[筹码同步] 本地筹码已更新为: ${amount}`);
            } catch (e) {
                console.error('更新loginData失败:', e);
            }
        }
    }

    // 记录一局游戏结果（改为上报服务器）
    static async recordHand(result) {
        const username = this.getCurrentUser();
        
        // 如果未登录，使用本地存储（兼容旧版）
        if (!username) {
            console.log('未登录，使用本地存储战绩');
            return this._recordHandLocal(result);
        }

        try {
            const response = await fetch(`${this.API_BASE}/stats/${username}/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            });
            
            const res = await response.json();
            if (res.success) {
                console.log('📊 战绩已同步到服务器');
            } else {
                console.warn('战绩同步失败，使用本地备份');
                this._recordHandLocal(result);
            }
        } catch (e) {
            console.error('战绩上报失败:', e);
            this._recordHandLocal(result);
        }
    }

    // 本地记录（兼容旧版）
    static _recordHandLocal(result) {
        const data = this._loadLocal();
        
        // Update basic stats
        data.stats.totalHands++;
        if (result.profit > 0) {
            data.stats.wins++;
            // Update rank wins
            if (result.hand && result.hand.rank) {
                if (!data.stats.rankWins) data.stats.rankWins = {};
                if (!data.stats.rankWins[result.hand.rank]) data.stats.rankWins[result.hand.rank] = 0;
                data.stats.rankWins[result.hand.rank]++;
            }
        }
        data.stats.totalProfit += result.profit;
        
        if (result.profit > 0 && result.pot > data.stats.biggestPot) {
            data.stats.biggestPot = result.pot;
        }

        // Check best hand
        if (result.hand && result.hand.rank > data.stats.bestHand.rank) {
            data.stats.bestHand = {
                rank: result.hand.rank,
                name: result.hand.name,
                cards: result.cards
            };
        }

        // Add to history (limit to last 20)
        const historyItem = {
            date: new Date().toLocaleString(),
            profit: result.profit,
            handName: result.hand ? result.hand.name : '弃牌',
            pot: result.pot
        };
        data.history.unshift(historyItem);
        if (data.history.length > 20) data.history.pop();

        this.save(data);
    }
    
    // 重置战绩
    static async reset() {
        const username = this.getCurrentUser();
        
        if (!username) {
            this.save(this.defaultProfile);
            return this.defaultProfile;
        }

        try {
            const response = await fetch(`${this.API_BASE}/stats/${username}/reset`, {
                method: 'POST'
            });
            
            const res = await response.json();
            if (res.success) {
                console.log('✅ 战绩已重置');
                return this.defaultProfile;
            }
        } catch (e) {
            console.error('重置战绩失败:', e);
        }
        
        this.save(this.defaultProfile);
        return this.defaultProfile;
    }
}