class DataManager {
    static KEY = 'texasholdem_profile_v1';

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

    static load() {
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

    static save(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    }

    static updateChips(amount) {
        const data = this.load();
        data.chips = amount;
        this.save(data);
    }

    static recordHand(result) {
        // result: { profit: number, hand: {rank, name, tieBreakers}, pot: number, cards: [] }
        const data = this.load();
        
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
        // Rank 1-9 (High Card to Straight Flush)
        if (result.hand && result.hand.rank > data.stats.bestHand.rank) {
            data.stats.bestHand = {
                rank: result.hand.rank,
                name: result.hand.name,
                cards: result.cards // Array of card strings or objects
            };
        } else if (result.hand && result.hand.rank === data.stats.bestHand.rank) {
             // Tie-breaker logic could go here, but for now simple overwrite if same rank is acceptable or ignore
             // Usually we want the "highest" cards, but let's keep it simple: only upgrade if rank is strictly higher
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
    
    static reset() {
        this.save(this.defaultProfile);
        return this.defaultProfile;
    }
}