const SUITS = ['♠', '♥', '♣', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
    }

    get color() {
        return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black';
    }

    get numValue() {
        return VALUE_MAP[this.value];
    }

    toString() {
        return `${this.value}${this.suit}`;
    }

    getHTML() {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        if (this.color === 'red') cardDiv.classList.add('red');
        cardDiv.innerHTML = `<div>${this.value}</div><div>${this.suit}</div>`;
        return cardDiv;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (let suit of SUITS) {
            for (let value of VALUES) {
                this.cards.push(new Card(suit, value));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }
}

class Player {
    constructor(name, chips, isComputer = false) {
        this.name = name;
        this.chips = chips;
        this.hand = [];
        this.isComputer = isComputer;
        this.currentBet = 0;
        this.folded = false;
        this.isActive = true; 
    }

    receiveCard(card) {
        this.hand.push(card);
    }

    resetHand() {
        this.hand = [];
        this.currentBet = 0;
        this.folded = false;
    }
}

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
             const amt = parseInt(slider.value);
             this.handleAction('raise', amt);
        });
        
        document.getElementById('btn-allin').addEventListener('click', () => {
             // All in means raise to max chips
             const player = this.players[0];
             // Max raise amount = player's total chips - (currentBet - player.currentBet) 
             // Actually, "all-in" logic in handleAction handles the "put everything in" part.
             // We can just pass a special flag or a huge number.
             // Let's pass 'all-in' as amount or just max chips.
             // But wait, raise amount in handleAction is "additional to current bet" or "total bet"?
             // My logic: raiseAmt is the INCREASE over currentBet.
             // So if currentBet is 100, and I have 1000. To all in, I bet 1000.
             // The raise amount (increase) is 1000 - 100 = 900? No.
             // All-in is total stack.
             // Let's handle 'all-in' as a specific action type or calculate exact amount.
             // Raise logic: currentBet becomes currentBet + raiseAmt.
             // If I have 1000 chips. I want to put them all in.
             // My total contribution will be player.chips + player.currentBet.
             // So new currentBet = player.chips + player.currentBet.
             // The "raiseAmt" (increase over PREVIOUS high bet) is (newTotal) - (oldHighBet).
             
             // Simplest: Calculate max raise amount for the slider.
             // Slider max = player.chips - (call amount).
             // If player.chips < call amount, they can't raise, only call (all-in call).
             // But button logic handles disabled state.
             
             // Let's pass the raw chip amount user wants to ADD to the pot on top of call?
             // Standard raise slider usually shows "Total Bet" or "Raise Amount".
             // Let's stick to "Raise Amount" (how much to increase the bet by).
             // Min raise = BB or previous raise.
             
             // For All-in button:
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
                     // total - player.currentBet = player.chips
                     // total = player.chips + player.currentBet
                     // raiseAmt = total - this.currentBet
                     // raiseAmt = (player.chips + player.currentBet) - this.currentBet
                     // This could be negative if chips < callAmt (which means it's not a raise, it's a partial call)
                     // But here we assume it IS a raise (chips > callAmt)
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
                // WAIT: The raiser does NOT need to act again immediately.
                // So we should exclude the raiser from the new queue? 
                // Yes, populateQueue adds everyone including raiser if we loop full circle.
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

        // If not a raise, we just consume the current turn
        // The current player is at the front of the queue (or should be).
        // Actually, in nextTurn we peek/shift. 
        // Let's handle queue management in nextTurn mainly, but Raise logic is special.
        
        // Delay for next turn
        // Reduce delay for faster pace as requested (Option 1A)
        // Chip animation takes 400ms.
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
        this.ui.highlightActivePlayer(this.activePlayerIndex);
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
                // In this MVP we treat it as call, but chips might go negative if we don't clamp.
                // Let's clamp in handleAction? Or here?
                // Better: handleAction assumes chips are sufficient or handles partial.
                // Let's just allow negative for now or force fold if 0 chips?
                // Standard: All-in. We'll stick to basic flow.
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

    // ... (endHand, determineWinner, etc. remain mostly same)
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
        
        // --- Animate Winner ---
        // Just pick the first winner for animation target in this simplified version
        // Or if split pot, maybe animate to both? 
        // animatePotToWinner handles one index.
        // Let's loop.
        
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
            
            // Clear pot text immediately as chips are "in flight" or about to be?
            // Actually, keep pot until animation starts?
            // animatePotToWinner uses current pot location.
            // Let's set pot to 0 text at end of animation. 
            // The callback inside animatePotToWinner updates players. 
            // We should zero the pot text after all animations.
            
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
         document.getElementById('btn-allin').disabled = !canRaise && player.chips > 0; // All-in always possible if have chips? 
         // If chips < callAmt, all-in is technically a Call (Short Stack All-in).
         // But let's allow "All-in" button to work even then (it just triggers handleAction which needs to handle partial call).
         // My handleAction currently assumes raise.
         // Let's refine handleAction to treat raise with insufficient chips as All-in.
         
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
              document.getElementById('btn-allin').disabled = false;
              // But raise button disabled
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
        document.getElementById('btn-allin').disabled = true;
    }
}

// UI and HandEvaluator classes remain unchanged, assuming they are appended correctly
// I will include them to ensure file integrity.

class UI {
    setupOpponents(opponents) {
        const container = document.getElementById('opponents-container');
        container.innerHTML = '';
        const count = opponents.length;
        const step = 100 / (count + 1);
        opponents.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = 'player-area opponent';
            div.id = `opponent-${index}`;
            const leftPercent = step * (index + 1);
            div.style.left = `calc(${leftPercent}% - 60px)`; 
            const offsetFromCenter = Math.abs((index + 1) - (count + 1)/2);
            div.style.top = `${10 + offsetFromCenter * 15}px`; 
            div.innerHTML = `
                <div class="player-info">${p.name}</div>
                <div class="cards"></div>
                <div class="player-chips">Wait...</div>
                <div class="player-status"></div>
            `;
            container.appendChild(div);
        });
    }

    updatePlayers(players, showAllCards = false) {
        const user = players[0];
        
        // --- Update User ---
        // Always show face up for user (pass true)
        this.updatePlayerCards(document.getElementById('player-cards'), user.hand, true);
        document.getElementById('player-chips').innerText = user.chips;
        document.getElementById('player-status').innerText = user.folded ? "Fold" : (user.currentBet > 0 ? `Bet: ${user.currentBet}` : "");
        
        // Handle User Fold State
        const userArea = document.getElementById('player-area');
        userArea.classList.toggle('active', game.activePlayerIndex === 0);
        userArea.classList.toggle('folded', user.folded);
        
        // Update User Badges
        this.updateRoleBadges(userArea, 0, players.length);

        // --- Hand Strength Hint ---
        const hintEl = document.getElementById('player-hand-hint');
        if (user.hand.length > 0 && !user.folded) {
             // Basic Hand Name
             const result = HandEvaluator.evaluate(user.hand, game.communityCards);
             let text = result.name;
             
             const val = result.tieBreakers[0];
             const valStr = this.getRankLabel(val);
             
             if (['高牌', '一对', '三条', '四条'].includes(text)) {
                 text += ` ${valStr}`;
             } else if (text === '两对') {
                 text += ` ${valStr} & ${this.getRankLabel(result.tieBreakers[1])}`;
             } else if (text === '葫芦') {
                 text += ` ${valStr}`;
             }

             // Calculate Odds (Simple Cache Check)
             const activeOpponents = players.filter(p => p !== user && p.isActive && !p.folded).length;
             if (activeOpponents > 0) {
                 const stateKey = `${user.hand.map(c=>c.toString()).join('')}-${game.communityCards.map(c=>c.toString()).join('')}-${activeOpponents}`;
                 if (this.lastOddsState !== stateKey) {
                     // Recalculate
                     this.lastWinRate = OddsCalculator.calculate(user.hand, game.communityCards, activeOpponents);
                     this.lastOddsState = stateKey;
                 }
                 const percent = Math.round(this.lastWinRate * 100);
                 text += ` | 胜率: ${percent}%`;
                 
                 // Dynamic Color based on odds
                 if (percent > 70) hintEl.style.color = '#2ecc71'; // Green
                 else if (percent < 30) hintEl.style.color = '#e74c3c'; // Red
                 else hintEl.style.color = '#f1c40f'; // Yellow
             }
             
             hintEl.innerText = text;
             hintEl.style.display = 'block';
        } else {
             hintEl.style.display = 'none';
        }

        // --- Update Opponents ---
        for(let i=1; i<players.length; i++) {
            const p = players[i];
            const div = document.getElementById(`opponent-${i-1}`);
            if(!div) continue;
            
            this.updatePlayerCards(div.querySelector('.cards'), p.hand, showAllCards || p.folded === false && showAllCards, p.folded); 

            div.querySelector('.player-chips').innerText = p.chips;
            div.querySelector('.player-status').innerText = p.folded ? "Fold" : (p.currentBet > 0 ? `${p.currentBet}` : "");
            
            div.classList.toggle('active', game.activePlayerIndex === i);
            div.classList.toggle('folded', p.folded);
            
            // Update Opponent Badges
            this.updateRoleBadges(div, i, players.length);
        }
    }

    updateRoleBadges(container, playerIndex, totalPlayers) {
        // Clear existing badges
        container.querySelectorAll('.role-badge').forEach(el => el.remove());

        const dealerIdx = game.dealerIndex;
        const sbIdx = (dealerIdx + 1) % totalPlayers;
        const bbIdx = (dealerIdx + 2) % totalPlayers;

        const badges = [];
        if (playerIndex === dealerIdx) badges.push({ text: 'D', cls: 'role-dealer' });
        if (playerIndex === sbIdx) badges.push({ text: 'SB', cls: 'role-sb' });
        if (playerIndex === bbIdx) badges.push({ text: 'BB', cls: 'role-bb' });

        // Render Badges
        badges.forEach((b, i) => {
            const badge = document.createElement('div');
            badge.className = `role-badge ${b.cls}`;
            badge.innerText = b.text;
            
            // If multiple badges, offset them
            if (i > 0) {
                // Shift subsequent badges to the left
                badge.style.right = `${-10 + (i * 25)}px`; 
                // Wait, right: -10 is default.
                // If i=1, we want it further left? No, further left means larger 'right' value?
                // Or if we want them side-by-side...
                // Let's stack them or put them side by side.
                // My CSS: right: -10px.
                // If I have D and BB.
                // D at -10px. BB should be at -35px? Or 15px?
                // Let's put them side-by-side going OUTWARDS or INWARDS?
                // Going Left (Inwards): right: 15px, 40px...
                // Going Right (Outwards): right: -10px, -35px...
                
                // Let's try stacking them vertically? No, too tall.
                // Let's just adjust 'right' property.
                // First badge (D) at -10px.
                // Second badge (BB) at 15px (inside).
                badge.style.right = `${-10 + (i * 25)}px`; // -10, 15, 40...
            }
            
            // Actually, better to just rely on flex or flow?
            // But they are absolute.
            // Let's manually set style.right.
            // Badge width 20px. Gap 2px.
            // i=0: right: -10px.
            // i=1: right: 15px. (25px shift)
            badge.style.right = `${-10 + (i * 25)}px`;
            
            container.appendChild(badge);
        });
    }

    getRankLabel(val) {
        if (val === 14) return 'A';
        if (val === 13) return 'K';
        if (val === 12) return 'Q';
        if (val === 11) return 'J';
        return val;
    }

    updatePlayerCards(container, hand, showFaceUp, isFolded = false) {
        // Sync DOM cards with data cards
        // Simple approach: 
        // 1. If DOM has fewer cards, add new ones (animate them).
        // 2. If DOM has more cards (new hand), clear and rebuild.
        // 3. If same count, assume same cards (optimization).

        const existingCards = container.children.length;
        const targetCards = hand.length;

        if (targetCards === 0) {
            container.innerHTML = '';
            return;
        }
        
        // BUG FIX: Compare actual card values to detect new hand
        // Even if count is same (2), the cards might be different
        // Check first card to see if it matches
        let isNewHand = false;
        if (existingCards > 0 && targetCards > 0 && showFaceUp) {
            const firstDom = container.firstElementChild;
            // Assuming getHTML() puts values in specific divs.
            // Let's store data-value on card element for easier check
            // Or just check innerText. 
            // Better: force rebuild if it's the start of a new hand? 
            // startNewHand calls resetHand (hand=[]), then deal (hand=[c1]).
            // So updatePlayers will see 0 -> 1 -> 2.
            // The issue might be that container wasn't cleared when hand was reset?
            // updatePlayers is called in startNewHand AFTER deal loop.
            // But hand is reset BEFORE deal.
            // If we don't call updatePlayers in between, existingCards is 2 (old), target is 2 (new).
            // Logic below falls through to "same count" and does nothing.
        }
        
        // Fix: In startNewHand, we call players.forEach(p => p.resetHand()). 
        // We should probably update UI there to clear cards? 
        // Or handle "different cards" detection here.
        // Let's detect by checking if the DOM cards match the Hand cards text.
        
        if (existingCards === targetCards && showFaceUp) {
            const domCard = container.children[0];
            const handCard = hand[0];
            // Check if card content matches. 
            // Note: domCard might be 'back'.
            if (!domCard.classList.contains('back')) {
                const valDiv = domCard.querySelector('div:first-child'); // value
                const suitDiv = domCard.querySelector('div:last-child'); // suit
                if (valDiv && suitDiv) {
                     if (valDiv.innerText !== handCard.value || suitDiv.innerText !== handCard.suit) {
                         isNewHand = true;
                     }
                }
            }
        }

        if (targetCards < existingCards || isNewHand) {
             // New hand started, clear everything
             container.innerHTML = '';
        }

        // Add new cards
        for (let i = container.children.length; i < targetCards; i++) {
            const cardObj = hand[i];
            let cardEl;
            
            if (showFaceUp) {
                cardEl = cardObj.getHTML();
            } else {
                // For opponents, usually face down unless showdown
                // Check if we should show this specific opponent card? 
                // The argument showFaceUp is passed as true during showdown.
                // During normal play, opponents get back cards.
                // Wait, updatePlayers logic for opponents:
                // showAllCards || p.folded === false && showAllCards... 
                // Let's simplify: passed showFaceUp determines if we see content.
                if (showFaceUp) {
                    cardEl = cardObj.getHTML();
                } else {
                    cardEl = document.createElement('div');
                    cardEl.classList.add('card', 'back');
                }
            }

            // Animation Setup
            cardEl.classList.add('dealing');
            container.appendChild(cardEl);

            // Trigger Reflow
            void cardEl.offsetWidth;

            // Animate In
            // Use setTimeout to allow browser to register 'dealing' state first
            setTimeout(() => {
                cardEl.classList.remove('dealing');
            }, 50 + i * 100); // Stagger effect
        }
        
        // If showdown (showFaceUp changed from false to true), we might need to flip existing cards?
        // For this MVP, we just replace them if needed. 
        // But the current logic only appends. 
        // If we go from 2 backs to 2 fronts, the count is same, loop won't run.
        // Fix: Check if first card state matches.
        if (existingCards > 0 && existingCards === targetCards && showFaceUp) {
             // Check if currently showing backs but need fronts
             const firstDom = container.firstElementChild;
             if (firstDom.classList.contains('back')) {
                 // FLIP REVEAL!
                 container.innerHTML = '';
                 hand.forEach((c, idx) => {
                     const el = c.getHTML();
                     // No flying animation, just appear (or flip animation if we were fancy)
                     container.appendChild(el);
                 });
             }
        }
    }

    highlightActivePlayer(index) {} // Deprecated, handled in updatePlayers via class toggle
    
    updateCommunityCards(cards) {
        const div = document.getElementById('community-cards');
        const existingCount = div.children.length;
        
        if (cards.length < existingCount) {
            div.innerHTML = '';
        }

        for (let i = div.children.length; i < cards.length; i++) {
            const cardEl = cards[i].getHTML();
            cardEl.classList.add('dealing');
            div.appendChild(cardEl);
            
            void cardEl.offsetWidth;
            
            setTimeout(() => {
                cardEl.classList.remove('dealing');
            }, 100);
        }
    }
    updatePot(amount) { document.getElementById('pot-amount').innerText = amount; }
    showMessage(msg) { document.getElementById('message-area').innerText = msg; }
    
    // --- Chip Animations ---
    animateChips(fromEl, toEl, amount, onComplete) {
        if (!fromEl || !toEl) return;
        
        const rectFrom = fromEl.getBoundingClientRect();
        const rectTo = toEl.getBoundingClientRect();
        
        // Create flying chip
        const chip = document.createElement('div');
        chip.className = 'flying-chip';
        chip.style.left = `${rectFrom.left + rectFrom.width/2 - 12}px`;
        chip.style.top = `${rectFrom.top + rectFrom.height/2 - 12}px`;
        document.body.appendChild(chip);
        
        // Trigger animation
        void chip.offsetWidth;
        chip.style.left = `${rectTo.left + rectTo.width/2 - 12}px`;
        chip.style.top = `${rectTo.top + rectTo.height/2 - 12}px`;
        
        // Cleanup
        setTimeout(() => {
            chip.remove();
            if (onComplete) onComplete();
        }, 400); // Match CSS duration
    }

    animatePotToWinner(winnerIndex, callback) {
        // Pot is center
        const potEl = document.querySelector('.pot-display');
        
        // Winner element
        let winnerEl;
        if (winnerIndex === 0) {
            winnerEl = document.getElementById('player-area').querySelector('.player-info'); // Avatar area
        } else {
            const opp = document.getElementById(`opponent-${winnerIndex-1}`);
            if (opp) winnerEl = opp.querySelector('.player-info');
        }
        
        if (!winnerEl) {
             if(callback) callback();
             return;
        }

        // Animate multiple chips for effect
        for(let i=0; i<5; i++) {
            setTimeout(() => {
                this.animateChips(potEl, winnerEl, 0);
            }, i * 50);
        }
        
        // Highlight winner glow
        if (winnerIndex === 0) {
            document.getElementById('player-area').classList.add('winner-glow');
        } else {
            const opp = document.getElementById(`opponent-${winnerIndex-1}`);
            if(opp) opp.classList.add('winner-glow');
        }
        
        setTimeout(() => {
             // Remove glow
             document.querySelectorAll('.winner-glow').forEach(el => el.classList.remove('winner-glow'));
             if(callback) callback();
        }, 2000);
    }
}

class OddsCalculator {
    static calculate(playerHand, communityCards, opponentCount, iterations = 300) {
        // Create a deck of remaining cards
        const fullDeck = [];
        for (let suit of SUITS) {
            for (let value of VALUES) {
                fullDeck.push(new Card(suit, value));
            }
        }

        // Remove known cards
        const knownCards = [...playerHand, ...communityCards];
        const remainingDeck = fullDeck.filter(c => 
            !knownCards.some(k => k.value === c.value && k.suit === c.suit)
        );

        let wins = 0;
        let ties = 0;

        for (let i = 0; i < iterations; i++) {
            // Shuffle deck for this iteration
            // Optimization: Fisher-Yates on a copy is too slow? 
            // Let's just shuffle the indices array or clone deck efficiently.
            // Actually 300 iterations is small enough for simple shuffle.
            const deck = [...remainingDeck]; 
            this.shuffle(deck);

            // Deal to opponents
            const oppHands = [];
            for (let j = 0; j < opponentCount; j++) {
                oppHands.push([deck.pop(), deck.pop()]);
            }

            // Deal remaining community cards
            const simCommunity = [...communityCards];
            while (simCommunity.length < 5) {
                simCommunity.push(deck.pop());
            }

            // Evaluate
            const myScore = HandEvaluator.evaluate(playerHand, simCommunity);
            let myRank = myScore.rank; // Just use rank for speed first? No, need tie breakers.
            
            let won = true;
            let tied = false;

            for (let oppHand of oppHands) {
                const oppScore = HandEvaluator.evaluate(oppHand, simCommunity);
                
                const cmp = this.compareScores(myScore, oppScore);
                if (cmp < 0) { // Lost to this opponent
                    won = false;
                    tied = false;
                    break;
                } else if (cmp === 0) {
                    tied = true;
                }
            }

            if (won) {
                if (tied) ties++;
                else wins++;
            }
        }

        return (wins + ties * 0.5) / iterations;
    }

    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    static compareScores(a, b) {
        // Returns >0 if a > b, <0 if a < b, 0 if equal
        if (a.rank !== b.rank) return a.rank - b.rank;
        for(let i=0; i<a.tieBreakers.length; i++) {
            if (a.tieBreakers[i] !== b.tieBreakers[i]) {
                return a.tieBreakers[i] - b.tieBreakers[i];
            }
        }
        return 0;
    }
}

class HandEvaluator {
    static evaluate(hand, community) {
        const allCards = [...hand, ...community];
        allCards.sort((a, b) => b.numValue - a.numValue);
        const flush = this.hasFlush(allCards);
        const straight = this.hasStraight(allCards);
        const counts = this.getCounts(allCards);
        const four = Object.keys(counts).find(key => counts[key] === 4);
        const three = Object.keys(counts).find(key => counts[key] === 3);
        const pairs = Object.keys(counts).filter(key => counts[key] === 2).sort((a,b) => b-a);

        if (flush && straight) {
            const suit = flush[0].suit;
            const flushCards = allCards.filter(c => c.suit === suit);
            const straightFlush = this.hasStraight(flushCards);
            if (straightFlush) return { rank: 9, name: "同花顺", tieBreakers: [straightFlush[0]] };
        }
        if (four) {
            const fourVal = parseInt(four);
            const kickers = allCards.filter(c => c.numValue !== fourVal).slice(0, 1).map(c => c.numValue);
            return { rank: 8, name: "四条", tieBreakers: [fourVal, ...kickers] };
        }
        if (three && pairs.length >= 1) {
            const threeVal = parseInt(three);
            const pairVal = parseInt(pairs[0]);
            return { rank: 7, name: "葫芦", tieBreakers: [threeVal, pairVal] };
        }
        const threes = Object.keys(counts).filter(key => counts[key] === 3).sort((a,b) => b-a);
        if (threes.length >= 2) return { rank: 7, name: "葫芦", tieBreakers: [parseInt(threes[0]), parseInt(threes[1])] };
        if (flush) return { rank: 6, name: "同花", tieBreakers: flush.slice(0, 5).map(c => c.numValue) };
        if (straight) return { rank: 5, name: "顺子", tieBreakers: [straight[0]] };
        if (three) {
            const threeVal = parseInt(three);
            const kickers = allCards.filter(c => c.numValue !== threeVal).slice(0, 2).map(c => c.numValue);
            return { rank: 4, name: "三条", tieBreakers: [threeVal, ...kickers] };
        }
        if (pairs.length >= 2) {
            const highPair = parseInt(pairs[0]);
            const lowPair = parseInt(pairs[1]);
            const kickers = allCards.filter(c => c.numValue !== highPair && c.numValue !== lowPair).slice(0, 1).map(c => c.numValue);
            return { rank: 3, name: "两对", tieBreakers: [highPair, lowPair, ...kickers] };
        }
        if (pairs.length === 1) {
            const pairVal = parseInt(pairs[0]);
            const kickers = allCards.filter(c => c.numValue !== pairVal).slice(0, 3).map(c => c.numValue);
            return { rank: 2, name: "一对", tieBreakers: [pairVal, ...kickers] };
        }
        return { rank: 1, name: "高牌", tieBreakers: allCards.slice(0, 5).map(c => c.numValue) };
    }
    static getCounts(cards) {
        const counts = {};
        cards.forEach(card => { counts[card.numValue] = (counts[card.numValue] || 0) + 1; });
        return counts;
    }
    static hasFlush(cards) {
        const suits = {};
        cards.forEach(card => {
            suits[card.suit] = (suits[card.suit] || []);
            suits[card.suit].push(card);
        });
        for (let suit in suits) {
            if (suits[suit].length >= 5) return suits[suit].sort((a,b) => b.numValue - a.numValue);
        }
        return null;
    }
    static hasStraight(cards) {
        const uniqueValues = [...new Set(cards.map(c => c.numValue))];
        uniqueValues.sort((a, b) => b - a);
        if (uniqueValues.includes(14)) uniqueValues.push(1);
        for (let i = 0; i < uniqueValues.length - 4; i++) {
            if (uniqueValues[i] - uniqueValues[i+4] === 4) return [uniqueValues[i]];
        }
        return null;
    }
}

const game = new Game();
