/**
 * CGV 동두천 앱 아이콘 생성기 v2
 */
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const RED      = 0xe71a0fff;
const WHITE    = 0xffffffff;
const DARK_RED = 0xb01208ff;
const BG       = 0xffffffff; // 모서리 여백

function fillRect(img, x, y, w, h, color) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (px >= 0 && py >= 0 && px < img.width && py < img.height)
        img.setPixelColor(color, px, py);
    }
  }
}

function drawRoundedRect(img, x, y, w, h, r, color) {
  fillRect(img, x + r, y,     w - 2*r, h,     color);
  fillRect(img, x,     y + r, w,       h-2*r, color);
  for (let cy = 0; cy < r; cy++) {
    for (let cx = 0; cx < r; cx++) {
      if ((cx-r)*(cx-r) + (cy-r)*(cy-r) <= r*r) {
        img.setPixelColor(color, x+cx,       y+cy);
        img.setPixelColor(color, x+w-1-cx,   y+cy);
        img.setPixelColor(color, x+cx,       y+h-1-cy);
        img.setPixelColor(color, x+w-1-cx,   y+h-1-cy);
      }
    }
  }
}

// ── C 글자: 위/아래/왼쪽 3면 ──
function drawC(img, ox, oy, W, H, color) {
  const t = Math.round(H * 0.22);
  const openW = Math.round(W * 0.75); // 오른쪽 열린 부분 (75%만 막음)
  fillRect(img, ox, oy,           openW, t, color); // 상단
  fillRect(img, ox, oy,           t,     H, color); // 좌측
  fillRect(img, ox, oy + H - t,   openW, t, color); // 하단
}

// ── G 글자: C + 오른쪽 하단 세로 + 중간 가로 ──
function drawG(img, ox, oy, W, H, color) {
  const t  = Math.round(H * 0.22);
  const openW = Math.round(W * 0.80);
  const midY  = Math.round(H * 0.50);

  fillRect(img, ox,           oy,            openW, t, color); // 상단
  fillRect(img, ox,           oy,            t,     H, color); // 좌측
  fillRect(img, ox,           oy + H - t,    openW, t, color); // 하단
  // 오른쪽 하단 세로
  fillRect(img, ox + openW - t, oy + midY,   t,    H - midY, color);
  // 중간 가로대 (안으로 절반만)
  fillRect(img, ox + Math.round(W*0.40), oy + midY, Math.round(W*0.40), t, color);
}

// ── V 글자: 양쪽 사선으로 만나는 V ──
function drawV(img, ox, oy, W, H, color) {
  const t = Math.round(H * 0.20);

  for (let row = 0; row < H; row++) {
    const progress = row / (H - 1); // 0 → 1
    // 왼쪽 획: 왼쪽 끝에서 → 중앙 아래로
    const lx = ox + Math.round(progress * (W/2 - t/2));
    // 오른쪽 획: 오른쪽 끝에서 → 중앙 아래로 (반대)
    const rx = ox + W - Math.round(progress * (W/2 - t/2)) - t;

    fillRect(img, lx, oy + row, t, 1, color);
    if (rx > lx + t) {
      fillRect(img, rx, oy + row, t, 1, color);
    } else {
      // 맨 아래 꼭짓점: 합쳐서 채우기
      fillRect(img, lx, oy + row, rx - lx + t, 1, color);
    }
  }
}

// 픽셀 폰트 (동두천 - 6x7 격자)
const GLYPH = {
  '동': [
    [0,1,1,1,1,0],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,0,0,0,0,1],
    [0,1,1,1,1,0],
    [0,0,1,1,0,0],
  ],
  '두': [
    [1,1,1,1,1,1],
    [0,0,1,0,0,0],
    [0,0,1,0,0,0],
    [0,0,1,0,0,0],
    [1,0,1,0,0,1],
    [0,1,0,1,1,0],
    [0,0,0,0,0,0],
  ],
  '천': [
    [0,0,1,0,0,0],
    [0,1,0,0,1,0],
    [1,1,1,1,1,1],
    [0,0,1,0,0,0],
    [0,0,1,0,0,0],
    [0,1,1,1,0,0],
    [0,0,0,0,0,0],
  ],
};

function drawChar(img, ch, ox, oy, sc, color) {
  const g = GLYPH[ch]; if (!g) return;
  for (let r = 0; r < g.length; r++)
    for (let c = 0; c < g[r].length; c++)
      if (g[r][c]) fillRect(img, ox + c*sc, oy + r*sc, sc, sc, color);
}

async function generateIcon(size) {
  const img = new Jimp({ width: size, height: size, color: BG });

  // 배경
  const radius = Math.round(size * 0.20);
  drawRoundedRect(img, 0, 0, size, size, radius, RED);

  // 하단 그림자 밴드
  const shH = Math.round(size * 0.055);
  drawRoundedRect(img, 0, size - shH, size, shH, radius, DARK_RED);

  // ── CGV 글자 배치 ──
  const LH   = Math.round(size * 0.42);  // 글자 높이
  const LW   = Math.round(size * 0.25);  // 글자 너비
  const gap  = Math.round(size * 0.045);
  const totW = LW * 3 + gap * 2;
  const sx   = Math.round((size - totW) / 2);
  const sy   = Math.round(size * 0.17);

  drawC(img, sx,              sy, LW, LH, WHITE);
  drawG(img, sx + LW + gap,   sy, LW, LH, WHITE);
  drawV(img, sx + (LW+gap)*2, sy, LW, LH, WHITE);

  // ── 동두천 서브텍스트 ──
  const sc = Math.round(size * 0.030);          // 픽셀 크기
  const cw = 6 * sc + Math.round(sc * 0.5);     // 문자 너비 (자간 포함)
  const subW = cw * 3 - Math.round(sc * 0.5);
  const subX = Math.round((size - subW) / 2);
  const subY = Math.round(size * 0.695);

  drawChar(img, '동', subX,          subY, sc, WHITE);
  drawChar(img, '두', subX + cw,     subY, sc, WHITE);
  drawChar(img, '천', subX + cw * 2, subY, sc, WHITE);

  // 구분선
  const lineY = Math.round(size * 0.655);
  fillRect(img,
    Math.round(size * 0.18), lineY,
    Math.round(size * 0.64), Math.round(size * 0.007),
    0xffffff88
  );

  return img;
}

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(outDir, { recursive: true });
  console.log('아이콘 생성 중...');

  const img192 = await generateIcon(192);
  await img192.write(path.join(outDir, 'icon-192.png'));
  console.log('✓ icon-192.png');

  const img512 = await generateIcon(512);
  await img512.write(path.join(outDir, 'icon-512.png'));
  console.log('✓ icon-512.png');

  console.log('완료!');
}

main().catch(console.error);
