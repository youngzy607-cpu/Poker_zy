class Game {
    constructor() {
        this.deck = new Deck();
        this.players = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0; 
        this.phase = 'pre-flop'; 
        this.activePlayerIndex = 0;
        this.dealerIndex = 0;
        this.playersToAct = []; // Queue of players who must act
        this.ui = new UI();
        this.timers = []; // Track active timers
        
        // Game Mode State
        this.mode = 'cash'; // 'cash' or 'tournament'
        this.handCount = 0;
        this.blinds = { sb: 5, bb: 10 };
        this.tournamentConfig = {
            buyIn: 500,
            startChips: 1500,
            blindIncreaseEvery: 5,
            prizes: [1500, 1000] // Net profit: 1st=+1000, 2nd=+500. Total Payout from pool: 2500? No, this is "Net". 
                                 // Actually logic: 
                                 // 1st gets 1500 chips worth of value? No, cash.
                                 // Let's store "Payout" amount. 
                                 // User pays 500. 
                                 // 1st Prize: 1500 (Net +1000). 
                                 // 2nd Prize: 1000 (Net +500).
        };

        // Bankroll Management
        this.bankroll = 0; // Chips remaining outside the table
        
        this.bindEvents();
    }
    
    // Helper to manage timers
    setTimeout(fn, delay) {
        const id = window.setTimeout(fn, delay);
        this.timers.push(id);
        return id;
    }
    
    clearAllTimers() {
        this.timers.forEach(id => clearTimeout(id));
        this.timers = [];
    }

    bindEvents() {
        // --- Mode Selection UI Handlers ---
        const lobbyOverlay = document.getElementById('lobby-overlay');
        const modeSelect = document.getElementById('lobby-mode-select');
        const setupCash = document.getElementById('lobby-setup-cash');
        const setupTourney = document.getElementById('lobby-setup-tourney');

        // 1. Open Mode Selection (Main Menu -> Lobby)
        document.getElementById('btn-menu-single').addEventListener('click', () => {
            const profile = DataManager.load();
            
            // Bankruptcy Check (Global)
            if (profile.chips <= 0) {
                 DataManager.updateChips(1000);
                 alert("破产补助：已为您补充 1000 筹码");
                 profile.chips = 1000;
            }
            
            document.getElementById('mode-total-chips').innerText = profile.chips;
            document.getElementById('cash-total-chips').innerText = profile.chips;
            document.getElementById('tourney-total-chips').innerText = profile.chips;

            document.getElementById('main-menu').style.display = 'none';
            lobbyOverlay.style.display = 'flex';
            modeSelect.style.display = 'block';
            setupCash.style.display = 'none';
            setupTourney.style.display = 'none';
        });

        // 2. Select Cash Game
        document.getElementById('btn-mode-cash').addEventListener('click', () => {
            modeSelect.style.display = 'none';
            setupCash.style.display = 'block';
            
            // Setup Cash Slider
            const profile = DataManager.load();
            const slider = document.getElementById('buyin-amount');
            const display = document.getElementById('buyin-display');
            slider.min = 100;
            slider.max = profile.chips;
            slider.value = Math.min(1000, profile.chips);
            display.innerText = slider.value;
            slider.oninput = function() { display.innerText = this.value; }
        });

        // 3. Select Tournament
        document.getElementById('btn-mode-tourney').addEventListener('click', () => {
            modeSelect.style.display = 'none';
            setupTourney.style.display = 'block';
        });

        // 4. Back Buttons
        document.getElementById('btn-mode-back').addEventListener('click', () => {
            lobbyOverlay.style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        });
        document.getElementById('btn-back-mode-select').addEventListener('click', () => {
            setupCash.style.display = 'none';
            modeSelect.style.display = 'block';
        });
        document.getElementById('btn-back-mode-select-2').addEventListener('click', () => {
            setupTourney.style.display = 'none';
            modeSelect.style.display = 'block';
        });

        // 5. Start Buttons
        document.getElementById('btn-start-cash').addEventListener('click', () => {
            const count = parseInt(document.getElementById('opponent-count').value);
            const buyIn = parseInt(document.getElementById('buyin-amount').value);
            this.initGame('cash', { opponentCount: count, buyIn: buyIn });
        });

        document.getElementById('btn-start-tourney').addEventListener('click', () => {
            const profile = DataManager.load();
            if (profile.chips < 500) {
                alert('您的资金不足 $500，无法报名锦标赛！');
                return;
            }
            this.initGame('tournament', { opponentCount: 4, buyIn: 500 });
        });


        // Other UI Handlers
        document.getElementById('btn-menu-multi').addEventListener('click', () => {
            alert('联机对战功能开发中，敬请期待！');
        });

        // Stats Button
        document.getElementById('btn-menu-stats').addEventListener('click', () => {
             const data = DataManager.load();
             document.getElementById('stat-chips').innerText = data.chips;
             document.getElementById('stat-hands').innerText = data.stats.totalHands;
             document.getElementById('stat-wins').innerText = data.stats.wins;
             document.getElementById('stat-profit').innerText = data.stats.totalProfit > 0 ? `+${data.stats.totalProfit}` : data.stats.totalProfit;
             document.getElementById('stat-best-hand').innerText = data.stats.bestHand.name !== '无' ? `${data.stats.bestHand.name}` : '暂无';
             document.getElementById('stat-biggest-pot').innerText = data.stats.biggestPot;
             
             const historyContainer = document.getElementById('history-container');
             historyContainer.innerHTML = '';
             data.history.forEach(item => {
                 const div = document.createElement('div');
                 div.className = 'history-item';
                 div.innerHTML = `
                    <div class="history-date">${item.date}</div>
                    <div class="history-hand">${item.handName}</div>
                    <div class="history-profit ${item.profit >= 0 ? 'win' : 'loss'}">${item.profit >= 0 ? '+' : ''}${item.profit}</div>
                 `;
                 historyContainer.appendChild(div);
             });

             document.getElementById('main-menu').style.display = 'none';
             document.getElementById('stats-overlay').style.display = 'flex';
        });

        document.getElementById('btn-stats-close').addEventListener('click', () => {
            document.getElementById('stats-overlay').style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        });

        document.getElementById('btn-stats-reset').addEventListener('click', () => {
            if(confirm('确定要重置所有战绩数据吗？这将清空您的筹码和历史记录。')) {
                DataManager.reset();
                alert('数据已重置');
                document.getElementById('btn-stats-close').click();
            }
        });

        document.getElementById('btn-menu-exit').addEventListener('click', () => {
            if(confirm('确定要退出游戏吗？')) {
                window.close();
                document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff;"><h1>已退出游戏</h1></div>';
            }
        });

        document.getElementById('btn-back-menu').addEventListener('click', () => {
            let msg = '确定要返回主菜单吗？';
            if (this.mode === 'cash') {
                msg += '当前牌局将直接结束，您的筹码将自动保存。';
            } else {
                msg += '锦标赛中途退出将被视为弃权，无法获得退款或奖金！';
            }
            
            if(confirm(msg)) {
                this.stopGame(); 
                document.querySelector('.game-container').style.display = 'none';
                document.getElementById('main-menu').style.display = 'flex';
                this.updateMenuChips();
            }
        });

        document.getElementById('btn-fold').addEventListener('click', () => this.handleAction('fold'));
        document.getElementById('btn-check').addEventListener('click', () => this.handleAction('check'));
        document.getElementById('btn-call').addEventListener('click', () => this.handleAction('call'));
        
        // Raise & All-in logic
        const slider = document.getElementById('raise-slider');
        const display = document.getElementById('raise-amount-display');
        
        slider.addEventListener('input', (e) => {
            display.innerText = e.target.value;
        });
        
        document.getElementById('btn-raise').addEventListener('click', () => {
             document.getElementById('main-actions').style.display = 'none';
             document.getElementById('raise-inputs').style.display = 'flex';
             this.updateButtons();
        });
        
        document.getElementById('btn-confirm-raise').addEventListener('click', () => {
             const amt = parseInt(slider.value);
             this.handleAction('raise', amt);
             document.getElementById('raise-inputs').style.display = 'none';
             document.getElementById('main-actions').style.display = 'flex';
        });

        document.getElementById('btn-cancel-raise').addEventListener('click', () => {
             document.getElementById('raise-inputs').style.display = 'none';
             document.getElementById('main-actions').style.display = 'flex';
        });
        
        document.querySelector('.btn-adjust.minus').addEventListener('click', () => {
             slider.stepDown();
             slider.dispatchEvent(new Event('input'));
        });
        document.querySelector('.btn-adjust.plus').addEventListener('click', () => {
             slider.stepUp();
             slider.dispatchEvent(new Event('input'));
        });
        
        document.getElementById('btn-quick-allin').addEventListener('click', () => {
             const maxRaise = this.getMaxRaiseAmount();
             this.handleAction('raise', maxRaise);
        });

        document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    }

    stopGame() {
        if (this.mode === 'cash') {
            // Save Chips Logic for Cash Game
            if (this.players && this.players.length > 0) {
                const user = this.players[0];
                const currentTotal = this.bankroll + user.chips;
                DataManager.updateChips(currentTotal);
                if(networkManager) networkManager.updateBalance(currentTotal);
            }
        } else {
            // Tournament: No refund if quit manually.
            // Bankroll was already deducted at init.
        }
    
        // Reset game state
        this.clearAllTimers();
        this.players = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'pre-flop';
        this.playersToAct = [];
        this.activePlayerIndex = -1;
        
        this.ui.updateCommunityCards([]);
        this.ui.updatePot(0);
        document.getElementById('opponents-container').innerHTML = '';
    }

    getMaxRaiseAmount() {
        const player = this.players[0];
        const callAmt = this.currentBet - player.currentBet;
        return Math.max(0, player.chips - callAmt);
    }

    updateMenuChips() {
        const data = DataManager.load();
        const el = document.getElementById('menu-chip-count');
        if (el) el.innerText = data.chips;
    }

    initGame(mode, config) {
        this.mode = mode;
        const opponentCount = config.opponentCount;
        const buyInAmount = config.buyIn;

        document.getElementById('lobby-overlay').style.display = 'none';
        document.querySelector('.game-container').style.display = 'flex';
        
        if (typeof soundManager !== 'undefined') {
            soundManager.init();
        }

        // --- Bankroll Logic ---
        const profile = DataManager.load();
        
        if (this.mode === 'cash') {
            this.bankroll = profile.chips - buyInAmount;
            // Immediate save to prevent duplication if crash
            DataManager.updateChips(this.bankroll); 
            if(networkManager) networkManager.updateBalance(this.bankroll);
            
            this.blinds = { sb: 5, bb: 10 }; // Reset blinds
            this.handCount = 0;
            
            // Init Players
            this.players = [];
            this.players.push(new Player('玩家 (你)', buyInAmount, false));
            for (let i = 1; i <= opponentCount; i++) {
                const personality = {
                    aggression: Math.random(),
                    tightness: Math.random(),
                    bluffFrequency: Math.random()
                };
                this.players.push(new Player(`电脑 ${i}`, buyInAmount, true, personality));
            }
            
        } else {
            // Tournament Logic
            // Deduct buy-in permanently
            this.bankroll = profile.chips - buyInAmount;
            DataManager.updateChips(this.bankroll);
            if(networkManager) networkManager.updateBalance(this.bankroll);
            
            this.blinds = { sb: 10, bb: 20 }; // Start slightly higher? Or 5/10. Let's do 10/20.
            this.handCount = 0;
            const startChips = this.tournamentConfig.startChips; // 1500

            this.players = [];
            this.players.push(new Player('玩家 (你)', startChips, false));
            for (let i = 1; i <= opponentCount; i++) {
                const personality = {
                    aggression: Math.random(),
                    tightness: Math.random(),
                    bluffFrequency: Math.random()
                };
                this.players.push(new Player(`电脑 ${i}`, startChips, true, personality));
            }
        }

        this.ui.setupOpponents(this.players.slice(1)); 
        
        // Add Rebuy Button for Cash Game
        if (this.mode === 'cash') {
            this.ui.createAddChipsButton();
            const btn = document.getElementById('btn-add-chips');
            if(btn) {
                btn.onclick = () => {
                    // Only allow rebuy if not already pending or max chips?
                    // Actually allow anytime.
                    this.triggerNonBlockingRebuy();
                };
            }
        }
        
        this.startNewHand();
    }

    startNewHand() {
        // --- Tournament Knockout Check ---
        if (this.mode === 'tournament') {
            // Remove players with 0 chips
            const activeBefore = this.players.length;
            this.players = this.players.filter(p => p.chips > 0);
            
            // Check if User Died
            const user = this.players.find(p => !p.isComputer);
            if (!user) {
                // User Eliminated
                // Calculate Rank
                const rank = this.players.length + 1; // Survivors + Me
                this.handleTournamentOver(rank);
                return;
            }
            
            // Check if Winner
            if (this.players.length === 1 && this.players[0] === user) {
                this.handleTournamentOver(1);
                return;
            }
            
            // If opponents died, refresh UI
            if (this.players.length < activeBefore) {
                 this.ui.setupOpponents(this.players.filter(p => p.isComputer));
            }
        } else {
            // Cash Game Logic
            const user = this.players[0];
            
            // 1. Check User Bankruptcy (Non-blocking)
            if (user.chips <= 0) {
                user.isSittingOut = true;
                user.isActive = false;
                // If modal not already shown, trigger it
                if (document.getElementById('rebuy-overlay').style.display !== 'flex') {
                    this.triggerNonBlockingRebuy();
                }
            } else {
                // If user has chips, ensure they are back in
                if (user.isSittingOut) {
                    user.isSittingOut = false;
                    user.isActive = true;
                }
            }

            // 2. Check Opponents Bankruptcy
            this.players.forEach(p => {
                if (p.isComputer) {
                    if (p.chips <= 0) {
                        // Simple CPU Rebuy Logic: Always rebuy if broke
                        p.chips = 1000;
                        p.isActive = true;
                        this.ui.showMessage(`${p.name} 补充了筹码`);
                    } else {
                        p.isActive = true;
                    }
                }
            });

            // 3. Check if enough players to start
            const activePlayers = this.players.filter(p => !p.isSittingOut && p.isActive);
            if (activePlayers.length < 2) {
                // Everyone is broke or sitting out?
                // If user is sitting out, we should wait?
                // Or if user is the ONLY one sitting out, and CPUs are ready, we can't start a hand with 1 CPU?
                // Actually if CPUs are there, they can play against each other? 
                // Wait, if user is sitting out, we can let CPUs play.
                
                // If ONLY 1 player total (e.g. 1 CPU left and User sitting out), we can't start.
                // But we have logic to refill CPUs. So usually CPUs > 0.
                // If User + 1 CPU. User sits out. CPU is alone.
                // We need at least 2 active players to deal cards.
                
                if (activePlayers.length < 2) {
                    this.ui.showMessage("等待玩家加入...");
                    this.setTimeout(() => this.startNewHand(), 1000); // Polling wait
                    return;
                }
            }
        }

        // --- Blind Increase Logic (Tournament) ---
        if (this.mode === 'tournament') {
            this.handCount++;
            if (this.handCount > 1 && this.handCount % this.tournamentConfig.blindIncreaseEvery === 1) {
                // Increase Blinds! (Triggered at start of 6th, 11th... hand)
                const oldSb = this.blinds.sb;
                const oldBb = this.blinds.bb;
                
                this.blinds.sb *= 2;
                this.blinds.bb *= 2;
                
                // Show Level Up Overlay
                const overlay = document.getElementById('level-up-overlay');
                document.querySelector('.old-blind span').innerText = `${oldSb}/${oldBb}`;
                document.getElementById('level-up-new-blind').innerText = `${this.blinds.sb}/${this.blinds.bb}`;
                
                overlay.style.display = 'flex';
                soundManager.playAlert();
                
                // Pause game for 3 seconds then start
                this.setTimeout(() => {
                    overlay.style.display = 'none';
                    this.startHandSequence();
                }, 3000);
                return; // Stop here, wait for timeout to resume
            }
        }

        this.startHandSequence();
    }

    startHandSequence() {
        this.deck.reset();
        this.deck.shuffle();
        this.players.forEach(p => p.resetHand());
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'pre-flop';
        
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        
        this.postBlinds();

        soundManager.playCard();
        for(let i=0; i<2; i++) {
            this.players.forEach(p => {
                // Only deal to active players who are NOT sitting out
                if((this.mode === 'tournament' || (p.isActive && !p.isSittingOut))) {
                    p.receiveCard(this.deck.deal());
                }
            });
        }

        this.ui.updateCommunityCards([]);
        this.ui.updatePot(this.pot);
        this.ui.updatePlayers(this.players);
        
        if (this.mode === 'tournament') {
             // Show Blind Info
             this.ui.showMessage(`第 ${this.handCount} 局 (盲注 ${this.blinds.sb}/${this.blinds.bb})`);
        } else {
             this.ui.showMessage("新的一局开始！");
        }
        
        this.userStartChips = this.players[0].chips;
        
        this.populateQueue((this.dealerIndex + 3) % this.players.length);
        this.nextTurn();
    }

    postBlinds() {
        const sbIndex = (this.dealerIndex + 1) % this.players.length;
        const bbIndex = (this.dealerIndex + 2) % this.players.length;
        
        const sb = this.blinds.sb;
        const bb = this.blinds.bb;

        // Force post. If not enough chips, All-in.
        // Helper
        const post = (player, amount) => {
            if (player.chips < amount) amount = player.chips;
            player.chips -= amount;
            player.currentBet = amount;
            this.pot += amount;
        };

        if(this.players[sbIndex].isActive || this.mode === 'tournament') {
            post(this.players[sbIndex], sb);
        }

        if(this.players[bbIndex].isActive || this.mode === 'tournament') {
            post(this.players[bbIndex], bb);
        }

        this.currentBet = bb;
    }

    handleTournamentOver(rank) {
        let msg = "";
        let reward = 0;
        
        if (rank === 1) {
            msg = "🏆 恭喜！你是锦标赛冠军！获得奖金 $1500！";
            reward = 1500;
            soundManager.playWin();
        } else if (rank === 2) {
            msg = "🥈 获得亚军！获得奖金 $1000！";
            reward = 1000;
        } else {
            msg = `❌ 你被淘汰了。第 ${rank} 名。`;
        }
        
        this.ui.showMessage(msg);
        this.disableControls();
        
        // Save Reward
        if (reward > 0) {
            const profile = DataManager.load();
            DataManager.updateChips(profile.chips + reward);
            if(networkManager) networkManager.updateBalance(profile.chips + reward);
            
            // Record History
            DataManager.recordHand({
                profit: reward - 500, // Net Profit
                hand: { name: `锦标赛第${rank}名` },
                pot: 0,
                cards: []
            });
        } else {
             // Record Loss
             DataManager.recordHand({
                profit: -500,
                hand: { name: `锦标赛第${rank}名` },
                pot: 0,
                cards: []
            });
        }
        
        document.getElementById('btn-restart').style.display = 'inline-block';
        document.getElementById('btn-restart').innerText = "返回大厅";
        document.getElementById('btn-restart').onclick = () => location.reload();
    }

    populateQueue(startIndex) {
        this.playersToAct = [];
        const count = this.players.length;
        for (let i = 0; i < count; i++) {
            const idx = (startIndex + i) % count;
            const p = this.players[idx];
            // In tournament, all remaining players are active
            if ((this.mode === 'tournament' || p.isActive) && !p.folded && p.chips > 0) {
                this.playersToAct.push(idx);
            }
        }
    }

    // New centralized action handler
    handleAction(action, amount = 0) {
        const playerIndex = this.activePlayerIndex;
        const player = this.players[playerIndex];
        
        // Safety check
        if (!player) return;

        if (player === this.players[0]) this.disableControls();

        let message = "";
        let chipChange = 0;

        switch (action) {
            case 'fold':
                player.folded = true;
                message = "弃牌";
                soundManager.playFold();
                break;
            case 'check':
                message = "过牌";
                soundManager.playCheck();
                break;
            case 'call':
                const callAmt = this.currentBet - player.currentBet;
                player.chips -= callAmt;
                player.currentBet += callAmt;
                this.pot += callAmt;
                chipChange = callAmt;
                message = "跟注";
                soundManager.playChip();
                break;
            case 'raise':
                let raiseAmt = amount;
                if (raiseAmt <= 0) raiseAmt = this.blinds.bb * 2; // Min raise logic
                
                const total = this.currentBet + raiseAmt;
                const added = total - player.currentBet;
                
                player.chips -= added;
                player.currentBet += added;
                this.pot += added;
                this.currentBet = total;
                chipChange = added;
                message = `加注 ${raiseAmt}`;
                soundManager.playChip();
                
                const nextIdx = (playerIndex + 1) % this.players.length;
                this.populateQueue(nextIdx);
                this.playersToAct = this.playersToAct.filter(idx => idx !== playerIndex);
                break;
        }

        this.ui.showMessage(`${player.name} ${message}`);
        this.ui.updatePlayers(this.players); 
        
        if (chipChange > 0) {
            let playerEl;
            if (playerIndex === 0) playerEl = document.getElementById('player-area').querySelector('.player-info');
            else {
                // In Tournament, indices shift as players die. 
                // But UI setupOpponents re-renders. We need to find the correct DOM element.
                // UI.js assigns ID 'opponent-X' based on array index.
                // BUT if players array shrinks, indices change.
                // We should rely on UI to handle mapping or just grab by index if it matches UI render order.
                // Current UI implementation: setupOpponents iterates (players.slice(1)).
                // So opponent-0 is players[1], opponent-1 is players[2].
                // Yes, consistent.
                const opp = document.getElementById(`opponent-${playerIndex-1}`);
                if (opp) playerEl = opp.querySelector('.player-info');
            }
            const potEl = document.querySelector('.pot-display');
            
            this.ui.animateChips(playerEl, potEl, chipChange, () => {
                 this.ui.updatePot(this.pot); 
            });
        } else {
            this.ui.updatePot(this.pot);
        }

        this.setTimeout(() => this.nextTurn(), player.isComputer ? 600 : 400);
    }

    nextTurn() {
        const survivors = this.players.filter(p => (this.mode==='tournament' || (p.isActive && !p.isSittingOut)) && !p.folded);
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

        // Validate
        if ((this.mode !== 'tournament' && (!player.isActive || player.isSittingOut)) || player.folded) {
            this.nextTurn(); 
            return;
        }

        this.processTurn();
    }

    processTurn() {
        const player = this.players[this.activePlayerIndex];
        if (!player) return; 

        if (player.isComputer) {
            this.disableControls();
            this.ui.showMessage(`${player.name} 思考中...`);
            this.setTimeout(() => this.computerAI(), 800);
        } else {
            this.ui.showMessage("轮到你了");
            soundManager.playAlert();
            this.enableControls();
        }
    }

    computerAI() {
        if (!this.players || this.activePlayerIndex >= this.players.length || this.activePlayerIndex < 0) return;
        
        const cpu = this.players[this.activePlayerIndex];
        if (!cpu) return;
        
        const diff = this.currentBet - cpu.currentBet;
        const activePlayersCount = this.players.filter(p => (this.mode==='tournament' || (p.isActive && !p.isSittingOut)) && !p.folded).length;

        let winRate = 0;
        try {
            winRate = OddsCalculator.calculate(cpu.hand, this.communityCards, activePlayersCount - 1);
        } catch (e) {
            console.error("Odds calculation error:", e);
            winRate = 1 / activePlayersCount;
        }

        let action = 'fold';
        // console.log(`[AI ${cpu.name}] WR: ${winRate.toFixed(2)}`);

        if (this.phase === 'pre-flop') {
            const baseThreshold = (1 / activePlayersCount);
            const threshold = baseThreshold + (cpu.tightness * 0.15) - 0.05;

            if (winRate >= threshold) {
                if (diff === 0) action = 'check';
                else action = 'call';

                if (winRate > threshold + 0.15 && Math.random() < cpu.aggression) {
                    action = 'raise';
                }
            } else {
                if (diff === 0) action = 'check';
                else action = 'fold';
            }

        } else {
            const averageWinRate = 1 / activePlayersCount;
            if (winRate > averageWinRate * 1.1) { 
                if (Math.random() < cpu.aggression) {
                    action = 'raise'; 
                } else {
                    if (diff === 0) action = 'check';
                    else action = 'call'; 
                }
            } else {
                if (Math.random() < cpu.bluffFrequency) {
                    action = 'raise'; 
                } else {
                    if (diff === 0) action = 'check';
                    else action = 'fold';
                }
            }
        }

        if (action === 'raise') {
             const callAmt = diff;
             if (cpu.chips <= callAmt) {
                 action = 'call';
             }
        }
        
        if (action === 'check' && diff > 0) {
            action = 'fold';
        }

        this.handleAction(action);
    }

    dealCommunity(count) {
        soundManager.playCard();
        for(let i=0; i<count; i++) {
            const card = this.deck.deal();
            this.communityCards.push(card);
        }
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

        this.ui.updateCommunityCards(this.communityCards);
        this.ui.updatePlayers(this.players);
        this.ui.updatePot(this.pot);
        this.ui.showMessage(`进入阶段: ${this.phase}`);

        this.populateQueue((this.dealerIndex + 1) % this.players.length);
        
        this.setTimeout(() => this.nextTurn(), 1000);
    }

    endHand(winner) {
        if (winner) {
            winner.chips += this.pot;
            this.ui.showMessage(`${winner.name} 赢了 ${this.pot} 筹码!`);
        }
        
        // Save user state (Only in Cash Mode)
        if (this.mode === 'cash') {
            const user = this.players[0];
            DataManager.updateChips(this.bankroll + user.chips);
            if(networkManager) networkManager.updateBalance(this.bankroll + user.chips);
        }
        
        this.pot = 0;
        this.ui.updatePlayers(this.players);
        this.ui.updatePot(0);
        
        this.setTimeout(() => {
            if (this.mode === 'cash' && this.players[0].chips <= 0) {
                 this.startNewHand();
            } else {
                this.startNewHand();
            }
        }, 3000);
    }
    
    restartGame() {
        location.reload(); 
    }

    determineWinner() {
        this.ui.updatePlayers(this.players, true); 
        
        const activeSurvivors = this.players.filter(p => (this.mode==='tournament' || (p.isActive && !p.isSittingOut)) && !p.folded);
        const scores = activeSurvivors.map(p => {
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

        const bestScore = scores[0];
        const winners = scores.filter(s => {
            if (s.score.rank !== bestScore.score.rank) return false;
            for(let i=0; i<s.score.tieBreakers.length; i++) {
                if (s.score.tieBreakers[i] !== bestScore.score.tieBreakers[i]) return false;
            }
            return true;
        });

        const winAmount = Math.floor(this.pot / winners.length);
        let msg = "";
        
        this.setTimeout(() => {
            winners.forEach((w, i) => {
                const pIdx = this.players.indexOf(w.player);
                this.setTimeout(() => {
                    this.ui.animatePotToWinner(pIdx, () => {
                         w.player.chips += winAmount;
                         this.ui.updatePlayers(this.players, true);
                    });
                }, i * 500);
                msg += `${w.player.name} `;
            });
            
            msg += `赢了! (${bestScore.score.name})`;
            this.ui.showMessage(msg);
            soundManager.playWin();
            
            // --- Save User Data & Record History ---
            const user = this.players[0];
            const userScore = scores.find(s => s.player === user);
            const userWon = winners.some(w => w.player === user);
            
            this.setTimeout(() => {
                if (this.mode === 'cash') {
                    const actualProfit = user.chips - this.userStartChips;
                    
                    // 1. Update Chips first
                    DataManager.updateChips(this.bankroll + user.chips);
                    if(networkManager) networkManager.updateBalance(this.bankroll + user.chips);
                    
                    // 2. Record Hand Stats (Wins, Hands Played, etc.)
                    DataManager.recordHand({
                        profit: actualProfit,
                        hand: userScore ? userScore.score : null,
                        pot: this.pot,
                        cards: user.hand.map(c => c.toString())
                    });

                    // 3. CHECK ACHIEVEMENTS NOW (After stats are updated)
                    this.checkAchievements();
                }
                
                this.pot = 0;
                this.ui.updatePot(0);
                
                if (this.mode === 'cash' && this.players[0].chips <= 0) {
                    // Logic moved to startNewHand check, so just startNewHand
                    // If player is broke, startNewHand will mark sittingOut and trigger modal
                    this.startNewHand();
                } else {
                    this.startNewHand();
                }
            }, 3000); 
            
        }, 500);
    }

    handleAdWatch() {
        this.ui.showAdCountdown(5, () => {
            // Reward 1000 chips
            const reward = 1000;
            const profile = DataManager.load();
            DataManager.updateChips(profile.chips + reward);
            this.bankroll = profile.chips + reward; 
            
            this.ui.showMessage("观看广告奖励：1000 筹码到账！");
            
            // Re-open rebuy modal to let user select amount to bring in
            this.triggerNonBlockingRebuy();
        });
    }

    handleRebuy(amount) {
        const user = this.players[0];
        if (this.bankroll >= amount) {
            this.bankroll -= amount;
            user.chips += amount; // Added to stack
            
            // Mark as no longer sitting out (will play next hand)
            user.isSittingOut = false;
            user.isActive = true;
            
            // Save immediately
            DataManager.updateChips(this.bankroll + user.chips);
            
            this.ui.showMessage(`成功带入 ${amount} 筹码，下局生效`);
            this.ui.updatePlayers(this.players);
            
            // NOTE: We DO NOT call startNewHand() here. 
            // The game loop (setTimeout in endHand or mid-game) continues.
            // User just waits for next hand.
        } else {
            alert("资金不足！");
            this.triggerNonBlockingRebuy();
        }
    }

    triggerNonBlockingRebuy() {
        const profile = DataManager.load();
        this.bankroll = profile.chips; 

        // Non-blocking UI call
        this.ui.showRebuyModal(
            this.bankroll,
            (amount) => this.handleRebuy(amount),
            () => this.handleAdWatch(),
            () => {
                // If user cancels rebuy, they stay sitting out
                // We might want to add a button to reopen rebuy? 
                // Or just keep the overlay but maybe minimized?
                // For now, if cancel, just hide modal. 
                // User is SittingOut, so game proceeds. 
                // We need a way to open Rebuy again. -> "Plus Button"
            }
        );
    }

    updateButtons() {
         const player = this.players[0];
         const canCheck = player.currentBet === this.currentBet;
         document.getElementById('btn-check').disabled = !canCheck;
         document.getElementById('btn-call').disabled = canCheck; 
         document.getElementById('btn-fold').disabled = false;
         
         const callAmt = this.currentBet - player.currentBet;
         const canRaise = player.chips > callAmt;
         document.getElementById('btn-raise').disabled = !canRaise;
         
         const slider = document.getElementById('raise-slider');
         const maxRaise = this.getMaxRaiseAmount();
         slider.disabled = !canRaise;
         document.getElementById('btn-quick-allin').disabled = !canRaise && player.chips > 0; 
         
         if (canRaise) {
             slider.min = this.blinds.bb * 2; // Min raise adjusted to blinds
             slider.max = maxRaise;
             slider.value = slider.min;
             document.getElementById('raise-amount-display').innerText = slider.value;
         } else {
             slider.value = 0;
             document.getElementById('raise-amount-display').innerText = 0;
         }
         
         if (player.chips > 0 && player.chips <= callAmt) {
              document.getElementById('btn-quick-allin').disabled = false;
         }
    }
    
    enableControls() {
        this.updateButtons();
    }
    
    disableControls() {
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-call').disabled = true;
        document.getElementById('btn-fold').disabled = true;
        document.getElementById('btn-raise').disabled = true;
        document.getElementById('raise-slider').disabled = true;
        document.getElementById('btn-quick-allin').disabled = true;
        document.getElementById('raise-inputs').style.display = 'none';
        document.getElementById('main-actions').style.display = 'flex';
    }

    checkAchievements() {
        const profile = DataManager.load();
        const unlocked = AchievementManager.check(profile.stats, profile.chips);
        
        if (unlocked.length > 0) {
            unlocked.forEach(ach => {
                this.ui.showAchievementToast(ach);
            });
            const newProfile = DataManager.load();
            const user = this.players[0];
            
            // If achievement gives reward, update server AND local UI immediately
            if(networkManager) networkManager.updateBalance(newProfile.chips);
            
            // Update local bankroll variable (profit calculation)
            this.bankroll = newProfile.chips - user.chips; 

            // FORCE UI UPDATE: Update player's chip display immediately to show reward
            user.chips = newProfile.chips; // Sync object
            this.ui.updatePlayerInfo(user, 0); // Update visual (0 is player index)
            
            // Also update the "Total Assets" in menu if possible, but we are in game
            // The stat overlay will read from DataManager so it's fine.
        }
    }
}