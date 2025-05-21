// pianoRoll.js
export class PianoRoll {
    constructor(canvasId, audioContext) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.audioCtx = audioContext;
      this.notes = []; // {note, startTime, duration}
      this.activeNotes = new Map(); // note -> startTime
      this.startTime = this.audioCtx.currentTime;
      this.noteHeight = 15;
      this.noteWidth = 20;
      this.scrollSpeed = 60; // pixels per second
      this.octaves = 3;
      this.noteCount = this.octaves * 12; // 36 notes
      this.topNote = 72; // C6 approx
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
  
      this.draw = this.draw.bind(this);
      requestAnimationFrame(this.draw);
    }
  
    resize() {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.noteHeight * this.noteCount;
    }
  
    noteToY(note) {
      // Map note to vertical position (higher notes on top)
      return (this.topNote - note) * this.noteHeight;
    }
  
    addNoteOn(note) {
      if (this.activeNotes.has(note)) return; // already playing
      this.activeNotes.set(note, this.audioCtx.currentTime);
    }
  
    addNoteOff(note) {
      if (!this.activeNotes.has(note)) return;
      const start = this.activeNotes.get(note);
      const duration = this.audioCtx.currentTime - start;
      this.notes.push({ note, startTime: start, duration });
      this.activeNotes.delete(note);
    }
  
    clearOldNotes() {
      const now = this.audioCtx.currentTime;
      // Remove notes that scrolled off left (older than 10s)
      this.notes = this.notes.filter(n => (now - n.startTime) < 10);
    }
  
    draw() {
      const now = this.audioCtx.currentTime;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      // Draw background grid for notes
      for (let i = 0; i < this.noteCount; i++) {
        const y = i * this.noteHeight;
        ctx.fillStyle = i % 12 === 0 ? '#ddd' : '#f8f8f8';
        ctx.fillRect(0, y, this.canvas.width, this.noteHeight);
      }
  
      // Draw played notes (past notes, scrolling left)
      ctx.fillStyle = '#1e90ff';
      this.notes.forEach(n => {
        const x = this.canvas.width - (now - n.startTime) * this.scrollSpeed;
        const y = this.noteToY(n.note);
        const width = n.duration * this.scrollSpeed;
        if (x + width > 0 && x < this.canvas.width) {
          ctx.fillRect(x, y, width, this.noteHeight);
        }
      });
  
      // Draw active notes (currently pressed)
      ctx.fillStyle = '#ff6347';
      this.activeNotes.forEach((start, note) => {
        const x = this.canvas.width - (now - start) * this.scrollSpeed;
        const y = this.noteToY(note);
        ctx.fillRect(x, y, 10, this.noteHeight);
      });
  
      this.clearOldNotes();
      requestAnimationFrame(this.draw);
    }
  }
  