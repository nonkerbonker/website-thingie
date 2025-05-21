import { Chord } from 'https://cdn.skypack.dev/@tonaljs/tonal';

export function detectChord(midiNotes, useFlats = false) {
  if (!midiNotes || midiNotes.length === 0) return null;

  const noteNames = midiNotes.map(n => midiToNoteName(n, useFlats));

  // Tonal Chord.detect takes an array of notes and returns array of chord names.
  const detected = Chord.detect(noteNames);

  return detected.length > 0 ? detected[0] : 'Unknown';
}

function midiToNoteName(midi, useFlats) {
  const sharp = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flat  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const names = useFlats ? flat : sharp;
  return names[midi % 12];
}
