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
    // Show main menu initially
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
