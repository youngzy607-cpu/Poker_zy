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
            this.masterGain.gain.value = this.enabled ? 0.5 : 0;
            this.masterGain.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') {
            this.context.resume().then(() => {
                // console.log('AudioContext resumed successfully');
            }).catch(e => console.error(e));
        }
        return true;
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (this.masterGain) {
            // Smooth transition to avoid clicks
            const currentTime = this.context.currentTime;
            this.masterGain.gain.cancelScheduledValues(currentTime);
            this.masterGain.gain.setTargetAtTime(this.enabled ? 0.5 : 0, currentTime, 0.1);
        }
        return this.enabled;
    }

    // --- Haptic Feedback Helper ---
    vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    // --- Advanced Synthesis Helpers ---

    playTone(freq, type, duration, startTime = 0, volume = 0.1) {
        if (!this.enabled || !this.context) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.context.currentTime + startTime);
        
        gain.gain.setValueAtTime(volume, this.context.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(this.context.currentTime + startTime);
        osc.stop(this.context.currentTime + startTime + duration);
    }

    playNoise(duration, type = 'white', filterFreq = 1000) {
        if (!this.enabled || !this.context) return;

        const bufferSize = this.context.sampleRate * duration;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            if (type === 'white') {
                data[i] = Math.random() * 2 - 1;
            } else {
                // Simple pink noise approximation
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5; 
            }
        }

        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        // Filter to make it sound more like paper/felt
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.1, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start();
    }

    // --- Game Sounds ---
    
    playCard() {
        // "Swish" sound: Filtered noise
        this.playNoise(0.15, 'white', 800);
        // Haptic: very light tap
        this.vibrate(10);
    }

    playChip() {
        // "Clack" sound: Two short, high-freq sine waves interfering
        // Simulates the ceramic/clay impact
        const now = this.context.currentTime;
        
        // Impact 1
        this.playTone(2200, 'sine', 0.05, 0, 0.1);
        // Impact 2 (slightly detuned)
        this.playTone(2400, 'sine', 0.05, 0.005, 0.08);
        
        // Body resonance
        this.playTone(600, 'triangle', 0.08, 0, 0.05);

        // Haptic: Sharp click
        this.vibrate(15);
    }

    playCheck() {
        // "Knock" sound: Low freq impact
        this.playTone(100, 'square', 0.1, 0, 0.1); // Thud
        this.playTone(150, 'sine', 0.1, 0.02, 0.1); // Resonance
        
        // Double knock pattern sometimes? Standard is usually double tap for check.
        // Let's do a quick double-tap sound
        setTimeout(() => {
             if (this.context) {
                this.playTone(90, 'square', 0.08, 0, 0.08);
             }
        }, 120);

        this.vibrate([20, 50, 20]);
    }

    playFold() {
        // "Muck" sound: Softer, lower pitched slide
        this.playNoise(0.25, 'white', 400);
        this.vibrate(20);
    }

    playAlert() {
        // "Ding": Attention grabber for turn
        this.playTone(880, 'sine', 0.4, 0, 0.1); // A5
        this.playTone(1760, 'sine', 0.4, 0.05, 0.05); // A6 (harmonic)
        this.vibrate([50, 50, 50]);
    }

    playWin() {
        // "Victory" Fanfare: C Major Arpeggio with glissando feel
        const now = this.context.currentTime;
        const notes = [
            523.25, // C5
            659.25, // E5
            783.99, // G5
            1046.50, // C6
            1318.51, // E6
            1567.98  // G6
        ];
        
        notes.forEach((freq, i) => {
            // Staggered start
            this.playTone(freq, 'triangle', 0.4, i * 0.08, 0.1);
            this.playTone(freq, 'sine', 0.6, i * 0.08, 0.1); // Add body
        });

        // Haptic: Success vibration
        this.vibrate([50, 100, 50, 100, 200]);
    }

    playAllIn() {
        // Dramatic tension sound
        this.playTone(100, 'sawtooth', 1.0, 0, 0.2); // Low growl
        this.playTone(200, 'sine', 1.0, 0, 0.2);
        this.vibrate(500);
    }

    playAchievement() {
        // "Treasure" sound: High-pitched magical chime
        const now = this.context.currentTime;
        const notes = [
            1046.50, // C6
            1318.51, // E6
            1567.98, // G6
            2093.00  // C7
        ];
        
        // Rapid arpeggio up
        notes.forEach((freq, i) => {
            this.playTone(freq, 'sine', 0.5, i * 0.06, 0.15);
            this.playTone(freq * 1.01, 'triangle', 0.3, i * 0.06, 0.05); // Detuned sparkle
        });
        
        // Final ring
        setTimeout(() => {
             this.playTone(2093.00, 'sine', 1.5, 0, 0.2); 
        }, 300);

        this.vibrate([50, 50, 50, 50, 100, 50, 100]);
    }
}

// const soundManager = new SoundManager();
