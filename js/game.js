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
        
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-lobby-start').addEventListener('click', () => {
            const count = parseInt(document.getElementById('opponent-count').value);
            this.initGame(count);
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

    getMaxRaiseAmount() {
        const player = this.players[0];
        const callAmt = this.currentBet - player.currentBet;
        return Math.max(0, player.chips - callAmt);
    }

    initGame(opponentCount) {
        document.getElementById('lobby-overlay').style.display = 'none';
        
        this.players = [];
        this.players.push(new Player('玩家 (你)', 1000, false));
        for (let i = 1; i <= opponentCount; i++) {
            this.players.push(new Player(`电脑 ${i}`, 1000, true));
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
        for(let i=0; i<2; i++) {
            this.players.forEach(p => {
                if(p.isActive) p.receiveCard(this.deck.deal());
            });
        }

        this.ui.updateCommunityCards([]);
        this.ui.updatePot(this.pot);
        this.ui.updatePlayers(this.players);
        this.ui.showMessage("新的一局开始！");
        
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
                break;
            case 'check':
                message = "过牌";
                break;
            case 'call':
                const callAmt = this.currentBet - player.currentBet;
                player.chips -= callAmt;
                player.currentBet += callAmt;
                this.pot += callAmt;
                chipChange = callAmt;
                message = "跟注";
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
        setTimeout(() => this.nextTurn(), player.isComputer ? 600 : 400);
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

        if (player.isComputer) {
            this.disableControls();
            this.ui.showMessage(`${player.name} 思考中...`);
            setTimeout(() => this.computerAI(), 800);
        } else {
            this.ui.showMessage("轮到你了");
            this.enableControls();
        }
    }

    computerAI() {
        const cpu = this.players[this.activePlayerIndex];
        const diff = this.currentBet - cpu.currentBet;
        const rand = Math.random();
        
        let action = 'fold';

        if (diff === 0) {
            // Check or Raise
            if (rand > 0.9) action = 'raise';
            else action = 'check';
        } else {
            // Call or Fold
            // Simple logic: if bet is small relative to stack, call more often
            if (rand > 0.2) action = 'call';
            else action = 'fold';
        }

        // Validate chips
        if (action === 'raise') {
             const raiseAmt = 20;
             if (cpu.chips < (this.currentBet + raiseAmt - cpu.currentBet)) {
                 action = 'call'; // Not enough to raise
             }
        }
        if (action === 'call') {
            if (cpu.chips < diff) {
                // All-in logic (simplified as call all chips)
            }
        }

        this.handleAction(action);
    }

    dealCommunity(count) {
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
        
        setTimeout(() => this.nextTurn(), 1000);
    }

    endHand(winner) {
        if (winner) {
            winner.chips += this.pot;
            this.ui.showMessage(`${winner.name} 赢了 ${this.pot} 筹码!`);
            this.pot = 0;
            this.ui.updatePlayers(this.players);
            this.ui.updatePot(0);
        }
        setTimeout(() => this.startNewHand(), 3000);
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
        setTimeout(() => {
            winners.forEach((w, i) => {
                const pIdx = this.players.indexOf(w.player);
                // Stagger animations if multiple winners
                setTimeout(() => {
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
            
            setTimeout(() => {
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
}
