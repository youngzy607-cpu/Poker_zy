class OnlineGame {
    constructor() {
        this.ui = new UI();
        this.socketId = null;
        this.roomId = null;
        this.myPlayerIndex = -1;
        this.gameState = null;
        this.bankroll = 0; // 模拟本地账户余额
        this.bindEvents();
    }

    bindEvents() {
        // Network Events
        networkManager.on('connect', () => {
            this.socketId = networkManager.socket.id;
        });

        networkManager.on('roomCreated', ({ roomId }) => {
            this.enterGame(roomId);
        });

        networkManager.on('updateState', (state) => {
            this.updateState(state);
        });

        networkManager.on('playerAction', (data) => {
            // Optional: Show action animation/toast if needed immediately
            // But updateState usually follows.
            // We can use this for sound effects!
            this.handleSound(data.action);
        });

        networkManager.on('gameStart', (data) => {
            this.ui.showMessage(`第 ${data.handCount} 局开始`);
            soundManager.playAlert();
        });

        networkManager.on('gameOver', (data) => {
            // Show winners
            let msg = "";
            data.winners.forEach(w => {
                const name = this.getPlayerName(w.socketId);
                msg += `${name} 赢了 ${w.amount} (${w.handName}) `;
            });
            this.ui.showMessage(msg);
            soundManager.playWin();
            
            // Highlight winners
            data.winners.forEach(w => {
                const idx = this.getPlayerIndex(w.socketId);
                this.ui.animatePotToWinner(idx);
            });
        });
        
        networkManager.on('message', (msg) => {
            this.ui.showMessage(msg);
        });

        // UI Action Bindings (Override main game bindings if necessary or use separate)
        // We will toggle visibility of controls based on turn
    }

    enterGame(roomId) {
        this.roomId = roomId;
        document.getElementById('online-lobby-overlay').style.display = 'none';
        document.querySelector('.game-container').style.display = 'flex';
        document.getElementById('main-menu').style.display = 'none';
        
        // Setup initial UI
        this.ui.showMessage(`加入房间: ${roomId}. 等待玩家...`);
        
        // Re-bind buttons to network actions
        this.rebindControls();
        
        // Show room ID somewhere
        const ver = document.querySelector('.version-tag');
        if(ver) ver.innerText += ` | 房间: ${roomId}`;
    }

    rebindControls() {
        // Remove old listeners (by cloning nodes)
        const actions = document.getElementById('main-actions');
        const newActions = actions.cloneNode(true);
        actions.parentNode.replaceChild(newActions, actions);

        const raiseInputs = document.getElementById('raise-inputs');
        const newRaiseInputs = raiseInputs.cloneNode(true);
        raiseInputs.parentNode.replaceChild(newRaiseInputs, raiseInputs);
        
        // Bind New Listeners
        document.getElementById('btn-fold').addEventListener('click', () => networkManager.sendAction('fold'));
        document.getElementById('btn-check').addEventListener('click', () => networkManager.sendAction('check'));
        document.getElementById('btn-call').addEventListener('click', () => networkManager.sendAction('call'));
        
        // Raise UI logic
        const slider = document.getElementById('raise-slider');
        const display = document.getElementById('raise-amount-display');
        
        slider.addEventListener('input', (e) => {
            display.innerText = e.target.value;
        });
        
        document.getElementById('btn-raise').addEventListener('click', () => {
             document.getElementById('main-actions').style.display = 'none';
             document.getElementById('raise-inputs').style.display = 'flex';
        });
        
        document.getElementById('btn-confirm-raise').addEventListener('click', () => {
             const amt = parseInt(slider.value);
             networkManager.sendAction('raise', amt);
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
             networkManager.sendAction('allin');
        });
        
        // Back Button
        document.getElementById('btn-back-menu').addEventListener('click', () => {
             this.exitGame();
        });

        // Host Start Button
        document.getElementById('btn-host-start').addEventListener('click', () => {
            networkManager.socket.emit('startGame');
        });
    }

    async exitGame() {
        if(confirm('确定要退出房间吗？')) {
             // 1. 保存当前桌面筹码到账户（无论多少都要返还）
             if (this.gameState && this.gameState.players) {
                 const me = this.gameState.players.find(p => p.socketId === this.socketId);
                 if (me) {
                     // 将桌面筹码返还到账户（包括0筹码的情况）
                     const profile = await DataManager.load();
                     const newChips = profile.chips + me.chips;
                     console.log(`[退出联机] 原账户筹码: ${profile.chips}, 桌面筹码: ${me.chips}, 返还后: ${newChips}`);
                     DataManager.updateChips(newChips);
                     if(networkManager) networkManager.updateBalance(newChips);
                 }
             }
             
             // 2. Disconnect network
             networkManager.disconnect();
             
             // 3. Reset internal state
             this.roomId = null;
             this.gameState = null;
             this.myPlayerIndex = -1;
             this.socketId = null;

             // 4. Reset UI
             document.querySelector('.game-container').style.display = 'none';
             document.getElementById('main-menu').style.display = 'flex';
             
             // Clear opponents
             this.ui.setupOpponents([]);
             // Clear community cards
             this.ui.updateCommunityCards([]);
             // Clear pot
             this.ui.updatePot(0);
             // Clear messages
             this.ui.showMessage('');
             // Clear player cards
             const playerCards = document.getElementById('player-cards');
             if(playerCards) playerCards.innerHTML = '';
             
             // Reset player chips display in menu
             DataManager.load().then(data => {
                 const el = document.getElementById('menu-chip-count');
                 if (el) el.innerText = data.chips;
             });
                         
             // 5. 重新绑定单机模式的事件监听器
             this.restoreSinglePlayerBindings();
        }
    }

    updateState(state) {
        // 如果收到了游戏状态更新，但还没有进入游戏界面（roomId为空），则自动进入游戏
        if (!this.roomId && state.roomId) {
            this.enterGame(state.roomId);
        }

        this.gameState = state;
        this.socketId = networkManager.socket.id; // Ensure we have it
        
        // Identify My Index
        // Server sends `players` array.
        // We need to rotate `players` so "Me" is at index 0 for UI.
        const myIndex = state.players.findIndex(p => p.socketId === this.socketId);
        this.myPlayerIndex = myIndex;
        
        let uiPlayers = [];
        if (myIndex !== -1) {
            // Rotate: [Me, Opp1, Opp2, ...]
            uiPlayers = [
                ...state.players.slice(myIndex),
                ...state.players.slice(0, myIndex)
            ];
        } else {
            // Spectator mode? Or just raw list
            uiPlayers = state.players;
        }
        
        // Re-construct Player objects for UI (UI expects objects with .hand, .chips, etc)
        // The server sends raw objects, which is fine.
        // We need to convert card objects {suit, value} to Card instances for getHTML()
        uiPlayers.forEach(p => {
            if (p.hand) {
                p.hand = p.hand.map(c => new Card(c.suit, c.value));
            } else {
                p.hand = [];
            }
        });
        
        const community = state.communityCards.map(c => new Card(c.suit, c.value));
        
        // Update Global Game State proxy for UI (if UI uses global 'game' var?)
        // UI.js uses `game.activePlayerIndex`, `game.dealerIndex` for badges.
        // We need to mock or update `game` object if we want to reuse `ui.js` as is.
        // OR we update `ui.js` to accept `dealerRelativeIndex`.
        
        // Hack: Patch the global `game` object with current state properties
        if (typeof game !== 'undefined') {
            game.players = uiPlayers;
            game.communityCards = community;
            game.pot = state.pot;
            game.activePlayerIndex = this.getRelativeIndex(state.activePlayerIndex, myIndex, state.players.length);
            game.dealerIndex = this.getRelativeIndex(state.dealerIndex, myIndex, state.players.length);
            game.phase = state.phase;
            game.currentBet = state.currentBet; // Global current bet
        }

        // Setup Opponents (only if count changed?)
        // UI.setupOpponents clears and rebuilds.
        this.ui.setupOpponents(uiPlayers.slice(1));
        
        // 更新用户自己的头像（联机模式）
        if (uiPlayers[0] && uiPlayers[0].avatar !== undefined && uiPlayers[0].avatar !== null) {
            const userAvatarEl = document.querySelector('.user-avatar');
            if (userAvatarEl) {
                const avatars = ['👨‍💼', '👩‍💼', '🕵️‍♂️', '🤠', '👽', '🤖', '🐶', '🐯'];
                userAvatarEl.innerText = avatars[uiPlayers[0].avatar] || '👤';
            }
        }
        
        this.ui.updateCommunityCards(community);
        this.ui.updatePot(state.pot);
        this.ui.updatePlayers(uiPlayers);
        
        // Controls
        this.updateControls(uiPlayers[0], state);
        
        // Game Status UI (Host Start, Waiting, etc.)
        this.updateGameStatusUI(state);
        
        // 检查自己是否筹码为0且处于旁观状态
        if (uiPlayers[0] && uiPlayers[0].chips <= 0 && state.isWaiting) {
            // 弹出买入弹窗
            this.triggerRebuyModal();
        }
    }
    
    updateGameStatusUI(state) {
        const hostBtnContainer = document.getElementById('host-start-container');
        const waitingHostOverlay = document.getElementById('waiting-host-overlay');
        const waitingNextOverlay = document.getElementById('waiting-next-hand-overlay');
        
        // Default: Hide all
        hostBtnContainer.style.display = 'none';
        waitingHostOverlay.style.display = 'none';
        waitingNextOverlay.style.display = 'none';

        if (!state.gameStarted) {
            // Game hasn't started yet
            if (state.isHost) {
                // I am host, show start button
                hostBtnContainer.style.display = 'block';
                // Update hint text based on player count
                const count = state.players.length; // + state.waitingPlayers? Server sends all active players in players list if not started? 
                // Wait, server logic: addPlayer adds to players if !gameStarted.
                // So state.players includes everyone present.
                const hint = hostBtnContainer.querySelector('.host-hint');
                if (count < 2) {
                    document.getElementById('btn-host-start').disabled = true;
                    hint.innerText = `等待玩家加入... (${count}/8)`;
                } else {
                    document.getElementById('btn-host-start').disabled = false;
                    hint.innerText = `可以开始了 (${count}/8)`;
                }
            } else {
                // I am guest, wait for host
                waitingHostOverlay.style.display = 'flex';
            }
        } else {
            // Game is running
            if (state.isWaiting) {
                // I joined late, waiting for next hand
                waitingNextOverlay.style.display = 'flex';
            }
        }
    }

    getRelativeIndex(absIndex, myAbsIndex, total) {
        if (myAbsIndex === -1) return absIndex;
        return (absIndex - myAbsIndex + total) % total;
    }
    
    getPlayerName(socketId) {
        if (!this.gameState) return "Unknown";
        const p = this.gameState.players.find(p => p.socketId === socketId);
        return p ? p.name : "Unknown";
    }
    
    getPlayerIndex(socketId) {
        if (!this.gameState || this.myPlayerIndex === -1) return -1;
        const absIndex = this.gameState.players.findIndex(p => p.socketId === socketId);
        return this.getRelativeIndex(absIndex, this.myPlayerIndex, this.gameState.players.length);
    }

    updateControls(me, state) {
        if (state.activePlayerIndex === this.gameState.players.findIndex(p => p.socketId === this.socketId)) {
            // It's my turn
            this.enableControls(me, state);
            this.ui.showMessage("轮到你了");
            soundManager.playAlert();
        } else {
            this.disableControls();
        }
    }

    enableControls(me, state) {
        const callAmt = state.currentBet - me.currentBet;
        const canCheck = callAmt === 0;
        const canRaise = me.chips > callAmt;
        
        document.getElementById('btn-check').disabled = !canCheck;
        document.getElementById('btn-call').disabled = canCheck;
        document.getElementById('btn-fold').disabled = false;
        document.getElementById('btn-raise').disabled = !canRaise;
        document.getElementById('btn-quick-allin').disabled = false; // Always allow All In if it's my turn
        
        const slider = document.getElementById('raise-slider');
        if (canRaise) {
            slider.min = 20; // Blind logic? Server handles validation
            slider.max = me.chips;
            slider.value = slider.min;
            slider.disabled = false;
        } else {
            slider.disabled = true;
        }
        
        document.getElementById('main-actions').style.display = 'flex';
        document.getElementById('raise-inputs').style.display = 'none';
    }

    disableControls() {
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-call').disabled = true;
        document.getElementById('btn-fold').disabled = true;
        document.getElementById('btn-raise').disabled = true;
        document.getElementById('btn-quick-allin').disabled = true;
        document.getElementById('raise-inputs').style.display = 'none';
    }

    handleSound(action) {
        switch(action) {
            case 'fold': soundManager.playFold(); break;
            case 'check': soundManager.playCheck(); break;
            case 'call': 
            case 'raise': soundManager.playChip(); break;
        }
    }

    // 触发买入弹窗
    triggerRebuyModal() {
        // 简化处理：直接弹出1000筹码的买入弹窗
        // 实际应该查询用户账户余额
        this.bankroll = 10000; // 模拟余额，实际应从服务器获取
        
        this.ui.showRebuyModal(
            this.bankroll,
            (amount) => this.handleRebuy(amount),
            () => this.handleAdWatch(),
            () => {
                // 取消买入，继续旁观
                console.log('玩家取消买入，继续旁观');
            }
        );
    }

    // 处理买入
    handleRebuy(amount) {
        // 发送买入请求到服务器
        networkManager.socket.emit('rebuy', { amount });
        this.ui.showMessage(`已请求带入 ${amount} 筹码，下局生效`);
    }

    // 处理观看广告（联机模式不支持）
    handleAdWatch() {
        alert('联机模式不支持观看广告获取筹码');
    }

    // 恢复单机模式的事件绑定
    restoreSinglePlayerBindings() {
        // 重新绑定单机模式的按钮事件
        // 通过克隆节点移除旧的监听器，然后重新绑定
        const actions = document.getElementById('main-actions');
        const newActions = actions.cloneNode(true);
        actions.parentNode.replaceChild(newActions, actions);

        const raiseInputs = document.getElementById('raise-inputs');
        const newRaiseInputs = raiseInputs.cloneNode(true);
        raiseInputs.parentNode.replaceChild(newRaiseInputs, raiseInputs);
        
        // 绑定单机模式的按钮事件（调用game对象的handleAction）
        document.getElementById('btn-fold').addEventListener('click', () => game.handleAction('fold'));
        document.getElementById('btn-check').addEventListener('click', () => game.handleAction('check'));
        document.getElementById('btn-call').addEventListener('click', () => game.handleAction('call'));
        
        // Raise & All-in logic
        const slider = document.getElementById('raise-slider');
        const display = document.getElementById('raise-amount-display');
        
        slider.addEventListener('input', (e) => {
            display.innerText = e.target.value;
        });
        
        document.getElementById('btn-raise').addEventListener('click', () => {
             document.getElementById('main-actions').style.display = 'none';
             document.getElementById('raise-inputs').style.display = 'flex';
             game.updateButtons();
        });
        
        document.getElementById('btn-confirm-raise').addEventListener('click', () => {
             const amt = parseInt(slider.value);
             game.handleAction('raise', amt);
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
             const maxRaise = game.getMaxRaiseAmount();
             game.handleAction('raise', maxRaise);
        });
        
        // Back Button - 重新绑定到单机模式的退出逻辑
        document.getElementById('btn-back-menu').addEventListener('click', async () => {
            let msg = '确定要返回主菜单吗？';
            if (game.mode === 'cash') {
                msg += '当前牌局将直接结束，您的筹码将自动保存。';
            } else if (game.mode === 'tournament') {
                msg += '锦标赛中途退出将被视为弃权，无法获得退款或奖金！';
            }
            
            if(confirm(msg)) {
                game.stopGame(); 
                document.querySelector('.game-container').style.display = 'none';
                document.getElementById('main-menu').style.display = 'flex';
                await game.updateMenuChips();
            }
        });
    }
}

window.addEventListener('load', () => {
    window.onlineGame = new OnlineGame();
});
