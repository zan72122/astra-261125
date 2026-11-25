(function (global) {
  'use strict';

  /**
   * Subtle translucent fingertip guidance overlay (NO text, NO arrows, NO icons, NO arm/elbow/body!).
   * Appears only after ~4 seconds of player inactivity and gently demonstrates the next touch/drag gesture.
   */
  class FingerHint {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.resize();

      this.opacity = 0;
      this.phase = 0;
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
    }

    /**
     * @param {number} dt
     * @param {boolean} active - true when idle >= ~4s and a hint path exists
     * @param {{x:number, y:number}|null} fromPx - start screen pixel
     * @param {{x:number, y:number}|null} toPx - end screen pixel (null or same for gentle tap)
     */
    updateAndDraw(dt, active, fromPx, toPx) {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      const targetOpacity = active && fromPx ? 1 : 0;
      this.opacity += (targetOpacity - this.opacity) * Math.min(1, dt * (active ? 2.4 : 9.0));

      if (this.opacity < 0.015 || !fromPx) {
        if (!active) this.phase = 0;
        return;
      }

      this.phase = (this.phase + dt * 0.48) % 1.0;

      const isDrag = Boolean(toPx && Math.hypot(toPx.x - fromPx.x, toPx.y - fromPx.y) > 24);
      let cx = fromPx.x;
      let cy = fromPx.y;
      let press = 0;
      let localAlpha = 1;

      if (isDrag) {
        if (this.phase < 0.18) {
          const u = this.phase / 0.18;
          localAlpha = u;
          press = u;
        } else if (this.phase < 0.74) {
          const u = (this.phase - 0.18) / 0.56;
          const ease = u * u * (3 - 2 * u);
          cx = fromPx.x + (toPx.x - fromPx.x) * ease;
          cy = fromPx.y + (toPx.y - fromPx.y) * ease - Math.sin(u * Math.PI) * 34;
          press = 1;
        } else if (this.phase < 0.88) {
          const u = (this.phase - 0.74) / 0.14;
          cx = toPx.x;
          cy = toPx.y;
          press = 1 - u;
          localAlpha = 1 - u * 0.5;
        } else {
          const u = (this.phase - 0.88) / 0.12;
          cx = toPx.x;
          cy = toPx.y;
          localAlpha = 0.5 * (1 - u);
        }
      } else {
        const tapWave = Math.sin(this.phase * Math.PI * 2);
        press = Math.max(0, tapWave);
        cy = fromPx.y - (1 - press) * 10;
        localAlpha = 0.85;
      }

      const alpha = this.opacity * localAlpha * 0.56;
      if (alpha < 0.01) return;

      if (press > 0.35) {
        const ringR = 14 + (1 - press) * 18;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 252, 242, ${alpha * 0.65})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Simple rounded translucent child fingertip only (no arm/elbow/body, no arrow)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.32);
      const scale = 1 - press * 0.08;
      ctx.scale(scale, scale);

      const glow = ctx.createRadialGradient(0, 6, 4, 0, 8, 28);
      glow.addColorStop(0, `rgba(255, 250, 240, ${alpha * 0.45})`);
      glow.addColorStop(1, 'rgba(255, 250, 240, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 8, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-11, 24);
      ctx.lineTo(-11, 2);
      ctx.arc(0, 2, 11, Math.PI, 0, false);
      ctx.lineTo(11, 24);
      ctx.quadraticCurveTo(0, 31, -11, 24);
      ctx.closePath();

      const fill = ctx.createLinearGradient(0, -10, 0, 30);
      fill.addColorStop(0, `rgba(255, 248, 238, ${alpha * 0.95})`);
      fill.addColorStop(0.7, `rgba(252, 240, 224, ${alpha * 0.72})`);
      fill.addColorStop(1, `rgba(252, 240, 224, ${alpha * 0.12})`);
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, 6.2, 4.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.35})`;
      ctx.fill();

      ctx.restore();
    }
  }

  global.FingerHint = FingerHint;
})(window);
