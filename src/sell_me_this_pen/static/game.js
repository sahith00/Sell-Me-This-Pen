import {
  CHARACTER_HEIGHT,
  ITEM_SIZE,
  SELLER_LOOK,
  buyerLook,
  drawCharacter,
  drawIcon,
  drawItem,
  hasIcon,
} from "./sprites.js";

const W = 256;
const H = 240;
const SCALE = 3;
const FONT = "'Press Start 2P', monospace";

const BOX = { x: 4, y: 146, w: 248, h: 90 };
const TEXT_X = 14;
const SPEAKER_Y = 154;
const TEXT_Y = 168;
const LINE_H = 11;
const COLS = 28;
const LINES = 6;
const TYPE_RATE = 45;
const WALK_MS = 900;

const COUNTER = { x: 6, w: 118 };
const SELLER_POS = { x: 36, y: 60 };
const ITEM_POS = { x: 84, y: 100 - ITEM_SIZE * 2 };
const BUYER_HOME = { x: 168, y: 134 - CHARACTER_HEIGHT * 2 };

const COLORS = {
  white: "#fcfcfc",
  yellow: "#f8b800",
  red: "#f83800",
  blue: "#3cbcfc",
  green: "#58d854",
};

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

const els = {
  status: document.getElementById("status"),
  pitchForm: document.getElementById("pitch-form"),
  pitch: document.getElementById("pitch"),
  wordCount: document.getElementById("word-count"),
  sayButton: document.getElementById("say-button"),
  passButton: document.getElementById("pass-button"),
  choices: document.getElementById("choices"),
  buyerDetails: document.getElementById("buyer-details"),
  log: document.getElementById("log"),
  soundToggle: document.getElementById("sound-toggle"),
  titleButton: document.getElementById("title-button"),
};

const view = {
  snapshot: null,
  busy: null,
  dialogue: null,
  mood: "neutral",
  saleAt: 0,
  enterAt: 0,
  retry: null,
};

// --- Server ----------------------------------------------------------------

async function request(path, body) {
  const options =
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        };
  const response = await fetch(path, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `The server answered ${response.status}.`;
    throw new Error(detail);
  }
  return data;
}

// --- Game flow ---------------------------------------------------------------

async function boot() {
  await loadFont();
  requestAnimationFrame(frame);
  setBusy("start");
  try {
    const snapshot = await request("/api/state");
    setBusy(null);
    enter(snapshot);
  } catch (error) {
    setBusy(null);
    showFailure("NO SERVER", error.message, boot);
  }
}

function enter(snapshot) {
  applySnapshot(snapshot);
  switch (snapshot.screen) {
    case "title":
      say(snapshot.saved ? `Saved game: ${snapshot.saved}.` : "No saved game yet. Open the shop!", {
        speaker: "SHOP",
      });
      break;
    case "start":
      startDay();
      break;
    case "day": {
      view.enterAt = performance.now();
      const last = snapshot.day.exchanges.at(-1);
      if (last) {
        view.mood = last.mood;
        say(last.buyer_said, { speaker: snapshot.day.buyer.name, color: COLORS.blue });
      } else {
        introduce(snapshot.day);
      }
      break;
    }
    case "between":
      view.mood = snapshot.day.exchanges.at(-1)?.mood ?? "neutral";
      say(snapshot.day.end_message, { speaker: "SHOP" });
      break;
    default:
      throw new Error(`Unhandled screen: ${snapshot.screen}`);
  }
}

async function startGame(mode) {
  view.retry = null;
  setBusy("start");
  try {
    const snapshot = await request("/api/start", { mode });
    setBusy(null);
    enter(snapshot);
  } catch (error) {
    setBusy(null);
    showFailure("COULD NOT START", error.message, () => startGame(mode));
  }
}

async function returnToTitle() {
  if (view.busy !== null) return;
  view.retry = null;
  view.mood = "neutral";
  view.saleAt = 0;
  setBusy("title");
  try {
    const snapshot = await request("/api/title", {});
    setBusy(null);
    enter(snapshot);
  } catch (error) {
    setBusy(null);
    showFailure("COULD NOT LEAVE", error.message, returnToTitle);
  }
}

function confirmNewGame() {
  if (window.confirm("Start over? This replaces the saved game.")) startGame("new");
}

async function startDay() {
  view.retry = null;
  view.mood = "neutral";
  view.saleAt = 0;
  setBusy("day");
  say("A customer is on the way", { speaker: "SHOP", waiting: true });
  try {
    const snapshot = await request("/api/day", {});
    setBusy(null);
    applySnapshot(snapshot);
    view.enterAt = performance.now();
    sfx("door");
    introduce(snapshot.day);
  } catch (error) {
    setBusy(null);
    showFailure("NO BUYER", error.message, startDay);
  }
}

function introduce(day) {
  const { name, profession, money } = day.buyer;
  say(`Day ${day.number}. ${name}, ${withArticle(profession)}, walks in with $${money}. Sell the ${day.item}!`, {
    speaker: "SHOP",
  });
}

async function submitPitch(event) {
  event.preventDefault();
  if (view.busy !== null) return;
  const pitch = els.pitch.value.trim();
  const words = countWords(pitch);
  if (words === 0 || words > wordLimit()) {
    updateWordCount();
    return;
  }

  const name = view.snapshot.day.buyer.name;
  const previousMood = view.mood;
  setBusy("pitch");
  say(`${name} is thinking`, { speaker: "SHOP", waiting: true });
  try {
    const { outcome, state } = await request("/api/pitch", { pitch });
    setBusy(null);
    applySnapshot(state);
    handleOutcome(outcome, state, previousMood);
  } catch (error) {
    setBusy(null);
    view.mood = previousMood;
    showFailure("REQUEST FAILED", `${error.message} This try was not used.`, null);
  }
}

function handleOutcome(outcome, state, previousMood) {
  switch (outcome.kind) {
    case "answered": {
      const exchange = outcome.exchange;
      els.pitch.value = "";
      updateWordCount();
      view.mood = exchange.mood;
      say(exchange.buyer_said, { speaker: state.day.buyer.name, color: COLORS.blue, voiced: true });
      if (exchange.convinced) {
        view.saleAt = performance.now();
        sfx("sale");
      } else {
        sfx(exchange.mood === "annoyed" ? "no" : "hmm");
      }
      break;
    }
    case "rejected":
      view.mood = previousMood;
      sfx("error");
      say(outcome.message, { speaker: "NOTE", color: COLORS.yellow });
      break;
    case "error":
      view.mood = previousMood;
      say(`${state.day.buyer.name} didn't catch that. Say it again. This try doesn't count.`, {
        speaker: "SHOP",
      });
      break;
    default:
      throw new Error(`Unhandled pitch outcome: ${outcome.kind}`);
  }
}

async function passDay() {
  if (view.busy !== null) return;
  if (!window.confirm("End the day without a sale?")) return;
  setBusy("pass");
  try {
    const snapshot = await request("/api/pass", {});
    setBusy(null);
    applySnapshot(snapshot);
    sfx("no");
    say(snapshot.day.end_message, { speaker: "SHOP" });
  } catch (error) {
    setBusy(null);
    showFailure("COULD NOT PASS", error.message, null);
  }
}

function showFailure(title, message, retry) {
  sfx("error");
  view.retry = retry;
  say(message, { speaker: title, color: COLORS.red, border: COLORS.red });
  setStatus(`${title}: ${message}`, "error");
  renderControls();
}

// --- Page controls -----------------------------------------------------------

function applySnapshot(snapshot) {
  view.snapshot = snapshot;
  if (snapshot.screen === "between") {
    setStatus(snapshot.day.end_message, snapshot.day.sold ? "good" : "");
  } else if (snapshot.screen === "title" && snapshot.save_error) {
    setStatus(snapshot.save_error, "error");
  } else {
    setStatus("");
  }
  renderControls();
  renderSidebar();
}

function setBusy(kind) {
  view.busy = kind;
  if (kind === "start") setStatus("OPENING THE SHOP...");
  if (kind === "day") setStatus("WAITING FOR A CUSTOMER...");
  if (kind === "pitch") setStatus(`${view.snapshot.day.buyer.name.toUpperCase()} IS THINKING...`);
  if (kind === "pass") setStatus("CLOSING UP...");
  if (kind === "title") setStatus("BACK TO THE TITLE...");
  renderControls();
}

function setStatus(message, tone = "") {
  els.status.textContent = message;
  els.status.className = tone ? `status ${tone}` : "status";
}

function renderControls() {
  const screen = view.snapshot?.screen;
  const busy = view.busy !== null;

  els.pitchForm.hidden = screen !== "day";
  els.pitch.readOnly = busy;
  els.passButton.disabled = busy;
  els.titleButton.classList.toggle("away", !screen || screen === "title");
  els.titleButton.disabled = busy;
  updateWordCount();

  const choices = [];
  if (!busy) {
    if (view.retry) choices.push({ label: "TRY AGAIN", run: view.retry });
    if (screen === "title") {
      if (view.snapshot.saved) choices.push({ label: "CONTINUE", run: () => startGame("continue") });
      choices.push({ label: "NEW GAME", run: () => startGame("new"), secondary: Boolean(view.snapshot.saved) });
    }
    if (screen === "between") {
      choices.push({ label: "NEXT DAY", run: startDay });
      choices.push({ label: "NEW GAME", run: confirmNewGame, secondary: true });
    }
  }
  els.choices.replaceChildren(
    ...choices.map(({ label, run, secondary }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (secondary) button.className = "secondary";
      button.addEventListener("click", run);
      return button;
    }),
  );
  els.choices.hidden = choices.length === 0;
}

function renderSidebar() {
  const day = view.snapshot?.day;
  els.buyerDetails.replaceChildren();
  if (!day) {
    addDetail("WHO", "Nobody yet");
  } else {
    const { buyer } = day;
    addDetail("NAME", buyer.name);
    addDetail("JOB", buyer.profession);
    addDetail("CASH", `$${buyer.money}`);
    addDetail("TRAITS", buyer.characteristics.join(", "));
    addDetail("LIKES", buyer.likes.join(", "));
    addDetail("HATES", buyer.dislikes.join(", "));
    addDetail("SELL", day.item);
  }

  els.log.replaceChildren();
  if (!day || day.exchanges.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Nothing said yet.";
    els.log.append(empty);
    return;
  }
  for (const exchange of day.exchanges) {
    els.log.append(logLine("YOU", exchange.seller_said, "seller"));
    els.log.append(logLine(day.buyer.name.toUpperCase(), exchange.buyer_said, exchange.convinced ? "buyer sold" : "buyer"));
  }
  els.log.scrollTop = els.log.scrollHeight;
}

function addDetail(term, value) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  els.buyerDetails.append(dt, dd);
}

function logLine(who, message, className) {
  const item = document.createElement("li");
  item.className = className;
  const label = document.createElement("span");
  label.className = "who";
  label.textContent = who;
  item.append(label, document.createTextNode(message));
  return item;
}

function wordLimit() {
  return view.snapshot?.limits?.words ?? 300;
}

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function updateWordCount() {
  const limit = wordLimit();
  const words = countWords(els.pitch.value);
  els.wordCount.textContent = `${words}/${limit} WORDS`;
  els.wordCount.classList.toggle("over", words > limit);
  els.sayButton.disabled = view.busy !== null || words === 0 || words > limit;
}

function withArticle(phrase) {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

// --- Dialogue box ------------------------------------------------------------

function say(message, { speaker = "", color = COLORS.yellow, border = COLORS.white, voiced = false, waiting = false } = {}) {
  view.dialogue = {
    speaker,
    color,
    border,
    voiced,
    waiting,
    pages: paginate(wrap(clean(message), COLS), LINES),
    page: 0,
    startedAt: waiting ? -Infinity : performance.now(),
    blipped: 0,
  };
}

function clean(message) {
  return message
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...");
}

function wrap(message, cols) {
  const lines = [];
  for (const paragraph of message.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      while (rest.length > cols) {
        if (line) lines.push(line);
        line = "";
        lines.push(rest.slice(0, cols));
        rest = rest.slice(cols);
      }
      if (!rest) continue;
      if (!line) line = rest;
      else if (line.length + 1 + rest.length <= cols) line += ` ${rest}`;
      else {
        lines.push(line);
        line = rest;
      }
    }
    lines.push(line);
  }
  return lines;
}

function paginate(lines, perPage) {
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  return pages.length ? pages : [[""]];
}

function pageLength(page) {
  return page.reduce((total, line) => total + line.length, 0);
}

function visibleChars(dialogue, now) {
  return Math.floor(((now - dialogue.startedAt) / 1000) * TYPE_RATE);
}

function advanceDialogue() {
  const dialogue = view.dialogue;
  if (!dialogue || dialogue.waiting) return;
  const page = dialogue.pages[dialogue.page];
  if (visibleChars(dialogue, performance.now()) < pageLength(page)) {
    dialogue.startedAt = -Infinity;
  } else if (dialogue.page < dialogue.pages.length - 1) {
    dialogue.page += 1;
    dialogue.startedAt = performance.now();
    dialogue.blipped = 0;
  }
}

// --- Drawing -----------------------------------------------------------------

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function frameBox(x, y, w, h, border) {
  rect(x, y, w, h, border);
  rect(x + 2, y + 2, w - 4, h - 4, "#000000");
}

function text(message, x, y, color, { size = 8, align = "left", shadow = null } = {}) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(message, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(message, x, y);
}

let cachedLook = { key: "", look: null };

function lookFor(buyer) {
  const key = `${buyer.name}|${buyer.profession}`;
  if (cachedLook.key !== key) cachedLook = { key, look: buyerLook(buyer) };
  return cachedLook.look;
}

function frame(now) {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  rect(0, 0, W, H, "#000000");
  drawScene(now);
  drawHud();
  drawOverlay();
  drawDialogue(now);
  requestAnimationFrame(frame);
}

function drawScene(now) {
  const snapshot = view.snapshot;
  const day = view.busy === "day" ? null : snapshot?.day;

  rect(0, 16, W, 84, "#fcd8a8");
  for (let x = 8; x < W; x += 16) rect(x, 16, 1, 72, "#f0bc8c");
  rect(0, 88, W, 12, "#c84c0c");
  rect(0, 88, W, 2, "#881400");

  drawWindow(now);

  rect(10, 52, 108, 4, "#ac7c00");
  rect(10, 56, 108, 2, "#503000");
  ["#f83800", "#00a800", "#0078f8", "#f8b800", "#d800cc"].forEach((color, index) => {
    const x = 16 + index * 20;
    rect(x + 1, 38, 8, 2, "#503000");
    rect(x, 40, 10, 12, color);
    rect(x + 2, 42, 2, 6, COLORS.white);
  });

  rect(0, 100, W, 36, "#ac7c00");
  for (let y = 100; y < 136; y += 8) {
    const plank = Math.min(8, 136 - y);
    rect(0, y, W, 1, "#887000");
    for (let x = (y - 100) % 16 ? 0 : 16; x < W; x += 32) rect(x, y, 1, plank, "#887000");
  }

  const selling = view.saleAt && now - view.saleAt < 4000;
  drawCharacter(ctx, SELLER_LOOK, selling ? "happy" : "neutral", SELLER_POS.x, SELLER_POS.y, 2);

  rect(COUNTER.x, 100, COUNTER.w, 4, "#fca044");
  rect(COUNTER.x, 104, COUNTER.w, 32, "#c84c0c");
  rect(COUNTER.x, 104, COUNTER.w, 1, "#881400");
  for (let x = COUNTER.x + 6; x + 22 <= COUNTER.x + COUNTER.w - 4; x += 28) {
    rect(x, 110, 22, 1, "#881400");
    rect(x, 129, 22, 1, "#881400");
    rect(x, 110, 1, 20, "#881400");
    rect(x + 21, 110, 1, 20, "#881400");
  }

  if (!day) return;
  const itemGone = snapshot.screen === "between" && day.sold;
  if (!itemGone) drawItem(ctx, day.item, ITEM_POS.x, ITEM_POS.y, 2);
  if (selling) drawSparkles(now);
  drawBuyer(now, day);
}

function drawWindow(now) {
  const x = 152;
  const y = 22;
  const w = 84;
  const h = 34;
  rect(x, y, w, h, "#ac7c00");
  rect(x + 3, y + 3, w - 6, h - 6, COLORS.blue);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.clip();
  const cloudX = x - 20 + Math.floor((now / 80) % (w + 24));
  rect(cloudX, y + 10, 16, 4, COLORS.white);
  rect(cloudX + 4, y + 7, 8, 3, COLORS.white);
  ctx.restore();
  rect(x + w / 2 - 1, y + 3, 2, h - 6, "#ac7c00");
  rect(x + 3, y + h / 2 - 1, w - 6, 2, "#ac7c00");
}

function drawSparkles(now) {
  const points = [[-6, -4], [26, -2], [-4, 18], [28, 20], [10, -10]];
  points.forEach(([dx, dy], index) => {
    if ((Math.floor(now / 150) + index) % 2) return;
    const x = ITEM_POS.x + dx;
    const y = ITEM_POS.y + dy;
    rect(x + 1, y, 1, 3, COLORS.yellow);
    rect(x, y + 1, 3, 1, COLORS.yellow);
  });
}

function drawBuyer(now, day) {
  const sinceEnter = now - view.enterAt;
  const walking = sinceEnter < WALK_MS;
  const start = W + 8;
  const x = walking ? Math.round(start - (start - BUYER_HOME.x) * (sinceEnter / WALK_MS)) : BUYER_HOME.x;
  let y = BUYER_HOME.y;
  if (walking) y -= Math.floor(now / 120) % 2;
  if (view.busy === "pitch") y -= Math.floor(now / 300) % 2;

  const face = view.busy === "pitch" ? "thinking" : view.mood;
  drawCharacter(ctx, lookFor(day.buyer), face, x, y, 2);
  if (walking) return;

  const centerX = BUYER_HOME.x + 16;
  text(day.buyer.name.toUpperCase().slice(0, 12), centerX, 60, "#000000", { align: "center" });
  text(`$${day.buyer.money}`, centerX, 70, "#006800", { align: "center" });

  if (view.busy === "pitch" || hasIcon(view.mood)) drawBubble(x + 26, BUYER_HOME.y - 2, now);
}

function drawBubble(x, y, now) {
  rect(x, y, 16, 14, "#000000");
  rect(x + 1, y + 1, 14, 12, COLORS.white);
  rect(x - 1, y + 10, 2, 2, "#000000");
  if (view.busy === "pitch") {
    const dots = Math.floor(now / 300) % 4;
    for (let i = 0; i < dots; i += 1) rect(x + 3 + i * 4, y + 6, 2, 2, "#000000");
  } else {
    drawIcon(ctx, view.mood, x + 4, y + 3, 1);
  }
}

function drawHud() {
  rect(0, 0, W, 16, "#000000");
  const snapshot = view.snapshot;
  if (!snapshot || snapshot.screen === "title") {
    text("SHOPKEEPER", 8, 4, COLORS.yellow);
    return;
  }
  const day = snapshot.day;
  const number = view.busy === "day" || !day ? (snapshot.record?.days ?? 0) + 1 : day.number;
  text(`DAY ${number}`, 8, 4, COLORS.white);
  if (snapshot.screen === "day" && view.busy !== "day") {
    const tries = snapshot.limits.tries;
    text(`TRY ${Math.min(day.tries_used + 1, tries)}/${tries}`, 128, 4, COLORS.yellow, { align: "center" });
  }
  const record = snapshot.record ?? { sold: 0, days: 0 };
  text(`SOLD ${record.sold}/${record.days}`, 248, 4, COLORS.green, { align: "right" });
}

function drawOverlay() {
  const snapshot = view.snapshot;
  if (!snapshot) return;
  if (snapshot.screen === "title") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 16, W, 120);
    text("SHOPKEEPER", 128, 44, COLORS.yellow, { size: 16, align: "center", shadow: "#881400" });
    text("ONE BUYER. ONE ITEM.", 128, 78, COLORS.white, { align: "center" });
    text(`${snapshot.limits.tries} TRIES TO MAKE THE SALE.`, 128, 92, COLORS.white, { align: "center" });
    return;
  }
  if (snapshot.screen === "between" && view.busy !== "day") {
    const sold = snapshot.day.sold;
    const label = sold ? "SOLD!" : "NO SALE";
    const width = label.length * 16 + 24;
    const x = Math.round((W - width) / 2);
    frameBox(x, 22, width, 30, sold ? COLORS.green : COLORS.red);
    text(label, 128, 29, sold ? COLORS.green : COLORS.red, { size: 16, align: "center" });
  }
}

function drawDialogue(now) {
  const dialogue = view.dialogue;
  if (!dialogue) return;
  frameBox(BOX.x, BOX.y, BOX.w, BOX.h, dialogue.border);

  const lines = dialogue.pages[dialogue.page];
  const total = pageLength(lines);
  const visible = visibleChars(dialogue, now);
  if (dialogue.voiced && visible < total && visible - dialogue.blipped >= 2) {
    dialogue.blipped = visible;
    sfx("blip");
  }

  const top = dialogue.speaker ? TEXT_Y : SPEAKER_Y;
  if (dialogue.speaker) text(dialogue.speaker.toUpperCase().slice(0, COLS), TEXT_X, SPEAKER_Y, dialogue.color);

  let remaining = visible;
  lines.forEach((line, index) => {
    const shown = line.slice(0, Math.max(0, remaining));
    remaining -= line.length;
    if (shown) text(shown, TEXT_X, top + index * LINE_H, COLORS.white);
  });

  if (dialogue.waiting) {
    const last = lines.length - 1;
    const x = TEXT_X + lines[last].length * 8 + 2;
    const dots = Math.floor(now / 300) % 4;
    for (let i = 0; i < dots; i += 1) rect(x + i * 6, top + last * LINE_H + 5, 2, 2, COLORS.white);
  }

  const morePages = dialogue.page < dialogue.pages.length - 1;
  if (visible >= total && morePages && Math.floor(now / 400) % 2 === 0) {
    rect(238, 224, 6, 2, COLORS.yellow);
    rect(239, 226, 4, 2, COLORS.yellow);
    rect(240, 228, 2, 2, COLORS.yellow);
  }
}

async function loadFont() {
  try {
    await Promise.race([
      document.fonts.load(`8px ${FONT}`),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // The canvas falls back to a monospace font.
  }
}

// --- Sound -------------------------------------------------------------------

const sound = { on: true, audio: null };

const SFX = {
  blip: [[660, 0, 0.03, "square", 0.025]],
  door: [[784, 0, 0.08], [988, 0.08, 0.14]],
  hmm: [[440, 0, 0.08], [494, 0.09, 0.1]],
  no: [[330, 0, 0.12], [247, 0.12, 0.22]],
  sale: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.3]],
  error: [[110, 0, 0.25, "sawtooth"]],
};

function unlockAudio() {
  if (sound.audio) return;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (AudioContextClass) sound.audio = new AudioContextClass();
}

function sfx(name) {
  const audio = sound.audio;
  if (!sound.on || !audio) return;
  if (audio.state === "suspended") audio.resume();
  const start = audio.currentTime;
  for (const [frequency, at, length, type = "square", volume = 0.05] of SFX[name] ?? []) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start + at);
    gain.gain.setValueAtTime(volume, start + at);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start + at);
    oscillator.stop(start + at + length + 0.02);
  }
}

// --- Events ------------------------------------------------------------------

els.pitchForm.addEventListener("submit", submitPitch);
els.pitch.addEventListener("input", updateWordCount);
els.pitch.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    els.pitchForm.requestSubmit();
  }
});
els.passButton.addEventListener("click", passDay);
els.titleButton.addEventListener("click", returnToTitle);
canvas.addEventListener("click", advanceDialogue);
document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    advanceDialogue();
  }
});
els.soundToggle.addEventListener("click", () => {
  sound.on = !sound.on;
  els.soundToggle.textContent = sound.on ? "SOUND: ON" : "SOUND: OFF";
});
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, unlockAudio, { once: true });
}

boot();
