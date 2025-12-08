document.addEventListener('DOMContentLoaded', () => {
    const keys = document.querySelectorAll('.key');
    let audioCtx;

    // 25 Notes Chromatic Scale (G4 to G6)
    const NOTE_FREQS = {
        'G4': 392.00, 'G#4': 415.30,
        'A4': 440.00, 'A#4': 466.16,
        'B4': 493.88,

        'C5': 523.25, 'C#5': 554.37,
        'D5': 587.33, 'D#5': 622.25,
        'E5': 659.25,
        'F5': 698.46, 'F#5': 739.99,
        'G5': 783.99, 'G#5': 830.61,
        'A5': 880.00, 'A#5': 932.33,
        'B5': 987.77,

        'C6': 1046.50, 'C#6': 1108.73,
        'D6': 1174.66, 'D#6': 1244.51,
        'E6': 1318.51,
        'F6': 1396.91, 'F#6': 1479.98,
        'G6': 1567.98
    };

    // MIDI Note Mapping (C4 = 60)
    // G4=67, A4=69, B4=71, C5=72, ...
    const MIDI_MAP = {
        67: 'G4', 68: 'G#4', 69: 'A4', 70: 'A#4', 71: 'B4',
        72: 'C5', 73: 'C#5', 74: 'D5', 75: 'D#5', 76: 'E5', 77: 'F5', 78: 'F#5', 79: 'G5', 80: 'G#5', 81: 'A5', 82: 'A#5', 83: 'B5',
        84: 'C6', 85: 'C#6', 86: 'D6', 87: 'D#6', 88: 'E6', 89: 'F6', 90: 'F#6', 91: 'G6'
    };

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playNote(freq) {
        if (!audioCtx) initAudio();

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Sine wave for clear bell tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        // Percussive envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.01); // Quick attack
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // Medium ringing decay

        osc.start(now);
        osc.stop(now + 1.2);
    }

    function triggerVisual(noteName) {
        // Find button with data-note matching noteName
        const button = document.querySelector(`.key[data-note="${noteName}"]`);
        if (button) {
            button.classList.remove('active');
            void button.offsetWidth; // Trigger reflow
            button.classList.add('active');
            setTimeout(() => button.classList.remove('active'), 100);
        }
    }

    function handleInput(e) {
        if (e.type === 'touchstart') {
            e.preventDefault(); // Critical for multitouch
        }

        const target = e.currentTarget;
        const note = target.dataset.note;

        if (NOTE_FREQS[note]) {
            triggerVisual(note);
            playNote(NOTE_FREQS[note]);
        }
    }

    // --- MIDI Implementation ---
    function onMIDISuccess(midiAccess) {
        console.log('MIDI Access Granted');
        const inputs = midiAccess.inputs;
        for (let input of inputs.values()) {
            input.onmidimessage = onMIDIMessage;
        }
        midiAccess.onstatechange = (e) => {
            console.log('MIDI State Change:', e.port.name, e.port.state);
            // Re-bind listeners if new device connected
            if (e.port.type === 'input' && e.port.state === 'connected') {
                e.port.onmidimessage = onMIDIMessage;
            }
        };
    }

    function onMIDIFailure() {
        console.warn('Could not access your MIDI devices.');
    }

    function onMIDIMessage(message) {
        const command = message.data[0];
        const note = message.data[1];
        const velocity = (message.data.length > 2) ? message.data[2] : 0;

        // Note On (usually 144-159) with velocity > 0
        if (command >= 144 && command <= 159 && velocity > 0) {
            const noteName = MIDI_MAP[note];
            if (noteName && NOTE_FREQS[noteName]) {
                playNote(NOTE_FREQS[noteName]);
                triggerVisual(noteName);
            }
        }
    }

    // Request MIDI access
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    // --- Event Listeners ---
    keys.forEach(key => {
        key.addEventListener('mousedown', handleInput);
        key.addEventListener('touchstart', handleInput, { passive: false });
    });

    // unlock audio context
    const unlockEvents = ['click', 'touchstart', 'touchend', 'mousedown', 'keydown'];
    const unlock = () => {
        initAudio(); // Initialize audio on first user interaction
        unlockEvents.forEach(e => document.body.removeEventListener(e, unlock));
    };
    unlockEvents.forEach(e => document.body.addEventListener(e, unlock, { once: true }));

    // Mobile Landscape Fix - JS Force
    function checkOrientation() {
        const header = document.querySelector('.app-header');

        const isLandscape = window.innerWidth > window.innerHeight;
        // Check if device supports touch (most reliable for "mobile")
        const isTouch = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);

        // If it's a touch device in landscape, OR if the height is very small (simulated landscape on mobile web)
        if ((isLandscape && isTouch) || window.innerHeight < 550) {
            if (header) header.style.display = 'none';
        } else {
            if (header) header.style.display = '';
        }
    }

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Run immediately
    checkOrientation();
});
