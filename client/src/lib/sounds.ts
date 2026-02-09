const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

function playChord(frequencies: number[], duration: number, type: OscillatorType = "sine", volume = 0.08) {
  frequencies.forEach((f) => playTone(f, duration, type, volume));
}

export function playTradeSuccess() {
  playChord([523, 659, 784], 0.15, "sine", 0.1);
  setTimeout(() => playTone(1047, 0.2, "sine", 0.08), 100);
}

export function playTradeFail() {
  playTone(220, 0.15, "square", 0.08);
  setTimeout(() => playTone(180, 0.2, "square", 0.06), 120);
}

export function playClick() {
  playTone(800, 0.05, "sine", 0.05);
}

export function playNotification() {
  playTone(880, 0.1, "sine", 0.08);
  setTimeout(() => playTone(1100, 0.15, "sine", 0.06), 80);
}
