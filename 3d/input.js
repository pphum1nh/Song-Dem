// Joystick ảo (nửa trái), kéo xoay camera (nửa phải), bàn phím cho máy tính.
const RADIUS = 56;

export class Input {
  constructor(surface, joyBase, joyKnob) {
    this.surface = surface;
    this.joyBase = joyBase;
    this.joyKnob = joyKnob;
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookIds = new Map(); // pointerId -> last {x,y}
    this.look = { dx: 0, dy: 0 };
    this.keys = new Set();
    this.enabled = true;
    this.onAction = null;
    this.jumpQueued = false;

    surface.addEventListener('pointerdown', (e) => this.down(e));
    surface.addEventListener('pointermove', (e) => this.moveEvt(e));
    surface.addEventListener('pointerup', (e) => this.up(e));
    surface.addEventListener('pointercancel', (e) => this.up(e));
    surface.addEventListener('lostpointercapture', (e) => this.up(e));
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if ((e.code === 'KeyE' || e.code === 'Enter') && this.onAction) this.onAction();
      if (e.code === 'Space' && this.enabled) { this.jumpQueued = true; e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.resetJoy(); this.lookIds.clear(); });
  }

  down(e) {
    if (!this.enabled) return;
    try { this.surface.setPointerCapture(e.pointerId); } catch (_) {}
    const isTouchLeft = e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.5;
    if (isTouchLeft && this.joy.id === null) {
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX; this.joy.oy = e.clientY;
      this.joy.x = 0; this.joy.y = 0;
      this.joyBase.style.left = e.clientX + 'px';
      this.joyBase.style.top = e.clientY + 'px';
      this.joyBase.classList.add('active');
      this.joyKnob.style.transform = 'translate(-50%,-50%)';
    } else {
      this.lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  moveEvt(e) {
    if (e.pointerId === this.joy.id) {
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      this.joy.x = dx / RADIUS; this.joy.y = -dy / RADIUS;
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    const last = this.lookIds.get(e.pointerId);
    if (last) {
      this.look.dx += e.clientX - last.x;
      this.look.dy += e.clientY - last.y;
      last.x = e.clientX; last.y = e.clientY;
    }
  }

  up(e) {
    if (e.pointerId === this.joy.id) this.resetJoy();
    this.lookIds.delete(e.pointerId);
  }

  resetJoy() {
    this.joy.id = null; this.joy.x = 0; this.joy.y = 0;
    this.joyBase.classList.remove('active');
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.resetJoy(); this.lookIds.clear(); this.look.dx = this.look.dy = 0; }
  }

  // Trả về {x, y, run}: x sang phải, y tiến về trước, độ lớn 0..1.
  getMove() {
    if (!this.enabled) return { x: 0, y: 0, run: false };
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || (this.joy.id !== null && len > 0.9);
    return { x, y, run };
  }

  queueJump() { if (this.enabled) this.jumpQueued = true; }
  consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }

  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }
}
