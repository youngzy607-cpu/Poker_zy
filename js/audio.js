class SoundManager {
    constructor() {
        this.enabled = true;
        this.context = null;
        this.masterGain = null;
    }

    init() {
        if (!this.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.enabled ? 0.5 : 0; // Respect current mute state
            this.masterGain.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (this.masterGain) {
            this.masterGain.gain.value = this.enabled ? 0.5 : 0;
        }
        return this.enabled;
    }

    playTone(freq, type, duration, startTime = 0) {
        if (!this.enabled || !this.context) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.context.currentTime + startTime);
        
        gain.gain.setValueAtTime(0.1, this.context.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(this.context.currentTime + startTime);
        osc.stop(this.context.currentTime + startTime + duration);
    }

    playNoise(duration) {
        if (!this.enabled || !this.context) return;

        const bufferSize = this.context.sampleRate * duration;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.05, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);

        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    // Sound Effects
    
    playCard() {
        // Sliding noise
        this.playNoise(0.1);
    }

    playChip() {
        // High pitched click
        this.playTone(1200, 'sine', 0.05);
        this.playTone(800, 'triangle', 0.05, 0.02);
    }

    playCheck() {
        // Double knock
        this.playTone(150, 'square', 0.05);
        this.playTone(150, 'square', 0.05, 0.1);
    }

    playFold() {
        // Lower sliding noise
        this.playNoise(0.2);
    }

    playAlert() {
        // Ding
        this.playTone(880, 'sine', 0.3);
    }

    playWin() {
        // Arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
        notes.forEach((freq, i) => {
            this.playTone(freq, 'sine', 0.2, i * 0.1);
        });
    }
}

const soundManager = new SoundManager();
