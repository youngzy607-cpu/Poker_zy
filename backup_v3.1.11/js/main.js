const soundManager = new SoundManager();
const game = new Game();

// Global interaction listener to unlock AudioContext
function unlockAudio() {
    if (soundManager) {
        soundManager.init();
    }
    // Remove listeners once unlocked
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
}

document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('keydown', unlockAudio);

// Initialize Main Menu
    window.addEventListener('load', () => {
        // ... (Existing)
        
        // Online Mode Button
        const btnOnline = document.getElementById('btn-menu-multi');
        let lobbyPollInterval = null;

        if (btnOnline) {
            // Remove old alert
            const newBtn = btnOnline.cloneNode(true);
            btnOnline.parentNode.replaceChild(newBtn, btnOnline);
            
            newBtn.addEventListener('click', () => {
                networkManager.connect(); // Connect when opening lobby
                document.getElementById('main-menu').style.display = 'none';
                document.getElementById('online-lobby-overlay').style.display = 'flex';
                
                // Immediate fetch
                networkManager.getRoomList();

                // Start Polling every 3 seconds
                if (lobbyPollInterval) clearInterval(lobbyPollInterval);
                lobbyPollInterval = setInterval(() => {
                    if (document.getElementById('online-lobby-overlay').style.display !== 'none') {
                        console.log('[Lobby] Polling room list...');
                        networkManager.getRoomList();
                    } else {
                        clearInterval(lobbyPollInterval);
                    }
                }, 3000);
            });
        }
        
        // Lobby Buttons
        document.getElementById('btn-create-room').addEventListener('click', () => {
            const name = document.getElementById('online-nickname').value.trim();
            const password = document.getElementById('create-room-pwd').value.trim();
            if (!name) {
                alert('请输入昵称');
                return;
            }
            networkManager.createRoom(name, password || null);
        });
        
        document.getElementById('btn-join-room').addEventListener('click', () => {
            const name = document.getElementById('online-nickname').value.trim();
            const roomId = document.getElementById('join-room-id').value.trim();
            if (!name) {
                alert('请输入昵称');
                return;
            }
            if (!roomId) {
                alert('请输入房间号');
                return;
            }
            networkManager.joinRoom(roomId, name, null); // Manual join tries without password first, server will fail if needed
        });
        
        document.getElementById('btn-lobby-back').addEventListener('click', () => {
            if (lobbyPollInterval) clearInterval(lobbyPollInterval);
            networkManager.disconnect(); // Disconnect when leaving lobby
            document.getElementById('online-lobby-overlay').style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        });

        document.getElementById('btn-refresh-rooms').addEventListener('click', () => {
            const btn = document.getElementById('btn-refresh-rooms');
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => { btn.style.transform = ''; }, 500); // Reset animation
            console.log('[Lobby] Manual refresh clicked');
            networkManager.getRoomList();
        });

        // Room List Rendering
        networkManager.on('roomList', (list) => {
            console.log('[Main] Received roomList:', list);
            const container = document.getElementById('room-list-container');
            if (!container) return;
            
            container.innerHTML = '';
            if (list.length === 0) {
                container.innerHTML = '<div class="room-list-empty">暂无房间，快来创建一个吧！</div>';
                return;
            }
            
            list.forEach(room => {
                const div = document.createElement('div');
                div.className = 'room-item';
                div.innerHTML = `
                    <div class="room-info">
                        <span class="room-id">${room.id}</span>
                        ${room.hasPassword ? '<span class="room-lock">🔒</span>' : ''}
                    </div>
                    <div class="room-count">${room.count}/${room.max}人</div>
                `;
                div.addEventListener('click', () => {
                    const name = document.getElementById('online-nickname').value.trim();
                    if (!name) {
                        alert('请输入昵称');
                        return;
                    }
                    
                    let password = null;
                    if (room.hasPassword) {
                        password = prompt('请输入房间密码:');
                        if (password === null) return; // Cancelled
                    }
                    
                    networkManager.joinRoom(room.id, name, password);
                });
                container.appendChild(div);
            });
        });

        // Handle specific join errors
        networkManager.on('joinError', (data) => {
            if (data.code === 'INVALID_PASSWORD') {
                const name = document.getElementById('online-nickname').value.trim();
                // If manual join failed due to password, prompt user
                // But we don't know the room ID easily here unless we stored it.
                // Or we just show message.
                // Better: if manual join, we might need to prompt.
                // Simple logic: just alert for now.
                alert('密码错误');
            }
        });

        // Network Error Handling in Lobby
        networkManager.on('error', (msg) => {
            document.getElementById('lobby-message').innerText = msg;
        });

        // ... (Rest of existing)   // Show main menu initially
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('lobby-overlay').style.display = 'none';
    document.querySelector('.game-container').style.display = 'none';
    
    // Update chips display
    const data = DataManager.load();
    const el = document.getElementById('menu-chip-count');
    if (el) el.innerText = data.chips;

    // Achievement Button Logic
    document.getElementById('btn-menu-achievements').addEventListener('click', () => {
        renderAchievements();
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('achievements-overlay').style.display = 'flex';
    });

    document.getElementById('btn-achievements-close').addEventListener('click', () => {
        document.getElementById('achievements-overlay').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
    });

    // Rankings Button Logic
    document.getElementById('btn-menu-rankings').addEventListener('click', () => {
        if(game && game.ui) game.ui.renderRankings();
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('rankings-overlay').style.display = 'flex';
    });

    document.getElementById('btn-game-rankings').addEventListener('click', () => {
        if(game && game.ui) game.ui.renderRankings();
        document.getElementById('rankings-overlay').style.display = 'flex';
    });

    document.getElementById('btn-rankings-close').addEventListener('click', () => {
        document.getElementById('rankings-overlay').style.display = 'none';
        // If game is not running (hidden), go back to main menu
        if (document.querySelector('.game-container').style.display === 'none') {
            document.getElementById('main-menu').style.display = 'flex';
        }
    });
});

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';
    
    const profile = DataManager.load();
    const unlockedIds = profile.achievements || [];
    
    // Sort: Unlocked first, then by ID
    const sortedConfig = [...AchievementConfig].sort((a, b) => {
        const aUnlocked = unlockedIds.includes(a.id);
        const bUnlocked = unlockedIds.includes(b.id);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return 0; // Keep original order otherwise
    });

    sortedConfig.forEach(ach => {
        const isUnlocked = unlockedIds.includes(ach.id);
        const progress = AchievementManager.getProgress(ach.id);
        const percent = Math.min(100, (progress / ach.target) * 100);
        
        const div = document.createElement('div');
        div.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
        
        div.innerHTML = `
            <div class="ach-icon">🏆</div>
            <div class="ach-content">
                <div class="ach-title">${ach.title}</div>
                <div class="ach-desc">${ach.desc}</div>
                <div class="ach-progress-bar">
                    <div class="ach-progress-fill" style="width: ${percent}%"></div>
                </div>
            </div>
            <div class="ach-reward">
                +${ach.reward}
                <div class="ach-status">${isUnlocked ? '已达成' : `${progress}/${ach.target}`}</div>
            </div>
        `;
        list.appendChild(div);
    });
}


// Mute Button Logic
const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
        // Ensure init is called
        soundManager.init();
        
        const isEnabled = soundManager.toggleMute();
        muteBtn.textContent = isEnabled ? '🔊' : '🔇';
        muteBtn.style.opacity = isEnabled ? '1' : '0.5';
        
        // Prevent event bubbling if necessary, though global unlock handles it
        e.stopPropagation();
    });
}
