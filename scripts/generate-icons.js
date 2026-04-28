/**
 * CGV DDC 앱 아이콘 생성기 v5
 * - 다크 네이비 배경 + 레드 CGV 띠
 * - 7×9 픽셀 비트맵 글자로 선명한 DDC 렌더링
 */
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const NAVY   = 0x0f172aff;
const RED    = 0xe71a0fff;
const WHITE  = 0xffffffff;
const SILVER = 0xb0bec5ff;

function rect(img, x, y, w, h, c) {
  for (let py = y; py < y+h; py++)
    for (let px = x; px < x+w; px++)
      if (px >= 0 && py >= 0 && px < img.width && py < img.height)
        img.setPixelColor(c, px, py);
}
function dot(img, cx, cy, r, c) {
  for (let dy=-r; dy<=r; dy++)
    for (let dx=-r; dx<=r; dx++)
      if (dx*dx+dy*dy <= r*r)
        if (cx+dx>=0 && cy+dy>=0 && cx+dx<img.width && cy+dy<img.height)
          img.setPixelColor(c, cx+dx, cy+dy);
}
function roundRect(img, x, y, w, h, r, c) {
  rect(img, x+r, y,   w-2*r, h,     c);
  rect(img, x,   y+r, w,     h-2*r, c);
  for (let cy2 = 0; cy2 < r; cy2++)
    for (let cx2 = 0; cx2 < r; cx2++)
      if ((cx2-r)**2 + (cy2-r)**2 <= r*r) {
        for (const [px2,py2] of [[x+cx2,y+cy2],[x+w-1-cx2,y+cy2],[x+cx2,y+h-1-cy2],[x+w-1-cx2,y+h-1-cy2]])
          if (px2>=0&&py2>=0&&px2<img.width&&py2<img.height) img.setPixelColor(c, px2, py2);
      }
}

/* ── 7×9 픽셀 비트맵 폰트 ── */
const G = {
  // D: 왼쪽 세로 + 오른쪽 둥근 곡선 표현
  D: [
    [1,1,1,1,1,0,0],
    [1,0,0,0,0,1,0],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,1,0],
    [1,1,1,1,1,0,0],
  ],
  // C: 왼쪽 + 위아래 곡선
  C: [
    [0,1,1,1,1,1,0],
    [1,1,0,0,0,1,1],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,1,0,0,0,1,1],
    [0,1,1,1,1,1,0],
  ],
  // G: C + 오른쪽 하단 가로대
  G: [
    [0,1,1,1,1,1,0],
    [1,1,0,0,0,1,1],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,1,0,0,0,1,1],
    [0,1,1,1,1,1,0],
  ],
  // V: 양쪽에서 아래 중앙으로
  V: [
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [0,1,0,0,0,1,0],
    [0,1,0,0,0,1,0],
    [0,0,1,0,1,0,0],
    [0,0,1,0,1,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
  ],
};

const COLS = 7, ROWS = 9;

function drawGlyph(img, ch, ox, oy, sc, color) {
  const g = G[ch]; if (!g) return;
  for (let r=0; r<g.length; r++)
    for (let c=0; c<g[r].length; c++)
      if (g[r][c]) rect(img, ox+c*sc, oy+r*sc, sc, sc, color);
}

// 문자열 총 픽셀 너비
function strW(str, sc, gap) {
  return str.length * COLS * sc + (str.length-1) * gap * sc;
}

function drawStr(img, str, ox, oy, sc, gap, color) {
  let x = ox;
  for (const ch of str) {
    drawGlyph(img, ch, x, oy, sc, color);
    x += (COLS + gap) * sc;
  }
}

/* ── 아이콘 생성 ── */
async function generateIcon(size) {
  const img = new Jimp({ width: size, height: size, color: WHITE });

  // 배경
  const bgR = Math.round(size * 0.21);
  roundRect(img, 0, 0, size, size, bgR, NAVY);

  // 상단 레드 띠
  const stripH = Math.round(size * 0.24);
  roundRect(img, 0, 0, size, stripH, bgR, RED);
  rect(img, 0, Math.round(stripH * 0.5), size, Math.round(stripH * 0.5), RED);

  // "CGV" 소형 텍스트 (레드 띠 안)
  // sc 계산: 띠 높이의 약 60%를 글자 높이로
  const cgvSc  = Math.max(2, Math.floor(stripH * 0.60 / ROWS));
  const cgvGap = 1;
  const cgvW   = strW('CGV', cgvSc, cgvGap);
  const cgvX   = Math.round((size - cgvW) / 2);
  const cgvY   = Math.round((stripH - ROWS * cgvSc) / 2);
  drawStr(img, 'CGV', cgvX, cgvY, cgvSc, cgvGap, WHITE);

  // ── 대형 "DDC" ──
  // sc 계산: 가로 80%에 3글자(gap=1) 맞추기
  // strW('DDC', sc, 1) = 3*7*sc + 2*1*sc = 23*sc <= size*0.82
  const ddcSc  = Math.floor(size * 0.82 / 23);
  const ddcGap = 1;
  const ddcW   = strW('DDC', ddcSc, ddcGap);
  const ddcH   = ROWS * ddcSc;

  const remainH = size - stripH;
  const ddcX = Math.round((size - ddcW) / 2);
  const ddcY = Math.round(stripH + (remainH - ddcH) / 2 - size * 0.03);
  drawStr(img, 'DDC', ddcX, ddcY, ddcSc, ddcGap, WHITE);

  // 구분선
  const lineY = ddcY + ddcH + Math.round(size * 0.04);
  const lineW = Math.round(size * 0.55);
  rect(img, Math.round((size-lineW)/2), lineY, lineW, Math.max(1, Math.round(size*0.008)), SILVER);

  // 하단 점 3개 (장식)
  const dotY = lineY + Math.round(size * 0.045);
  const dotR = Math.max(2, Math.round(size * 0.017));
  const dGap = Math.round(size * 0.07);
  const dCx  = Math.round(size / 2);
  for (const dx of [dCx - dGap, dCx, dCx + dGap])
    dot(img, dx, dotY + dotR, dotR, SILVER);

  return img;
}

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(outDir, { recursive: true });
  console.log('아이콘 생성 중...');
  for (const size of [192, 512]) {
    const img = await generateIcon(size);
    await img.write(path.join(outDir, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }
  console.log('완료!');
}
main().catch(console.error);
