import { PitchDetector } from "https://cdn.skypack.dev/pitchy";

const startButton = document.getElementById("startTuner");
const noteDisplay = document.getElementById("note");
const centsDisplay = document.getElementById("cents");
const freqDisplay = document.getElementById("frequency");

startButton.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const mic = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  mic.connect(analyser);

  const detector = await PitchDetector.forFloat32Array(audioContext.sampleRate);
  const input = new Float32Array(analyser.fftSize);

  function detect() {
    analyser.getFloatTimeDomainData(input);
    const [pitch, clarity] = detector.findPitch(input);

    if (clarity > 0.95) {
      const { note, cents } = getNoteAndCents(pitch);
      noteDisplay.textContent = `Note: ${note}`;
      centsDisplay.textContent = `Cents: ${cents.toFixed(2)}`;
      freqDisplay.textContent = `Frequency: ${pitch.toFixed(2)} Hz`;
    } else {
      noteDisplay.textContent = `Note: -`;
      centsDisplay.textContent = `Cents: -`;
      freqDisplay.textContent = `Frequency: - Hz`;
    }

    requestAnimationFrame(detect);
  }

  detect();
});

function getNoteAndCents(frequency) {
  const A4 = 440;
  const semitone = 12 * Math.log2(frequency / A4);
  const rounded = Math.round(semitone);
  const noteFreq = A4 * Math.pow(2, rounded / 12);
  const noteIndex = (rounded + 69) % 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return {
    note: noteNames[noteIndex],
    cents: 1200 * Math.log2(frequency / noteFreq)
  };
}
