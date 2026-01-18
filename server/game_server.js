const { Deck } = require('../js/card');
const { HandEvaluator } = require('../js/evaluator');
const Player = require('../js/player');

class GameServer {
    constructor(roomId, io, userManager) {
        this.roomId = roomId;
        this.io = io;
        this.userManager = userManager;
        this.deck = new Deck();
        this.players = []; // Array of Player objects (with socketId added)
        this.waitingPlayers = []; // Players waiting for next hand
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'pre-flop';
        this.activePlayerIndex = -1;
        this.dealerIndex = 0;
        this.playersToAct = [];
        this.timers = [];
        this.handCount = 0;
        this.blinds = { sb: 5, bb: 10 };
        this.minPlayers = 2; // Minimum players to start
        this.gameStarted = false; // "Playing" status
        this.hostSocketId = null; // Who can start the game
    }

    async addPlayer(socketId, name, userProfile = null) {
        // 从用户账户中扣除1000筹码作为带入
        let buyInAmount = 1000;
        if (this.userManager && userProfile && userProfile.username) {
            const user = await this.userManager.getUser(userProfile.username);
            if (user && user.chips >= buyInAmount) {
                // 扣除账户筹码
                const newBalance = user.chips - buyInAmount;
                console.log(`[联机带入] 用户: ${userProfile.username}, 原余额: ${user.chips}, 带入: ${buyInAmount}, 剩余: ${newBalance}`);
                await this.userManager.updateChips(userProfile.username, newBalance);
            } else if (user && user.chips > 0) {
                // 账户余额不足，使用现有筹码
                buyInAmount = user.chips;
                console.log(`[联机带入] 用户: ${userProfile.username}, 余额不足，全部带入: ${buyInAmount}`);
                await this.userManager.updateChips(userProfile.username, 0);
            } else {
                // 新用户或筹码为0，给予默认筹码
                buyInAmount = 1000;
                console.log(`[联机带入] 用户: ${userProfile.username}, 无筹码，默认带入: ${buyInAmount}`);
            }
        }
        
        const player = new Player(name, buyInAmount);
        player.socketId = socketId;
        
        // 保存用户信息
        if (userProfile) {
            player.avatar = userProfile.avatar || 0; // 头像ID
            player.username = userProfile.username || name; // 用户名
        }

        // First player becomes host
        if (this.players.length === 0 && this.waitingPlayers.length === 0) {
            this.hostSocketId = socketId;
        }

        if (this.gameStarted) {
            this.waitingPlayers.push(player);
            this.broadcastMessage(`${name} 加入了房间 (等待下一局)`);
        } else {
            this.players.push(player);
            this.broadcastMessage(`${name} 加入了房间`);
        }

        this.broadcastState();
    }

    startGame(socketId) {
        if (socketId !== this.hostSocketId) return;
        if (this.players.length < this.minPlayers) {
            this.io.to(socketId).emit('error', '人数不足，无法开始');
            return;
        }
        if (this.gameStarted) return;

        this.startNewHand();
    }

    removePlayer(socketId) {
        // Check active players
        let index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            this.players.splice(index, 1);
            this.handlePlayerExitDuringGame();
        } else {
            // Check waiting players
            index = this.waitingPlayers.findIndex(p => p.socketId === socketId);
            if (index !== -1) {
                this.waitingPlayers.splice(index, 1);
            }
        }

        // Host migration
        if (socketId === this.hostSocketId) {
            // Pick next host from players or waitingPlayers
            if (this.players.length > 0) {
                this.hostSocketId = this.players[0].socketId;
            } else if (this.waitingPlayers.length > 0) {
                this.hostSocketId = this.waitingPlayers[0].socketId;
            } else {
                this.hostSocketId = null;
            }
            if (this.hostSocketId) {
                const hostName = this.getPlayerName(this.hostSocketId);
                this.broadcastMessage(`房主已变更为 ${hostName}`);
            }
        }
        
        this.broadcastState();
    }

    handlePlayerExitDuringGame() {
        if (this.gameStarted) {
            if (this.players.length < 2) {
                // Not enough players to continue
                this.gameStarted = false;
                this.broadcastMessage('玩家离开，游戏暂停，等待房主开始...');
                this.clearAllTimers();
                
                // Move remaining player to waiting/reset state if needed?
                // Or just keep them in players but gameStarted = false
                // Reset hand state
                this.pot = 0;
                this.communityCards = [];
                this.players.forEach(p => p.resetHand());
            } else {
                // Logic to handle fold or skip turn is complicated
                // Simple version: restart hand
                this.broadcastMessage('玩家离开，重新发牌...');
                this.clearAllTimers();
                setTimeout(() => this.startNewHand(), 2000);
            }
        }
    }

    getPlayerName(socketId) {
        let p = this.players.find(p => p.socketId === socketId);
        if (!p) p = this.waitingPlayers.find(p => p.socketId === socketId);
        return p ? p.name : 'Unknown';
    }

    handlePlayerAction(socketId, { action, amount }) {
        if (!this.gameStarted) return;
        
        const playerIndex = this.players.findIndex(p => p.socketId === socketId);
        if (playerIndex !== this.activePlayerIndex) return; // Not your turn

        const player = this.players[playerIndex];
        let chipChange = 0;
        let message = "";

        switch (action) {
            case 'fold':
                player.folded = true;
                message = "Fold";
                break;
            case 'check':
                message = "Check";
                break;
            case 'call':
                const callAmt = this.currentBet - player.currentBet;
                player.chips -= callAmt;
                player.currentBet += callAmt;
                this.pot += callAmt;
                chipChange = callAmt;
                message = "Call";
                break;
            case 'raise':
                let raiseAmt = parseInt(amount);
                const total = this.currentBet + raiseAmt;
                const added = total - player.currentBet;
                
                player.chips -= added;
                player.currentBet += added;
                this.pot += added;
                this.currentBet = total;
                chipChange = added;
                message = `Raise ${raiseAmt}`;
                
                // Re-open betting for others
                const nextIdx = (playerIndex + 1) % this.players.length;
                this.populateQueue(nextIdx);
                // Remove self from queue (already acted)
                this.playersToAct = this.playersToAct.filter(idx => idx !== playerIndex);
                break;
            case 'allin':
                const allInAmount = player.chips;
                const newTotal = player.currentBet + allInAmount;
                
                player.chips = 0;
                player.currentBet = newTotal;
                this.pot += allInAmount;
                chipChange = allInAmount;
                message = "All In";

                if (newTotal > this.currentBet) {
                    // It's a raise
                    this.currentBet = newTotal;
                    // Re-open betting for others
                    const nextIdx = (playerIndex + 1) % this.players.length;
                    this.populateQueue(nextIdx);
                    // Remove self from queue
                    this.playersToAct = this.playersToAct.filter(idx => idx !== playerIndex);
                } else {
                    // It's a call (short stack)
                    // Do not re-open betting, just proceed
                    // But we still need to remove self from queue? 
                    // Yes, populateQueue was called before nextTurn, but wait.
                    // populateQueue is only called on Raise or New Phase.
                    // On Call/Check/Fold, we just shift activePlayerIndex.
                    // But if this was a Call, we don't need to do anything special,
                    // nextTurn() will handle the next player in existing queue.
                }
                break;
        }

        this.io.to(this.roomId).emit('playerAction', { 
            socketId: player.socketId, 
            action, 
            amount: chipChange,
            message 
        });

        this.broadcastState();
        setTimeout(() => this.nextTurn(), 1000);
    }

    startNewHand() {
        // 检查玩家筹码，将筹码为0的玩家移到等待列表
        const brokePlayers = [];
        this.players = this.players.filter(p => {
            if (p.chips <= 0) {
                p.isSittingOut = true;  // 标记为旁观状态
                brokePlayers.push(p);
                return false; // 从玩家列表中移除
            }
            return true;
        });
        
        // 将破产玩家移到等待列表
        if (brokePlayers.length > 0) {
            this.waitingPlayers.push(...brokePlayers);
            brokePlayers.forEach(p => {
                this.broadcastMessage(`${p.name} 筹码已用完，暂时旁观`);
            });
        }
        
        // Merge waiting players (只合并有筹码的)
        if (this.waitingPlayers.length > 0) {
            const joiners = this.waitingPlayers.filter(p => p.chips > 0 && !p.isSittingOut);
            if (joiners.length > 0) {
                this.players.push(...joiners);
                this.waitingPlayers = this.waitingPlayers.filter(p => p.chips <= 0 || p.isSittingOut);
                this.broadcastMessage('等待的玩家已加入牌局');
            }
        }

        if (this.players.length < this.minPlayers) {
            this.gameStarted = false;
            this.broadcastMessage('人数不足，等待更多玩家...');
            this.broadcastState();
            return;
        }

        this.gameStarted = true;
        this.deck.reset();
        this.deck.shuffle();
        this.players.forEach(p => p.resetHand());
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'pre-flop';
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

        this.postBlinds();
        
        // Deal cards
        for(let i=0; i<2; i++) {
            this.players.forEach(p => {
                p.receiveCard(this.deck.deal());
            });
        }

        this.io.to(this.roomId).emit('gameStart', { handCount: ++this.handCount });
        this.broadcastState();

        this.populateQueue((this.dealerIndex + 3) % this.players.length);
        this.nextTurn();
    }

    postBlinds() {
        const sbIndex = (this.dealerIndex + 1) % this.players.length;
        const bbIndex = (this.dealerIndex + 2) % this.players.length;
        
        const sb = this.blinds.sb;
        const bb = this.blinds.bb;

        const post = (player, amount) => {
            if (player.chips < amount) amount = player.chips;
            player.chips -= amount;
            player.currentBet = amount;
            this.pot += amount;
        };

        post(this.players[sbIndex], sb);
        post(this.players[bbIndex], bb);
        this.currentBet = bb;
    }

    populateQueue(startIndex) {
        this.playersToAct = [];
        const count = this.players.length;
        for (let i = 0; i < count; i++) {
            const idx = (startIndex + i) % count;
            const p = this.players[idx];
            if (!p.folded && p.chips > 0) {
                this.playersToAct.push(idx);
            }
        }
    }

    nextTurn() {
        const survivors = this.players.filter(p => !p.folded);
        if (survivors.length === 1) {
            this.endHand(survivors[0]);
            return;
        }

        if (this.playersToAct.length === 0) {
            this.nextPhase();
            return;
        }

        this.activePlayerIndex = this.playersToAct.shift();
        const player = this.players[this.activePlayerIndex];

        if (player.folded || player.chips === 0) {
            this.nextTurn();
            return;
        }

        this.broadcastState();
    }

    nextPhase() {
        this.players.forEach(p => p.currentBet = 0);
        this.currentBet = 0;

        if (this.phase === 'pre-flop') {
            this.phase = 'flop';
            this.dealCommunity(3);
        } else if (this.phase === 'flop') {
            this.phase = 'turn';
            this.dealCommunity(1);
        } else if (this.phase === 'turn') {
            this.phase = 'river';
            this.dealCommunity(1);
        } else if (this.phase === 'river') {
            this.phase = 'showdown';
            this.determineWinner();
            return;
        }

        this.broadcastState();
        this.populateQueue((this.dealerIndex + 1) % this.players.length);
        setTimeout(() => this.nextTurn(), 1000);
    }

    dealCommunity(count) {
        for(let i=0; i<count; i++) {
            this.communityCards.push(this.deck.deal());
        }
    }

    determineWinner() {
        const survivors = this.players.filter(p => !p.folded);
        
        // 实现边池(Side Pot)机制
        const sidePots = this.calculateSidePots();
        
        const scores = survivors.map(p => {
            return {
                player: p,
                score: HandEvaluator.evaluate(p.hand, this.communityCards)
            };
        });

        scores.sort((a, b) => {
            if (b.score.rank !== a.score.rank) return b.score.rank - a.score.rank;
            for(let i=0; i<a.score.tieBreakers.length; i++) {
                if (b.score.tieBreakers[i] !== a.score.tieBreakers[i]) {
                    return b.score.tieBreakers[i] - a.score.tieBreakers[i];
                }
            }
            return 0;
        });

        // 分配边池
        const allWinners = [];
        sidePots.forEach(pot => {
            // 找出参与这个边池的最强玩家
            const eligibleScores = scores.filter(s => pot.eligiblePlayers.includes(s.player));
            if (eligibleScores.length === 0) return;
            
            const bestInPot = eligibleScores[0];
            const winnersInPot = eligibleScores.filter(s => {
                if (s.score.rank !== bestInPot.score.rank) return false;
                for(let i=0; i<s.score.tieBreakers.length; i++) {
                    if (s.score.tieBreakers[i] !== bestInPot.score.tieBreakers[i]) return false;
                }
                return true;
            });
            
            const winAmount = Math.floor(pot.amount / winnersInPot.length);
            winnersInPot.forEach(w => {
                w.player.chips += winAmount;
                this.saveChips(w.player); // Save winner chips
                
                // 记录赢家信息
                const existing = allWinners.find(aw => aw.socketId === w.player.socketId);
                if (existing) {
                    existing.amount += winAmount;
                } else {
                    allWinners.push({
                        socketId: w.player.socketId,
                        amount: winAmount,
                        handName: w.score.name
                    });
                }
            });
        });

        // Also save all players chips to be safe (blinds/bets deducted)
        this.players.forEach(p => this.saveChips(p));

        this.io.to(this.roomId).emit('gameOver', {
            winners: allWinners
        });

        this.pot = 0;
        this.broadcastState();
        setTimeout(() => this.startNewHand(), 5000);
    }

    endHand(winner) {
        winner.chips += this.pot;
        this.io.to(this.roomId).emit('gameOver', {
            winners: [{ socketId: winner.socketId, amount: this.pot, handName: 'Opponents Folded' }]
        });
        this.pot = 0;
        this.broadcastState();
        setTimeout(() => this.startNewHand(), 3000);
    }

    broadcastState() {
        // We need to mask other players' cards!
        // But for simplicity in "State" object, we might send everything and filter on client?
        // NO, that's cheating. We must filter on server.
        
        const allPlayers = [...this.players, ...this.waitingPlayers];

        allPlayers.forEach(p => {
            const state = {
                roomId: this.roomId,
                pot: this.pot,
                communityCards: this.communityCards,
                currentBet: this.currentBet,
                phase: this.phase,
                activePlayerIndex: this.activePlayerIndex,
                dealerIndex: this.dealerIndex,
                gameStarted: this.gameStarted,
                isHost: p.socketId === this.hostSocketId,
                isWaiting: this.waitingPlayers.includes(p),
                players: allPlayers.map((other, idx) => ({
                    name: other.name,
                    chips: other.chips,
                    currentBet: other.currentBet,
                    folded: other.folded,
                    socketId: other.socketId,
                    avatar: other.avatar, // Send avatar
                    isActive: this.players.includes(other),
                    isWaiting: this.waitingPlayers.includes(other),
                    // Only show cards if it's ME or Showdown
                    hand: (other.socketId === p.socketId || this.phase === 'showdown') ? other.hand : [] 
                }))
            };
            this.io.to(p.socketId).emit('updateState', state);
        });
    }
    
    broadcastMessage(msg) {
        this.io.to(this.roomId).emit('message', msg);
    }

    clearAllTimers() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers = [];
    }

    saveChips(player) {
        if (this.userManager && player.name) {
            // Assuming player.name is the username. 
            // If player.name is nickname, we need username.
            // But in addPlayer we passed name which IS username.
            this.userManager.updateChips(player.name, player.chips);
        }
    }

    // 计算边池(Side Pots)
    // 当多个玩家all-in且筹码量不同时，需要分开计算底池
    calculateSidePots() {
        const pots = [];
        const allPlayers = [...this.players].sort((a, b) => a.currentBet - b.currentBet);
        
        let remainingPlayers = allPlayers.filter(p => !p.folded);
        let previousBet = 0;
        
        allPlayers.forEach((player, index) => {
            if (player.folded) return;
            
            const betLevel = player.currentBet;
            if (betLevel <= previousBet) return;
            
            const betDiff = betLevel - previousBet;
            let potAmount = 0;
            
            // 计算这个级别的底池金额
            allPlayers.forEach(p => {
                const contribution = Math.min(betDiff, Math.max(0, p.currentBet - previousBet));
                potAmount += contribution;
            });
            
            if (potAmount > 0) {
                pots.push({
                    amount: potAmount,
                    eligiblePlayers: [...remainingPlayers]
                });
            }
            
            // 移除已经all-in且筹码用完的玩家（他们不能参与更大的边池）
            if (player.chips === 0) {
                remainingPlayers = remainingPlayers.filter(p => p !== player);
            }
            
            previousBet = betLevel;
        });
        
        // 如果没有边池（所有人筹码相同），返回主池
        if (pots.length === 0) {
            pots.push({
                amount: this.pot,
                eligiblePlayers: allPlayers.filter(p => !p.folded)
            });
        }
        
        return pots;
    }

    // 处理玩家重新买入（客户端调用）
    handleRebuy(socketId, amount) {
        // 在等待列表中找到这个玩家
        const player = this.waitingPlayers.find(p => p.socketId === socketId);
        if (!player) return;
        
        // 简化处理：直接给玩家增加筹码
        // 实际应该验证玩家账户余额等
        player.chips = amount;
        player.isSittingOut = false;
        
        this.broadcastMessage(`${player.name} 补充了 ${amount} 筹码`);
        this.broadcastState();
    }
}

module.exports = GameServer;
