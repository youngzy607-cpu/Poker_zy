class OnlineGame {
    constructor() {
        this.ui = new UI();
        this.socketId = null;
        this.roomId = null;
        this.myPlayerIndex = -1;
        this.gameState = null;
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

    exitGame() {
        if(confirm('确定要退出房间吗？')) {
             // 1. Disconnect network
             networkManager.disconnect();
             
             // 2. Reset internal state
             this.roomId = null;
             this.gameState = null;
             this.myPlayerIndex = -1;
             this.socketId = null;

             // 3. Reset UI
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
             const data = DataManager.load();
             const el = document.getElementById('menu-chip-count');
             if (el) el.innerText = data.chips;
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
        
        this.ui.updateCommunityCards(community);
        this.ui.updatePot(state.pot);
        this.ui.updatePlayers(uiPlayers);
        
        // Controls
        this.updateControls(uiPlayers[0], state);
        
        // Game Status UI (Host Start, Waiting, etc.)
        this.updateGameStatusUI(state);
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
}

window.addEventListener('load', () => {
    window.onlineGame = new OnlineGame();
});
