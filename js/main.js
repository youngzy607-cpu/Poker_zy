const soundManager = new SoundManager();
const game = new Game();
window.game = game; // Expose game globally for debugging and access
window.soundManager = soundManager; // Expose soundManager globally

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
    // Connect immediately
    networkManager.connect();

    // Show Auth Overlay by default
    const authOverlay = document.getElementById('auth-overlay');
    const mainMenu = document.getElementById('main-menu');
    
    // Auth Logic
    initAuthUI();

    // --- Main Menu Buttons ---

    // Online Mode Button (Now just opens Lobby)
    const btnOnline = document.getElementById('btn-menu-multi');
    let lobbyPollInterval = null;

    if (btnOnline) {
        // Remove old listener
        const newBtn = btnOnline.cloneNode(true);
        btnOnline.parentNode.replaceChild(newBtn, btnOnline);
        
        newBtn.addEventListener('click', async () => {
            // 检查连接状态，如果未连接则尝试重连
            if (!networkManager.isConnected) {
                try {
                    // 显示连接中提示
                    const connectMsg = '正在连接服务器...';
                    const lobbyMsg = document.getElementById('lobby-message');
                    if (lobbyMsg) lobbyMsg.innerText = connectMsg;
                    
                    await networkManager.ensureConnected();
                } catch (err) {
                    alert('连接服务器失败，请检查网络后重试');
                    return;
                }
            }
            
            mainMenu.style.display = 'none';
            document.getElementById('online-lobby-overlay').style.display = 'flex';
            
            // 清除连接提示
            const lobbyMsg = document.getElementById('lobby-message');
            if (lobbyMsg) lobbyMsg.innerText = '';
            
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
        // No name needed, use session
        const password = document.getElementById('create-room-pwd').value.trim();
        networkManager.createRoom(password || null);
    });
    
    document.getElementById('btn-join-room').addEventListener('click', () => {
        // No name needed, use session
        const roomId = document.getElementById('join-room-id').value.trim();
        if (!roomId) {
            alert('请输入房间号');
            return;
        }
        networkManager.joinRoom(roomId, null); // Manual join tries without password first
    });
    
    document.getElementById('btn-lobby-back').addEventListener('click', () => {
        if (lobbyPollInterval) clearInterval(lobbyPollInterval);
        document.getElementById('online-lobby-overlay').style.display = 'none';
        mainMenu.style.display = 'flex';
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
                let password = null;
                if (room.hasPassword) {
                    password = prompt('请输入房间密码:');
                    if (password === null) return; // Cancelled
                }
                
                networkManager.joinRoom(room.id, password);
            });
            container.appendChild(div);
        });
    });

    // Handle specific join errors
    networkManager.on('joinError', (data) => {
        if (data.code === 'INVALID_PASSWORD') {
            alert('密码错误');
        }
    });

    // Network Error Handling in Lobby
    networkManager.on('error', (msg) => {
        const el = document.getElementById('lobby-message');
        if (el) el.innerText = msg;
        else alert(msg);
    });

    // Achievement Button Logic
    document.getElementById('btn-menu-achievements').addEventListener('click', () => {
        renderAchievements();
        mainMenu.style.display = 'none';
        document.getElementById('achievements-overlay').style.display = 'flex';
    });

    document.getElementById('btn-achievements-close').addEventListener('click', () => {
        document.getElementById('achievements-overlay').style.display = 'none';
        mainMenu.style.display = 'flex';
    });

    // Rankings Button Logic
    document.getElementById('btn-menu-rankings').addEventListener('click', () => {
        if(game && game.ui) game.ui.renderRankings();
        mainMenu.style.display = 'none';
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
            mainMenu.style.display = 'flex';
        }
    });
});

function initAuthUI() {
    const authOverlay = document.getElementById('auth-overlay');
    const formLogin = document.getElementById('auth-form-login');
    const formRegister = document.getElementById('auth-form-register');
    const authMessage = document.getElementById('auth-message');
    
    // Switch between Login and Register
    const linkToRegister = document.getElementById('link-to-register');
    if (linkToRegister) {
        linkToRegister.addEventListener('click', () => {
            formLogin.style.display = 'none';
            formRegister.style.display = 'block';
            authMessage.innerText = '';
        });
    }
    
    const linkToLogin = document.getElementById('link-to-login');
    if (linkToLogin) {
        linkToLogin.addEventListener('click', () => {
            formRegister.style.display = 'none';
            formLogin.style.display = 'block';
            authMessage.innerText = '';
        });
    }

    // Avatar Grid Generation
    const avatarGrid = document.getElementById('reg-avatar-grid');
    if (avatarGrid) {
        const avatars = ['👨‍💼', '👩‍💼', '🕵️‍♂️', '🤠', '👽', '🤖', '🐶', '🐯'];
        avatars.forEach((emoji, index) => {
            const div = document.createElement('div');
            div.className = 'avatar-item';
            div.innerText = emoji;
            div.dataset.id = index;
            if (index === 0) div.classList.add('selected');
            
            div.addEventListener('click', () => {
                document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                document.getElementById('reg-avatar-id').value = index;
            });
            
            avatarGrid.appendChild(div);
        });
    }

    // Submit Login
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    if (btnLoginSubmit) {
        btnLoginSubmit.addEventListener('click', () => {
            const user = document.getElementById('login-username').value.trim();
            const pass = document.getElementById('login-password').value.trim();
            if (!user || !pass) {
                authMessage.innerText = '请输入用户名和密码';
                return;
            }
            networkManager.login(user, pass);
        });
    }

    // Submit Register
    const btnRegisterSubmit = document.getElementById('btn-register-submit');
    if (btnRegisterSubmit) {
        btnRegisterSubmit.addEventListener('click', () => {
            const user = document.getElementById('reg-username').value.trim();
            const pass = document.getElementById('reg-password').value.trim();
            const avatar = document.getElementById('reg-avatar-id').value;
            
            if (!user || user.length < 2) {
                authMessage.innerText = '用户名至少2个字符';
                return;
            }
            if (!pass || pass.length < 4) {
                authMessage.innerText = '密码至少4个字符';
                return;
            }
            
            networkManager.register(user, pass, parseInt(avatar));
        });
    }

    // Auth Listeners
    networkManager.on('loginSuccess', (user) => {
        console.log('Login Success:', user);
        authOverlay.style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
        
        // 保存完整的登录信息（包含 username 和 chips）
        localStorage.setItem('loginData', JSON.stringify({
            username: user.username,
            chips: user.chips
        }));
        
        // Update local DataManager with server chips
        DataManager.updateChips(user.chips);
        document.getElementById('menu-chip-count').innerText = user.chips;
        
        // Also save simple session locally if we want auto-login later
        localStorage.setItem('last_user', user.username);
    });

    networkManager.on('registerSuccess', (user) => {
        console.log('Register Success:', user);
        authOverlay.style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
        
        // 保存完整的登录信息（包含 username 和 chips）
        localStorage.setItem('loginData', JSON.stringify({
            username: user.username,
            chips: user.chips
        }));
        
        // 清除旧的本地战绩数据，确保新账号从零开始
        localStorage.removeItem('texasholdem_profile_v1');
        
        // Update local DataManager with server chips
        DataManager.updateChips(user.chips);
        document.getElementById('menu-chip-count').innerText = user.chips;
    });

    networkManager.on('loginError', (msg) => {
        authMessage.innerText = '登录失败: ' + (msg === 'USER_NOT_FOUND' ? '用户不存在' : '密码错误');
    });

    networkManager.on('registerError', (msg) => {
        authMessage.innerText = '注册失败: ' + (msg === 'USERNAME_EXISTS' ? '用户名已存在' : msg);
    });
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';
    
    DataManager.load().then(profile => {
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
            AchievementManager.getProgress(ach.id).then(progress => {
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
        });
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
