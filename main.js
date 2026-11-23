import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pet, Ball, makeTreat, makeBowl, makeFoodBowl, makeToyBox, Hearts } from './pet.js?v=22';
import { HandSeer } from './hand.js?v=22';
import { WalkMap } from './walk.js?v=22';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'pip-pet-v1';
const ROSTER_KEY = 'pip-pets-v2';
const roster = loadRoster();
const saved = roster.pets[roster.current] || null;
// Ask the browser to keep our saves even when it's low on space.
try { navigator.storage?.persist?.(); } catch {}

/* ---------------- sound (tiny synth, no files) ---------------- */
let ac = null;
const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
function tone(f0, f1, dur, type = 'sine', vol = 0.18, delay = 0) {
  try {
    const a = audio(), t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
const sfx = {
  chirp: (m = 1) => tone(700 * m, 1250 * m, 0.13),
  happy: () => { tone(800, 1300, 0.1); tone(1000, 1600, 0.1, 'sine', 0.18, 0.12); tone(1200, 2000, 0.14, 'sine', 0.18, 0.24); },
  confused: () => { tone(900, 600, 0.18, 'triangle'); tone(600, 900, 0.18, 'triangle', 0.15, 0.2); },
  nope: () => { tone(500, 300, 0.12, 'square', 0.06); tone(500, 300, 0.12, 'square', 0.06, 0.15); },
  bounce: (v = 1) => tone(160, 90, 0.08, 'sine', 0.25 * v),
  munch: () => { for (let i = 0; i < 4; i++) tone(220 + Math.random() * 80, 120, 0.06, 'square', 0.05, i * 0.13); },
  whoosh: () => tone(300, 1200, 0.18, 'sawtooth', 0.04),
  squeak: () => tone(1500, 2200, 0.09, 'triangle', 0.1),
  joy: () => { const b = 850 + Math.random() * 250; tone(b, b * 1.7, 0.09, 'sine', 0.16); tone(b * 1.2, b * 2, 0.08, 'sine', 0.13, 0.1); if (Math.random() < 0.5) tone(b * 1.5, b * 2.4, 0.1, 'triangle', 0.1, 0.2); },
  bark: () => { tone(620, 380, 0.11, 'square', 0.07); tone(680, 400, 0.11, 'square', 0.07, 0.18); },
  sing: () => { [660, 740, 880, 740, 990, 880].forEach((f, i) => tone(f, f * 1.02, 0.2, 'sine', 0.12, i * 0.22)); },
  purr: () => { for (let i = 0; i < 6; i++) tone(90, 80, 0.09, 'sawtooth', 0.04, i * 0.1); },
};

/* ---------------- three.js setup ---------------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 30);
camera.position.set(0, 0.32, 0.62);
scene.add(camera);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.08, 0);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 0.3; controls.maxDistance = 1.6;
controls.maxPolarAngle = Math.PI * 0.47;

scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 1.3));
const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8, near: 0.1, far: 4 });
sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
scene.add(sun, sun.target);

// Cozy preview room (hidden in AR)
const room = new THREE.Group();
{
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.MeshStandardMaterial({ color: '#3b2c6e', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.55, 64), new THREE.MeshStandardMaterial({ color: '#ff8fb1', roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.002; rug.receiveShadow = true; room.add(rug);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 64), new THREE.MeshStandardMaterial({ color: '#ffd1e0', roughness: 1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; room.add(ring);
  const prop = (geo, color, x, z, y, ry = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; room.add(m); return m;
  };
  prop(new THREE.BoxGeometry(0.3, 0.26, 0.24), '#ffb347', -0.75, -0.55, 0.13, 0.4);            // box
  prop(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 40), '#7c5cff', 0.7, -0.7, 0.06);          // cushion
  prop(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 32), '#e8e2f5', 0.95, 0.25, 0.1);            // plant pot
  const leaves = prop(new THREE.SphereGeometry(0.17, 24, 16), '#4fc38a', 0.95, 0.25, 0.33); leaves.scale.y = 1.2;
  prop(new THREE.BoxGeometry(0.5, 0.32, 0.18), '#5ad1e6', -0.2, -1.05, 0.16);                  // bench
}
scene.add(room);
const hidingSpots = [new THREE.Vector3(-0.85, 0, -0.78), new THREE.Vector3(0.75, 0, -0.98), new THREE.Vector3(1.12, 0, 0.42), new THREE.Vector3(-0.2, 0, -1.3)];
scene.background = null;
renderer.setClearColor('#1a1240', 1);

// AR helpers
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.32 }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.receiveShadow = true; shadowCatcher.visible = false; scene.add(shadowCatcher);
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);

const hearts = new Hearts(); scene.add(hearts);
const emotes = new THREE.Group(); scene.add(emotes);

/* ---------------- state ---------------- */
let pet = null;
let mode = 'create';               // create | play | ar
let floorY = 0;
let placed = false;
const thrown = [];                 // flying / resting items
let inHand = null;                 // item held in front of camera
let hideGame = null;               // { since }
let nextMischief = 45;
const skills = { come: 0.55, sit: 0.25, spin: 0.15, hop: 0.3, fetch: 0.45, hide: 0.2, sleep: 0.3, down: 0.3, stay: 0.3, jumphigh: 0.2,
  paw: 0.3, highfive: 0.2, wave: 0.15, speak: 0.4, rollover: 0.1, playdead: 0.1, beg: 0.2, bow: 0.15, dance: 0.25, sing: 0.2,
  chasetail: 0.35, backflip: 0.05, shy: 0.2, kiss: 0.6, sniff: 0.5, shakeoff: 0.4, up: 0.35, follow: 0.6, cleanup: 0.35, hopin: 0.8 };
const DEFAULT_SKILLS0 = { ...skills };
Object.assign(skills, saved?.skills || {});
let lastSuccess = null;

/* ---------------- needs: food, water, energy, happiness, tummy ---------------- */
const needs = { hunger: 80, thirst: 80, energy: 90, fun: 70, tummy: 0, ...(saved?.needs || {}) };
let sick = !!saved?.sick;
{ // Time passes while the app is closed (gently).
  const away = saved?.at ? Math.min(6 * 3600, (Date.now() - saved.at) / 1000) : 0;
  needs.hunger = Math.max(15, needs.hunger - away * 0.004);
  needs.thirst = Math.max(15, needs.thirst - away * 0.005);
  needs.energy = Math.min(100, needs.energy + away * 0.02);
  needs.tummy = Math.max(0, needs.tummy - away / 90);
}
const clamp01 = (v) => Math.max(0, Math.min(100, v));
function spend(kind, amt) { needs[kind] = clamp01(needs[kind] - amt); }
let needTalk = 12;
let napStart = 0;
let bowl = null;

function updateNeeds(dt) {
  if (!pet?.parent || mode === 'create') return;
  const sleeping = pet.state === 'sleep';
  needs.hunger = clamp01(needs.hunger - dt * 0.12);
  needs.thirst = clamp01(needs.thirst - dt * (pet.state === 'walk' ? 0.3 : 0.15));
  needs.fun = clamp01(needs.fun - dt * 0.08);
  needs.tummy = Math.max(0, needs.tummy - dt / 90);
  if (sleeping) needs.energy = clamp01(needs.energy + dt * 6);
  else needs.energy = clamp01(needs.energy - dt * (pet.state === 'walk' ? 0.25 : 0.06));

  // Too many cookies → tummy ache. Water + a nap make it better.
  if (!sick && needs.tummy >= 4) {
    sick = true; pet.state = 'idle'; pet.target = null;
    emote('ugh…', '#b7d98a'); sfx.confused();
    toast(`${look.name} had too many treats and has a tummy ache 🤢`);
  }
  if (sick && sleeping && needs.thirst > 60 && performance.now() - napStart > 12000) {
    sick = false; needs.tummy = 0;
    pet.state = 'idle'; pet.happy(3); emote('All better!', '#7ee08a');
    toast(`${look.name} feels better! 💚`);
  }
  // Waking up from a nap on its own.
  if (sleeping && !sick && needs.energy >= 100 && !pet.inBed) { pet.state = 'idle'; pet.hop(); emote('!'); }
  // Exhausted → falls asleep by itself.
  if (!sleeping && needs.energy < 6 && ['idle', 'sit'].includes(pet.state) && !hideGame) { goToBedAndNap(); }

  pet.setCondition({ sick, tired: needs.energy < 25 });

  // Say what it needs, every so often.
  needTalk -= dt;
  if (needTalk < 0 && !sleeping && !hideGame) {
    needTalk = 9 + Math.random() * 6;
    if (sick) emote(needs.thirst < 60 ? 'water…' : 'tummy hurts', '#b7d98a');
    else if (needs.thirst < 25) emote('thirsty…', '#5ad1e6');
    else if (needs.hunger < 25) emote('hungry… dinner?', '#ffd25e');
    else if (needs.energy < 25) emote('*yawn*');
    else if (needs.fun < 25) emote('play?', '#ff7eb3');
  }
}
function goNap() { pet.target = null; pet.sleep(); napStart = performance.now(); emote('z z z'); }

let meterTick = 0;
function updateMeters(dt) {
  meterTick -= dt; if (meterTick > 0) return; meterTick = 0.4;
  const set = (id, v) => { const b = $(id); b.style.width = `${v}%`; b.style.background = v < 25 ? '#ff6b6b' : v < 50 ? '#ffd25e' : '#7ee08a'; };
  set('mHunger', needs.hunger); set('mThirst', needs.thirst); set('mEnergy', needs.energy); set('mFun', needs.fun);
  const st = $('status');
  const msg = sick ? `${look.name} has a tummy ache 🤢 — water and a nap` : pet?.state === 'sleep' ? `${look.name} is napping 😴` : needs.energy < 25 ? `${look.name} is tired 🥱` : '';
  st.hidden = !msg; st.textContent = msg;
  persist();
}

/* ---------------- creator ---------------- */
const PART_KEYS = ['color', 'belly', 'ears', 'earColor', 'feetColor', 'maneColor', 'wingColor', 'snout', 'nose', 'tail', 'pattern', 'extra'];
const look = { animal: 'blob', eyes: 1, accessory: 'none', name: 'Pip', ...strip(Pet.ANIMALS.blob), ...(saved?.look || {}) };
function strip(a) { const { emoji, ...rest } = a; return rest; }
const COLORS = ['#ff9f6e', '#ff7eb3', '#ffb3c7', '#8f7bff', '#5ad1e6', '#7ee08a', '#5ac88a', '#ffd25e', '#ffcc66', '#e0a96d', '#8a5a33', '#c9c3d6', '#9aa3ad', '#f4f1f8', '#2a2a3a', '#ff5252'];
const BELLIES = ['#ffe2c4', '#ffffff', '#fff1dc', '#ffd1e0', '#e8ffd9', '#d9d2ff', '#d9b48a', '#2a2a3a'];
const PARTS = [
  ['Ears', 'ears', [['pointy', 'Pointy'], ['round', 'Round'], ['bunny', 'Bunny'], ['floppy', 'Floppy'], ['koala', 'Fluffy'], ['mouse', 'Big round'], ['tiny', 'Tiny'], ['tufts', 'Tufts'], ['none', 'None']]],
  ['Eyes', 'eyes', [[0.8, 'Small'], [1, 'Normal'], [1.3, 'Big'], [1.6, 'Huge']]],
  ['Snout', 'snout', [['none', 'None'], ['dog', 'Puppy'], ['bear', 'Bear'], ['pig', 'Piggy'], ['beak', 'Beak']]],
  ['Nose', 'nose', [['pink', 'Pink'], ['black', 'Black'], ['koala', 'Big'], ['none', 'None']]],
  ['Tail', 'tail', [['puff', 'Puff'], ['long', 'Long'], ['fluffy', 'Fluffy'], ['curly', 'Curly'], ['thin', 'Thin'], ['spiky', 'Dragon'], ['none', 'None']]],
  ['Pattern', 'pattern', [['none', 'None'], ['spots', 'Spots'], ['stripes', 'Stripes'], ['panda', 'Eye patches'], ['mask', 'Face mask']]],
  ['Extra', 'extra', [['none', 'None'], ['whiskers', 'Whiskers'], ['mane', 'Mane'], ['horn', 'Horn'], ['unicorn', 'Unicorn'], ['horns', 'Horns'], ['wings', 'Wings'], ['dragon', 'Dragon'], ['frogeyes', 'Frog eyes']]],
];
const STYLES = [['none', 'Nothing'], ['bow', '🎀 Bow'], ['santa', '🎅 Santa hat'], ['scarf', '🧣 Scarf'], ['partyhat', '🥳 Party hat'], ['crown', '👑 Crown'], ['glasses', '👓 Glasses'], ['flower', '🌼 Flower']];
let tab = 'animal';

function buildCreator() {
  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => { tab = b.dataset.tab; renderTab(); };
  // Slide the builder down to see your whole pet, and back up to edit.
  $('slideBtn').onclick = () => {
    const c = document.querySelector('.creator'); c.classList.toggle('mini');
    $('slideBtn').textContent = c.classList.contains('mini') ? '⌃ Edit' : '⌄';
    frameCamera('create');
  };
  $('name').value = look.name;
  $('name').oninput = () => { look.name = $('name').value.trim() || 'Pip'; persist(); };
  $('randomBtn').onclick = () => {
    const names = Object.keys(Pet.ANIMALS);
    pickAnimal(names[Math.floor(Math.random() * names.length)], false);
    if (Math.random() < 0.6) look.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    look.accessory = STYLES[Math.floor(Math.random() * STYLES.length)][0];
    look.eyes = [0.8, 1, 1.3, 1.6][Math.floor(Math.random() * 4)];
    refreshPet(); renderTab();
  };
  renderTab();
}
function pickAnimal(key, refresh = true) {
  for (const k of PART_KEYS) delete look[k];
  Object.assign(look, strip(Pet.ANIMALS[key])); look.animal = key;
  if (refresh) { refreshPet(); renderTab(); }
}
function renderTab() {
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  const box = $('tabbody'); box.innerHTML = '';
  const label = (t) => { const l = document.createElement('div'); l.className = 'opt-label'; l.textContent = t; box.appendChild(l); };
  const grid = () => { const g = document.createElement('div'); g.className = 'grid'; box.appendChild(g); return g; };
  if (tab === 'pets') {
    label('My pets — tap to switch'); const g = grid();
    for (const [id, d] of Object.entries(roster.pets)) {
      const a = Pet.ANIMALS[d.look?.animal] || Pet.ANIMALS.blob;
      g.appendChild(chip(`${a.emoji} ${d.look?.name || 'Pip'}`, () => { if (id !== roster.current) switchPet(id); }, id === roster.current));
    }
    g.appendChild(chip('＋ New pet', newPet));
    label('Keep them safe'); const g2 = grid();
    g2.appendChild(chip('💾 Save backup', backupPets));
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json'; inp.hidden = true;
    inp.onchange = () => inp.files[0] && restorePets(inp.files[0]); box.appendChild(inp);
    g2.appendChild(chip('📂 Restore', () => inp.click()));
    g2.appendChild(chip('🗑 Remove this pet', deletePet));
    const note = document.createElement('p'); note.className = 'note'; note.style.textAlign = 'left';
    note.textContent = 'Your pets save automatically on this phone. Save a backup to keep them if you clear your browser.';
    box.appendChild(note);
  } else if (tab === 'animal') {
    const g = grid();
    for (const [k, a] of Object.entries(Pet.ANIMALS)) {
      const b = document.createElement('button'); b.className = 'animal' + (look.animal === k ? ' on' : ''); b.textContent = a.emoji; b.title = k;
      b.onclick = () => pickAnimal(k); g.appendChild(b);
    }
  } else if (tab === 'colors') {
    label('Body'); let g = grid();
    for (const c of COLORS) g.appendChild(swatch(c, look.color === c, () => { look.color = c; refreshPet(); renderTab(); }));
    label('Tummy'); g = grid();
    for (const c of BELLIES) g.appendChild(swatch(c, look.belly === c, () => { look.belly = c; refreshPet(); renderTab(); }));
  } else if (tab === 'parts') {
    for (const [name, key, opts] of PARTS) {
      label(name); const g = grid();
      for (const [v, l] of opts) g.appendChild(chip(l, () => { look[key] = v; if (key === 'ears') delete look.earColor; refreshPet(); renderTab(); }, look[key] === v));
    }
  } else {
    label('Wear something'); const g = grid();
    for (const [v, l] of STYLES) g.appendChild(chip(l, () => { look.accessory = v; refreshPet(); renderTab(); }, look.accessory === v));
  }
}
function swatch(c, on, fn) { const b = document.createElement('button'); b.className = 'swatch' + (on ? ' on' : ''); b.style.background = c; b.onclick = fn; return b; }
function chip(label, fn, on = false) { const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b; }
function mark() { renderTab(); }
function refreshPet() {
  if (typeof roster !== 'undefined' && pet) setTimeout(persist, 0);
  const keep = pet ? { p: pet.position.clone(), r: pet.rotation.y } : null;
  if (pet) scene.remove(pet);
  pet = new Pet(sfx, look);
  pet.onHearts = (p, n) => hearts.burst(p, n);
  pet.onEmote = (p, text) => emote(text);
  if (keep) { pet.position.copy(keep.p); pet.rotation.y = keep.r; }
  scene.add(pet);
  sfx.chirp(1 + Math.random() * 0.3);
}

/* ---------------- emote bubbles ---------------- */
function emote(text, color = '#ffffff') {
  if (!pet) return;
  for (const old of [...emotes.children]) old.life = Math.max(old.life, 1.3);   // fade the previous bubble
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '800 64px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = 'rgba(20,12,50,.85)'; g.strokeText(text, 128, 66);
  g.fillStyle = color; g.fillText(text, 128, 66);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 10;
  s.scale.set(0.14, 0.07, 1);
  s.position.copy(pet.localToWorld(new THREE.Vector3(0, 0.26, 0)));
  s.life = 0; emotes.add(s);
}
function updateEmotes(dt) {
  for (const s of [...emotes.children]) {
    s.life += dt; s.position.y += dt * 0.05;
    s.material.opacity = s.life < 1.2 ? 1 : Math.max(0, 1 - (s.life - 1.2) / 0.5);
    if (s.life > 1.7) { emotes.remove(s); s.material.map.dispose(); s.material.dispose(); }
  }
}

/* ---------------- play modes ---------------- */
async function startPlay() {
  mode = 'play';
  audio().resume?.();
  $('create').hidden = true; $('hud').hidden = false;
  setNames();
  pet.position.set(0, 0, 0); pet.rotation.y = 0;
  frameCamera('play');
  controls.enabled = false;   // the cartoon room camera stays still — no spinning
  persist();
  armKnock(); setTimeout(greet, 400);
  startTutorial();
}

/* ---------------- cartoon room = a calm, step-by-step lesson ---------------- */
const TUT = [
  { id: 'pat',   icon: '👋', text: () => `Say hi! Tap ${look.name} to give a pat.` },
  { id: 'ball',  icon: '🎾', btn: 'ballBtn', text: () => `Tap 🎾 Ball. Then swipe up to throw it.`, held: () => `Now swipe up on the screen to throw!` },
  { id: 'food',  icon: '🥕', btn: 'waterBtn', text: () => `${look.name} is hungry. Tap 🍽️ Food for dinner.` },
  { id: 'trick', icon: '🎤', btn: 'micBtn', text: () => `Teach a trick! Tap 🎤 and say “${look.name}, sit!”`, skip: 'Use a button instead' },
  { id: 'bed',   icon: '🛏️', btn: 'bedBtn', text: () => `Time for bed. Tap 🛏️ Bed.`, held: () => `Now tap a spot on the floor for the bed.` },
  { id: 'done',  icon: '🎉', text: () => `You did it! ${look.name} loves you.` },
];
let tutI = -1;
function startTutorial() { tutI = 0; $('tut').hidden = false; showTut(); }
function endTutorial() {
  tutI = -1; $('tut').hidden = true;
  for (const el of document.querySelectorAll('.pulse')) el.classList.remove('pulse');
}
function showTut(sub = false) {
  const s = TUT[tutI]; if (!s) return endTutorial();
  for (const el of document.querySelectorAll('.pulse')) el.classList.remove('pulse');
  if (s.btn && !sub) { const b = $(s.btn); b.classList.add('pulse'); b.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }
  $('tutIcon').textContent = s.icon;
  $('tutText').textContent = sub && s.held ? s.held() : s.text();
  $('tutDots').innerHTML = TUT.slice(0, -1).map((_, i) => `<i class="${i < tutI ? 'done' : i === tutI ? 'now' : ''}"></i>`).join('');
  const go = $('tutGo'), skip = $('tutSkip');
  if (s.id === 'done') {
    const canRoom = !$('goAR').hidden;
    go.hidden = false; go.textContent = canRoom ? `Bring ${look.name} into my room ✨` : 'Keep playing';
    go.onclick = () => { endTutorial(); if (canRoom) { $('exitBtn').onclick(); $('goAR').onclick(); } };
    skip.textContent = 'Close'; skip.onclick = endTutorial;
  } else if (s.id === 'trick') {
    // Voice might not work in every browser — the Sit button teaches it too.
    go.hidden = false; go.textContent = '🐾 Sit button'; go.onclick = () => { doTrick('sit', true); success('sit'); tutDone('trick'); };
    skip.textContent = 'Skip'; skip.onclick = () => tutDone('trick');
  } else {
    go.hidden = true;
    skip.textContent = tutI === 0 ? 'Skip lesson' : 'Skip'; skip.onclick = () => (tutI === 0 ? endTutorial() : tutDone(s.id));
  }
}
function tutDone(id) {
  if (tutI < 0 || TUT[tutI]?.id !== id) return;
  tutI++; sfx.happy?.();
  setTimeout(() => { if (tutI >= 0) showTut(); }, 900);   // a beat to enjoy it before the next step
}
function tutHeld(id) { if (tutI >= 0 && TUT[tutI]?.id === id) showTut(true); }

async function startAR() {
  audio().resume?.();
  const base = { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: $('ui') } };
  // Ask for depth sensing so the pet can hide behind your real furniture; fall back without it.
  const withDepth = { ...base, optionalFeatures: [...base.optionalFeatures, 'depth-sensing'],
    depthSensing: { usagePreference: ['cpu-optimized', 'gpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] } };
  const session = await navigator.xr.requestSession('immersive-ar', withDepth)
    .catch(() => navigator.xr.requestSession('immersive-ar', base))
    .catch(() => null);
  if (!session) { xrOK = false; return startCam(); }   // full AR didn't start — use camera mode instead
  camera.clearViewOffset();
  mode = 'ar'; placed = false;
  room.visible = false; shadowCatcher.visible = true; controls.enabled = false;
  renderer.setClearColor('#000000', 0);
  $('create').hidden = true; $('hud').hidden = false; setNames();
  $('ui').style.pointerEvents = 'auto';   // so swipes in AR reach our handlers
  scene.remove(pet);
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  hitSource = await session.requestHitTestSource({ space: viewer });
  depthCPU = session.depthUsage === 'cpu-optimized';
  floorMap.length = 0; $('roomChip').hidden = false; $('roomCount').textContent = '0';
  toast('Slowly point your phone at the floor…');
  session.addEventListener('end', () => {
    $('ui').style.pointerEvents = '';
    $('roomChip').hidden = true; pet.setVisibility(1); stopHideBuzz(); setWalk(false); setVoiceOnly(false); placed = false; hideGame = null;
    hitSource = null; mode = 'create'; room.visible = true; shadowCatcher.visible = false; controls.enabled = true; reticle.visible = false;
    renderer.setClearColor('#1a1240', 1); frameCamera('create');
    $('hud').hidden = true; $('create').hidden = false; scene.add(pet); pet.position.set(0, 0, 0); floorY = 0;
    clearThrown(); stopListening();
  });
  // Keep UI taps from also counting as "tap the room".
  for (const el of document.querySelectorAll('#ui button, #ui .pill, #ui .panel')) el.addEventListener('beforexrselect', (e) => e.preventDefault());
}
let hitSource = null;
let depthCPU = false;

/* ---------------- camera mode (phones without full AR): your camera + gyro ---------------- */
let camStream = null, orient = null, alphaOffset = null;
async function startCam() {
  audio().resume?.();
  // Tilt sensors are nice to have — never let them stop the camera from starting.
  try { const DOE = window.DeviceOrientationEvent; if (DOE && typeof DOE.requestPermission === 'function') await DOE.requestPermission(); } catch {}
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('This browser has no camera access'), { name: 'NoCamera' });
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e;
      camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });   // simpler ask for picky phones
    }
  } catch (e) { camHelp(e); return; }
  const v = $('camfeed'); v.srcObject = camStream; v.hidden = false; await v.play().catch(() => {});
  camera.clearViewOffset();
  mode = 'cam'; placed = true; floorY = 0; alphaOffset = null;
  if (!walk) walk = new WalkMap(camera, v); walk.reset();
  room.visible = false; shadowCatcher.visible = true; shadowCatcher.position.y = 0.001; controls.enabled = false;
  renderer.setClearColor('#000000', 0);
  camera.fov = 62; camera.updateProjectionMatrix();
  camera.position.set(0, 1.15, 0); camera.quaternion.identity();
  // A ring of floor around you the pet can roam and hide on.
  floorMap.length = 0;
  for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.75; floorMap.push(new THREE.Vector3(Math.sin(a) * r, 0, -Math.cos(a) * r)); }
  pet.position.set(0, 0, -0.8); pet.rotation.y = 0; pet.scale.setScalar(0.01); pet.popIn = 0;
  $('create').hidden = true; $('hud').hidden = false; setNames();
  addEventListener('deviceorientation', onOrient);
  armKnock(); setTimeout(greet, 300); startHandSeer();
  toast(`Point your phone at the floor — ${look.name} is there! Turn around to look for them.`);
}
function camHelp(e) {
  const blocked = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
  const busy = e?.name === 'NotReadableError' || e?.name === 'AbortError';
  $('camHelpWhy').innerHTML = blocked
    ? 'The camera is blocked for this page. To allow it:<br>1. Tap the 🔒 or ⓘ next to the web address at the top.<br>2. Tap <b>Permissions</b> (or Site settings) → <b>Camera</b> → <b>Allow</b>.<br>3. Come back and tap <b>Try again</b>.'
    : busy ? 'Another app is using the camera. Close the other camera app, then tap <b>Try again</b>.'
    : e?.name === 'NoCamera' ? 'This browser cannot use the camera. Try opening the page in Chrome.'
    : 'The camera did not start. Tap <b>Try again</b>. If it keeps happening, close all tabs and reopen Pip.';
  $('camHelpErr').textContent = `(${e?.name || 'Error'}: ${e?.message || ''})`.slice(0, 160);
  $('camHelp').hidden = false;
}
$('camHelpRetry').onclick = () => { $('camHelp').hidden = true; startCam(); };
$('camHelpTrain').onclick = () => { $('camHelp').hidden = true; startPlay(); };
function onOrient(e) { if (e.alpha == null) return; orient = e; if (alphaOffset == null) alphaOffset = e.alpha; }
const _euler = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _z = new THREE.Vector3(0, 0, 1);
function applyOrientation() {
  if (!orient) return;
  const d2r = Math.PI / 180;
  const screenAngle = (screen.orientation?.angle || 0) * d2r;
  _euler.set(orient.beta * d2r, (orient.alpha - alphaOffset) * d2r, -orient.gamma * d2r, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(_euler).multiply(_q1).multiply(_q0.setFromAxisAngle(_z, -screenAngle));
  // Heavier smoothing keeps the pet from swimming around.
  if (camera.quaternion.angleTo(q) > 0.004) camera.quaternion.slerp(q, 0.22);
}
function stopCam() {
  hand?.stop(); for (const o of handBalls.splice(0)) removeThrown(o);
  petInHand = false; pocketScale = 1; pet.scale.setScalar(1); stayMode = false; $('hopOutBtn').hidden = true;
  zoom = 1; for (const el of [$('camfeed'), canvas]) el.style.transform = '';
  removeEventListener('deviceorientation', onOrient); orient = null;
  camStream?.getTracks().forEach((t) => t.stop()); camStream = null; $('camfeed').hidden = true;
  camera.fov = 55; camera.updateProjectionMatrix();
  room.visible = true; shadowCatcher.visible = false; controls.enabled = true; renderer.setClearColor('#1a1240', 1);
}

/* ---------------- learning your room ---------------- */
// Every floor spot your phone sees gets remembered, so the pet can roam and hide all over the room.
const floorMap = [];
function learnFloor(p) {
  if (placed && Math.abs(p.y - floorY) > 0.08) return;          // only the same floor level
  if (floorMap.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 0.09)) return; // keep ~30cm apart
  if (floorMap.length < 400) { floorMap.push(p.clone()); $('roomCount').textContent = floorMap.length; }
  if (floorMap.length === 12) toast(`${look.name} is learning your room — walk around! 🏠`);
}
let nextRoam = 8;
function maybeRoam(dt) {
  if (stayMode || photoMode || (mode !== 'ar' && mode !== 'cam') || !placed || pet.state !== 'idle' || pet.target || hideGame || inHand || sick || needs.energy < 25) return;
  nextRoam -= dt; if (nextRoam > 0) return;
  nextRoam = 7 + Math.random() * 10;
  const near = floorMap.filter((q) => q.distanceTo(pet.position) < 2.5 && q.distanceTo(pet.position) > 0.4);
  if (!near.length) return;
  travel(near[Math.floor(Math.random() * near.length)]);
  if (Math.random() < 0.3) emote(['sniff sniff', 'ooh?', '♪'][Math.floor(Math.random() * 3)]);
}

/* ---------------- hiding behind real things (depth sensing) ---------------- */
let occl = 1;
function updateOcclusion(frame) {
  if (mode !== 'ar' || !placed || !depthCPU || !frame) { if (occl !== 1) { occl = 1; pet?.setVisibility(1); } return; }
  const ref = renderer.xr.getReferenceSpace();
  const pose = frame.getViewerPose(ref); if (!pose) return;
  const view = pose.views[0];
  let info = null; try { info = frame.getDepthInformation(view); } catch {}
  if (!info) return;
  const xrCam = renderer.xr.getCamera().cameras[0] || camera;
  const pts = [[0, 0.03, 0], [0, 0.1, 0], [0, 0.17, 0], [0.06, 0.08, 0], [-0.06, 0.08, 0]];
  let seen = 0;
  for (const [x, y, z] of pts) {
    const w = pet.localToWorld(new THREE.Vector3(x, y, z));
    const camSpace = w.clone().applyMatrix4(xrCam.matrixWorldInverse);
    const petDepth = -camSpace.z;
    const ndc = w.clone().project(xrCam);
    if (petDepth <= 0 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) { seen++; continue; }
    let real = Infinity;
    try { real = info.getDepthInMeters((ndc.x + 1) / 2, (1 - ndc.y) / 2); } catch {}
    if (!(real > 0) || real + 0.06 > petDepth) seen++;
  }
  const target = seen / pts.length;
  occl += (target - occl) * 0.25;
  pet.setVisibility(Math.max(0, Math.min(1, occl)));
}

const ctrl = renderer.xr.getController(0);
scene.add(ctrl);
let lastThrowAt = 0;
ctrl.addEventListener('select', () => {
  if (mode !== 'ar' || inHand || performance.now() - lastThrowAt < 400) return;
  if (!placed) {
    if (!reticle.visible) return;
    const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    floorY = p.y; pet.position.copy(p); pet.scale.setScalar(0.01); pet.popIn = 0;
    scene.add(pet); placed = true;
    shadowCatcher.position.y = floorY + 0.001;
    greet(); armKnock();
    toast(`Say "${look.name}, come!" or flick a ball`);
    return;
  }
  const ray = new THREE.Raycaster();
  const m = ctrl.matrixWorld;
  ray.ray.origin.setFromMatrixPosition(m);
  ray.ray.direction.set(0, 0, -1).transformDirection(m);
  handleTap(ray);
});

/* ---------------- tables & moving between heights ---------------- */
const tableMap = [];
function learnTable(p) {
  if (!placed) return;
  const h = p.y - floorY;
  if (h < 0.3 || h > 1.25) return;
  if (tableMap.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 0.0625 && Math.abs(q.y - p.y) < 0.1)) return;
  if (tableMap.length < 200) tableMap.push(p.clone());
  if (tableMap.length === 4) toast(`${look.name} spotted a table! Say "jump up!" 🪑`);
}
// Go anywhere, jumping up or down when the height changes.
/* ---------------- real-room obstacles (camera mode) ---------------- */
let walk = null, stuckT = 0;
{ const raw = Pet.prototype.goTo;
  Pet.prototype.goTo = function (point, run = false, cb = null) {
    if (mode !== 'cam' || !walk || this.position.y - floorY > 0.2) return raw.call(this, point, run, cb);
    const goal = walk.nearestFree(new THREE.Vector3(point.x, point.y, point.z));
    const path = walk.plan(this.position, goal) || [goal];
    const step = (i) => raw.call(this, path[i], run, i === path.length - 1 ? cb : () => step(i + 1));
    step(0);
  };
}
// If the pet ends up "inside" a wall or cabinet, walk back out onto the floor.
function unstick(dt) {
  if (!pet?.parent || pet.position.y - floorY > 0.2 || ['leap', 'hiding', 'sleep'].includes(pet.state)) { stuckT = 0; return; }
  stuckT = walk.blocked(pet.position.x, pet.position.z) ? stuckT + dt : 0;
  if (stuckT > 0.8) { stuckT = 0; const p = walk.nearestFree(pet.position); if (p !== pet.position) pet.goTo(p, true); }
  for (const o of thrown) if (!o.held && o.landed && walk.blocked(o.position.x, o.position.z)) { const p = walk.nearestFree(o.position); o.position.x = p.x; o.position.z = p.z; }
}
let placingUp = false, perch = null;
// Where on the furniture did you tap? Follow the tap ray until it passes over
// something that isn't floor; its height there is the furniture top.
function surfaceFromTap(ray) {
  const o = ray.ray.origin, d = ray.ray.direction;
  if (mode !== 'cam') { const hits = tableMap.length ? nearest(tableMap, pet.position, 3) : null; return hits; }
  for (let t = 0.3; t < 4; t += 0.03) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < 0.12) break;
    if (walk && walk.blocked(x, z) && y < 1.2) return new THREE.Vector3(x + d.x * 0.08, y, z + d.z * 0.08);
  }
  // No floor map yet: guess a seat-height surface where you tapped.
  if (d.y < -0.05) { const t = (o.y - 0.45) / -d.y; if (t > 0.3 && t < 3) return new THREE.Vector3(o.x + d.x * t, 0.45, o.z + d.z * t); }
  return null;
}
function hopUp() {
  if (!pet?.parent) return;
  if (petInHand) { hopOut(); setTimeout(hopUp, 900); return; }
  if (!perch) { placingUp = true; placingBowls = null; toast('Tap the top of a table, couch or chair 🛋️'); return; }
  stayMode = false; emote('up!');
  travel(perch, false, () => { pet.hop(); success('up'); });
}
function getDown() {
  if (!onTable()) { emote('?'); return; }
  const f = nearest(floorMap, pet.position, 2) || new THREE.Vector3(pet.position.x + 0.3, floorY, pet.position.z + 0.3);
  travel(f.clone().setY(floorY), false, () => pet.hop());
}
$('upBtn').onclick = () => { if (onTable()) getDown(); else { perch = null; hopUp(); } };
function travel(point, run = false, cb = null) {
  const dy = point.y - pet.position.y;
  if (Math.abs(dy) < 0.1) { pet.goTo(point, run, cb); return; }
  const d = Math.hypot(point.x - pet.position.x, point.z - pet.position.z);
  if (d < 0.75) { pet.leapTo(point, cb); return; }
  // Walk closer at the current height, then jump.
  const dir = new THREE.Vector3(point.x - pet.position.x, 0, point.z - pet.position.z).normalize();
  const near = new THREE.Vector3(point.x - dir.x * 0.4, pet.position.y, point.z - dir.z * 0.4);
  pet.goTo(near, run, () => pet.leapTo(point, cb));
}
function nearest(list, from, maxD = Infinity) {
  let best = null, bd = maxD;
  for (const q of list) { const d = Math.hypot(q.x - from.x, q.z - from.z); if (d < bd) { bd = d; best = q; } }
  return best;
}
const onTable = () => pet && pet.position.y - floorY > 0.2;

/* ---------------- Pip's bed ---------------- */
let bed = null, placingBed = false;
function makeBed() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 16, 40), new THREE.MeshStandardMaterial({ color: '#7c5cff', roughness: 0.9 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.03; rim.castShadow = rim.receiveShadow = true;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#ffd1e0', roughness: 1 }));
  pad.position.y = 0.015; pad.receiveShadow = true;
  g.add(rim, pad); return g;
}
$('bedBtn').onclick = () => {
  placingBed = true; tutHeld('bed');
  toast(`Tap a spot on the floor for ${look.name}'s bed 🛏️`);
};
function placeBed(p) {
  placingBed = false;
  if (!bed) bed = makeBed();
  scene.add(bed); bed.position.copy(p); bed.position.y = floorY; bed.scale.setScalar(0.01); bed.pop = 0;
  sfx.happy(); emote('my bed!', '#ff7eb3');
  toast(`Bed placed! Say "take a nap" and ${look.name} will sleep there`);
  persist();
  if (tutI >= 0 && TUT[tutI]?.id === 'bed') setTimeout(() => doTrick('sleep', true), 700);
  tutDone('bed');
}
function nearBed() {
  if (!bed?.parent) return true;
  if (mode === 'ar') { const cp = new THREE.Vector3(); camera.getWorldPosition(cp); return Math.hypot(bed.position.x - cp.x, bed.position.z - cp.z) < 1.4; }
  if (mode === 'cam') return lookAngle() < 0.6;
  return true;
}
function goToBedAndNap() {
  if (bed?.parent) {
    emote('bedtime…'); travel(bed.position.clone().setY(floorY), false, () => { pet.position.copy(bed.position).setY(floorY + 0.03); goNap(); pet.inBed = true; });
  } else goNap();
}
function wakeUp() {
  if (pet.state !== 'sleep') return;
  if (pet.inBed && !nearBed()) { emote('z z z'); toast(`${look.name} is asleep in bed — go over to the bed to wake them up`); return; }
  pet.inBed = false; pet.state = 'idle'; pet.position.y = floorY; pet.trickNow('stretch'); emote('*yawn*');
  setTimeout(() => { if (pet.state === 'idle') { pet.happy(2); emote('Morning!', '#ffd25e'); } }, 1900);
}

/* ---------------- puppy love: asks for pats, you tap your phone ---------------- */
let wantsPat = 0, pats = 0, nextCuddle = 40;
function wantPats() {
  wantsPat = performance.now() + 12000; pats = 0;
  pet.faceYaw = null; pet.sit();
  emote('pat pat? 🥺', '#ff7eb3'); buzz(20);
  toast(`${look.name} wants pats — tap the top of your phone (or tap ${look.name})`);
  armKnock();
}
function pat() {
  if (!pet) return;
  pats++; buzz(25); sfx.joy(); lastPatAt = performance.now();
  hearts.burst(pet.localToWorld(new THREE.Vector3(0, 0.2, 0)), 2);
  pet.state = 'hop'; pet.jump = 0.4;
  needs.fun = clamp01(needs.fun + 6);
  if (pats >= 3) {
    wantsPat = 0; pets_given++; pats = 0;
    setTimeout(() => { pet.happy(3); emote('♥ ♥ ♥', '#ff7eb3'); buzz([30, 40, 30]); }, 250);
    praise();
  } else emote(pats === 1 ? '♥' : '♥♥', '#ff7eb3');
}
let pets_given = 0, lastPatAt = 0;
function petIsClose() {
  if (!pet?.parent || !pet.visible) return false;
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const inView = p.z < 1 && Math.abs(p.x) < 0.75 && Math.abs(p.y) < 0.8;
  if (mode === 'ar') return inView && hideDistance() < 1.3;
  if (mode === 'cam') return inView;
  return inView;
}
function maybeCuddle(dt) {
  if (pats && !wantsPat && performance.now() - lastPatAt > 4000) pats = 0;
  if (wantsPat && performance.now() > wantsPat) { wantsPat = 0; emote('aww…'); }
  if (wantsPat || hideGame || stayMode || photoMode || inHand || sick || pet.state !== 'idle' || pet.target) return;
  nextCuddle -= dt; if (nextCuddle > 0) return;
  nextCuddle = 45 + Math.random() * 45;
  if (needs.fun > 85 && Math.random() < 0.5) return;
  emote('♥?'); travel(frontOfYou(0.35), false, () => wantPats());
}

/* ---------------- puppy personality ---------------- */
let nextQuirk = 6, greeted = false;
function greet() {
  if (greeted) return; greeted = true;
  const away = saved?.at ? (Date.now() - saved.at) / 60000 : 0;
  if (away > 10) {
    emote('Missed you!!', '#ff7eb3'); sfx.happy(); pet.happy(4);
    setTimeout(() => pet.trickNow('chasetail'), 1800);
  } else { emote('Hi!'); pet.happy(2); }
}
function puppyQuirks(dt) {
  if (stayMode || photoMode || hideGame || inHand || wantsPat || pet.state !== 'idle' || pet.target) return;
  nextQuirk -= dt; if (nextQuirk > 0) return;
  nextQuirk = 8 + Math.random() * 10;
  const r = Math.random();
  if (needs.energy < 25) { pet.trickNow('stretch'); emote('*yawn*'); return; }
  // Bored? Bring you the ball.
  const ball = thrown.find((o) => o.kind === 'ball' && !o.held);
  if (needs.fun < 45 && ball && r < 0.6) { emote('play?', '#ff7eb3'); chase(ball, true); return; }
  if (r < 0.25) { pet.trickNow('sniff'); emote('sniff sniff'); }
  else if (r < 0.4) pet.trickNow('scratch');
  else if (r < 0.5) pet.trickNow('shakeoff');
  else if (r < 0.6 && needs.fun > 50) { pet.trickNow('chasetail'); }
  else if (r < 0.72 && tableMap.length && !onTable()) { const t = nearest(tableMap, pet.position, 1.6); if (t) { emote('ooh, up there!'); travel(t, false, () => pet.hop()); } }
  else if (r < 0.8 && onTable()) { const f = nearest(floorMap, pet.position, 2); if (f) travel(f.clone().setY(floorY), false); }
}

/* ---------------- zoom in on the pet when you look down at it ---------------- */
let zoom = 1, zoomOrigin = { x: innerWidth / 2, y: innerHeight / 2 };
function updatePhotoZoom(dt) {
  zoom = 1; canvas.style.transform = '';
  const W = innerWidth, H = innerHeight, z = photoZoom;
  // Where is the pet on the un-zoomed screen? Follow it smoothly.
  if (pet?.parent) {
    _pcam.copy(camera, false); _pcam.clearViewOffset(); _pcam.updateProjectionMatrix(); _pcam.updateMatrixWorld();
    const p = pet.localToWorld(new THREE.Vector3(0, 0.15, 0)).project(_pcam);   // aim at the face
    if (p.z < 1) { photoC.x += ((p.x + 1) / 2 * W - photoC.x) * Math.min(1, dt * 4); photoC.y += ((1 - p.y) / 2 * H - photoC.y) * Math.min(1, dt * 4); }
  }
  // Keep the zoomed window inside the screen.
  photoC.x = Math.min(W - W / (2 * z), Math.max(W / (2 * z), photoC.x));
  photoC.y = Math.min(H - H / (2 * z), Math.max(H / (2 * z), photoC.y));
  const v = $('camfeed');
  if (z > 1.001) {
    camera.setViewOffset(W, H, photoC.x - W / (2 * z), photoC.y - H / (2 * z), W / z, H / z);
    v.style.transformOrigin = '0 0'; v.style.transform = `translate(${(W / 2 - photoC.x * z).toFixed(1)}px, ${(H / 2 - photoC.y * z).toFixed(1)}px) scale(${z.toFixed(3)})`;
  } else { camera.clearViewOffset(); v.style.transform = ''; }
}
function updateZoom(dt) {
  if (photoMode) { updatePhotoZoom(dt); return; }
  let want = 1;
  if (mode === 'cam' && pet?.parent && pet.visible && !petInHand && pet.state !== 'leap') {
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
    const centered = p.z < 1 && Math.abs(p.x) < 0.4 && Math.abs(p.y) < 0.45;
    if (centered && fwd.y < -0.4) {
      want = 1.35;
      zoomOrigin.x += (((p.x + 1) / 2) * innerWidth - zoomOrigin.x) * Math.min(1, dt * 3);
      zoomOrigin.y += (((1 - p.y) / 2) * innerHeight - zoomOrigin.y) * Math.min(1, dt * 3);
    }
  }
  zoom += (want - zoom) * Math.min(1, dt * 2.5);
  const t = Math.abs(zoom - 1) < 0.003 ? '' : `scale(${zoom.toFixed(3)})`;
  for (const el of [$('camfeed'), canvas]) { el.style.transformOrigin = `${zoomOrigin.x}px ${zoomOrigin.y}px`; el.style.transform = t; }
}
// Undo the zoom for tap positions.
function unzoom(x, y) { return { x: zoomOrigin.x + (x - zoomOrigin.x) / zoom, y: zoomOrigin.y + (y - zoomOrigin.y) / zoom }; }

/* ---------------- tapping the scene (preview) ---------------- */
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || photoMode || (mode !== 'play' && mode !== 'cam')) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  if (moved < 8 && performance.now() - downAt.t < 400) {
    const ray = new THREE.Raycaster();
    const u = unzoom(e.clientX, e.clientY);
    ray.setFromCamera(new THREE.Vector2((u.x / innerWidth) * 2 - 1, -(u.y / innerHeight) * 2 + 1), camera);
    handleTap(ray);
  }
  downAt = null;
});

function handleTap(ray) {
  if (!pet) return;
  if (placingBowls) {
    const which = placingBowls; placingBowls = null;
    const hp = new THREE.Vector3();
    let p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY), hp) ? hp : frontOfYou(0.6);
    if (mode === 'cam') { p = clampToPlay(p); if (walk) p = walk.nearestFree(p); }
    placeBowls(which, p); return;
  }
  if (placingUp) { placingUp = false; const s = surfaceFromTap(ray); if (!s) { toast('Hmm, tap right on the top of the table, couch or chair'); return; } perch = s; hopUp(); return; }
  if (placingBed) {
    const hp = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY), hp)) placeBed(mode === 'cam' ? clampToPlay(hp) : hp);
    else if (mode === 'cam') placeBed(frontOfYou(0.9));
    return;
  }
  if (ray.intersectObject(pet, true).length) {
    if (hideGame) return foundPet();
    if (pet.state === 'sleep') { pet.hop(); emote('!'); return; }
    if (wantsPat) { pat(); tutDone('pat'); return; }
    sfx.squeak(); pet.happy(2); emote('♥', '#ff7eb3');
    praise(); tutDone('pat');
    return;
  }
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY), hit)) {
    if (hideGame) return;
    travel(mode === 'cam' ? clampToPlay(hit) : hit);
  }
}

/* ---------------- throwing: hold an item, then swipe or flick ---------------- */
function holdItem(kind) {
  if (inHand) { camera.remove(inHand); }
  let obj;
  if (kind === 'ball' && handBalls.length) { obj = handBalls.pop(); removeThrown(obj); obj.held = false; obj.userHeld = false; obj.scale.setScalar(1); obj.rotation.set(0, 0, 0); }
  else obj = kind === 'treat' ? makeTreat() : new Ball();
  obj.kind = kind; obj.r = kind === 'treat' ? 0.015 : 0.028;
  obj.position.set(0, -0.1, -0.34);
  if (kind === 'treat') obj.rotation.x = 0.9;
  camera.add(obj);
  inHand = obj;
  controls.enabled = false;   // swipes throw instead of turning the camera
  if (kind === 'ball') tutHeld('ball');
  toast(isTouch ? 'Swipe up — or flick your phone — to throw!' : 'Drag upward to throw!');
  sfx.chirp(1.6);
  armFlick();
}
$('ballBtn').onclick = () => holdItem('ball');
$('treatBtn').onclick = () => holdItem('treat');
let bowlHold = null, bowlHeld = false;
$('waterBtn').addEventListener('pointerdown', () => { bowlHeld = false; bowlHold = setTimeout(() => { bowlHeld = true; removeBowls(); }, 800); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('waterBtn').addEventListener(ev, () => clearTimeout(bowlHold));
$('waterBtn').onclick = () => { if (bowlHeld) return; feed('both'); };
let placingBowls = null;

/* ---------------- photo: Pip smiles, you save the picture ---------------- */
let snapNext = false, snapping = false;
// Photo mode: a viewfinder that zooms in on the pet. The 3D view renders just the zoomed part (stays sharp)
// and the camera picture is scaled to match. photoC = the spot (screen px, unzoomed) the zoom centres on.
var photoMode = false, photoZoom = 1, photoBaseFov = 55;
const photoC = { x: innerWidth / 2, y: innerHeight / 2 }, _pcam = new THREE.PerspectiveCamera();
function enterPhoto() {
  if (mode === 'ar') { takePhoto(); return; }   // full AR has its own camera; just snap
  photoMode = true; photoBaseFov = camera.fov;
  $('hud').classList.add('photo'); $('photoUI').hidden = false; setNames();
  setPhotoZoom(1);
  if (pet && !petInHand && pet.state === 'idle') { pet.target = null; pet.faceYaw = null; pet.sit(); }
}
function exitPhoto() {
  if (!photoMode) return;
  setPhotoZoom(1); photoMode = false;
  camera.clearViewOffset(); camera.fov = photoBaseFov; camera.updateProjectionMatrix();
  $('camfeed').style.transform = '';
  $('hud').classList.remove('photo'); $('photoUI').hidden = true;
}
function setPhotoZoom(z) {
  photoZoom = Math.max(1, Math.min(4, z));
  for (const b of document.querySelectorAll('#zoomBtns button')) b.classList.toggle('on', Math.abs(+b.dataset.z - photoZoom) < 0.25);
}
for (const b of document.querySelectorAll('#zoomBtns button')) b.onclick = () => { setPhotoZoom(+b.dataset.z); sfx.chirp(1 + +b.dataset.z * 0.1); };
$('shutterBtn').onclick = takePhoto;
$('photoExit').onclick = exitPhoto;
// Pinch with two fingers to zoom.
const pinchPts = new Map(); let pinchStart = null;
const pinchDist = () => { const [a, b] = [...pinchPts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('pointerdown', (e) => {
  if (!photoMode) return;
  pinchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinchPts.size === 2) pinchStart = { d: pinchDist(), z: photoZoom };
});
canvas.addEventListener('pointermove', (e) => {
  if (!photoMode || !pinchPts.has(e.pointerId)) return;
  pinchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinchStart && pinchPts.size === 2) setPhotoZoom(pinchStart.z * pinchDist() / Math.max(20, pinchStart.d));
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => { pinchPts.delete(e.pointerId); if (pinchPts.size < 2) pinchStart = null; });
function takePhoto() {
  if (!pet || snapping) return;
  const p = pet.position.clone().project(camera);
  if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) { toast('Point your phone at ' + look.name + ' to take a picture 📸'); return; }
  snapping = true; pet.target = null; pet.faceYaw = null; if (pet.state !== 'sit') pet.sit();
  toast('Say cheese! 📸');
  [3, 2, 1].forEach((n, i) => setTimeout(() => { emote(String(n), '#ffd25e'); sfx.chirp(1 + i * 0.15); }, i * 700));
  setTimeout(() => { pet.state = 'sit'; pet.faceYaw = null; pet.mouthOpen = true; emote('cheese!', '#ff7eb3'); }, 2100);
  setTimeout(() => { for (const e of emotes.children) e.visible = false; snapNext = true; }, 2700);
}
function grabPhoto() {
  const W = canvas.width, H = canvas.height, out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d'), v = $('camfeed');
  if (!v.hidden && v.videoWidth) {
    const pz = photoMode ? photoZoom : 1, k = W / innerWidth;
    const sc = Math.max(W / v.videoWidth, H / v.videoHeight), sw = W / sc / pz, sh = H / sc / pz;
    // The same part of the camera picture you see in the zoomed viewfinder.
    const x0 = (v.videoWidth - W / sc) / 2 + (photoC.x * k - W / (2 * pz)) / sc, y0 = (v.videoHeight - H / sc) / 2 + (photoC.y * k - H / (2 * pz)) / sc;
    g.drawImage(v, pz > 1 ? x0 : (v.videoWidth - sw) / 2, pz > 1 ? y0 : (v.videoHeight - sh) / 2, sw, sh, 0, 0, W, H);
  } else { g.fillStyle = getComputedStyle(document.body).backgroundColor || '#2a1f4a'; g.fillRect(0, 0, W, H); }
  g.drawImage(canvas, 0, 0, W, H);
  for (const e of emotes.children) e.visible = true;
  pet.mouthOpen = false; pet.happy(2); emote('♥', '#ff7eb3'); snapping = false;
  const f = $('snapFlash'); f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; });
  tone(1800, 900, 0.06, 'square', 0.12);
  out.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b), name = look.name.replace(/\W+/g, '') + '-' + new Date().toISOString().slice(0, 19).replace(/\D/g, '') + '.png';
    $('snapImg').src = url; $('snapView').hidden = false;
    $('snapSave').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Saved to your phone 📥'); };
    const file = new File([b], name, { type: 'image/png' });
    $('snapShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $('snapShare').onclick = () => navigator.share({ files: [file] }).catch(() => {});
    $('snapClose').onclick = () => { $('snapView').hidden = true; URL.revokeObjectURL(url); };
  }, 'image/png');
}
$('photoBtn').onclick = enterPhoto;
// Bowls stay where you put them. Ask again and they get refilled.
function feed(which) {
  if (!pet?.parent) return;
  const have = which === 'food' ? foodBowl?.parent : which === 'water' ? bowl?.parent : (foodBowl?.parent || bowl?.parent);
  if (!have) { placingBowls = which; placingUp = false; toast(`Tap the floor where ${which === 'water' ? 'the water bowl' : which === 'food' ? 'the food bowl' : 'the food & water bowls'} should go`); return; }
  if (which !== 'water' && foodBowl?.parent) { foodBowl.food.visible = true; foodBowl.food.scale.setScalar(1); }
  if (which !== 'food' && bowl?.parent) bowl.water.scale.setScalar(1);
  sfx.chirp(0.8); setTimeout(() => tutDone('food'), 2500);
  if (pet.state === 'sleep') { emote('z z z'); return; }
  if (petInHand) { hopOut(); setTimeout(() => goEatOrDrink(which), 900); return; }
  setTimeout(() => goEatOrDrink(which), 400);
}
function removeBowls() {
  let any = false;
  for (const o of [foodBowl, bowl]) if (o?.parent) { o.parent.remove(o); any = true; }
  toast(any ? 'Bowls put away 🧺' : 'No bowls out'); sfx.chirp(0.7);
}

let foodBowl = null;
function placeWater() { placeBowls('water'); }
function placeBowls(which = 'both', at = null) {
  if (!pet?.parent) return;
  setTimeout(() => tutDone('food'), 2500);
  const front = at || frontOfYou(0.45);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const put = (obj, offset) => { scene.add(obj); obj.position.copy(front).addScaledVector(side, offset); obj.position.y = floorY; obj.scale.setScalar(0.01); obj.pop = 0; popping.add(obj); };
  if (which !== 'water') { if (!foodBowl) foodBowl = makeFoodBowl(); foodBowl.food.visible = true; foodBowl.food.scale.setScalar(1); put(foodBowl, which === 'both' ? -0.09 : 0); }
  if (which !== 'food') { if (!bowl) bowl = makeBowl(); bowl.water.scale.setScalar(1); put(bowl, which === 'both' ? 0.09 : 0); }
  sfx.chirp(0.8);
  if (pet.state === 'sleep') { emote('z z z'); return; }
  setTimeout(() => goEatOrDrink(which), 500);
}
function goEatOrDrink(which) {
  if (pet.state === 'sleep' || hideGame) return;
  const wantFood = which !== 'water' && foodBowl?.parent && foodBowl.food.visible && (which === 'food' || needs.hunger <= needs.thirst);
  if (wantFood) {
    travel(foodBowl.position.clone().setY(floorY), needs.hunger < 40, () => {
      pet.state = 'eat'; emote('nom nom'); sfx.munch(); setTimeout(() => sfx.munch(), 700);
      const t0 = performance.now();
      const chew = () => {
        const p = (performance.now() - t0) / 2000;
        foodBowl.food.scale.setScalar(Math.max(0.15, 1 - p * 0.85));
        if (p < 1) return requestAnimationFrame(chew);
        foodBowl.food.visible = false;
        needs.hunger = 100; needs.tummy = Math.max(0, needs.tummy - 1); needs.fun = clamp01(needs.fun + 5);
        pet.state = 'idle'; pet.happy(1); emote('Yum, veggies! 🥕', '#7ee08a');
        if (which === 'both' && needs.thirst < 90 && bowl?.parent) setTimeout(() => goEatOrDrink('water'), 900);
      };
      chew();
    });
    return;
  }
  if (!bowl?.parent) return;
  travel(bowl.position.clone().setY(floorY), needs.thirst < 40, () => {
    pet.state = 'eat'; emote('slurp');
    for (let i = 0; i < 5; i++) tone(500, 380, 0.07, 'sine', 0.12, i * 0.22);
    const t0 = performance.now();
    const drink = () => {
      const p = (performance.now() - t0) / 1600;
      bowl.water.scale.setScalar(Math.max(0.2, 1 - p * 0.8));
      if (p < 1) return requestAnimationFrame(drink);
      needs.thirst = 100; pet.state = 'idle';
      bowl.water.scale.setScalar(1);
      if (sick) { emote('need a nap…', '#b7d98a'); setTimeout(() => { if (sick && pet.state !== 'sleep') goToBedAndNap(); }, 1500); }
      else { pet.happy(1); emote('Ahh!', '#5ad1e6'); }
      if (which === 'both' && foodBowl?.parent && foodBowl.food.visible && needs.hunger < 90) setTimeout(() => goEatOrDrink('food'), 900);
    };
    drink();
  });
}
const popping = new Set();
function updatePops(dt) {
  for (const o of popping) { o.pop = Math.min(1, o.pop + dt * 4); o.scale.setScalar(Math.max(0.01, o.pop)); if (o.pop >= 1) popping.delete(o); }
}

/* ---------------- clean up your toys ---------------- */
let toyBox = null, cleaning = false;
function cleanUp() {
  const left = () => thrown.filter((o) => o.kind === 'ball' && !o.held && !o.userHeld);
  if (!left().length) { emote('all clean!'); return; }
  cleaning = true; stayMode = false; zoomUntil = 0; emote('on it!');
  const next = () => {
    const t = left()[0];
    if (!t || !cleaning) { cleaning = false; pet.happy(2); emote('all clean! ✨', '#7ee08a'); success('cleanup'); return; }
    travel(t.position.clone().setY(floorY), true, () => {
      if (!thrown.includes(t) || t.userHeld) return next();
      t.held = true; scene.remove(t); pet.mouthSlot.add(t); t.position.set(0, 0, 0); sfx.squeak();
      travel(frontOfYou(0.35), true, () => {
        if (hand?.visible && handBalls.length < 3) giveToHand(t); else poof(t);
        pet.hop(); setTimeout(next, 450);
      });
    });
  };
  next();
}
// A toy vanishes with a little sparkle.
function poof(o) {
  const wp = new THREE.Vector3(); o.getWorldPosition(wp);
  o.parent?.remove(o); scene.add(o); o.position.copy(wp); o.held = true;
  hearts.burst(wp.clone().add(new THREE.Vector3(0, 0.03, 0)), 2);
  sfx.chirp(2);
  const t0 = performance.now();
  const shrink = () => {
    const p = (performance.now() - t0) / 350;
    o.scale.setScalar(Math.max(0.001, 1 - p)); o.position.y += 0.004;
    if (p < 1) requestAnimationFrame(shrink); else removeThrown(o);
  };
  shrink();
}

/* ---------------- your hand: the pet puts toys in it, and they stay there ---------------- */
let hand = null;
const handBalls = [];
function giveToHand(o) {
  const wp = new THREE.Vector3(); o.getWorldPosition(wp);
  o.parent?.remove(o); scene.add(o); o.position.copy(wp);
  o.held = true; o.userHeld = true; o.landed = true; o.vel = new THREE.Vector3();
  handBalls.push(o);
  emote('here you go!', '#7ee08a'); sfx.happy(); buzz(30);
}
function handPoint(i) {
  // A spot ~40cm in front of the phone, right where your palm shows on screen.
  const pt = hand.palm, W = innerWidth, H = innerHeight;
  const ndc = new THREE.Vector3(((pt.x + (i - (handBalls.length - 1) / 2) * 34) / W) * 2 - 1, -((pt.y - 30 - i * 6) / H) * 2 + 1, 0.5);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const dir = ndc.unproject(camera).sub(cp).normalize();
  return cp.addScaledVector(dir, 0.4);
}
let handLostAt = 0;
function updateHandBalls(dt) {
  if (!handBalls.length) return;
  if (hand?.visible) {
    handLostAt = 0;
    handBalls.forEach((o, i) => { o.position.lerp(handPoint(i), Math.min(1, dt * 10)); o.rotation.y += dt; });
  } else {
    if (!handLostAt) handLostAt = performance.now();
    if (performance.now() - handLostAt > 1500) {
      // Hand left the picture: the toys drop to the floor.
      for (const o of handBalls.splice(0)) { o.held = false; o.userHeld = false; o.landed = true; o.vel = new THREE.Vector3(0, 0, 0); }
      emote('oops!');
    }
  }
}
/* ---------------- hop in your hand, ride along, hop out ---------------- */
let petInHand = false, handOffset = null, petHandLostAt = 0;
function petHandPoint() {
  const pt = hand.palm, W = innerWidth, H = innerHeight;
  if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return pet.position.clone();
  const ndc = new THREE.Vector3((pt.x / W) * 2 - 1, -((pt.y + 20) / H) * 2 + 1, 0.5);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const dir = ndc.unproject(camera).sub(cp).normalize();
  return cp.addScaledVector(dir, 0.42);
}
function hopIn() {
  if (petInHand) { hopOut(); return; }
  if (mode !== 'cam') { toast('Hop-in works in camera mode — tap "Bring it into my room"'); return; }
  startHandSeer();
  if (!hand?.visible) { toast(`Hold your hand out in front of the camera, palm up, then say "hop in"`); emote('?'); return; }
  stayMode = false; zoomUntil = 0;
  emote('ooh!');
  travel(frontOfYou(0.4), true, () => {
    if (!hand?.visible) { emote('where’s your hand?'); return; }
    pet.leapTo(petHandPoint(), () => {
      petInHand = true; stayMode = true; pet.state = 'sit'; pet.faceYaw = null; $('hopOutBtn').hidden = false;
      pocketSize(true);
      emote('♥ comfy!', '#ff7eb3'); sfx.joy(); buzz([20, 30, 20]);
      toast(`${look.name} is in your hand! Walk around — say "hop out" to put them down`);
    });
  });
}
function hopOut() {
  $('hopOutBtn').hidden = true;
  const wasIn = petInHand;
  petInHand = false; stayMode = false; pocketSize(false); petHandLostAt = 0;
  pet.target = null; pet.onArrive = null;
  if (!wasIn) { if (['sit', 'leap'].includes(pet.state)) pet.state = 'idle'; return; }
  // Land on the floor just in front of you, where you can see it.
  let spot = frontOfYou(0.6);
  if (!Number.isFinite(pet.position.x)) pet.position.copy(spot).setY(floorY + 0.3);
  spot.y = floorY;
  pet.leapTo(spot, () => { pet.state = 'idle'; pet.hop(); emote('wheee!', '#ffd25e'); sfx.happy(); });
  // Safety net: whatever happens, it's back to normal a moment later.
  setTimeout(() => { if (!petInHand && pet.state === 'leap') { pet.state = 'idle'; pet.position.copy(spot); } }, 2500);
}
// Shrink a little while in your palm so it fits.
let pocketScale = 1;
function pocketSize(on) { pocketScale = on ? 0.6 : 1; }
function updatePetInHand(dt) {
  const cur = pet.scale.x; const want = pocketScale;
  if (Math.abs(cur - want) > 0.001 && !(pet.popIn < 1)) pet.scale.setScalar(cur + (want - cur) * Math.min(1, dt * 6));
  if (!petInHand) return;
  shadowCatcher.position.y = floorY + 0.001;
  if (hand?.visible) {
    petHandLostAt = 0;
    pet.position.lerp(petHandPoint(), Math.min(1, dt * 9));
    handOffset = camera.worldToLocal(pet.position.clone());
  } else {
    // Hand out of view for a moment: keep it where it was relative to you.
    if (handOffset) pet.position.copy(camera.localToWorld(handOffset.clone()));
    if (!petHandLostAt) petHandLostAt = performance.now();
    if (performance.now() - petHandLostAt > 4000) { hopOut(); }
  }
  if (pet.state !== 'trick' && pet.state !== 'happy') pet.state = 'sit';
}

$('hopOutBtn').onclick = () => hopOut();
function startHandSeer() {
  if (mode !== 'cam') return;
  if (!hand) hand = new HandSeer($('camfeed'));
  hand.start();
}
function removeFromThrownOnly(o) { const i = thrown.indexOf(o); if (i >= 0) thrown.splice(i, 1); }

// Swipe to throw (anywhere on screen)
let swipe = null;
addEventListener('pointerdown', (e) => { if (inHand && !e.target.closest('button')) swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
addEventListener('pointerup', (e) => {
  if (!swipe || !inHand) return;
  const dy = swipe.y - e.clientY, dx = e.clientX - swipe.x, dt = Math.max(30, performance.now() - swipe.t);
  swipe = null;
  if (dy < 40) return;
  const speed = Math.min(1, (dy / dt) / 1.6);          // px/ms → 0..1
  throwHeld(0.08 + speed * 0.92, dx / Math.max(dy, 1));
}, true);
if (!('PointerEvent' in window)) console.warn('No pointer events');

// Flick the phone (accelerometer spike)
let flickArmed = false;
function armFlick() {
  if (flickArmed) return; flickArmed = true;
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') DME.requestPermission().catch(() => {});
  // Watch the whole flick, then throw with its strongest moment (not the first wiggle).
  let flick = null;
  addEventListener('devicemotion', (e) => {
    if (!inHand) { flick = null; return; }
    let mag;
    if (e.acceleration && e.acceleration.x != null) { const a = e.acceleration; mag = Math.hypot(a.x, a.y, a.z); }
    else { const g = e.accelerationIncludingGravity || {}; mag = Math.max(0, Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.8); }
    const now = performance.now();
    if (!flick) { if (mag > 12) flick = { start: now, peak: mag, aim: aimHeading(now - 250) }; return; }
    flick.peak = Math.max(flick.peak, mag);
    if (now - flick.start > 160) {
      const f = flick; flick = null;
      throwHeld(Math.min(1, 0.12 + (f.peak - 12) / 26), 0, f.aim);
    }
  });
}

// Remember which way the phone faced a moment ago, so a sideways flick still throws where you were looking.
const aimHist = [];
function recordAim() {
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  if (Math.hypot(f.x, f.z) < 0.05) return;
  aimHist.push({ t: performance.now(), x: f.x, z: f.z });
  while (aimHist.length > 90) aimHist.shift();
}
function aimHeading(t) {
  let best = null;
  for (const h of aimHist) if (h.t <= t) best = h;
  return best ? { x: best.x, z: best.z } : null;
}
function throwHeld(power, sideways = 0, aim = null) {
  if (!inHand) return;
  const obj = inHand; inHand = null; lastThrowAt = performance.now();
  const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
  camera.remove(obj); scene.add(obj); obj.position.copy(wp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const flat = aim && mode === 'cam' ? new THREE.Vector3(aim.x, 0, aim.z).normalize() : new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
  const right = new THREE.Vector3(-flat.z, 0, flat.x);
  const dir = flat.clone().addScaledVector(right, THREE.MathUtils.clamp(sideways, -0.8, 0.8) * 0.6).normalize();
  // Gentler throws in the cartoon room so the ball stays on screen.
  // In your room a hard flick sends it far — down the hall.
  const sp = mode === 'play' ? 0.8 + power * 1.2 : 0.5 + power * 7.3;
  obj.vel = dir.multiplyScalar(sp).add(new THREE.Vector3(0, mode === 'play' ? 1 + power * 0.6 : 1 + power * 1.8, 0));
  if (obj.kind === 'ball') setTimeout(() => tutDone('ball'), 1500);
  obj.spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0);
  obj.landed = false;
  thrown.push(obj);
  sfx.whoosh();
  if (hideGame) return;
  pet.state = 'idle'; pet.target = null;
  emote(obj.kind === 'treat' ? '!!' : '!');
}

function stepThrown(dt) {
  for (const o of thrown) {
    if (o.held) continue;
    o.vel.y -= 9.8 * dt;
    o.position.addScaledVector(o.vel, dt);
    if (o.spin) { o.rotation.x += o.spin.x * dt; o.rotation.y += o.spin.y * dt; }
    if (o.position.y < floorY + o.r) {
      o.position.y = floorY + o.r;
      const bounce = o.kind === 'treat' ? 0.2 : 0.45;
      const impact = Math.abs(o.vel.y) > 0.6;
      if (impact) sfx.bounce(Math.min(1, Math.abs(o.vel.y) / 4));
      o.vel.y = -o.vel.y * bounce;
      // A real bounce loses some speed; a rolling ball just slows down gently.
      const keep = impact ? 0.65 : o.kind === 'treat' ? Math.max(0, 1 - 6 * dt) : Math.max(0, 1 - 2.2 * dt);
      o.vel.x *= keep; o.vel.z *= keep;
      if (o.spin) o.spin.multiplyScalar(0.6);
      if (Math.abs(o.vel.y) < 0.2) o.vel.y = 0;
      if (o.kind === 'treat') { o.rotation.set(0, o.rotation.y, 0); o.spin = null; }
    }
    // Bounce off real walls and cabinets the camera has seen.
    if (mode === 'cam' && walk && o.position.y < 1.3) {
      const dc = Math.hypot(o.position.x, o.position.z), far = dc > 7;
      if (far || walk.blocked(o.position.x, o.position.z)) {
        o.position.addScaledVector(o.vel, -dt);
        const n = far ? [-o.position.x / dc, -o.position.z / dc] : walk.normal(o.position.x, o.position.z);
        if (n) { const vn = o.vel.x * n[0] + o.vel.z * n[1]; if (vn < 0) { o.vel.x -= 2 * vn * n[0]; o.vel.z -= 2 * vn * n[1]; } } else { o.vel.x = -o.vel.x; o.vel.z = -o.vel.z; }
        o.vel.x *= 0.6; o.vel.z *= 0.6;
        if (Math.hypot(o.vel.x, o.vel.z) > 0.4) sfx.bounce(0.5);
      }
    }
    // keep things in the preview room
    if (mode === 'play') {
      const d = Math.hypot(o.position.x, o.position.z);
      if (d > 1.9) { o.position.x *= 1.9 / d; o.position.z *= 1.9 / d; o.vel.x *= -0.5; o.vel.z *= -0.5; }
    }
    const resting = o.position.y <= floorY + o.r + 0.002 && Math.hypot(o.vel.x, o.vel.z) < 0.05;
    if (resting) o.vel.set(0, 0, 0);
    if (!o.landed && o.position.y <= floorY + o.r + 0.02 && o.vel.y <= 0.3) { o.landed = true; onLanded(o); }
  }
}

function onLanded(o) {
  if (!pet || hideGame || pet.state === 'sleep') return;
  if (o.kind === 'treat') {
    if (sick) { emote('no more treats…', '#b7d98a'); return; }
    travel(o.position, true, () => eatTreat(o));
  } else {
    // Always chases. Whether it brings it back depends on training (and mood).
    const willReturn = Math.random() < 0.35 + (skills.fetch ?? 0.5) * 0.6;
    setTimeout(() => chase(o, willReturn), 250);
  }
}
function chase(o, willReturn = true) {
  if (!thrown.includes(o)) return;
  travel(o.position, true, () => {
    if (o.position.distanceTo(pet.position) > 0.12) return chase(o, willReturn);
    o.held = true; scene.remove(o); pet.mouthSlot.add(o); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); sfx.squeak();
    const drop = (msg) => {
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      pet.mouthSlot.remove(o); scene.add(o); o.position.copy(wp); o.held = false; o.vel = new THREE.Vector3(0, 0.3, 0); o.landed = true;
      emote(msg);
    };
    if (!willReturn) {
      // Keep-away! Runs off with it, then drops it somewhere else.
      emote('Mine!', '#ffd25e'); sfx.nope();
      const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
      const away = pet.position.clone().sub(cp); away.y = 0; away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 2);
      travel(clampToPlay(pet.position.clone().addScaledVector(away, 0.5)), true, () => { drop('hehe'); pet.hop(); skills.fetch = Math.min(1, skills.fetch + 0.02); persist(); });
      return;
    }
    travel(frontOfYou(0.35), true, () => {
      if (hand?.visible && handBalls.length < 3) { giveToHand(o); pet.happy(2); success('fetch'); return; }
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      pet.mouthSlot.remove(o); scene.add(o); o.position.copy(wp); o.held = false; o.vel = new THREE.Vector3(0, 0.3, 0); o.landed = true;
      pet.happy(2); emote('Again?');
      success('fetch');
    });
  });
}
function eatTreat(o) {
  pet.state = 'eat'; sfx.munch();
  const t0 = performance.now();
  const shrink = () => {
    const p = (performance.now() - t0) / 1200;
    o.scale.setScalar(Math.max(0.01, 1 - p));
    if (p < 1) requestAnimationFrame(shrink);
    else {
      removeThrown(o); pet.state = 'idle';
      needs.hunger = clamp01(needs.hunger + 25); needs.fun = clamp01(needs.fun + 5); needs.tummy += 1;
      if (needs.tummy >= 3 && needs.tummy < 4) { emote('so full…', '#ffd25e'); sfx.confused(); }
      else { pet.happy(2); emote('Yum!', '#ffd25e'); }
      praise(true);
    }
  };
  shrink();
}
function removeThrown(o) { const i = thrown.indexOf(o); if (i >= 0) thrown.splice(i, 1); o.parent?.remove(o); }
function clearThrown() { for (const o of [...thrown]) removeThrown(o); if (inHand) { camera.remove(inHand); inHand = null; } }

function frontOfYou(dist = 0.4) {
  if (mode === 'cam') dist = Math.min(Math.max(dist, 0.7), 1.2);
  if (mode === 'play') dist += 0.4;   // cartoon camera sits further back; keep things in view above the buttons
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  return new THREE.Vector3(cp.x + fwd.x * dist, floorY, cp.z + fwd.z * dist);
}

/* ---------------- training: obey sometimes, better with practice ---------------- */
const TRICK_NAMES = {
  come: ['Come', 'come / come back'], sit: ['Sit', 'sit'], down: ['Lie down', 'lie down'], stay: ['Stay', 'stay … then "come"'],
  spin: ['Spin', 'spin'], hop: ['Jump', 'jump'], jumphigh: ['Big jump', 'jump high'], fetch: ['Fetch', 'play catch / get your ball'],
  paw: ['Shake', 'shake / paw'], highfive: ['High five', 'high five'], wave: ['Wave', 'wave / say hi'], speak: ['Speak', 'speak / bark'],
  rollover: ['Roll over', 'roll over'], playdead: ['Play dead', 'play dead / bang'], beg: ['Beg', 'beg'], bow: ['Bow', 'take a bow'],
  dance: ['Dance', 'dance'], sing: ['Sing', 'sing'], chasetail: ['Chase tail', 'chase your tail'], backflip: ['Backflip', 'backflip'],
  shy: ['Peekaboo', 'peekaboo'], kiss: ['Kisses', 'kiss / I love you'], sniff: ['Sniff', 'find it / sniff'], shakeoff: ['Shake off', 'shake it off'],
  hide: ['Hide & seek', 'hide and seek'], sleep: ['Nap', 'take a nap · "wake up" at the bed'], up: ['Jump on table', 'jump up / get down'],
  follow: ['Walk together', "let's go for a walk / follow me"],
  cleanup: ['Clean up', 'clean up your toys'],
  hopin: ['Ride in your hand', 'hold out your hand: hop in · hop out'],
};
function obey(cmd, quiet = false) {
  const s = skills[cmd] ?? 0.3;
  if (sick) { emote('tummy hurts…', '#b7d98a'); sfx.confused(); return false; }
  const tiredPenalty = needs.energy < 25 ? 0.3 : 0;
  if (tiredPenalty && Math.random() < 0.4) { emote('*yawn*'); return false; }
  // A little mischief: sometimes it just runs off!
  if (mode !== 'play' && Math.random() < 0.07 && cmd !== 'fetch' && !tiredPenalty) { runAway(); return false; }
  if (Math.random() < 0.3 + s * 0.65 - tiredPenalty) return true;
  if (!quiet) {
    // Confused: does the wrong thing or tilts its head.
    if (Math.random() < 0.5) { emote('?'); sfx.confused(); }
    else { const wrong = ['hop', 'spin', 'sit'].filter((x) => x !== cmd)[Math.floor(Math.random() * 2)]; doTrick(wrong, true); emote('?'); }
  } else { emote('Meh'); sfx.confused(); }
  skills[cmd] = Math.min(1, s + 0.02); persist();
  return false;
}
function success(cmd) {
  const cost = { fetch: [8, 6, 15], hide: [8, 4, 20], come: [2, 1, 4] }[cmd] || [3, 1, 6];
  spend('energy', cost[0]); spend('thirst', cost[1]); needs.fun = clamp01(needs.fun + cost[2]);
  skills[cmd] = Math.min(1, (skills[cmd] ?? 0.3) + 0.07);
  lastSuccess = { cmd, t: performance.now() };
  persist();
  if (cmd !== 'fetch' && cmd !== 'come') tutDone('trick');
}
function praise(treat = false) {
  if (lastSuccess && performance.now() - lastSuccess.t < 8000) {
    const c = lastSuccess.cmd;
    skills[c] = Math.min(1, skills[c] + (treat ? 0.12 : 0.06));
    toast(`${look.name} is learning "${(TRICK_NAMES[c] || [c])[0]}"  ${stars(skills[c])}`);
    lastSuccess = null; persist();
  }
}
const stars = (v) => '★'.repeat(Math.round(v * 5)) + '☆'.repeat(5 - Math.round(v * 5));
function showTricks() {
  const list = $('tricksList'); list.innerHTML = '';
  for (const [k, [n, say]] of Object.entries(TRICK_NAMES)) {
    const row = document.createElement('div'); row.className = 'trick-row';
    row.innerHTML = `<span>${n}<br><small>"${say}"</small></span><span>${stars(skills[k] ?? 0.3)}</span>`;
    list.appendChild(row);
  }
  document.querySelectorAll('.pn').forEach((e) => (e.textContent = look.name));
  $('tricksSheet').hidden = false;
}
$('petName').onclick = showTricks;
$('tricksBtn').onclick = showTricks;
$('tricksClose').onclick = () => ($('tricksSheet').hidden = true);

function doTrick(cmd, forced = false) {
  if (!forced && !obey(cmd)) return;
  switch (cmd) {
    case 'come': travel(frontOfYou(0.3), false, () => { pet.hop(); success('come'); }); emote('!'); return;
    case 'sit': pet.sit(); break;
    case 'spin': pet.spin(); break;
    case 'hop': pet.hop(); break;
    case 'sleep': goToBedAndNap(); break;
    case 'hide': startHide(); return;
    case 'down': pet.lieDown(); break;
    case 'kiss': emote('♥'); travel(frontOfYou(0.3), true, () => { pet.happy(2); hearts.burst(pet.localToWorld(new THREE.Vector3(0, 0.22, 0)), 8); sfx.happy(); success('kiss'); wantPats(); }); return;
    case 'up': {
      if (mode === 'ar' && !perch) { const t = nearest(tableMap, pet.position, 2.5); if (t) perch = t; }
      hopUp(); return;
    }
    case 'off': getDown(); return;
    default:
      if (Pet.TRICKS[cmd]) {
        pet.trickNow(cmd);
        if (cmd === 'speak') sfx.bark();
        if (cmd === 'sing') sfx.sing();
        if (cmd === 'dance') emote('♪ ♫');
        if (cmd === 'playdead') emote('x_x');
        if (cmd === 'beg') emote('please?');
        if (cmd === 'shy') emote('peekaboo!');
        if (!forced) setTimeout(() => success(cmd), Pet.TRICKS[cmd] * 1000);
        return;
      }
  }
  if (!forced) setTimeout(() => success(cmd), 200);
}

function runAway() {
  emote('Nope!', '#ffd25e'); sfx.nope();
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const away = pet.position.clone().sub(cp); away.y = 0; away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.6);
  const p = clampToPlay(pet.position.clone().addScaledVector(away, 0.6 + Math.random() * 0.4));
  travel(p, true, () => { emote('hehe'); setTimeout(() => { if (pet.state === 'idle' && !hideGame) travel(frontOfYou(0.4)); }, 2500); });
}
function clampToPlay(p) {
  const lim = mode === 'play' ? 1.5 : mode === 'cam' ? 1.35 : Infinity;
  { const d = Math.hypot(p.x, p.z); if (d > lim) { p.x *= lim / d; p.z *= lim / d; } }
  p.y = floorY; return p;
}

/* ---------------- hide and seek ---------------- */
function startHide(self = false) {
  let spot;
  if (mode === 'play') {
    spot = hidingSpots[Math.floor(Math.random() * hidingSpots.length)].clone();
  } else if (floorMap.length > 6) {
    // In your room: pick a learned floor spot that's out of sight, not too far.
    const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
    const options = floorMap.filter((q) => {
      const d = Math.hypot(q.x - cp.x, q.z - cp.z);
      const ndc = q.clone().setY(floorY + 0.08).project(camera);
      const outOfView = ndc.z > 1 || Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.9;
      return d > 1 && d < 4.5 && outOfView;
    });
    const pool = options.length ? options : floorMap.filter((q) => q.distanceTo(pet.position) > 0.8);
    spot = (pool.length ? pool : floorMap)[Math.floor(Math.random() * (pool.length || floorMap.length))].clone();
  } else {
    // Room not learned yet: dash somewhere out of view (to the side or behind you).
    const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const ang = (Math.random() < 0.5 ? 1 : -1) * (1.9 + Math.random() * 0.9);
    const dir = fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    spot = new THREE.Vector3(cp.x + dir.x * 1.3, floorY, cp.z + dir.z * 1.3);
  }
  spot.y = floorY;
  emote(self ? 'Catch me!' : 'Count to 3!', '#ffd25e'); sfx.happy();
  travel(spot, true, () => { pet.state = 'hiding'; });
  hideGame = { since: performance.now() };
  toast(canBuzz
    ? `${look.name} is hiding! Your phone buzzes faster when you're close. Knock knock to tag! 👀`
    : `${look.name} is hiding! Look around to find them 👀`);
  startHideBuzz();
}
function foundPet() {
  hideGame = null; $('arrow').hidden = true; stopHideBuzz();
  buzz([40, 60, 40, 60, 120]);
  pet.state = 'idle'; pet.setVisibility(1); pet.happy(3); emote('Found me!', '#7ee08a');
  toast(`You found ${look.name}! 🎉`);
  success('hide');
}

/* ---------------- buzz: warmer/colder + knock-knock to tag ---------------- */
const canBuzz = 'vibrate' in navigator;
const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };
let buzzTimer = null;
function hideDistance() {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  return Math.hypot(pet.position.x - cp.x, pet.position.z - cp.z);
}
function startHideBuzz() {
  stopHideBuzz();
  const pulse = () => {
    if (!hideGame) return;
    // Nobody looking? After a while it gives up and comes out.
    if (performance.now() - hideGame.since > 75000) {
      hideGame = null; $('arrow').hidden = true; pet.state = 'idle'; pet.setVisibility(1);
      emote('here I am!', '#ffd25e'); travel(frontOfYou(0.4), true, () => pet.happy(2)); return;
    }
    const d = mode === 'ar' ? hideDistance() : mode === 'cam' ? 0.6 + lookAngle() * 1.3 : 1.5;
    if (pet.state === 'hiding') buzz(d < 1 ? 45 : 25);
    // Closer → faster heartbeat.
    buzzTimer = setTimeout(pulse, THREE.MathUtils.clamp(180 + (d - 0.6) * 450, 180, 1600));
  };
  buzzTimer = setTimeout(pulse, 1200);
}
// How far your view is pointing away from the pet (radians).
function lookAngle() {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const to = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).sub(cp).normalize();
  return Math.acos(THREE.MathUtils.clamp(fwd.dot(to), -1, 1));
}
function stopHideBuzz() { clearTimeout(buzzTimer); buzzTimer = null; }

// Knock twice on your phone (two sharp jolts) to tag the hiding pet.
let lastKnock = 0, motionArmed = false, lastPat = 0;
function armKnock() {
  if (motionArmed) return; motionArmed = true;
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') DME.requestPermission().catch(() => {});
  addEventListener('devicemotion', (e) => {
    if (inHand || !pet?.parent) return;
    const a = e.acceleration; if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (mag < 7 || mag > 30) return;   // a knock: sharp but small (a flick is bigger)
    const now = performance.now();
    if (now - lastKnock < 90) return;  // same jolt
    if (wantsPat || (!hideGame && pet.state !== 'sleep' && petIsClose())) { if (now - lastPat > 220) { lastPat = now; pat(); } return; }
    if (!hideGame && pet.state !== 'sleep') return;
    if (now - lastKnock < 550) { lastKnock = 0; knockKnock(); } else lastKnock = now;
  });
}
function knockKnock() {
  if (pet.state === 'sleep') { buzz([30, 50, 30]); wakeUp(); return; }
  if (!hideGame || pet.state !== 'hiding') return;
  const close = mode === 'ar' ? hideDistance() < 1.3 : mode === 'cam' ? lookAngle() < 0.45 : true;
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const inView = p.z < 1 && Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.8;
  if (close && (inView || mode === 'play')) foundPet();
  else { buzz(15); emote('hehe'); toast(close ? 'Close! Point your phone at them and knock again' : 'Not here… keep looking!'); }
}
$('hideBtn').onclick = () => { armKnock(); if (!hideGame) doTrick('hide', true); };

function checkFound() {
  // On screen, you find it by tapping it; in your room, by looking at it.
  if (!hideGame || pet.state !== 'hiding' || mode === 'play') return;
  // Found when it's near the middle of your view and reasonably close.
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  // Spotting it up close (and actually visible, not behind the couch) counts too.
  if (Math.abs(p.x) < 0.3 && Math.abs(p.y) < 0.45 && p.z < 1 && cp.distanceTo(pet.position) < (mode === 'cam' ? 3 : 0.9) && occl > 0.6 && performance.now() - hideGame.since > 2500) foundPet();
}

/* ---------------- voice ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
const COMMANDS = [
  [/\b(take a (picture|photo|pic|selfie)|picture|photo|selfie|say cheese|cheese|smile|snap)\b/, 'photo'],
  [/\b(hop up|climb up|jump up|get up|up there|up on|on the (table|couch|sofa|chair|seat)|onto the)\b/, 'up'],
  [/\b(hop in|hop on (my )?hand|climb in|climb on (my )?hand|jump in|in my hand|up you go|get in)\b/, 'hopin'],
  [/\b(hop out|hop off|hop down|climb out|climb off|climb down|get out|get off|jump out|jump down|all done|i'm done|im done|put you down|down you go|out you go)\b/, 'hopout'],
  [/\b(show (the )?(buttons|controls)|buttons)\b/, 'buttons'],
  [/\b(play catch|catch)\b/, 'fetch'],
  [/\b(follow|follow me|let's go|lets go|walk|heel)\b/, 'follow'],
  [/\b(get (your|the) ball|go get it|bring it|get it)\b/, 'getball'],
  [/\b(roll over|roll)\b/, 'rollover'],
  [/\b(play dead|bang|dead)\b/, 'playdead'],
  [/\b(high five|hi five|high 5|five)\b/, 'highfive'],
  [/\b(shake it off|shake off|wiggle)\b/, 'shakeoff'],
  [/\b(shake|paw|give me (your |a )?paw)\b/, 'paw'],
  [/\b(wave|say (hi|hello|bye)|bye bye)\b/, 'wave'],
  [/\b(speak|bark|woof|say something)\b/, 'speak'],
  [/\b(beg|pretty please)\b/, 'beg'],
  [/\b(dance|boogie|party)\b/, 'dance'],
  [/\b(take a bow|bow)\b/, 'bow'],
  [/\b(lie down|lay down)\b/, 'down'],
  [/\b(chase (your )?tail|tail)\b/, 'chasetail'],
  [/\b(jump high|big jump|higher)\b/, 'jumphigh'],
  [/\b(backflip|back flip|flip)\b/, 'backflip'],
  [/\b(sing|song)\b/, 'sing'],
  [/\b(peekaboo|peek a boo|shy)\b/, 'shy'],
  [/\b(stretch)\b/, 'stretch'],
  [/\b(sniff|smell|find it)\b/, 'sniff'],
  [/\b(kiss|give me a kiss|love you|i love you|cuddle|hug)\b/, 'kiss'],
  [/\b(jump up|up there|on the table|get up)\b/, 'up'],
  [/\b(get down|off the table|come down|off)\b/, 'off'],
  [/\b(come back|come|here|come here|over here)\b/, 'come'],
  [/\b(sit|sit down)\b/, 'sit'],
  [/\b(spin|twirl|turn around)\b/, 'spin'],
  [/\b(jump|hop)\b/, 'hop'],
  [/\b(fetch|ball|throw)\b/, 'fetch'],
  [/\b(clean up|clean|tidy|put (your )?toys away|toys)\b/, 'cleanup'],
  [/\b(remove|put away|take away|pick up|delete|clear)\b.*\b(bowls?|dish(es)?|food|water)\b/, 'nobowls'],
  [/\b(food|dinner|breakfast|lunch|supper|hungry|eat|meal|veggies|vegetables)\b/, 'food'],
  [/\b(treat|bone|snack|chew|cookie)\b/, 'treat'],
  [/\b(water|drink|thirsty)\b/, 'water'],
  [/\b(hide|seek|hiding)\b/, 'hide'],
  [/\b(wake|wake up|rise and shine)\b/, 'wake'],
  [/\b(sleep|nap|rest|bed|night night|goodnight|good night|tired)\b/, 'sleep'],
  [/\b(okay|ok|free|release|go play|break)\b/, 'release'],
  [/\b(good|love|cute|best|great job|nice|yay|good boy|good girl)\b/, 'praise'],
  [/\b(stay|stop|wait|freeze)\b/, 'stay'],
];
/* ---------------- "Pip, come!" — always brings it back to you ---------------- */
function petOnScreen() {
  if (!pet?.parent || !pet.visible) return false;
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  return p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
}
function recall() {
  if (!pet) return;
  if (mode === 'ar' && !placed) { toast('Tap the floor to place your pet first'); return; }
  if (petInHand) { hopOut(); setTimeout(recall, 900); return; }
  // Drop whatever it was doing.
  if (hideGame) { hideGame = null; stopHideBuzz(); $('arrow').hidden = true; }
  stayMode = false; zoomUntil = 0; cleaning = false; wantsPat = 0;
  pocketScale = 1; pet.setVisibility(1); occl = 1;
  if (pet.state === 'sleep') { pet.inBed = false; emote('*yawn*'); }
  pet.target = null; pet.onArrive = null; pet.state = 'idle';
  if (!pet.parent) scene.add(pet);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const far = !Number.isFinite(pet.position.x) || Math.hypot(pet.position.x - cp.x, pet.position.z - cp.z) > 3;
  if (far || !petOnScreen() || pet.scale.x < 0.3) {
    // Lost it? It pops right in front of you.
    const spot = frontOfYou(0.9); spot.y = floorY;
    pet.position.copy(spot); pet.scale.setScalar(0.01); pet.popIn = 0;
    hearts.burst(spot.clone().add(new THREE.Vector3(0, 0.15, 0)), 4);
    emote("I'm here!", '#7ee08a'); sfx.happy();
    setTimeout(() => travel(frontOfYou(0.4), true, () => { pet.hop(); success('come'); }), 600);
  } else {
    emote('coming!'); sfx.chirp(1.3);
    travel(frontOfYou(0.35), true, () => { pet.hop(); success('come'); });
  }
}
$('comeBtn').onclick = () => recall();

function onSpeech(text) {
  const t = text.toLowerCase();
  $('heard').innerHTML = `You said: <b>${escapeHtml(text)}</b>`;
  $('voiceHeard').textContent = `"${text}"`;
  if (!pet || (mode === 'ar' && !placed)) return;
  const hit = COMMANDS.find(([re]) => re.test(t));
  if (!hit) {
    // Just calling its name: if you can't see it, that means "come here".
    if (t.includes(look.name.toLowerCase())) { if (!petOnScreen()) { recall(); return; } emote('?'); sfx.chirp(1.2); pet.target = null; pet.state = pet.state === 'sleep' ? 'idle' : pet.state; }
    else { emote('?'); sfx.confused(); }
    return;
  }
  const cmd = hit[1];
  // "Come" always works — from a nap, from hiding, from anywhere.
  if (cmd === 'come') { recall(); return; }
  if (pet.state === 'sleep' && !['wake', 'praise', 'buttons'].includes(cmd)) { emote('z z z'); return; }
  if (hideGame && cmd !== 'praise') { emote('shh!'); return; }
  const moves = ['come', 'fetch', 'getball', 'follow', 'hide', 'up', 'off', 'water', 'food', 'cleanup', 'treat', 'sleep'];
  if (petInHand && moves.includes(cmd)) { hopOut(); setTimeout(() => onSpeech(text), 900); return; }
  switch (cmd) {
    case 'praise': sfx.happy(); pet.happy(2); emote('♥', '#ff7eb3'); praise(); return;
    case 'wake': wakeUp(); return;
    case 'stay': stayMode = true; zoomUntil = 0; pet.target = null; pet.faceYaw = null; pet.sit(); emote('staying!'); return;
    case 'release': if (petInHand) { hopOut(); return; } stayMode = false; pet.state = 'idle'; pet.happy(1); emote('free!'); return;
    case 'fetch': (voiceOnly || follow) ? autoThrow('ball') : holdItem('ball'); emote('!!'); return;
    case 'buttons': setVoiceOnly(false); if (follow) setWalk(false); return;
    case 'getball': {
      const b = thrown.find((o) => o.kind === 'ball' && !o.held);
      if (!b) { holdItem('ball'); emote('ball?'); return; }
      if (!obey('fetch')) return;
      emote('!'); chase(b, true); return;
    }
    case 'treat': if (sick) { emote('no more treats…', '#b7d98a'); return; } (voiceOnly || follow) ? autoThrow('treat') : holdItem('treat'); emote('!!'); return;
    case 'hopin': hopIn(); return;
    case 'hopout': if (!petInHand && onTable()) { getDown(); return; } hopOut(); return;
    case 'water': feed('water'); return;
    case 'food': feed('food'); return;
    case 'nobowls': removeBowls(); return;
    case 'photo': takePhoto(); return;
    case 'cleanup': cleanUp(); return;
    case 'follow': setWalk(true); return;
    case 'sleep': if (pet.state !== 'sleep') goToBedAndNap(); return;
    default: if (cmd === 'come') { zoomUntil = 0; stayMode = false; } doTrick(cmd);
  }
}
function startListening() {
  if (!SR) { toast('Voice needs Chrome (Android) or Safari'); return; }
  audio().resume?.();
  rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = (e) => { const r = e.results[e.results.length - 1]; if (r.isFinal) onSpeech(r[0].transcript.trim()); };
  rec.onend = () => {
    if (!listening) return;
    setTimeout(() => {
      if (!listening) return;
      try { rec.start(); }
      catch { listening = false; $('micBtn').classList.remove('on'); $('voiceHeard').textContent = 'Mic paused — tap here'; toast('Mic paused — tap 🎤 to keep talking'); }
    }, 250);
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopListening(); toast('Microphone permission is needed to talk'); } /* no-speech / network: onend restarts it */ };
  try { rec.start(); listening = true; $('micBtn').classList.add('on'); $('heard').innerHTML = `Listening… try <b>"${escapeHtml(look.name)}, sit!"</b>`; emote('?'); }
  catch (e) { toast('Could not start the microphone'); }
}
function stopListening() { listening = false; try { rec?.stop(); } catch {} $('micBtn').classList.remove('on'); }
$('micBtn').onclick = () => (listening ? stopListening() : startListening());

/* ---------------- walk together: no controls, the pet follows you ---------------- */
let follow = false, followTick = 0, nextZoomies = 18, zoomUntil = 0;
var stayMode = false;
function setWalk(on) {
  follow = on;
  if (on) armSteps();
  if (!on) stopFollowAnim();
  $('hud').classList.toggle('walking', on);
  $('walkOff').hidden = !on;
  if (on) {
    if (pet.state === 'sleep' || pet.state === 'sit') pet.state = 'idle';
    emote("Let's go!", '#7ee08a'); sfx.happy();
    if (!listening && SR) startListening();   // so "come back!" works hands-free
    toast(`Walk around — ${look.name} follows you. Say "come back!" if they run off`);
  }
}
$('walkBtn').onclick = () => setWalk(true);

/* ---------------- voice-only: hide every button, talk to it ---------------- */
let voiceOnly = false;
function setVoiceOnly(on) {
  voiceOnly = on;
  $('hud').classList.toggle('voiceonly', on);
  $('voiceOff').hidden = !on;
  if (on) {
    if (!listening && SR) startListening();
    toast(`Just talk: "play catch", "want a treat?", "water", "hide and seek", "follow me"`);
  }
}
$('voiceOnlyBtn').onclick = () => setVoiceOnly(true);
$('voiceOff').onclick = () => { setVoiceOnly(false); if (follow) setWalk(false); };
// With no buttons to swipe, voice commands toss things for you.
function autoThrow(kind) {
  holdItem(kind);
  setTimeout(() => throwHeld(0.45 + Math.random() * 0.25, (Math.random() - 0.5) * 0.6), 450);
}
$('walkOff').onclick = () => setWalk(false);

/* ---------------- footsteps (phone motion) ---------------- */
let walkingUntil = 0, lastWalkStop = 0, lastStep = 0, stepEnergy = 0, stepsArmed = false;
function armSteps() {
  if (stepsArmed) return; stepsArmed = true;
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') DME.requestPermission().catch(() => {});
  addEventListener('devicemotion', (e) => {
    const a = e.acceleration || {};
    let mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (!e.acceleration) { const g = e.accelerationIncludingGravity || {}; mag = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81); }
    // Smooth bounce of walking: steady bumps of ~1.2–6 m/s², a few per second.
    stepEnergy += (mag - stepEnergy) * 0.25;
    const now = performance.now();
    if (stepEnergy > 1.1 && stepEnergy < 9 && now - lastStep > 280) {
      lastStep = now;
      walkingUntil = now + 900;
    }
  });
}
function stopFollowAnim() { if (pet) { pet.forceWalk = false; pet.faceYaw = null; } }

function updateFollow(dt) {
  if (!follow || stayMode || !pet?.parent || (mode === 'ar' && !placed)) return;
  if (hideGame || ['sleep', 'eat', 'happy', 'spin', 'hop'].includes(pet.state) || thrown.some((o) => o.held)) return;
  const now = performance.now();
  if (now < zoomUntil) return;                       // off on an adventure

  // Camera mode can't see you move, so we feel your footsteps instead.
  // While you walk, it trots beside your feet, facing where you're heading.
  if (mode === 'cam') {
    const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const walkingNow = now < walkingUntil;
    if (walkingNow) {
      if (['sit', 'down', 'trick'].includes(pet.state)) pet.state = 'idle';
      pet.target = null; pet.onArrive = null;
      pet.forceWalk = true; pet.speed = 0.55;
      pet.faceYaw = Math.atan2(fwd.x, fwd.z);
      const spot = new THREE.Vector3(cp.x, floorY, cp.z).addScaledVector(fwd, 0.85).addScaledVector(side, 0.22);
      pet.position.lerp(spot, Math.min(1, dt * 3));
      lastWalkStop = now;
    } else {
      pet.forceWalk = false;
      // Just stopped: turn and look up at you, then sit after a moment.
      if (now - lastWalkStop > 600) pet.faceYaw = null;
      if (now - lastWalkStop > 2500 && pet.state === 'idle' && !pet.target && Math.random() < 0.01) pet.sit();
      followTick -= dt; if (followTick > 0) return; followTick = 0.4;
      const spot = new THREE.Vector3(cp.x, floorY, cp.z).addScaledVector(fwd, 0.8).addScaledVector(side, 0.2);
      const d = Math.hypot(pet.position.x - spot.x, pet.position.z - spot.z);
      if (d > 0.45) travel(clampToPlay(spot), d > 0.9);
    }
    return;
  }

  followTick -= dt; if (followTick > 0) return; followTick = 0.4;

  // Zoomies: every so often it dashes ahead of you.
  nextZoomies -= 0.4;
  if (nextZoomies < 0 && needs.energy > 40 && !sick) {
    nextZoomies = 20 + Math.random() * 25;
    const ahead = clampToPlay(frontOfYou(mode === 'cam' ? 1.2 : 1.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, 0)));
    emote('zoom!', '#ffd25e'); sfx.chirp(1.6);
    travel(ahead, true, () => { pet.hop(); emote('come get me!'); });
    zoomUntil = now + 5000;
    return;
  }
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const moving = walkSpeed > 0.25;
  // Walking: trot at your side, facing the way you're going (not backwards in front of you).
  // Standing still: sit beside you and look up at you.
  const dir = moving ? walkDir.clone() : fwd;
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const spot = new THREE.Vector3(cp.x, floorY, cp.z).addScaledVector(dir, moving ? 0.35 : 0.55).addScaledVector(side, moving ? 0.45 : 0.3);
  const d = Math.hypot(pet.position.x - spot.x, pet.position.z - spot.z);
  pet.faceYaw = moving ? Math.atan2(dir.x, dir.z) : null;
  if (d > (moving ? 0.25 : 0.5)) travel(clampToPlay(spot), d > 0.9);
  else if (!moving && pet.state === 'idle' && Math.random() < 0.08) pet.sit();
}
// Track how you're walking (for walking side by side).
let walkSpeed = 0; const walkDir = new THREE.Vector3(0, 0, -1); const lastCam = new THREE.Vector3(); let haveLastCam = false;
function trackWalking(dt) {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp); cp.y = 0;
  if (!haveLastCam) { lastCam.copy(cp); haveLastCam = true; return; }
  const v = cp.clone().sub(lastCam); const sp = v.length() / Math.max(dt, 1e-3);
  walkSpeed += (sp - walkSpeed) * Math.min(1, dt * 4);
  if (v.lengthSq() > 1e-6 && sp > 0.15) walkDir.lerp(v.normalize(), Math.min(1, dt * 3)).normalize();
  lastCam.copy(cp);
}

/* ---------------- HUD ---------------- */
function setNames() { $('petName').textContent = look.name; document.querySelectorAll('.pn').forEach((e) => (e.textContent = look.name)); }
$('exitBtn').onclick = () => {
  exitPhoto();
  stopListening(); clearThrown(); hideGame = null; $('arrow').hidden = true; endTutorial(); controls.enabled = true;
  if (mode === 'ar') { renderer.xr.getSession()?.end(); return; }
  if (mode === 'cam') stopCam();
  stopHideBuzz(); pet.setVisibility(1); placed = false; setWalk(false); setVoiceOnly(false);
  mode = 'create'; $('hud').hidden = true; $('create').hidden = false; pet.position.set(0, 0, 0); pet.state = 'idle'; pet.target = null;
  frameCamera('create');
};
$('goPlay').onclick = startPlay;
let xrOK = false;
$('goAR').onclick = () => (xrOK ? startAR() : startCam());
let toastTimer;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }
function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const isTouch = matchMedia('(pointer: coarse)').matches;

function updateArrow() {
  const el = $('arrow');
  if (!pet || !(mode === 'play' || placed) || !pet.parent) { el.hidden = true; return; }
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const behind = p.z > 1;
  const off = behind || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
  if (!off) { el.hidden = true; return; }
  let x = p.x, y = p.y; if (behind) { x = -x; y = -y; }
  const ang = Math.atan2(y, x);
  const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
  const sx = (x / m) * 0.82, sy = (y / m) * 0.7;
  el.hidden = false;
  el.style.left = `${(sx * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-sy * 0.5 + 0.5) * innerHeight}px`;
  el.firstElementChild.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
}

/* ---------------- save ---------------- */
function snapshot() { return { look: { ...look }, skills: { ...skills }, needs: { ...needs }, sick, at: Date.now(), born: roster.pets[roster.current]?.born || Date.now() }; }
function persist() {
  roster.pets[roster.current] = snapshot();
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(roster)); } catch {}
}
function loadRoster() {
  try {
    const r = JSON.parse(localStorage.getItem(ROSTER_KEY) || 'null');
    if (r?.pets && r.current) return r;
  } catch {}
  // First run, or upgrading from the one-pet save.
  let old = null; try { old = JSON.parse(localStorage.getItem('pip-pet-v1') || 'null'); } catch {}
  const id = 'p' + Date.now().toString(36);
  return { current: id, pets: old ? { [id]: { ...old, born: Date.now() } } : {} };
}
const DEFAULT_SKILLS = DEFAULT_SKILLS0;
const DEFAULT_NEEDS = { hunger: 80, thirst: 80, energy: 90, fun: 70, tummy: 0 };
function loadPetData(d) {
  for (const k of Object.keys(look)) delete look[k];
  Object.assign(look, { animal: 'blob', eyes: 1, accessory: 'none', name: 'Pip', ...strip(Pet.ANIMALS.blob), ...(d?.look || {}) });
  Object.assign(skills, DEFAULT_SKILLS, d?.skills || {});
  Object.assign(needs, DEFAULT_NEEDS, d?.needs || {});
  sick = !!d?.sick;
}
function switchPet(id) {
  persist();
  roster.current = id; loadPetData(roster.pets[id]);
  $('name').value = look.name; refreshPet(); renderTab(); persist();
}
function newPet() {
  persist();
  const id = 'p' + Date.now().toString(36);
  roster.current = id;
  loadPetData(null);
  const names = ['Pip', 'Mochi', 'Bean', 'Noodle', 'Pickle', 'Biscuit', 'Peanut', 'Waffles', 'Sprout', 'Bubbles'];
  look.name = names[Object.keys(roster.pets).length % names.length];
  roster.pets[id] = snapshot();
  $('name').value = look.name; tab = 'animal'; refreshPet(); renderTab(); persist();
}
function deletePet() {
  const ids = Object.keys(roster.pets);
  if (ids.length <= 1) { toast('This is your only pet'); return; }
  if (!confirm(`Say goodbye to ${look.name}? This can't be undone.`)) return;
  delete roster.pets[roster.current];
  roster.current = Object.keys(roster.pets)[0];
  loadPetData(roster.pets[roster.current]); $('name').value = look.name; refreshPet(); renderTab();
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(roster)); } catch {}
}
// Backup to a file, and restore from one (in case the browser's data gets cleared).
async function backupPets() {
  persist();
  const blob = new Blob([JSON.stringify({ app: 'pip', version: 2, ...roster }, null, 1)], { type: 'application/json' });
  const file = new File([blob], 'my-pip-pets.json', { type: 'application/json' });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'My Pip pets' }); return; } } catch {}
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-pip-pets.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function restorePets(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.app !== 'pip' || !d.pets) throw new Error('not a Pip backup');
      Object.assign(roster.pets, d.pets);
      roster.current = d.current && d.pets[d.current] ? d.current : Object.keys(d.pets)[0];
      loadPetData(roster.pets[roster.current]); $('name').value = look.name; refreshPet(); tab = 'pets'; renderTab(); persist();
      toast(`Welcome back, ${look.name}! 💖`);
    } catch (e) { toast("That file isn't a Pip backup"); }
  };
  r.readAsText(file);
}

/* ---------------- main loop ---------------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop((time, frame) => { try { tick(time, frame); } catch (e) { console.error(e); healPet(); try { renderer.render(scene, camera); } catch {} } });
function tick(time, frame) {
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === 'ar' && frame && hitSource) {
    const ref = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitSource);
    reticle.visible = false;
    if (hits.length) {
      const pose = hits[0].getPose(ref);
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const up = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(m));
      if (up.y > 0.85) {
        const hp = new THREE.Vector3().setFromMatrixPosition(m);
        learnFloor(hp); learnTable(hp);
        if (!placed) {
          reticle.matrix.copy(m); reticle.visible = true;
          if (!reticle.seen) { reticle.seen = true; toast(`Found the floor! Tap to place ${look.name}`); }
        }
      }
    }
    updateOcclusion(frame);
  }
  const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);

  if (mode === 'create') {
    pet.rotation.y += dt * 0.5;
    pet.update(dt, null);
    controls.update();
  } else {
    if (mode === 'play') controls.update();
    if (mode === 'cam') { applyOrientation(); recordAim(); if (walk && pet) { walk.update(dt, walk.s[walk.idx(pet.position.x, pet.position.z)] > 0.3 ? [pet.position] : []); unstick(dt); } }
    if (pet && pet.parent) {
      if (pet.popIn !== undefined && pet.popIn < 1) { pet.popIn = Math.min(1, pet.popIn + dt * 3); const s = 1 - Math.pow(1 - pet.popIn, 3) * 1; pet.scale.setScalar(Math.max(0.01, s * (1 + Math.sin(pet.popIn * Math.PI) * 0.15))); }
      pet.update(dt, camPos);
    }
    stepThrown(dt);
    checkFound();
    updateNeeds(dt); updateMeters(dt);
    trackWalking(dt);
    if (pet?.parent) {
      if (follow) updateFollow(dt); else { maybeRoam(dt); puppyQuirks(dt); }
      maybeCuddle(dt);
      if (pet.state !== 'leap' && !petInHand) shadowCatcher.position.y = pet.position.y + 0.001;
    }
    updatePops(dt);
    updateZoom(dt);
    updateHandBalls(dt);
    if (pet?.parent) updatePetInHand(dt);
    if (bed && bed.pop !== undefined && bed.pop < 1) { bed.pop = Math.min(1, bed.pop + dt * 4); bed.scale.setScalar(Math.max(0.01, bed.pop)); }
    if (bowl && bowl.pop !== undefined && bowl.pop < 1) { bowl.pop = Math.min(1, bowl.pop + dt * 4); bowl.scale.setScalar(Math.max(0.01, bowl.pop)); }
    // Self-started mischief every so often.
    nextMischief -= dt;
    if (mode !== 'play' && !photoMode && nextMischief < 0 && !stayMode && !wantsPat && pet && pet.parent && pet.state === 'idle' && !hideGame && !inHand && !sick && needs.energy > 30 && thrown.every((o) => !o.held) && (mode !== 'ar' || placed)) {
      armKnock();
      nextMischief = 50 + Math.random() * 50;
      if (Math.random() < 0.5) startHide(true); else runAway();
    }
  }
  // held item wobble
  if (inHand) { inHand.position.y = -0.1 + Math.sin(time / 300) * 0.004; inHand.rotation.y += dt * 1.5; }

  const fp = pet ? pet.position : new THREE.Vector3();
  sun.position.set(fp.x + 0.5, floorY + 1.4, fp.z + 0.4); sun.target.position.copy(fp);
  hearts.update(dt); updateEmotes(dt);
  updateArrow();
  renderer.render(scene, camera);
  if (snapNext) { snapNext = false; grabPhoto(); }
  if (pet && (!Number.isFinite(pet.position.x) || !Number.isFinite(pet.position.y) || !Number.isFinite(pet.position.z))) healPet();
}
function healPet() {
  if (!pet) return;
  petInHand = false; pocketScale = 1; stayMode = false; $('hopOutBtn').hidden = true;
  pet.target = null; pet.onArrive = null; pet.state = 'idle'; pet.setVisibility(1);
  const spot = frontOfYou(0.8); spot.y = floorY; pet.position.copy(spot);
  if (!Number.isFinite(pet.scale.x) || pet.scale.x < 0.3) pet.scale.setScalar(1);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (mode === 'create') frameCamera('create'); });

// Frame the pet above the bottom panel on tall phone screens.
function frameCamera(which) {
  const portrait = innerHeight > innerWidth;
  if (which === 'create') {
    const H = innerHeight, W = innerWidth;
    const top = (document.querySelector('#create .title h1')?.getBoundingClientRect().bottom || 50) + 6;
    const bottom = (document.querySelector('.creator')?.getBoundingClientRect().top || H * 0.6) - 18;
    const freeH = Math.max(120, bottom - top), yc = top + freeH / 2;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // The pet with ears, hats and tails is about 0.34m tall and 0.36m wide; leave a margin.
    const dh = 0.44 * H / (freeH * 2 * tanHalf);
    const dw = 0.4 / (2 * tanHalf * (W / H));
    const d = Math.max(dh, dw, 0.45);
    camera.position.set(0, 0.17, d); controls.target.set(0, 0.11, 0);
    camera.setViewOffset(W, H, 0, H / 2 - yc, W, H);
  }
  // Aim below the pet so it sits in the upper-middle of the screen, clear of the bottom panel.
  // Pet sits mid-screen: clear of the lesson card on top and the buttons below.
  else { camera.clearViewOffset(); camera.position.set(0, 0.55, portrait ? 1.3 : 0.85); controls.target.set(0, portrait ? 0.02 : -0.02, 0.06); }
  controls.update();
}

addEventListener('error', (e) => { try { toast('Oops: ' + (e.message || 'something broke') + ' — say "come" to reset'); } catch {} });
addEventListener('unhandledrejection', (e) => { console.warn(e.reason); });
window.__pip = { get pet() { return pet; }, get thrown() { return thrown; }, THREE };  // handy for testing
/* ---------------- boot ---------------- */
buildCreator();
frameCamera('create');
document.fonts?.ready?.then(() => { if (mode === 'create') frameCamera('create'); });
refreshPet();
persist();   // so a brand-new pet shows up in My pets right away
window.__pipReady = true;
// If the phone takes the 3D away (low memory), save and come back cleanly instead of freezing.
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); persist(); toast('Phone needed a breather — reloading…'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
(async () => {
  xrOK = !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)));
  const hasCam = !!navigator.mediaDevices?.getUserMedia && isTouch;
  $('goAR').hidden = !(xrOK || hasCam);
  if (xrOK || hasCam) { $('goPlay').className = 'big alt'; $('goPlay').textContent = '🎓 Training area'; }
  $('arNote').textContent = xrOK ? 'Full AR: your pet walks on your real floor and learns your room.'
    : hasCam ? 'Uses your camera. (Full AR needs Chrome + Google Play Services for AR.)'
    : 'Open this on your phone to bring your pet into your room.';
})();
