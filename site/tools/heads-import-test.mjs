import { drawHead, init } from '/root/sparkler-lab/site/assets/js/heads.js';

const ctx2dStub = () => {
  const grad = { addColorStop() {} };
  const calls = { arc: 0, fillRect: 0, fillText: 0, strokeText: 0 };
  return { calls, ctx: {
    save() {}, restore() {}, beginPath() { calls.arc++; }, arc() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, closePath() {},
    fillRect() { calls.fillRect++; }, fillText() { calls.fillText++; }, strokeText() { calls.strokeText++; },
    createRadialGradient() { return grad; }, measureText() { return { width: 60 }; },
    set fillStyle(v) {}, get fillStyle() { return ''; },
    set strokeStyle(v) {}, get strokeStyle() { return ''; },
    set globalAlpha(v) {}, get globalAlpha() { return 1; },
    set globalCompositeOperation(v) {}, get globalCompositeOperation() { return 'lighter'; },
    set lineWidth(v) {}, get lineWidth() { return 1; },
    set font(v) {}, get font() { return ''; },
    set shadowColor(v) {}, get shadowColor() { return ''; },
    set shadowBlur(v) {}, get shadowBlur() { return 0; },
    set textAlign(v) {}, get textAlign() { return ''; },
    set textBaseline(v) {}, get textBaseline() { return ''; },
    set lineJoin(v) {}, get lineJoin() { return ''; },
    set lineCap(v) {}, get lineCap() { return ''; },
  }};
};

let fails = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) fails++; };

check('drawHead is function', typeof drawHead === 'function');
check('init is function', typeof init === 'function');

for (const kind of ['classic', 'heart', 'star', 'initials', 'flame', 'orb', 'upload']) {
  try {
    const { ctx } = ctx2dStub();
    drawHead(ctx, kind, 80, 80, 120, { tint: '#ffb347', glow: 0.7, opacity: 0.9, flickerPhase: 2.5 });
    drawHead(ctx, kind, 80, 80, 120, { flickerPhase: 0 });
    check('drawHead ' + kind, true);
  } catch (e) {
    check('drawHead ' + kind + ' -> ' + e.message, false);
  }
}
drawHead(null, 'classic', 0, 0, 10, {});
check('null ctx tolerated', true);
check('no import errors', true);
console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);