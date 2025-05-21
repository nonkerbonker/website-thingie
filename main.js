import { detectChord } from './chordUtils.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let midiAccess = null;
let activeNotes = new Map();  // note -> {osc, gain, release}
let sustain = false;
let sustainedNotes = [];

const keyboard = document.getElementById('keyboard');
const pianoRollCanvas = document.getElementById('pianoRoll');
const ctx = pianoRollCanvas.getContext('2d');

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let pianoRollNotes = [];  // {note, startTime, duration}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

async function initMIDI() {
  try {
    midiAccess = await navigator.requestMIDIAccess();
    setupMIDIDevices();
  } catch (e) {
    alert('Could not get MIDI access: ' + e);
  }
}

function setupMIDIDevices() {
  const select = document.getElementById('midiDevices');
  select.innerHTML = '';
  for (const input of midiAccess.inputs.values()) {
    const option = document.createElement('option');
    option.value = input.id;
    option.textContent = input.name;
    select.appendChild(option);
  }

  select.onchange = () => {
    for (const input of midiAccess.inputs.values()) input.onmidimessage = null;
    const input = midiAccess.inputs.get(select.value);
    if (input) input.onmidimessage = onMIDIMessage;
  };

  if (select.options.length > 0) {
    select.value = select.options[0].value;
    select.onchange();
  }
}

function createVoice(note, velocity) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const attack = parseInt(document.getElementById('attack').value) || 10;
  const decay = parseInt(document.getElementById('decay').value) || 100;
  const sustainLevel = parseFloat(document.getElementById('sustain').value) || 0.7;
  const release = parseInt(document.getElementById('release').value) || 300;
  const waveform = document.getElementById('waveform').value || 'sine';

  osc.type = waveform;
  osc.frequency.value = midiToFreq(note);

  const now = audioCtx.currentTime;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(velocity / 127, now + attack / 1000);
  gain.gain.linearRampToValueAtTime((velocity / 127) * sustainLevel, now + (attack + decay) / 1000);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();

  return { osc, gain, release };
}

function stopVoice(note) {
  const voice = activeNotes.get(note);
  if (!voice) return;

  const now = audioCtx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.linearRampToValueAtTime(0, now + voice.release / 1000);

  voice.osc.stop(now + voice.release / 1000 + 0.05);
  activeNotes.delete(note);
}

function onMIDIMessage(event) {
  const [cmd, note, velocity] = event.data;

  if (cmd === 144 && velocity > 0) {
    if (activeNotes.has(note)) stopVoice(note);

    const voice = createVoice(note, velocity);
    activeNotes.set(note, voice);

    if (!sustain) highlightKey(note, true);

    pianoRollNotes.push({ note, startTime: performance.now(), duration: 0 });

  } else if (cmd === 128 || (cmd === 144 && velocity === 0)) {
    if (sustain) {
      sustainedNotes.push(note);
    } else {
      stopVoice(note);
      highlightKey(note, false);

      const prNote = pianoRollNotes.find(n => n.note === note && n.duration === 0);
      if (prNote) prNote.duration = performance.now() - prNote.startTime;
    }
  } else if (cmd === 176 && note === 64) {  // sustain pedal
    sustain = velocity > 0;
    if (!sustain) {
      sustainedNotes.forEach(n => {
        stopVoice(n);
        highlightKey(n, false);

        const prNote = pianoRollNotes.find(noteObj => noteObj.note === n && noteObj.duration === 0);
        if (prNote) prNote.duration = performance.now() - prNote.startTime;
      });
      sustainedNotes = [];
    }
  }

  updateChordDisplay();
}

function updateChordDisplay() {
  const useFlats = document.getElementById('flatNotation').checked;
  const notes = Array.from(activeNotes.keys());
  const chordName = detectChord(notes, useFlats);
  document.getElementById('noteDisplay').textContent = 'Notes: ' + (notes.length ? notes.join(', ') : 'None');
  document.getElementById('chordDisplay').textContent = 'Chord: ' + (chordName || 'Unknown');
}

function renderKeyboard() {
  keyboard.innerHTML = '';
  for (let note = 48; note <= 72; note++) {
    const isSharp = noteNames[note % 12].includes('#');
    const key = document.createElement('div');
    key.className = isSharp ? 'black-key' : 'white-key';
    key.dataset.note = note;
    key.addEventListener('mousedown', () => playNoteUI(note));
    key.addEventListener('mouseup', () => stopNoteUI(note));
    key.addEventListener('touchstart', e => {
      e.preventDefault();
      playNoteUI(note);
    }, { passive: false });
    key.addEventListener('touchend', e => {
      e.preventDefault();
      stopNoteUI(note);
    }, { passive: false });

    keyboard.appendChild(key);
  }
}

function playNoteUI(note) {
  if (activeNotes.has(note)) stopVoice(note);
  const voice = createVoice(note, 100);
  activeNotes.set(note, voice);
  highlightKey(note, true);

  pianoRollNotes.push({ note, startTime: performance.now(), duration: 0 });

  updateChordDisplay();
}

function stopNoteUI(note) {
  if (sustain) {
    sustainedNotes.push(note);
  } else {
    stopVoice(note);
    highlightKey(note, false);

    const prNote = pianoRollNotes.find(n => n.note === note && n.duration === 0);
    if (prNote) prNote.duration = performance.now() - prNote.startTime;

    updateChordDisplay();
  }
}

function highlightKey(note, active) {
  const key = [...keyboard.children].find(k => +k.dataset.note === note);
  if (key) key.classList.toggle('active', active);
}

function drawPianoRoll() {
  const width = pianoRollCanvas.width;
  const height = pianoRollCanvas.height;
  const now = performance.now();

  ctx.clearRect(0, 0, width, height);

  const keyCount = 25; // notes 48 to 72 inclusive
  const noteHeight = height / keyCount;

  ctx.strokeStyle = '#444';
  for (let i = 0; i <= keyCount; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * noteHeight);
    ctx.lineTo(width, i * noteHeight);
    ctx.stroke();
  }

  const maxDuration = 5000; // 5 seconds

  for (const prNote of pianoRollNotes) {
    const elapsed = now - prNote.startTime;
    const duration = prNote.duration || (elapsed < maxDuration ? elapsed : maxDuration);
    if (elapsed > maxDuration) continue;

    const x = width - (elapsed / maxDuration) * width;
    const noteIndex = prNote.note - 48;
    const y = height - (noteIndex + 1) * noteHeight;

    ctx.fillStyle = prNote.duration === 0 ? '#4caf50' : '#81c784';
    ctx.fillRect(x, y, (duration / maxDuration) * width, noteHeight * 0.9);
  }

  // Cleanup old notes
  pianoRollNotes = pianoRollNotes.filter(n => now - n.startTime < 10000);

  requestAnimationFrame(drawPianoRoll);
}

document.getElementById('startButton').addEventListener('click', async () => {
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  await initMIDI();
  renderKeyboard();
  drawPianoRoll();
  document.getElementById('startButton').disabled = true;
});
