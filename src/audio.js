export function createAudio() {
  let ctx, master, wind, city, music, melody, volume = .42;
  function open() {
    if (!ctx) {
      if (!window.AudioContext) return;
      ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      function bed(frequency, q) {
        const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency; filter.Q.value = q;
        const gain = ctx.createGain(); gain.gain.value = 0;
        noise.connect(filter); filter.connect(gain); gain.connect(master); noise.start();
        return gain.gain;
      }
      wind = bed(840, .6); city = bed(150, 2.2); music = ctx.createGain(); music.gain.value = 0; music.connect(master);
      const notes = [110, 130.81, 164.81, 196, 164.81, 130.81, 98, 146.83];
      const start = ctx.currentTime;
      melody = { notes, next: start, beat: 0 };
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function tone(start, end, dur, type, gain, at = ctx.currentTime, out = master) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(start, at); osc.frequency.exponentialRampToValueAtTime(end, at + dur);
    env.gain.setValueAtTime(.001, at); env.gain.exponentialRampToValueAtTime(gain, at + .022); env.gain.exponentialRampToValueAtTime(.001, at + dur);
    osc.connect(env); env.connect(out); osc.start(at); osc.stop(at + dur);
  }
  function effect(name) {
    if (!ctx) return;
    const spec = {
      web: [950, 160, .23, 'triangle', .16], step: [90, 45, .075, 'triangle', .045],
      land: [115, 38, .25, 'triangle', .14], hit: [175, 48, .2, 'sawtooth', .105],
      jump: [195, 310, .17, 'triangle', .084], special: [140, 680, .42, 'triangle', .15],
      reward: [390, 785, .31, 'sine', .14], danger: [220, 95, .22, 'square', .095]
    }[name];
    if (spec) tone(...spec);
  }
  function update(speed, height, menu) {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    wind.setTargetAtTime(menu ? .013 : .01 + Math.min(.29, speed * .006), now, .15);
    city.setTargetAtTime(menu ? .019 : .024 + Math.max(0, .085 - height * .002), now, .3);
    music.gain.setTargetAtTime(menu ? .29 : 0, now, .3);
    if (melody.next < now) melody.next = now + .025;
    if (menu && melody.next < now + .12) {
      const hz = melody.notes[melody.beat++ % melody.notes.length];
      tone(hz * 2, hz * 2, .67, 'sine', .23, melody.next, music);
      tone(hz, hz, .82, 'triangle', .18, melody.next, music);
      melody.next += .52;
    }
  }
  return { open, effect, update, volume(value) { volume = value; if (ctx) master.gain.setTargetAtTime(value, ctx.currentTime, .08); } };
}
