class UI {
    constructor() {
        this.AVATARS = ['👨‍💼', '👩‍💼', '🕵️‍♂️', '🤠', '👽', '🤖', '🐶', '🐯'];
    }

    setupOpponents(opponents) {
        const container = document.getElementById('opponents-container');
        container.innerHTML = '';
        const count = opponents.length;
        
        // Ellipse parameters (Percentages relative to .game-layer)
        // Center is 50%, 50%
        // We want opponents in the upper arc.
        // Angles: 0 is right (3 o'clock), -90 is top (12 o'clock), 180 is left (9 o'clock)
        // We distribute from roughly 160 deg (left-ish) to 20 deg (right-ish) going clockwise?
        // Actually, in CSS coordinates:
        // Top is 0%, Left is 0%. Center is 50%, 50%.
        // Radius X (width) approx 45% (since table width is 90%)
        // Radius Y (height) approx 45% (since table height is 65% of screen, roughly square-ish aspect in px?)
        // Let's use pure CSS percentage positioning based on angles.
        
        // Distribution range: From Angle 135 (Top Left) to 45 (Top Right) ? 
        // Or wider: 180 (Left) to 0 (Right).
        // Since user is at bottom (270 / -90), opponents should be top semi-circle.
        // Let's say 190 degrees to -10 degrees? (Spanning top)
        
        const startAngle = 200; // Left-bottom-ish
        const endAngle = 340;   // Right-bottom-ish
        // Wait, standard unit circle: 0 is Right, 90 is Bottom, 180 is Left, 270 is Top.
        // We want Top semi-circle. 
        // So from 160 (Left-ish) -> 270 (Top) -> 380 (Right-ish).
        // Let's distribute evenly between 150 deg and 390 deg.
        
        const angleStep = (390 - 150) / (count + 1); // +1 to leave gaps at ends?
        // Better: spread them evenly across the top arc.
        // If 1 opponent: 270 (Top)
        // If 2 opponents: 225, 315
        
        // Let's manually define arcs based on count
        // Angles in degrees (0 = Right, 270 = Top, 180 = Left)
        let angles = [];
        
        // Dynamic angle calculation for 1 to 7 opponents (Total 8 players)
        // User is at Bottom (90 deg / 270 deg in UI logic?)
        // Let's stick to the logic: 270 is Top.
        // We distribute opponents around the top arc.
        
        if (count === 1) angles = [270];
        else {
            // Spread from 180 (Left) to 360 (Right) -> Top semi-circle
            // Adjusted range to avoid pure left/right which might overlap UI
            const startAngle = 160; 
            const endAngle = 380;
            const step = (endAngle - startAngle) / (count - 1);
            
            for(let i=0; i<count; i++) {
                // If count is large, we spread them out.
                // For 2: 270 +/- offset?
                // General formula:
                if (count === 2) angles = [220, 320]; // Custom for 2
                else {
                    angles.push(startAngle + (step * i));
                }
            }
        }
        
        opponents.forEach((p, index) => {
            const angle = angles[index];
            const rad = angle * (Math.PI / 180);
            
            // Radius in percentage relative to container size
            // Container is .game-layer (90% w, 65% h of screen)
            // We want them on the edge.
            const rx = 50; // Horizontal radius %
            const ry = 50; // Vertical radius %
            
            // Adjust position: Center + (cos(a)*rx, sin(a)*ry)
            // Note: sin/cos direction. 
            // In screen coords: X grows right, Y grows down.
            // 0 deg (Right): x=50+50=100, y=50.
            // 270 deg (Top): x=50, y=50-50=0.
            
            // Math.cos(270) = 0 -> x=50
            // Math.sin(270) = -1 -> y=50 + (-1)*50 = 0. Correct.
            
            // Offset slightly inwards so avatar is fully visible
            const offsetX = Math.cos(rad) * 48; 
            const offsetY = Math.sin(rad) * 48;
            
            const left = 50 + offsetX;
            const top = 50 + offsetY;
            
            const div = document.createElement('div');
            div.className = 'player-seat opponent';
            
            // Adjust card position for players on the right side (Angles > 270)
            // Angles: 270 is Top (12 o'clock). > 270 is Top-Right to Right.
            if (angle > 270) {
                div.classList.add('cards-left');
            }

            div.id = `opponent-${index}`;
            div.style.left = `${left}%`;
            div.style.top = `${top}%`;
            
            div.innerHTML = `
                <div class="cards"></div>
                <div class="avatar-container">
                    <div class="avatar">
                        <div class="avatar-img opponent-avatar">CPU${index+1}</div>
                    </div>
                    <div class="player-info">
                        <div class="chips-pill"><span class="currency">$</span><span class="player-chips">1000</span></div>
                    </div>
                    <div class="status-bubble player-status"></div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    updatePlayers(players, showAllCards = false) {
        const user = players[0];
        
        // --- Update User ---
        this.updatePlayerCards(document.getElementById('player-cards'), user.hand, true);
        document.getElementById('player-chips').innerText = user.chips;
        this.updateStatusBubble('player-status', user);
        
        // User Active State
        const userSeat = document.getElementById('player-area');
        userSeat.classList.toggle('active', game.activePlayerIndex === 0);
        userSeat.classList.toggle('folded', user.folded);
        
        // Badges
        this.updateRoleBadges(userSeat.querySelector('.avatar-container'), 0, players.length);

        // Hand Hint
        this.updateHandHint(user, players);

        // --- Update Opponents ---
        for(let i=1; i<players.length; i++) {
            const p = players[i];
            const div = document.getElementById(`opponent-${i-1}`);
            if(!div) continue;
            
            this.updatePlayerCards(div.querySelector('.cards'), p.hand, showAllCards || (p.folded === false && showAllCards), p.folded); 
            div.querySelector('.player-chips').innerText = p.chips;
            this.updateStatusBubble(div.querySelector('.player-status'), p);
            
            // 更新对手头像和名字
            const oppAvatarEl = div.querySelector('.opponent-avatar');
            if (oppAvatarEl) {
                // 如果有avatar属性,使用注册头像;否则显示名字
                if (p.avatar !== undefined && p.avatar !== null) {
                    oppAvatarEl.innerText = this.AVATARS[p.avatar] || '👤';
                } else if (p.name) {
                    // 单机模式或未注册用户,显示名字
                    oppAvatarEl.innerText = p.name;
                }
            }

            div.classList.toggle('active', game.activePlayerIndex === i);
            div.classList.toggle('folded', p.folded);
            div.classList.toggle('waiting', !!p.isWaiting);
            
            this.updateRoleBadges(div.querySelector('.avatar-container'), i, players.length);
        }
    }

    updateStatusBubble(elOrId, player) {
        const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
        if (!el) return;
        
        if (player.isWaiting) {
            el.innerText = "等待中";
            el.style.display = 'block';
            el.style.background = '#7f8c8d';
        } else if (player.isSittingOut) {
            el.innerText = "补充筹码中";
            el.style.display = 'block';
            el.style.background = '#e67e22'; // Orange for attention
            el.style.animation = 'pulse 2s infinite';
        } else if (player.folded) {
            el.innerText = "弃牌";
            el.style.display = 'block';
            el.style.background = '#e74c3c';
        } else if (player.currentBet > 0) {
            // Check if it's the current active player, or just showing previous bet?
            // Usually we show "Bet: 20" or "Call"
            // For now, just show bet amount if > 0
            el.innerText = `下注 ${player.currentBet}`;
            el.style.display = 'block';
            el.style.background = 'rgba(0,0,0,0.8)';
        } else if (game.activePlayerIndex === game.players.indexOf(player)) {
             // Currently thinking?
             el.innerText = '...';
             el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    updateHandHint(user, players) {
        const hintEl = document.getElementById('player-hand-hint');
        if (user.hand.length > 0 && !user.folded) {
             const result = HandEvaluator.evaluate(user.hand, game.communityCards);
             let text = result.name;
             
             // Simple Rank Label logic
             // ... (Same as before)
             
             // Win Rate
             const activeOpponents = players.filter(p => p !== user && p.isActive && !p.folded).length;
             if (activeOpponents > 0) {
                 const stateKey = `${user.hand.map(c=>c.toString()).join('')}-${game.communityCards.map(c=>c.toString()).join('')}-${activeOpponents}`;
                 if (this.lastOddsState !== stateKey) {
                     this.lastWinRate = OddsCalculator.calculate(user.hand, game.communityCards, activeOpponents);
                     this.lastOddsState = stateKey;
                 }
                 const percent = Math.round(this.lastWinRate * 100);
                 text += ` ${percent}%`;
                 
                 if (percent > 70) hintEl.style.borderColor = '#2ecc71'; 
                 else if (percent < 30) hintEl.style.borderColor = '#e74c3c';
                 else hintEl.style.borderColor = '#f1c40f';
             }
             
             hintEl.innerText = text;
             hintEl.style.display = 'block';
        } else {
             hintEl.style.display = 'none';
        }
    }

    updateRoleBadges(container, playerIndex, totalPlayers) {
        // Clear existing
        container.querySelectorAll('.role-badge').forEach(el => el.remove());

        const dealerIdx = game.dealerIndex;
        const sbIdx = (dealerIdx + 1) % totalPlayers;
        const bbIdx = (dealerIdx + 2) % totalPlayers;

        let badge = null;
        if (playerIndex === dealerIdx) badge = {t:'D', c:'role-dealer'};
        else if (playerIndex === sbIdx) badge = {t:'SB', c:'role-sb'};
        else if (playerIndex === bbIdx) badge = {t:'BB', c:'role-bb'};

        if (badge) {
            const el = document.createElement('div');
            el.className = `role-badge ${badge.c}`;
            el.innerText = badge.t;
            // Position relative to avatar container (top-left usually)
            // CSS handles position
            container.appendChild(el);
        }
    }

    updatePlayerCards(container, hand, showFaceUp, isFolded = false) {
        // ... (Keep existing card update logic, mostly generic)
        // Except we might want to ensure 'back' cards are rendered correctly
        
        const existingCards = container.children.length;
        const targetCards = hand.length;

        if (targetCards === 0) {
            container.innerHTML = '';
            return;
        }

        // Simple rebuild for robustness in new layout
        // Optimization can be added back if needed
        container.innerHTML = '';
        
        hand.forEach((card, i) => {
            let cardEl;
            if (showFaceUp) {
                cardEl = card.getHTML();
            } else {
                cardEl = document.createElement('div');
                cardEl.className = 'card back';
            }
            container.appendChild(cardEl);
        });
    }

    updateCommunityCards(cards) {
        const div = document.getElementById('community-cards');
        div.innerHTML = '';
        cards.forEach(c => {
            div.appendChild(c.getHTML());
        });
    }

    updatePot(amount) { document.getElementById('pot-amount').innerText = amount; }
    showMessage(msg) { document.getElementById('message-area').innerText = msg; }
    
    animateChips(fromEl, toEl, amount, onComplete) {
        if (!fromEl || !toEl) {
            if(onComplete) onComplete();
            return;
        }
        
        const rectFrom = fromEl.getBoundingClientRect();
        const rectTo = toEl.getBoundingClientRect();
        
        const chip = document.createElement('div');
        chip.className = 'flying-chip';
        // Center of element
        chip.style.left = `${rectFrom.left + rectFrom.width/2 - 10}px`;
        chip.style.top = `${rectFrom.top + rectFrom.height/2 - 10}px`;
        document.body.appendChild(chip);
        
        // Force reflow
        void chip.offsetWidth;
        
        chip.style.left = `${rectTo.left + rectTo.width/2 - 10}px`;
        chip.style.top = `${rectTo.top + rectTo.height/2 - 10}px`;
        
        setTimeout(() => {
            chip.remove();
            if (onComplete) onComplete();
        }, 500);
    }

    animatePotToWinner(winnerIndex, callback) {
        const potEl = document.querySelector('.pot-container');
        let winnerEl;
        
        if (winnerIndex === 0) {
            winnerEl = document.getElementById('player-area').querySelector('.avatar');
        } else {
            const opp = document.getElementById(`opponent-${winnerIndex-1}`);
            if (opp) winnerEl = opp.querySelector('.avatar');
        }
        
        if (!winnerEl) {
             if(callback) callback();
             return;
        }

        // Trigger Sound
        if (soundManager) soundManager.playWin();

        // Trigger Particles if player won (or maybe for everyone for effect?)
        // Let's do it for everyone for now, but maybe bigger for player
        this.spawnConfetti(winnerEl);

        for(let i=0; i<5; i++) {
            setTimeout(() => {
                this.animateChips(potEl, winnerEl, 0);
            }, i * 50);
        }
        
        if (winnerIndex === 0) {
            document.getElementById('player-area').classList.add('winner-glow');
        } else {
            const opp = document.getElementById(`opponent-${winnerIndex-1}`);
            if(opp) opp.classList.add('winner-glow');
        }
        
        setTimeout(() => {
             document.querySelectorAll('.winner-glow').forEach(el => el.classList.remove('winner-glow'));
             if(callback) callback();
        }, 2000);
    }

    spawnConfetti(targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const colors = ['#f1c40f', '#e67e22', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c'];

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            // Random properties
            const bg = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 8 + 4; // 4-12px
            const tx = (Math.random() - 0.5) * 300; // spread X
            const ty = (Math.random() - 1.0) * 300; // spread Y (upwards mostly)
            const rot = Math.random() * 360;
            
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.backgroundColor = bg;
            confetti.style.left = `${centerX}px`;
            confetti.style.top = `${centerY}px`;
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            
            document.body.appendChild(confetti);

            // Animate
            // We use Web Animations API for better performance than adding/removing classes with complex calc
            const animation = confetti.animate([
                { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`, opacity: 0 }
            ], {
                duration: 1000 + Math.random() * 1000,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                fill: 'forwards'
            });

            animation.onfinish = () => confetti.remove();
        }
    }


    showAchievementToast(achievement) {
        const container = document.getElementById('achievement-notification-container');
        const toast = document.createElement('div');
        toast.className = 'ach-toast';
        toast.innerHTML = `
            <div class="ach-toast-icon">🏆</div>
            <div class="ach-toast-content">
                <div class="ach-toast-title">解锁成就：${achievement.title}</div>
                <div class="ach-toast-reward">奖励 +${achievement.reward} 筹码</div>
            </div>
            <div class="ach-shine"></div>
        `;
        container.appendChild(toast);
        
        // Play sound
        if (window.soundManager) {
            window.soundManager.playAchievement();
        }

        // Remove after animation (4s total)
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    renderRankings() {
        const list = document.getElementById('rankings-list');
        if (!list) return;
        list.innerHTML = '';
        
        const rankings = [
            {
                rank: 1,
                name: '皇家同花顺',
                en: 'Royal Flush',
                desc: '相同花色的10、J、Q、K、A',
                cards: [
                    new Card('♥', 'A'), new Card('♥', 'K'), new Card('♥', 'Q'), new Card('♥', 'J'), new Card('♥', '10')
                ]
            },
            {
                rank: 2,
                name: '同花顺',
                en: 'Straight Flush',
                desc: '五张花色相同且点数相连的牌',
                cards: [
                    new Card('♠', '10'), new Card('♠', '9'), new Card('♠', '8'), new Card('♠', '7'), new Card('♠', '6')
                ]
            },
            {
                rank: 3,
                name: '四条',
                en: 'Four of a Kind',
                desc: '四张相同点数的牌+一张单牌',
                cards: [
                    new Card('♥', 'K'), new Card('♠', 'K'), new Card('♦', 'K'), new Card('♣', 'K'), new Card('♠', '6')
                ]
            },
            {
                rank: 4,
                name: '葫芦',
                en: 'Full House',
                desc: '三张相同点数的牌+一对相同点数的牌',
                cards: [
                    new Card('♥', 'J'), new Card('♠', 'J'), new Card('♦', 'J'), new Card('♠', '7'), new Card('♣', '7')
                ]
            },
            {
                rank: 5,
                name: '同花',
                en: 'Flush',
                desc: '五张相同花色的牌',
                cards: [
                    new Card('♥', 'A'), new Card('♥', 'Q'), new Card('♥', '10'), new Card('♥', '7'), new Card('♥', '3')
                ]
            },
            {
                rank: 6,
                name: '顺子',
                en: 'Straight',
                desc: '五张点数相连的牌',
                cards: [
                    new Card('♥', '7'), new Card('♦', '6'), new Card('♥', '5'), new Card('♣', '4'), new Card('♠', '3')
                ]
            },
            {
                rank: 7,
                name: '三条',
                en: 'Three of a Kind',
                desc: '三张相同点数的牌+两张单牌',
                cards: [
                    new Card('♠', '9'), new Card('♦', '9'), new Card('♣', '9'), new Card('♠', '5'), new Card('♠', '2')
                ]
            },
            {
                rank: 8,
                name: '两对',
                en: 'Two Pairs',
                desc: '两对相同点数的牌+一张单牌',
                cards: [
                    new Card('♠', 'K'), new Card('♦', 'K'), new Card('♦', '9'), new Card('♣', '9'), new Card('♣', '5')
                ]
            },
            {
                rank: 9,
                name: '一对',
                en: 'One Pair',
                desc: '一对相同点数的牌+三张单牌',
                cards: [
                    new Card('♠', 'J'), new Card('♣', 'J'), new Card('♣', '9'), new Card('♦', '4'), new Card('♥', '2')
                ]
            },
            {
                rank: 10,
                name: '高牌',
                en: 'High Card',
                desc: '不能组成以上牌型的五张牌',
                cards: [
                    new Card('♦', 'A'), new Card('♠', '10'), new Card('♥', '7'), new Card('♥', '6'), new Card('♠', '4')
                ]
            }
        ];

        rankings.forEach(item => {
            const row = document.createElement('div');
            row.className = 'ranking-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'ranking-info';
            infoDiv.innerHTML = `
                <div class="ranking-badge">${item.rank}</div>
                <div class="ranking-text">
                    <div class="ranking-name">${item.name} <span class="ranking-en">${item.en}</span></div>
                    <div class="ranking-desc">${item.desc}</div>
                </div>
            `;
            
            const cardsDiv = document.createElement('div');
            cardsDiv.className = 'ranking-cards';
            item.cards.forEach(card => {
                const cardEl = card.getHTML();
                cardEl.classList.add('mini-card'); 
                cardsDiv.appendChild(cardEl);
            });
            
            row.appendChild(infoDiv);
            row.appendChild(cardsDiv);
            list.appendChild(row);
        });
    }

    showRebuyModal(currentBankroll, onConfirmRebuy, onWatchAd, onCancel) {
        const overlay = document.getElementById('rebuy-overlay');
        const totalChipsEl = document.getElementById('rebuy-total-chips');
        const sliderContent = document.getElementById('rebuy-content-slider');
        const adContent = document.getElementById('rebuy-content-ad');
        const slider = document.getElementById('rebuy-amount-slider');
        const display = document.getElementById('rebuy-amount-display');
        
        totalChipsEl.innerText = currentBankroll;
        overlay.style.display = 'flex';

        // Clear previous event listeners (simple cloning)
        const btnConfirm = document.getElementById('btn-confirm-rebuy');
        const btnCancel = document.getElementById('btn-cancel-rebuy');
        const btnWatchAd = document.getElementById('btn-watch-ad');
        const btnGiveUp = document.getElementById('btn-give-up');

        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
        
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        
        const newBtnWatchAd = btnWatchAd.cloneNode(true);
        btnWatchAd.parentNode.replaceChild(newBtnWatchAd, btnWatchAd);
        
        const newBtnGiveUp = btnGiveUp.cloneNode(true);
        btnGiveUp.parentNode.replaceChild(newBtnGiveUp, btnGiveUp);

        // Make overlay non-blocking visually if desired, but blocking interaction with buttons?
        // Actually for non-blocking rebuy, we want user to interact with modal.
        // We can make background transparent so they see game.
        overlay.style.backgroundColor = 'rgba(0,0,0,0.4)'; // More transparent

        if (currentBankroll > 0) {
            // Scenario A: Has Bankroll
            sliderContent.style.display = 'block';
            adContent.style.display = 'none';
            
            // Setup Slider
            const maxBuyIn = Math.min(currentBankroll, 1000); // Limit buy-in to 1000 or max bankroll
            slider.max = maxBuyIn;
            slider.value = maxBuyIn;
            display.innerText = maxBuyIn;
            
            slider.oninput = () => {
                display.innerText = slider.value;
            };

            newBtnConfirm.onclick = () => {
                overlay.style.display = 'none';
                if(onConfirmRebuy) onConfirmRebuy(parseInt(slider.value));
            };

            newBtnCancel.onclick = () => {
                overlay.style.display = 'none';
                if(onCancel) onCancel();
            };

        } else {
            // Scenario B: Bankruptcy
            sliderContent.style.display = 'none';
            adContent.style.display = 'block';

            newBtnWatchAd.onclick = () => {
                // overlay.style.display = 'none'; // Keep overlay or hide? 
                // Better hide rebuy, show ad overlay
                overlay.style.display = 'none';
                if(onWatchAd) onWatchAd();
            };

            newBtnGiveUp.onclick = () => {
                overlay.style.display = 'none';
                if(onCancel) onCancel();
            };
        }
        
        // Add "Add Chips" button trigger if not present
        if (!document.getElementById('btn-add-chips')) {
            this.createAddChipsButton(onConfirmRebuy ? () => {
                 // Trigger callback to game to open modal
                 // But UI shouldn't know game logic.
                 // We need a way to trigger open modal. 
                 // We can pass a 'requestRebuy' callback.
                 // For now, let's assume game handles button creation or binding.
                 // Actually better to put button creation in setup or game.js
            } : null);
        }
    }
    
    // New method to add the Plus button
    createAddChipsButton(onClick) {
        const container = document.getElementById('player-area');
        if (!container) return;
        
        const btn = document.createElement('button');
        btn.id = 'btn-add-chips';
        btn.innerHTML = '+';
        btn.className = 'btn-add-chips';
        btn.title = "补充筹码";
        container.appendChild(btn);
        
        // Event listener will be attached by game.js via ID
    }

    showAdCountdown(seconds, onComplete) {
        const overlay = document.getElementById('ad-overlay');
        const countdownEl = document.getElementById('ad-countdown');
        
        overlay.style.display = 'flex';
        let remaining = seconds;
        countdownEl.innerText = remaining;
        
        const interval = setInterval(() => {
            remaining--;
            countdownEl.innerText = remaining;
            
            if (remaining <= 0) {
                clearInterval(interval);
                overlay.style.display = 'none';
                if(onComplete) onComplete();
            }
        }, 1000);
    }
}
