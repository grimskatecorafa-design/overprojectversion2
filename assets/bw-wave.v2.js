/*
 * Over Project V2 — fondo dinámico "onda de partículas" (blanco y azul sobre negro).
 * v2: la capa trasera de la cinta y parte de la nube son azules (#1F3BFF).
 * Una cinta de hilos de puntos que ondula y gira sobre sí misma (los hilos se cruzan
 * donde la cinta se tuerce), con una capa trasera más tenue y polvo flotando.
 * Reemplaza el fondo de estrellas anterior (.particle-field, oculto en bw-theme.v1.css).
 *
 * - Un solo <canvas> fijo detrás del contenido, sin eventos de puntero.
 * - Se pausa cuando la pestaña no está visible.
 * - Con "reducir movimiento" dibuja un solo cuadro fijo.
 * - En pantallas chicas usa menos puntos.
 */
(function () {
  'use strict';
  if (window.__bwWave) return;
  window.__bwWave = true;

  var canvas = document.createElement('canvas');
  canvas.className = 'bw-wave';
  canvas.setAttribute('aria-hidden', 'true');
  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  function mount() {
    if (!document.body) return false;
    document.body.insertBefore(canvas, document.body.firstChild);
    return true;
  }
  if (!mount()) document.addEventListener('DOMContentLoaded', mount, { once: true });

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var W = 0, H = 0, DPR = 1, small = false;
  var STRANDS = 0, PTS = 0;
  var dust = [];
  var haze = [];
  var scrollY = 0, mouseX = 0, mouseTarget = 0;
  var BUCKETS = 12;
  var buckets = [], blue = [];
  for (var b = 0; b < BUCKETS; b++) { buckets.push([]); blue.push([]); }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    small = W < 760;
    STRANDS = small ? 18 : 30;
    PTS = small ? 150 : Math.min(300, Math.round(W / 4.6));
    var n = small ? 60 : 130;
    dust = [];
    for (var i = 0; i < n; i++) {
      dust.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() < 0.18 ? 1.8 : 1,
        a: 0.06 + Math.random() * 0.32,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.02 - Math.random() * 0.07,
        tw: Math.random() * Math.PI * 2
      });
    }
    // Nube de partículas sueltas alrededor de la cinta (como el brillo de la referencia).
    var hn = small ? 260 : 620;
    haze = [];
    for (var h = 0; h < hn; h++) {
      var g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~gaussiana
      haze.push({
        xf: Math.random(),
        dy: g,
        a: 0.05 + Math.random() * 0.3,
        s: Math.random() < 0.1 ? 1.8 : 1.1,
        sp: 0.2 + Math.random() * 0.8,
        blue: Math.random() < 0.3
      });
    }
    if (reduceMQ.matches) draw(4.2);
  }

  // Centro de la cinta en una posición xf (0–1) del ancho; la usan la cinta y la nube.
  function centerAt(xf, t, base, amp, speed) {
    var env = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, xf * 1.05 - 0.02)));
    return base
      + Math.sin(xf * 3.1 + t * 0.33 * speed) * amp * env
      + Math.sin(xf * 7.3 - t * 0.47 * speed + 1.3) * amp * 0.28;
  }

  function add(x, y, a, s, isBlue) {
    if (a <= 0.025 || x < -3 || x > W + 3 || y < -3 || y > H + 3) return;
    var k = a >= 1 ? BUCKETS - 1 : Math.floor(a * BUCKETS);
    (isBlue ? blue : buckets)[k].push(x, y, s);
  }

  // Una cinta: "back" = capa trasera más ancha, tenue y lenta.
  function ribbon(t, base, amp, width, back) {
    var PI = Math.PI;
    var speed = back ? 0.6 : 1;
    var strands = back ? Math.round(STRANDS * 0.6) : STRANDS;
    var pts = back ? Math.round(PTS * 0.7) : PTS;
    for (var s = 0; s < strands; s++) {
      var u = strands > 1 ? s / (strands - 1) : 0.5;   // posición a lo ancho de la cinta
      var off = u - 0.5;
      var edge = 1 - Math.abs(off) * 1.6;                // los hilos centrales brillan más
      for (var i = 0; i < pts; i++) {
        var xf = i / (pts - 1);
        var x = (xf * 1.12 - 0.06) * W + mouseX * 14 * (back ? 0.5 : 1);
        var env = 0.45 + 0.55 * Math.sin(PI * Math.min(1, Math.max(0, xf * 1.05 - 0.02)));
        // Giro de la cinta: donde tw cruza 0 los hilos se juntan y se cruzan.
        var ang = xf * (back ? 4.2 : 5.6) - t * 0.42 * speed + (back ? 1.7 : 0);
        var tw = Math.sin(ang);
        var face = Math.abs(Math.cos(ang));             // cara de la cinta hacia la cámara
        var center = centerAt(xf, t, base, amp, speed);
        var y = center + off * width * tw * env + Math.sin(xf * 52 + s * 0.9 + t * 1.1) * 0.9;
        // La capa trasera es azul y un poco más intensa, para dar profundidad detrás de la blanca.
        var a = (back ? 0.12 : 0.1) + (back ? 0.4 : 0.62) * edge * (0.35 + 0.65 * face) * env;
        add(x, y, a, back ? 1.6 : (face > 0.8 && edge > 0.5 ? 1.5 : 1.15), back);
      }
    }
  }

  function draw(t) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);
    for (var b = 0; b < BUCKETS; b++) { buckets[b].length = 0; blue[b].length = 0; }

    // La cinta baja un poco al hacer scroll para que se sienta viva entre secciones.
    var base = H * (small ? 0.66 : 0.62) + Math.min(scrollY * 0.03, H * 0.06);
    var phase = t + scrollY * 0.0007;
    ribbon(phase, base - H * 0.05, H * 0.08, H * (small ? 0.16 : 0.26), true);
    ribbon(phase, base, H * 0.07, H * (small ? 0.12 : 0.17), false);

    // Nube alrededor de la cinta, flotando despacio hacia arriba.
    for (var hz = 0; hz < haze.length; hz++) {
      var o = haze[hz];
      var xf = (o.xf + phase * 0.004 * o.sp) % 1;
      var cy = centerAt(xf, phase, base, H * 0.07, 1);
      var drift = ((phase * 6 * o.sp) % 40) - 20;
      var hy = cy + o.dy * H * 0.2 - drift;
      var fade = 1 - Math.min(1, Math.abs(o.dy) * 1.1);
      add((xf * 1.12 - 0.06) * W, hy, o.a * fade * (0.5 + 0.5 * Math.sin(phase * 1.5 + o.xf * 40)) * (o.blue ? 1.6 : 1), o.s, o.blue);
    }

    // Primero el azul (atrás), luego el blanco encima.
    ctx.fillStyle = '#2a46ff';
    for (var qb = 0; qb < BUCKETS; qb++) {
      var bl = blue[qb];
      if (!bl.length) continue;
      ctx.globalAlpha = Math.min(0.95, (qb + 0.8) / BUCKETS);
      for (var pb = 0; pb < bl.length; pb += 3) ctx.fillRect(bl[pb], bl[pb + 1], bl[pb + 2], bl[pb + 2]);
    }

    ctx.fillStyle = '#ffffff';
    for (var q = 0; q < BUCKETS; q++) {
      var list = buckets[q];
      if (!list.length) continue;
      ctx.globalAlpha = Math.min(0.92, (q + 0.6) / BUCKETS);
      for (var p = 0; p < list.length; p += 3) {
        var sz = list[p + 2];
        ctx.fillRect(list[p], list[p + 1], sz, sz);
      }
    }

    // Polvo flotante, con un parpadeo suave.
    for (var d = 0; d < dust.length; d++) {
      var o = dust[d];
      ctx.globalAlpha = o.a * (0.55 + 0.45 * Math.sin(t * 1.2 + o.tw));
      ctx.fillRect(o.x, o.y, o.r, o.r);
    }
    ctx.globalAlpha = 1;
  }

  function stepDust() {
    for (var d = 0; d < dust.length; d++) {
      var o = dust[d];
      o.x += o.vx;
      o.y += o.vy;
      if (o.y < -4) { o.y = H + 4; o.x = Math.random() * W; }
      if (o.x < -4) o.x = W + 4; else if (o.x > W + 4) o.x = -4;
    }
  }

  var raf = 0, last = 0, t0 = performance.now();
  function frame(now) {
    raf = 0;
    // Máximo ~45 fps: suficiente para un fondo y más ligero para la página.
    if (now - last >= 22) {
      last = now;
      mouseX += (mouseTarget - mouseX) * 0.04;
      stepDust();
      draw((now - t0) / 1000);
    }
    start();
  }
  function start() {
    if (!raf && !document.hidden && !reduceMQ.matches) raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') mouseTarget = (e.clientX / (W || 1) - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  var onMQ = function () { if (reduceMQ.matches) { stop(); draw(4.2); } else start(); };
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMQ);

  resize();
  start();
})();
