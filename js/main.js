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
