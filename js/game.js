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
        document.getElementById('btn-lobby-start').addEventListener('click', () => {
            const count = parseInt(document.getElementById('opponent-count').value);
            const buyIn = parseInt(document.getElementById('buyin-amount').value);
            this.initGame(count, buyIn);
        });

        // Main Menu & Navigation Handlers
        document.getElementById('btn-menu-single').addEventListener('click', () => {
            // Update Lobby UI with current persistent chips
            const profile = DataManager.load();
            let totalChips = profile.chips;
            
            // Bankruptcy Check
            if (totalChips <= 0) {
                 totalChips = 1000;
                 DataManager.updateChips(1000);
                 alert("破产补助：已为您补充 1000 筹码");
            }
            
            document.getElementById('lobby-total-chips').innerText = totalChips;
            
            // Setup Buy-in Slider
            const slider = document.getElementById('buyin-amount');
            const display = document.getElementById('buyin-display');
            
            // Logic: Min 100, Max Total. Default 50% or 1000.
            const minBuyIn = 100;
            const maxBuyIn = totalChips;
            
            slider.min = minBuyIn;
            slider.max = maxBuyIn;
            slider.value = Math.min(1000, maxBuyIn); // Default to 1000 or max
            display.innerText = slider.value;
            
            slider.oninput = function() { display.innerText = this.value; }
            
            document.getElementById('main-menu').style.display = 'none';
            document.getElementById('lobby-overlay').style.display = 'flex';
        });

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
             
             // History List
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
                window.close(); // Only works if opened via script, but good for intent
                // Fallback for standalone/web
                document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff;"><h1>已退出游戏</h1></div>';
            }
        });

        document.getElementById('btn-lobby-back').addEventListener('click', () => {
            document.getElementById('lobby-overlay').style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        });

        document.getElementById('btn-back-menu').addEventListener('click', () => {
            if(confirm('确定要返回主菜单吗？当前牌局将直接结束，您的筹码（包含场外余额）将自动保存。')) {
                this.stopGame(); 
                document.querySelector('.game-container').style.display = 'none';
                document.getElementById('main-menu').style.display = 'flex';
                this.updateMenuChips(); // Refresh chips display in menu
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
             // Show raise inputs, hide main actions
             document.getElementById('main-actions').style.display = 'none';
             document.getElementById('raise-inputs').style.display = 'flex';
             // Update slider range again just in case
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
        
        // Plus/Minus buttons
        document.querySelector('.btn-adjust.minus').addEventListener('click', () => {
             slider.stepDown();
             slider.dispatchEvent(new Event('input'));
        });
        document.querySelector('.btn-adjust.plus').addEventListener('click', () => {
             slider.stepUp();
             slider.dispatchEvent(new Event('input'));
        });
        
        document.getElementById('btn-quick-allin').addEventListener('click', () => {
             // All in means raise to max chips
             const maxRaise = this.getMaxRaiseAmount();
             this.handleAction('raise', maxRaise);
        });

        document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    }

    stopGame() {
        // Save Chips Logic
        if (this.players && this.players.length > 0) {
            const user = this.players[0];
            const currentTotal = this.bankroll + user.chips;
            DataManager.updateChips(currentTotal);
        }
    
        // Reset game state to initial values
        this.clearAllTimers(); // Stop AI and loops
        this.players = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'pre-flop';
        this.playersToAct = [];
        this.activePlayerIndex = -1; // Invalid index to prevent AI running
        
        this.ui.updateCommunityCards([]);
        this.ui.updatePot(0);
        document.getElementById('opponents-container').innerHTML = ''; // Clear opponents
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

    initGame(opponentCount, buyInAmount) {
        document.getElementById('lobby-overlay').style.display = 'none';
        document.querySelector('.game-container').style.display = 'flex'; // Show Game
        
        // Initialize Audio Context explicitly on Start button click
        if (typeof soundManager !== 'undefined') {
            soundManager.init();
        }

        // Setup Bankroll Logic
        // buyInAmount is what we take to the table.
        // this.bankroll is what remains in "safe".
        const profile = DataManager.load();
        const total = profile.chips;
        this.bankroll = total - buyInAmount;
        // Safety check
        if (this.bankroll < 0) this.bankroll = 0;
        
        // Immediately save the "deduction" (optional, but safer to treat chips as table chips + bankroll)
        // For simplicity, we only update persistence on endHand or exit.
        // BUT if user closes tab during game, they lose table chips if we don't save "in-game" state.
        // For now, assume graceful exit.

        this.players = [];
        this.players.push(new Player('玩家 (你)', buyInAmount, false));
        for (let i = 1; i <= opponentCount; i++) {
            const personality = {
                aggression: Math.random(),      // 0-1
                tightness: Math.random(),       // 0-1
                bluffFrequency: Math.random()   // 0-1
            };
            this.players.push(new Player(`电脑 ${i}`, buyInAmount, true, personality)); // Opponents match buy-in
        }

        this.ui.setupOpponents(this.players.slice(1)); 
        this.startNewHand();
    }

    startNewHand() {
        this.players.forEach(p => {
            if (p.chips <= 0) p.isActive = false;
        });

        const activePlayers = this.players.filter(p => p.isActive);
        if (activePlayers.length < 2) {
            this.ui.showMessage(activePlayers[0] === this.players[0] ? "恭喜！你赢得了所有筹码！" : "游戏结束，你输光了。");
            document.getElementById('btn-restart').style.display = 'inline-block';
            this.disableControls();
            return;
        }

        this.deck.reset();
        this.deck.shuffle();
        this.players.forEach(p => p.resetHand());
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'pre-flop';
        
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        
        // Post Blinds
        this.postBlinds();

        // Deal Cards
        soundManager.playCard();
        for(let i=0; i<2; i++) {
            this.players.forEach(p => {
                if(p.isActive) p.receiveCard(this.deck.deal());
            });
        }

        this.ui.updateCommunityCards([]);
        this.ui.updatePot(this.pot);
        this.ui.updatePlayers(this.players);
        this.ui.showMessage("新的一局开始！");
        
        // Track user start chips for profit calculation
        this.userStartChips = this.players[0].chips;
        
        // Populate playersToAct queue
        // Pre-flop starts at UTG (Dealer + 3)
        // Order: UTG -> ... -> Dealer -> SB -> BB
        this.populateQueue((this.dealerIndex + 3) % this.players.length);

        this.nextTurn();
    }

    postBlinds() {
        const sbIndex = (this.dealerIndex + 1) % this.players.length;
        const bbIndex = (this.dealerIndex + 2) % this.players.length;
        
        const sb = 5;
        const bb = 10;

        if(this.players[sbIndex].isActive) {
            this.players[sbIndex].chips -= sb;
            this.players[sbIndex].currentBet = sb;
            this.pot += sb;
        }

        if(this.players[bbIndex].isActive) {
            this.players[bbIndex].chips -= bb;
            this.players[bbIndex].currentBet = bb;
            this.pot += bb;
        }

        this.currentBet = bb;
    }

    populateQueue(startIndex) {
        this.playersToAct = [];
        const count = this.players.length;
        // Add all active players starting from startIndex
        for (let i = 0; i < count; i++) {
            const idx = (startIndex + i) % count;
            const p = this.players[idx];
            if (p.isActive && !p.folded && p.chips > 0) {
                this.playersToAct.push(idx);
            }
        }
    }

    // New centralized action handler
    handleAction(action, amount = 0) {
        const playerIndex = this.activePlayerIndex;
        const player = this.players[playerIndex];
        
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
                // amount is the "raise over" part. 
                // e.g. currentBet=20, raiseAmt=20 -> totalBet=40.
                let raiseAmt = amount;
                if (raiseAmt <= 0) raiseAmt = 20; // Default min raise if 0 passed
                
                const total = this.currentBet + raiseAmt;
                const added = total - player.currentBet;
                
                // Validate if player has enough chips
                if (player.chips < added) {
                     // Should be All-in
                     // Adjust raiseAmt so that total added equals chips
                     // added = player.chips
                }

                player.chips -= added;
                player.currentBet += added;
                this.pot += added;
                this.currentBet = total;
                chipChange = added;
                message = `加注 ${raiseAmt}`;
                soundManager.playChip();
                
                // CRITICAL: Raise resets the queue!
                // Everyone else (active, not folded) must act again to match the bet.
                // Starting from the NEXT player.
                const nextIdx = (playerIndex + 1) % this.players.length;
                this.populateQueue(nextIdx);
                // The current player (raiser) is already processed, so we don't need to pop them from the NEW queue 
                // because populateQueue adds everyone. 
                // Let's filter out the current raiser from the new queue.
                this.playersToAct = this.playersToAct.filter(idx => idx !== playerIndex);
                break;
        }

        this.ui.showMessage(`${player.name} ${message}`);
        this.ui.updatePlayers(this.players); // Updates chips text immediately, animation follows
        
        // --- Chip Animation ---
        if (chipChange > 0) {
            // Find player element
            let playerEl;
            if (playerIndex === 0) playerEl = document.getElementById('player-area').querySelector('.player-info');
            else {
                const opp = document.getElementById(`opponent-${playerIndex-1}`);
                if (opp) playerEl = opp.querySelector('.player-info');
            }
            const potEl = document.querySelector('.pot-display');
            
            // Animate
            this.ui.animateChips(playerEl, potEl, chipChange, () => {
                 this.ui.updatePot(this.pot); // Update pot text after animation lands
            });
        } else {
            this.ui.updatePot(this.pot);
        }

        // Delay for next turn
        this.setTimeout(() => this.nextTurn(), player.isComputer ? 600 : 400);
    }

    nextTurn() {
        // 1. Check if only one player remains (Win by fold)
        const survivors = this.players.filter(p => p.isActive && !p.folded);
        if (survivors.length === 1) {
            this.endHand(survivors[0]);
            return;
        }

        // 2. Check if queue is empty -> Next Phase
        if (this.playersToAct.length === 0) {
            this.nextPhase();
            return;
        }

        // 3. Get next player from queue
        this.activePlayerIndex = this.playersToAct.shift();
        const player = this.players[this.activePlayerIndex];

        // Validate player state (just in case)
        if (!player.isActive || player.folded) {
            this.nextTurn(); // Skip
            return;
        }

        this.processTurn();
    }

    processTurn() {
        // Removed: this.ui.highlightActivePlayer(this.activePlayerIndex); (Deprecated)
        const player = this.players[this.activePlayerIndex];
        
        // BUG FIX: Existence check
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
        // BUG FIX: Existence check
        if (!this.players || this.activePlayerIndex >= this.players.length || this.activePlayerIndex < 0) return;
        
        const cpu = this.players[this.activePlayerIndex];
        
        // Extra safety check
        if (!cpu) return;
        
        const diff = this.currentBet - cpu.currentBet;
        const activePlayersCount = this.players.filter(p => p.isActive && !p.folded).length;

        // 1. Calculate Win Rate
        // OddsCalculator.calculate(hand, community, opponentCount)
        let winRate = 0;
        try {
            // Using activePlayersCount - 1 as opponent count
            winRate = OddsCalculator.calculate(cpu.hand, this.communityCards, activePlayersCount - 1);
        } catch (e) {
            console.error("Odds calculation error:", e);
            winRate = 1 / activePlayersCount;
        }

        let action = 'fold';
        console.log(`[AI ${cpu.name}] Phase: ${this.phase}, WR: ${winRate.toFixed(2)}, Agg: ${cpu.aggression.toFixed(2)}, Tight: ${cpu.tightness.toFixed(2)}, Bluff: ${cpu.bluffFrequency.toFixed(2)}`);

        // 2. Decision Process
        if (this.phase === 'pre-flop') {
            // Pre-flop: Tightness driven
            // Base threshold is roughly 1/N. Tightness increases this threshold.
            // Example: 5 players (0.2). Tightness 0.5 -> Threshold 0.2. Tightness 1.0 -> Threshold 0.3.
            const baseThreshold = (1 / activePlayersCount);
            // Dynamic threshold: Tightness pushes the requirement up.
            // Formula: Base + (Tightness * 0.15) - 0.05
            // If Tightness=0 (Loose), req = Base - 0.05.
            // If Tightness=1 (Tight), req = Base + 0.10.
            const threshold = baseThreshold + (cpu.tightness * 0.15) - 0.05;

            if (winRate >= threshold) {
                // Play
                if (diff === 0) action = 'check';
                else action = 'call';

                // Strong hand + Aggression -> Raise
                if (winRate > threshold + 0.15 && Math.random() < cpu.aggression) {
                    action = 'raise';
                }
            } else {
                // Weak hand
                if (diff === 0) action = 'check';
                else action = 'fold';
                
                // Occasional pre-flop bluff? (Maybe too advanced, keeping it simple as per spec)
            }

        } else {
            // Post-flop: Win Rate & Personality driven
            const averageWinRate = 1 / activePlayersCount;
            
            // "High" Win Rate definition
            if (winRate > averageWinRate * 1.1) { 
                // High Win Rate: Value Bet or Slow Play
                if (Math.random() < cpu.aggression) {
                    action = 'raise'; // Value Bet
                } else {
                    if (diff === 0) action = 'check';
                    else action = 'call'; // Slow Play
                }
            } else {
                // Low/Medium Win Rate
                // Check Bluff Frequency
                if (Math.random() < cpu.bluffFrequency) {
                    // Bluff!
                    action = 'raise'; 
                } else {
                    // Normal play: Check or Fold
                    if (diff === 0) action = 'check';
                    else {
                        // If Win Rate is decent (not total trash), maybe call small bet?
                        // For now, sticking to "Low Win Rate -> Check/Fold" unless bluffing.
                        action = 'fold';
                    }
                }
            }
        }

        // 3. Validation
        // If raising but not enough chips, downgrade to call (which handles all-in)
        if (action === 'raise') {
             const callAmt = diff;
             // If we can't cover the call + min raise, just call (All-in)
             if (cpu.chips <= callAmt) {
                 action = 'call';
             }
        }
        
        // If checking but facing a bet, must fold (or call if logic failed)
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

        // Populate queue for new street
        // Order: SB -> BB -> ... -> Button (Dealer)
        // Start from Dealer + 1
        this.populateQueue((this.dealerIndex + 1) % this.players.length);
        
        this.setTimeout(() => this.nextTurn(), 1000);
    }

    endHand(winner) {
        if (winner) {
            winner.chips += this.pot;
            this.ui.showMessage(`${winner.name} 赢了 ${this.pot} 筹码!`);
            
            // If user won, update stats immediately? Or wait for end of session?
            // Better to update persistence at end of every hand to prevent data loss.
        }
        
        // Save user state
        const user = this.players[0];
        // Update persistent chips: Bankroll + Current Table Chips
        DataManager.updateChips(this.bankroll + user.chips);
        
        // We need to record hand history. But "endHand" is for early fold win.
        // If early fold win, user hand is not fully played out, but profit is real.
        // Let's record simple result.
        // We need to track how many chips user had at start of hand to calculate profit.
        // Or we can just calculate profit = (current - previous_saved).
        // To simplify, we might want to refactor where we record history.
        // For now, let's just save chips.
        
        this.pot = 0;
        this.ui.updatePlayers(this.players);
        this.ui.updatePot(0);
        
        this.setTimeout(() => this.startNewHand(), 3000);
    }
    
    restartGame() {
        location.reload(); 
    }

    determineWinner() {
        this.ui.updatePlayers(this.players, true); 
        
        const activeSurvivors = this.players.filter(p => p.isActive && !p.folded);
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
        
        // Wait for potential river card animation
        this.setTimeout(() => {
            winners.forEach((w, i) => {
                const pIdx = this.players.indexOf(w.player);
                // Stagger animations if multiple winners
                this.setTimeout(() => {
                    this.ui.animatePotToWinner(pIdx, () => {
                         // After animation, update chips text
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
            
            // Calculate Profit: Current Chips - Start Chips (Need to track start chips)
            // Simplified: We assume we just compare to stored value before this update?
            // Better: DataManager.updateChips overwrites.
            // Let's rely on DataManager to handle "session" profit if we want, but for "hand history":
            // We need to know if user won or lost this specific hand.
            // Start Chips: this.userStartChips (need to add this property to Game class)
            const profit = user.chips - this.userStartChips + (userWon ? winAmount : 0); 
            // Note: user.chips hasn't been updated with winAmount in the object reference YET inside this callback loop context fully? 
            // Wait, w.player.chips += winAmount happens inside the animation callback.
            // So we should do saving AFTER animation.
            
            this.setTimeout(() => {
                // Now chips are updated
                const actualProfit = user.chips - this.userStartChips;
                // Update persistent chips: Bankroll + Current Table Chips
                DataManager.updateChips(this.bankroll + user.chips);
                
                DataManager.recordHand({
                    profit: actualProfit,
                    hand: userScore ? userScore.score : null,
                    pot: this.pot,
                    cards: user.hand.map(c => c.toString()) // Simple string representation
                });
                
                this.pot = 0;
                this.ui.updatePot(0);
                this.startNewHand();
            }, 3000); // Reduce from 4000 to 3000 for speed
            
        }, 500); // Small delay after showdown cards revealed
    }

    updateButtons() {
         const player = this.players[0];
         const canCheck = player.currentBet === this.currentBet;
         document.getElementById('btn-check').disabled = !canCheck;
         document.getElementById('btn-call').disabled = canCheck; 
         document.getElementById('btn-fold').disabled = false;
         
         // Raise logic
         const callAmt = this.currentBet - player.currentBet;
         const canRaise = player.chips > callAmt;
         document.getElementById('btn-raise').disabled = !canRaise;
         
         // Update slider range
         const slider = document.getElementById('raise-slider');
         const maxRaise = this.getMaxRaiseAmount();
         slider.disabled = !canRaise;
         document.getElementById('btn-quick-allin').disabled = !canRaise && player.chips > 0; 
         
         if (canRaise) {
             slider.min = 20; // Min raise. Technically should be Big Blind or previous raise.
             slider.max = maxRaise;
             slider.value = 20;
             document.getElementById('raise-amount-display').innerText = 20;
         } else {
             slider.value = 0;
             document.getElementById('raise-amount-display').innerText = 0;
         }
         
         // Special case: if short stack, can't raise normally, but can All-in.
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
        // Check using current stats and TOTAL chips (bankroll + table chips)
        // Note: DataManager.updateChips was just called, so profile.chips is accurate total.
        const unlocked = AchievementManager.check(profile.stats, profile.chips);
        
        if (unlocked.length > 0) {
            unlocked.forEach(ach => {
                this.ui.showAchievementToast(ach);
            });
            
            // Sync local bankroll because AchievementManager added rewards to persistent storage
            const newProfile = DataManager.load();
            const user = this.players[0];
            // New Total = Old Total + Rewards
            // We want to keep user.chips (table stack) same, but increase bankroll.
            this.bankroll = newProfile.chips - user.chips;
        }
    }
}
