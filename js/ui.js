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
                <div class="player-chips"></div>
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
            }
            
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
