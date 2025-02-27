/**
 * Ambient Soundscape Generator
 * A generative music system that creates pleasant, continuous soundscapes
 * using Web Audio API.
 */

// Initialize audio context
let audioContext;
let masterGainNode;
let reverbNode;
let analyser;
let playing = false;
let noteScheduler;
let visualizerInterval;

// Musical parameters
const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10]
};

const rootNotes = {
    'C': 60,
    'C#': 61,
    'D': 62,
    'D#': 63,
    'E': 64,
    'F': 65,
    'F#': 66,
    'G': 67,
    'G#': 68,
    'A': 69,
    'A#': 70,
    'B': 71
};

// DOM elements
const playButton = document.getElementById('play-button');
const stopButton = document.getElementById('stop-button');
const randomizeButton = document.getElementById('randomize-button');
const scaleSelect = document.getElementById('scale');
const rootSelect = document.getElementById('root');
const tempoSlider = document.getElementById('tempo');
const tempoValue = document.getElementById('tempo-value');
const densitySlider = document.getElementById('density');
const densityValue = document.getElementById('density-value');
const reverbSlider = document.getElementById('reverb');
const reverbValue = document.getElementById('reverb-value');
const visualizerCanvas = document.getElementById('visualizer-canvas');
const noteIndicatorsContainer = document.getElementById('note-indicators');

// Canvas context
const canvasCtx = visualizerCanvas.getContext('2d');
let canvasWidth, canvasHeight;

// Active notes for visualization
const activeNotes = new Set();
const noteIndicators = [];

// Initialize the application
function init() {
    // Set up event listeners
    playButton.addEventListener('click', startSoundscape);
    stopButton.addEventListener('click', stopSoundscape);
    randomizeButton.addEventListener('click', randomizeSettings);
    
    tempoSlider.addEventListener('input', updateTempoValue);
    densitySlider.addEventListener('input', updateDensityValue);
    reverbSlider.addEventListener('input', updateReverbValue);
    
    // Initialize UI values
    updateTempoValue();
    updateDensityValue();
    updateReverbValue();
    
    // Create note indicators
    createNoteIndicators();
    
    // Set canvas dimensions
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize with random settings
    randomizeSettings();
}

// Create note indicators based on the selected scale
function createNoteIndicators() {
    noteIndicatorsContainer.innerHTML = '';
    noteIndicators.length = 0;
    
    const currentScale = scales[scaleSelect.value];
    const numNotes = currentScale.length;
    
    for (let i = 0; i < numNotes; i++) {
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        noteIndicatorsContainer.appendChild(noteElement);
        noteIndicators.push(noteElement);
    }
}

// Update note indicators when scale changes
function updateNoteIndicators() {
    createNoteIndicators();
}

// Start the soundscape
function startSoundscape() {
    if (playing) return;
    
    // Initialize audio context if it doesn't exist
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create master gain node
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = 0.5;
        
        // Create analyzer for visualization
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Create reverb
        setupReverb();
    }
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Update UI
    playButton.classList.add('active');
    stopButton.classList.remove('active');
    
    // Start scheduling notes
    playing = true;
    scheduleNotes();
    
    // Start visualizer
    startVisualizer();
}

// Set up the reverb effect
function setupReverb() {
    // Create a convolver node for reverb
    const convolver = audioContext.createConvolver();
    
    // Create impulse response
    const rate = audioContext.sampleRate;
    const length = rate * 3; // 3 seconds
    const impulse = audioContext.createBuffer(2, length, rate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    
    // Fill the buffer with white noise with an exponential decay
    for (let i = 0; i < length; i++) {
        const decay = Math.pow(0.5, i / (rate * 0.5));
        impulseL[i] = (Math.random() * 2 - 1) * decay;
        impulseR[i] = (Math.random() * 2 - 1) * decay;
    }
    
    convolver.buffer = impulse;
    
    // Create wet/dry mix
    const reverbAmount = parseFloat(reverbSlider.value);
    const wetGain = audioContext.createGain();
    wetGain.gain.value = reverbAmount;
    
    const dryGain = audioContext.createGain();
    dryGain.gain.value = 1 - reverbAmount;
    
    // Create a gain node to control the final output
    const reverbMix = audioContext.createGain();
    
    // Connect the nodes
    masterGainNode.connect(wetGain);
    masterGainNode.connect(dryGain);
    
    wetGain.connect(convolver);
    convolver.connect(reverbMix);
    dryGain.connect(reverbMix);
    
    reverbMix.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // Store the nodes for later updates
    reverbNode = {
        wetGain: wetGain,
        dryGain: dryGain,
        convolver: convolver,
        reverbMix: reverbMix
    };
}

// Update reverb when slider changes
function updateReverbValue() {
    const reverb = reverbSlider.value;
    let reverbText;
    
    if (reverb <= 0.3) {
        reverbText = 'Dry';
    } else if (reverb <= 0.7) {
        reverbText = 'Medium';
    } else {
        reverbText = 'Wet';
    }
    
    reverbValue.textContent = reverbText;
    
    // Update reverb if already playing
    if (playing && reverbNode) {
        const reverbAmount = parseFloat(reverb);
        reverbNode.wetGain.gain.value = reverbAmount;
        reverbNode.dryGain.gain.value = 1 - reverbAmount;
    }
}

// Stop the soundscape
function stopSoundscape() {
    if (!playing) return;
    
    // Clear schedulers
    clearTimeout(noteScheduler);
    clearInterval(visualizerInterval);
    
    // Update UI
    playButton.classList.remove('active');
    stopButton.classList.add('active');
    
    // Stop all sound
    if (audioContext && masterGainNode) {
        masterGainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
        setTimeout(() => {
            if (audioContext) {
                masterGainNode.disconnect();
                if (reverbNode) {
                    reverbNode.wetGain.disconnect();
                    reverbNode.dryGain.disconnect();
                    reverbNode.convolver.disconnect();
                    reverbNode.reverbMix.disconnect();
                }
                analyser.disconnect();
                audioContext.close();
                audioContext = null;
                reverbNode = null;
            }
        }, 1000);
    }
    
    playing = false;
    activeNotes.clear();
    updateNoteIndicatorsDisplay();
}

// Schedule notes based on current settings
function scheduleNotes() {
    if (!playing) return;
    
    const tempo = parseInt(tempoSlider.value);
    const density = parseInt(densitySlider.value);
    const rootNote = rootNotes[rootSelect.value];
    const currentScale = scales[scaleSelect.value];
    
    // Calculate time between notes based on tempo and density
    const noteDuration = 60 / tempo * 1000; // in milliseconds
    const noteInterval = noteDuration / density;
    
    // Schedule a batch of notes
    for (let i = 0; i < density; i++) {
        setTimeout(() => {
            if (playing && Math.random() < 0.7) { // 70% chance of playing a note
                playRandomNote(rootNote, currentScale);
            }
        }, i * noteInterval);
    }
    
    // Schedule the next batch
    noteScheduler = setTimeout(scheduleNotes, noteDuration);
}

// Play a random note from the selected scale
function playRandomNote(rootNote, scale) {
    if (!audioContext) return;
    
    // Choose a random octave (-1, 0, or 1 relative to root)
    const octaveOffset = Math.floor(Math.random() * 3) - 1;
    
    // Choose a random note from the scale
    const scaleIndex = Math.floor(Math.random() * scale.length);
    const noteOffset = scale[scaleIndex];
    
    // Calculate the final MIDI note number
    const midiNote = rootNote + noteOffset + (octaveOffset * 12);
    
    // Convert MIDI note to frequency
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Create oscillator
    const oscillator = audioContext.createOscillator();
    oscillator.type = chooseRandomWaveform();
    oscillator.frequency.value = frequency;
    
    // Create envelope
    const envelope = audioContext.createGain();
    envelope.gain.value = 0;
    
    // Random duration between 2 and 8 seconds
    const duration = 2 + Math.random() * 6;
    
    // Random pan position
    const panner = audioContext.createStereoPanner();
    panner.pan.value = Math.random() * 2 - 1; // -1 to 1
    
    // Connect nodes
    oscillator.connect(envelope);
    envelope.connect(panner);
    panner.connect(masterGainNode);
    
    // Apply envelope
    const now = audioContext.currentTime;
    const attackTime = 0.2 + Math.random() * 0.3;
    const releaseTime = 0.5 + Math.random() * 1.5;
    
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.2 + Math.random() * 0.1, now + attackTime);
    envelope.gain.setValueAtTime(0.2 + Math.random() * 0.1, now + duration - releaseTime);
    envelope.gain.linearRampToValueAtTime(0, now + duration);
    
    // Start and stop the oscillator
    oscillator.start(now);
    oscillator.stop(now + duration);
    
    // Clean up when done
    oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        panner.disconnect();
    };
    
    // Update active notes for visualization
    activeNotes.add(scaleIndex);
    updateNoteIndicatorsDisplay();
    
    // Remove from active notes after the note is done
    setTimeout(() => {
        activeNotes.delete(scaleIndex);
        updateNoteIndicatorsDisplay();
    }, duration * 1000);
}

// Choose a random waveform type
function chooseRandomWaveform() {
    const waveforms = ['sine', 'triangle', 'sine', 'sine']; // More sine for smoother sound
    return waveforms[Math.floor(Math.random() * waveforms.length)];
}

// Start the visualizer
function startVisualizer() {
    if (visualizerInterval) {
        clearInterval(visualizerInterval);
    }
    
    visualizerInterval = setInterval(drawVisualizer, 30); // ~30fps
}

// Draw the visualizer
function drawVisualizer() {
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    // Clear the canvas
    canvasCtx.fillStyle = 'rgba(165, 200, 232, 0.2)';
    canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw the waveform
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#6ec4ff';
    canvasCtx.beginPath();
    
    const sliceWidth = canvasWidth / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvasHeight / 2;
        
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    canvasCtx.lineTo(canvasWidth, canvasHeight / 2);
    canvasCtx.stroke();
    
    // Draw circles for active frequencies
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    
    for (let i = 0; i < 20; i++) {
        const freqIndex = Math.floor(i * bufferLength / 100);
        const freqValue = freqData[freqIndex];
        const radius = freqValue / 10;
        
        if (radius > 1) {
            canvasCtx.beginPath();
            const x = Math.random() * canvasWidth;
            const y = Math.random() * canvasHeight;
            const gradient = canvasCtx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(110, 196, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(110, 196, 255, 0)');
            canvasCtx.fillStyle = gradient;
            canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
            canvasCtx.fill();
        }
    }
}

// Resize the canvas to match its container
function resizeCanvas() {
    const container = visualizerCanvas.parentElement;
    canvasWidth = container.clientWidth;
    canvasHeight = container.clientHeight;
    
    visualizerCanvas.width = canvasWidth;
    visualizerCanvas.height = canvasHeight;
}

// Update the note indicators display
function updateNoteIndicatorsDisplay() {
    for (let i = 0; i < noteIndicators.length; i++) {
        if (activeNotes.has(i)) {
            noteIndicators[i].classList.add('active');
        } else {
            noteIndicators[i].classList.remove('active');
        }
    }
}

// Randomize all settings
function randomizeSettings() {
    // Randomize scale
    const scaleKeys = Object.keys(scales);
    scaleSelect.value = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];
    
    // Randomize root note
    const rootKeys = Object.keys(rootNotes);
    rootSelect.value = rootKeys[Math.floor(Math.random() * rootKeys.length)];
    
    // Randomize tempo (40-120 BPM)
    tempoSlider.value = 40 + Math.floor(Math.random() * 80);
    updateTempoValue();
    
    // Randomize density (1-10)
    densitySlider.value = 1 + Math.floor(Math.random() * 10);
    updateDensityValue();
    
    // Randomize reverb (0.2-0.8)
    reverbSlider.value = (0.2 + Math.random() * 0.6).toFixed(1);
    updateReverbValue();
    
    // Update note indicators
    updateNoteIndicators();
    
    // Update reverb if already playing
    if (playing && reverbNode) {
        const reverbAmount = parseFloat(reverbSlider.value);
        reverbNode.wetGain.gain.value = reverbAmount;
        reverbNode.dryGain.gain.value = 1 - reverbAmount;
    }
}

// Update tempo display
function updateTempoValue() {
    const tempo = tempoSlider.value;
    tempoValue.textContent = `${tempo} BPM`;
}

// Update density display
function updateDensityValue() {
    const density = densitySlider.value;
    let densityText;
    
    if (density <= 3) {
        densityText = 'Sparse';
    } else if (density <= 7) {
        densityText = 'Medium';
    } else {
        densityText = 'Dense';
    }
    
    densityValue.textContent = densityText;
}

// Event listener for scale changes
scaleSelect.addEventListener('change', updateNoteIndicators);

// Initialize the application when the page loads
window.addEventListener('load', init);
