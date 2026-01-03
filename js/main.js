const game = new Game();

// Mute Button Logic
const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        const isEnabled = soundManager.toggleMute();
        muteBtn.textContent = isEnabled ? '🔊' : '🔇';
        muteBtn.style.opacity = isEnabled ? '1' : '0.5';
    });
}
