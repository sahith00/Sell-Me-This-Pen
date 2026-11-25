// Pixel art for the shop. Each sprite is a grid of palette codes; "." is transparent.

function sprite(width, rows) {
  rows.forEach((row, index) => {
    if (row.length !== width) {
      throw new Error(`sprite row ${index} is ${row.length} wide, expected ${width}`);
    }
  });
  return rows;
}

export function drawGrid(ctx, rows, colors, x, y, scale = 1) {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    for (let c = 0; c < row.length; c += 1) {
      const color = colors[row[c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

function drawPixels(ctx, pixels, color, x, y, scale) {
  ctx.fillStyle = color;
  for (const [px, py] of pixels) {
    ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
  }
}

// --- Characters (16 x 26) -------------------------------------------------

const BODY = sprite(16, [
  "................",
  "................",
  ".....SSSSSS.....",
  "....SSSSSSSS....",
  "....SSSSSSSS....",
  "....SSKSSKSS....",
  "....SSKSSKSS....",
  "....SSSSSSSS....",
  ".....SSSSSS.....",
  "......SSSS......",
  "....CCCCCCCC....",
  "...CCCCCCCCCC...",
  "..CCCCCCCCCCCC..",
  "..CDCCCCCCCCDC..",
  "..CDCCCCCCCCDC..",
  "..CDCCCCCCCCDC..",
  "..SS.CCCCCC.SS..",
  "..SS.CCCCCC.SS..",
  ".....CCCCCC.....",
  ".....PPPPPP.....",
  ".....PPPPPP.....",
  ".....PP..PP.....",
  ".....PP..PP.....",
  ".....PP..PP.....",
  ".....PP..PP.....",
  "....BBB..BBB....",
]);

export const CHARACTER_HEIGHT = BODY.length;
export const CHARACTER_WIDTH = 16;

const HAIR = {
  short: sprite(16, [
    "................",
    ".....HHHHHH.....",
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "....H......H....",
  ]),
  long: sprite(16, [
    "................",
    ".....HHHHHH.....",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "...HH......HH...",
    "...HH......HH...",
    "...HH......HH...",
    "...HH......HH...",
    "...HH......HH...",
    "...HH......HH...",
    "...HH......HH...",
    "...HH......HH...",
  ]),
  bun: sprite(16, [
    "......HHHH......",
    ".....HHHHHH.....",
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "....H......H....",
  ]),
  spiky: sprite(16, [
    "....H.H..H.H....",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "....HHHHHHHH....",
  ]),
  cap: sprite(16, [
    "................",
    ".....TTTTTT.....",
    "....TTTTTTTT....",
    "...TTTTTTTTTTT..",
    "....H......H....",
  ]),
  bald: sprite(16, [
    "................",
    "................",
    "................",
    "....H......H....",
    "....H......H....",
  ]),
};

const GLASSES = [
  [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
  [5, 5], [7, 5], [8, 5], [10, 5],
];

const FACES = {
  neutral: { mouth: [[7, 7], [8, 7]], brows: [] },
  thinking: { mouth: [[8, 7]], brows: [] },
  interested: { mouth: [[7, 7], [8, 7], [7, 8], [8, 8]], brows: [] },
  happy: { mouth: [[6, 7], [9, 7], [7, 8], [8, 8]], brows: [] },
  annoyed: { mouth: [[7, 7], [8, 7], [6, 8], [9, 8]], brows: [[6, 4], [9, 4]] },
};

const EXTRAS = {
  apron: [[6, 11, 4, 8]],
  coat: [[7, 10, 2, 9]],
  tie: [[7, 10, 2, 6]],
  overalls: [[5, 14, 6, 5], [5, 10, 1, 4], [10, 10, 1, 4]],
};

const SKINS = ["#fcd8a8", "#f0bc8c", "#c88c5c", "#8c5c3c"];
const HAIR_COLORS = ["#000000", "#503000", "#ac7c00", "#fca044", "#bcbcbc", "#c84c0c"];
const HAIR_STYLES = ["short", "long", "bun", "spiky", "cap", "bald"];

const OUTFITS = [
  { match: /chef|cook|baker|barista|caterer|pastry|brewer/, top: "#fcfcfc", shade: "#bcbcbc", pants: "#3c3c3c", extra: "apron", accent: "#f87858" },
  { match: /doctor|nurse|surgeon|pharmac|scientist|dentist|vet|chemist|research|lab/, top: "#fcfcfc", shade: "#bcbcbc", pants: "#0058f8", extra: "coat", accent: "#3cbcfc" },
  { match: /teacher|librar|professor|writer|author|editor|student|tutor|journalist/, top: "#00a800", shade: "#005800", pants: "#503000" },
  { match: /engineer|developer|programmer|designer|coder|analyst|gamer|tech|it /, top: "#6888fc", shade: "#0058f8", pants: "#3c3c3c" },
  { match: /farmer|gardener|mechanic|carpenter|builder|plumber|electrician|landscap|construct|welder/, top: "#f83800", shade: "#a81000", pants: "#0058f8", extra: "overalls" },
  { match: /lawyer|banker|accountant|manager|consultant|executive|broker|agent|director|ceo|realtor/, top: "#3c3c3c", shade: "#000000", pants: "#3c3c3c", extra: "tie", accent: "#d82800" },
  { match: /artist|musician|painter|dancer|actor|photograph|singer|poet|tattoo/, top: "#9878f8", shade: "#6844fc", pants: "#000000" },
  { match: /athlete|coach|trainer|runner|instructor|cyclist|yoga|fitness/, top: "#f8b800", shade: "#ac7c00", pants: "#0000bc" },
];

const FALLBACK_OUTFITS = [
  { top: "#0078f8", shade: "#0000bc", pants: "#503000" },
  { top: "#d800cc", shade: "#940084", pants: "#3c3c3c" },
  { top: "#00a844", shade: "#006800", pants: "#000000" },
  { top: "#e45c10", shade: "#a81000", pants: "#0058f8" },
];

export function hashString(text) {
  let hash = 5381;
  for (const ch of text) {
    hash = ((hash << 5) + hash + ch.codePointAt(0)) >>> 0;
  }
  return hash;
}

function pick(list, hash, salt) {
  const mixed = Math.imul(hash ^ (salt * 0x9e3779b9), 0x85ebca6b) >>> 0;
  return list[mixed % list.length];
}

export function buyerLook(buyer) {
  const hash = hashString(`${buyer.name}|${buyer.profession}`);
  const profession = buyer.profession.toLowerCase();
  const outfit = OUTFITS.find((entry) => entry.match.test(profession)) ?? pick(FALLBACK_OUTFITS, hash, 4);
  return {
    skin: pick(SKINS, hash, 1),
    hairColor: pick(HAIR_COLORS, hash, 2),
    hairStyle: pick(HAIR_STYLES, hash, 3),
    glasses: pick([false, false, true], hash, 5),
    ...outfit,
  };
}

export const SELLER_LOOK = {
  skin: "#f0bc8c",
  hairColor: "#503000",
  hairStyle: "short",
  glasses: false,
  top: "#00a800",
  shade: "#005800",
  pants: "#503000",
  extra: "apron",
  accent: "#fcfcfc",
};

export function drawCharacter(ctx, look, face, x, y, scale) {
  const colors = {
    S: look.skin,
    K: "#000000",
    C: look.top,
    D: look.shade,
    P: look.pants,
    B: "#3c2400",
    H: look.hairColor,
    T: look.accent ?? look.shade,
  };
  drawGrid(ctx, BODY, colors, x, y, scale);

  for (const [ex, ey, ew, eh] of EXTRAS[look.extra] ?? []) {
    const color = look.extra === "overalls" ? look.pants : look.accent;
    ctx.fillStyle = color;
    ctx.fillRect(x + ex * scale, y + ey * scale, ew * scale, eh * scale);
  }

  drawGrid(ctx, HAIR[look.hairStyle] ?? HAIR.short, colors, x, y, scale);
  if (look.glasses) drawPixels(ctx, GLASSES, "#000000", x, y, scale);

  const expression = FACES[face] ?? FACES.neutral;
  drawPixels(ctx, expression.mouth, "#881400", x, y, scale);
  drawPixels(ctx, expression.brows, "#000000", x, y, scale);
}

// --- Items (12 x 12) ---------------------------------------------------------

const ITEMS = {
  "wool scarf": {
    colors: { R: "#d82800", W: "#fcfcfc" },
    rows: sprite(12, [
      "............",
      "..RRRRRRRR..",
      ".RRWWRRWWRR.",
      ".RR......RR.",
      ".RR......RR.",
      "..RR....RR..",
      "...RR..RR...",
      "....RRRR....",
      "....RWWR....",
      "....RRRR....",
      "....R..R....",
      "....R..R....",
    ]),
  },
  "espresso machine": {
    colors: { K: "#000000", G: "#bcbcbc", R: "#f83800", W: "#fcfcfc" },
    rows: sprite(12, [
      "............",
      ".KKKKKKKKKK.",
      ".KGGGGGGGGK.",
      ".KGKKGGRRGK.",
      ".KGGGGGGGGK.",
      ".KGGKKKKGGK.",
      ".KGG.KK.GGK.",
      ".KGG....GGK.",
      ".KGG.WW.GGK.",
      ".KGG.WW.GGK.",
      ".KKKKKKKKKK.",
      "............",
    ]),
  },
  houseplant: {
    colors: { G: "#00a800", O: "#c84c0c" },
    rows: sprite(12, [
      "....GG..G...",
      "..G.GG.GG...",
      "..GGGGGG..G.",
      ".GG.GGG.GG..",
      "...GGGGGG...",
      "....GGGG....",
      "...OOOOOO...",
      "...OOOOOO...",
      "....OOOO....",
      "....OOOO....",
      "....OOOO....",
      "............",
    ]),
  },
  "noise-cancelling headphones": {
    colors: { K: "#000000", B: "#6888fc" },
    rows: sprite(12, [
      "............",
      "...KKKKKK...",
      "..K......K..",
      ".K........K.",
      ".K........K.",
      ".K........K.",
      "KBBK....KBBK",
      "KBBK....KBBK",
      "KBBK....KBBK",
      ".KK......KK.",
      "............",
      "............",
    ]),
  },
  "cast-iron skillet": {
    colors: { K: "#000000", G: "#7c7c7c" },
    rows: sprite(12, [
      "............",
      "............",
      "............",
      "..KKKKKK....",
      ".KGGGGGGK...",
      "KGGKKKKGGKKK",
      "KGKKKKKKGKKK",
      "KGGKKKKGGK..",
      ".KGGGGGGK...",
      "..KKKKKK....",
      "............",
      "............",
    ]),
  },
  "hardcover notebook": {
    colors: { K: "#000000", B: "#0000bc", Y: "#f8b800", W: "#fcfcfc" },
    rows: sprite(12, [
      "............",
      "..BBBBBBBK..",
      "..BBBBBBBWK.",
      "..BBYYYBBWK.",
      "..BBBBBBBWK.",
      "..BBBBBBBWK.",
      "..BBBBBBBWK.",
      "..BBBBBBBWK.",
      "..BBBBBBBWK.",
      "..BBBBBBBWK.",
      "...KKKKKKKK.",
      "............",
    ]),
  },
  "running shoes": {
    colors: { R: "#f83800", W: "#fcfcfc", K: "#000000" },
    rows: sprite(12, [
      "............",
      "............",
      "............",
      "......RRR...",
      ".....RWRRR..",
      "....RWRRRR..",
      "..RRRRRRRRR.",
      ".RRRRRRRRRRR",
      ".WWWWWWWWWWW",
      ".KKKKKKKKKKK",
      "............",
      "............",
    ]),
  },
  "ceramic teapot": {
    colors: { K: "#000000", T: "#00a8a8", W: "#fcfcfc" },
    rows: sprite(12, [
      "............",
      ".....KK.....",
      "...TTTTTT...",
      "..TTTTTTTT.T",
      "T.TTWWTTTTTT",
      "TTTTTTTTTT.T",
      ".TTTTTTTTTT.",
      "..TTTTTTTT..",
      "..TTTTTTTT..",
      "...TTTTTT...",
      "............",
      "............",
    ]),
  },
  "desk lamp": {
    colors: { K: "#000000", Y: "#f8b800" },
    rows: sprite(12, [
      "............",
      "...YYYYY....",
      "..YYYYYYY...",
      "....KKK.....",
      ".....K......",
      "......K.....",
      ".......K....",
      "......K.....",
      ".....K......",
      "....KKKK....",
      "...KKKKKK...",
      "............",
    ]),
  },
  "linen apron": {
    colors: { K: "#000000", L: "#fce0a8", P: "#c8a070" },
    rows: sprite(12, [
      "............",
      "....KKKK....",
      "....K..K....",
      "...LLLLLL...",
      "K..LLLLLL..K",
      ".KKLLLLLLKK.",
      "...LLLLLL...",
      "...LPPPPL...",
      "...LPPPPL...",
      "...LLLLLL...",
      "....LLLL....",
      "............",
    ]),
  },
  "fountain pen": {
    colors: { K: "#000000", G: "#f8b800", B: "#0000bc", Y: "#f8b800" },
    rows: sprite(12, [
      "..........K.",
      ".........KG.",
      "........KGK.",
      ".......BBK..",
      "......BBB...",
      ".....BBB....",
      "....BBB.....",
      "...BBB......",
      "..YBB.......",
      "..BY........",
      "............",
      "............",
    ]),
  },
  "yoga mat": {
    colors: { P: "#9878f8", W: "#d8b8f8", D: "#6844fc" },
    rows: sprite(12, [
      "............",
      "............",
      "..PPPPPPPP..",
      ".PPPPPPPPPP.",
      "PPPPPPPPPPWP",
      "PPPPPPPPPWDW",
      "PPPPPPPPPPWP",
      ".PPPPPPPPPP.",
      "..PPPPPPPP..",
      "............",
      "............",
      "............",
    ]),
  },
  "sourdough starter": {
    colors: { K: "#000000", G: "#7c7c7c", W: "#a4e4fc", C: "#fce0a8", D: "#c8a070" },
    rows: sprite(12, [
      "............",
      "...KKKKKK...",
      "...GGGGGG...",
      "..W......W..",
      "..W......W..",
      "..WCCCCCCW..",
      "..WCCCCCCW..",
      "..WCCDCCCW..",
      "..WCCCCDCW..",
      "..WCCCCCCW..",
      "...WWWWWW...",
      "............",
    ]),
  },
  "mechanical keyboard": {
    colors: { K: "#000000", W: "#fcfcfc" },
    rows: sprite(12, [
      "............",
      "............",
      "............",
      "KKKKKKKKKKKK",
      "KWKWKWKWKWKK",
      "KKKKKKKKKKKK",
      "KWKWKWKWKWKK",
      "KKKKKKKKKKKK",
      "KWKWWWWWWKWK",
      "KKKKKKKKKKKK",
      "............",
      "............",
    ]),
  },
  "rain jacket": {
    colors: { Y: "#f8b800", K: "#000000" },
    rows: sprite(12, [
      "....YYYY....",
      "...YYKKYY...",
      "..YYYYYYYY..",
      ".YYYYKYYYYY.",
      "YYYYYKYYYYYY",
      "YY.YYKYYY.YY",
      "YY.YYKYYY.YY",
      "YY.YYKYYY.YY",
      "...YYKYYY...",
      "...YYKYYY...",
      "...YYYYYY...",
      "............",
    ]),
  },
};

const GIFT_BOX = {
  colors: { R: "#d82800", Y: "#f8b800" },
  rows: sprite(12, [
    "............",
    "...YY..YY...",
    "....YYYY....",
    ".RRRRYYRRRR.",
    ".RRRRYYRRRR.",
    ".YYYYYYYYYY.",
    ".RRRRYYRRRR.",
    ".RRRRYYRRRR.",
    ".RRRRYYRRRR.",
    ".RRRRYYRRRR.",
    ".RRRRYYRRRR.",
    "............",
  ]),
};

export const ITEM_SIZE = 12;

export function drawItem(ctx, name, x, y, scale) {
  const item = ITEMS[name.toLowerCase()] ?? GIFT_BOX;
  drawGrid(ctx, item.rows, item.colors, x, y, scale);
}

// --- Mood icons (8 x 8) -----------------------------------------------------

const ICONS = {
  happy: {
    colors: { R: "#f83800" },
    rows: sprite(8, [
      "........",
      ".RR..RR.",
      "RRRRRRRR",
      "RRRRRRRR",
      ".RRRRRR.",
      "..RRRR..",
      "...RR...",
      "........",
    ]),
  },
  interested: {
    colors: { K: "#000000" },
    rows: sprite(8, [
      "...KK...",
      "...KK...",
      "...KK...",
      "...KK...",
      "...KK...",
      "........",
      "...KK...",
      "........",
    ]),
  },
  annoyed: {
    colors: { R: "#d82800" },
    rows: sprite(8, [
      ".R....R.",
      "..R..R..",
      "RR....RR",
      "........",
      "........",
      "RR....RR",
      "..R..R..",
      ".R....R.",
    ]),
  },
};

export function hasIcon(mood) {
  return mood in ICONS;
}

export function drawIcon(ctx, mood, x, y, scale = 1) {
  const icon = ICONS[mood];
  if (icon) drawGrid(ctx, icon.rows, icon.colors, x, y, scale);
}
