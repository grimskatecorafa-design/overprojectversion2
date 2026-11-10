/*
 * Over Project — asistente de chat (v8: entrevista para cotizar páginas web; v7: WhatsApp al primer número si hay varios; v6: ejemplos → Creaciones y Portafolio; botones "Ir a …"; 25 preguntas por visita).
 * - Botones guiados (sin IA, sin costo): qué plan me conviene, precios, páginas web, servicios.
 *   Toman planes, servicios y precios del contenido del editor (Firebase content/siteV2).
 * - Preguntas libres: /api/chat (IA de Cloudflare, con respaldo de Gemini).
 * - Siempre ofrece pasar a WhatsApp con un resumen ya escrito.
 * Todo el texto se inserta como texto (nunca como HTML).
 */
(function () {
  'use strict';
  if (window.__opChat) return;
  window.__opChat = true;

  var FIRESTORE = 'https://firestore.googleapis.com/v1/projects/over-project-web/databases/(default)/documents/content/siteV2';
  var MAX_QUESTIONS = 25;   // preguntas a la IA por visita
  var HISTORY = 12;         // mensajes de la plática que se mandan a la IA (cuida el cupo gratis)
  var STORE = 'opc-state-v6';

  var content = null;
  var contentP = null;
  var state = { open: false, log: [], ai: [], asked: 0, topic: '' };
  try { var saved = JSON.parse(sessionStorage.getItem(STORE) || 'null'); if (saved && saved.log) state = saved; state.open = false; } catch (e) {}
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

  function loadContent() {
    if (!contentP) {
      contentP = fetch(FIRESTORE).then(function (r) { return r.json(); }).then(function (d) {
        content = JSON.parse(d.fields.json.stringValue);
        return content;
      }).catch(function () { contentP = null; return null; });
    }
    return contentP;
  }

  // ---------- Utilidades ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
  function price(p) {
    if (!p) return 'Cotización';
    if (p.kind === 'quote') return 'Cotización';
    return (p.kind === 'from' ? 'Desde ' : '') + money(p.amount) + (p.per ? ' / ' + p.per : '');
  }
  function clean(s) { return String(s || '').replace(/\*/g, '').trim(); }
  function title(s) {
    s = clean(s);
    return s === s.toUpperCase() || s === s.toLowerCase()
      ? s.toLowerCase().replace(/(^|[\s/])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })
      : s;
  }
  function plans() { return (content && content.plans && content.plans.items) || []; }
  function webPlans() { return plans().filter(function (p) { return /landing|informativa|tienda|e-?commerce/i.test(p.name); }); }
  function monthlyPlans() { var w = webPlans(); return plans().filter(function (p) { return w.indexOf(p) < 0; }); }
  function reelsOf(p) { var m = (p.features || []).join(' ').match(/(\d+)\s*reels?/i); return m ? Number(m[1]) : null; }

  function waLink(extra) {
    var phone = (content && content.contact && content.contact.phone) || '33 2794 3905';
    // Si hay varios números ("33 27 94 39 05 / 33 45 36 38 32"), el chat usa el primero.
    var first = String(phone).match(/\+?\d[\d\s().-]{6,}\d/);
    var d = (first ? first[0] : String(phone)).replace(/\D/g, '');
    if (d.length > 13 && d.length % 10 === 0) d = d.slice(0, 10);
    if (d.length === 10) d = '52' + d;
    var qs = state.log.filter(function (m) { return m.t === 'user'; }).slice(-4).map(function (m) { return '• ' + m.text; });
    var lines = ['Hola Over Project, vengo del asistente de su página.'];
    if (extra || state.topic) lines.push('Me interesa: ' + (extra || state.topic));
    if (state.quote && state.quote.length) lines.push('Mi cotización:\n' + state.quote.map(function (r) { return '• ' + r[0] + ': ' + r[1]; }).join('\n'));
    else if (qs.length) lines.push('Mis preguntas:\n' + qs.join('\n'));
    var text = lines.join('\n').slice(0, 1400);
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
  }

  // ---------- Interfaz ----------
  // Ícono del asistente: globo de chat con una "chispa" de IA adentro.
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.2A3.2 3.2 0 0 1 7.2 3h9.6A3.2 3.2 0 0 1 20 6.2v6.6a3.2 3.2 0 0 1-3.2 3.2h-5.5l-4.1 3.5c-.6.5-1.5.1-1.5-.7V16A3.2 3.2 0 0 1 4 12.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 5.4c.35 2.45 1.65 3.75 4.1 4.1-2.45.35-3.75 1.65-4.1 4.1-.35-2.45-1.65-3.75-4.1-4.1 2.45-.35 3.75-1.65 4.1-4.1Z" fill="currentColor"/></svg>';
  // Avatar de la cabecera: chispa grande blanca + chispa chica azul.
  var AVATAR = '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M16 7c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" fill="#fff"/><path class="opc-twinkle" d="M25.5 6.5c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3Z" fill="#8396ff"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  var root = el('div', 'opc');
  var fab = el('button', 'opc-fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Abrir el asistente de Over Project');
  fab.innerHTML = ICON_CHAT;
  fab.appendChild(el('span', 'opc-fab-label', '¿Dudas? Pregúntame'));
  fab.appendChild(el('span', 'opc-dot'));

  var panel = el('section', 'opc-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Asistente de Over Project');
  var head = el('header', 'opc-head');
  var av = el('div', 'opc-avatar');
  av.innerHTML = AVATAR;
  var tt = el('div', 'opc-title');
  tt.appendChild(el('strong', null, 'Asistente Over Project'));
  tt.appendChild(el('span', null, 'Responde al instante'));
  var close = el('button', 'opc-close'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar'); close.innerHTML = ICON_CLOSE;
  head.appendChild(av); head.appendChild(tt); head.appendChild(close);

  var log = el('div', 'opc-log');
  log.setAttribute('aria-live', 'polite');
  var form = el('form', 'opc-form');
  var input = el('textarea', 'opc-input');
  input.rows = 1; input.maxLength = 500; input.placeholder = 'Escribe tu pregunta…'; input.setAttribute('aria-label', 'Tu pregunta');
  var send = el('button', 'opc-send'); send.type = 'submit'; send.setAttribute('aria-label', 'Enviar'); send.innerHTML = ICON_SEND;
  form.appendChild(input); form.appendChild(send);
  var note = el('p', 'opc-note', 'Asistente con IA: puede equivocarse. Confirma precios y detalles por WhatsApp.');

  panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(note);
  root.appendChild(fab); root.appendChild(panel);

  function mount() { document.body.appendChild(root); render(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });

  // Texto de la IA: **negritas** y viñetas, siempre como texto.
  function richText(node, text) {
    var t = String(text).replace(/^\s*[*-]\s+/gm, '• ');
    var parts = t.split(/\*\*(.+?)\*\*/g);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2) node.appendChild(el('strong', null, parts[i]));
      else node.appendChild(document.createTextNode(parts[i].replace(/\*/g, '')));
    }
  }

  // ---------- Registro de la conversación ----------
  function push(item) { state.log.push(item); if (state.log.length > 80) state.log.splice(0, 20); save(); render(); }
  function bot(text) { push({ t: 'bot', text: text }); }
  function user(text) { push({ t: 'user', text: text }); }
  function chips(list) { push({ t: 'chips', list: list }); }

  function renderItem(m, isLast) {
    if (m.t === 'bot' || m.t === 'user') {
      var b = el('div', 'opc-msg ' + (m.t === 'bot' ? 'is-bot' : 'is-user'));
      if (m.t === 'bot') richText(b, m.text); else b.textContent = m.text;
      return b;
    }
    if (m.t === 'card') {
      var c = el('div', 'opc-card');
      c.appendChild(el('h4', null, m.kicker || 'Plan recomendado'));
      c.appendChild(el('div', null, m.name)).style.fontWeight = '700';
      var pr = el('div', 'opc-price', m.price);
      if (m.per) pr.appendChild(el('small', null, ' ' + m.per));
      c.appendChild(pr);
      var ul = el('ul');
      (m.items || []).forEach(function (f) { ul.appendChild(el('li', null, f)); });
      c.appendChild(ul);
      return c;
    }
    if (m.t === 'list') {
      var l = el('div', 'opc-list');
      (m.rows || []).forEach(function (r) {
        var row = el('div', 'opc-row');
        row.appendChild(el('b', null, r[0]));
        row.appendChild(el('span', null, r[1]));
        l.appendChild(row);
      });
      return l;
    }
    if (m.t === 'chips') {
      var box = el('div', 'opc-chips');
      if (!isLast) return null;            // solo los botones más recientes siguen activos
      m.list.forEach(function (ch) {
        var b2 = el('button', 'opc-chip' + (ch.a === 'wa' ? ' is-wa' : ch.a === 'go' ? ' is-go' : ''), ch.l);
        b2.type = 'button';
        b2.addEventListener('click', function () { act(ch); });
        box.appendChild(b2);
      });
      return box;
    }
    return null;
  }

  function render() {
    log.textContent = '';
    state.log.forEach(function (m, i) {
      var n = renderItem(m, i === state.log.length - 1);
      if (n) log.appendChild(n);
    });
    if (busy) {
      var ty = el('div', 'opc-typing');
      ty.appendChild(el('i')); ty.appendChild(el('i')); ty.appendChild(el('i'));
      log.appendChild(ty);
    }
    root.classList.toggle('is-open', !!state.open);
    log.scrollTop = log.scrollHeight;
    send.disabled = busy;
  }

  // ---------- Secciones de la página (botones "Ir a …") ----------
  var SECTIONS = [
    { re: /Aviso de privacidad/i, l: 'Aviso de privacidad', h: '#privacidad' },
    { re: /T[ée]rminos y condiciones/i, l: 'Términos y condiciones', h: '#terminos' },
    { re: /Pol[ií]tica de cookies/i, l: 'Política de cookies', h: '#cookies' },
    { re: /Reembolsos/i, l: 'Reembolsos', h: '#reembolsos' },
    { re: /\bProceso\b/, l: 'Proceso', h: '#/servicios/proceso' },
    { re: /\bCreaciones\b/, l: 'Creaciones', h: '#/inicio/creaciones' },
    { re: /Sobre nosotros|\bNosotros\b/, l: 'Nosotros', h: '#/inicio/nosotros' },
    { re: /\bPlanes\b|\bAdicionales\b/, l: 'Planes', h: '#/planes' },
    { re: /\bServicios\b/, l: 'Servicios', h: '#/servicios' },
    { re: /\bPortafolio\b/, l: 'Portafolio', h: '#/portafolio' },
    { re: /\bContacto\b|\bHablemos\b/, l: 'Contacto', h: '#/inicio/contacto' }
  ];
  var EXAMPLES = /ejemplo|trabajos?\b|portafolio|creaci|proyectos|han hecho|hayan hecho|muestra|clientes/i;
  var EX_CHIPS = [
    { l: 'Ver Creaciones (páginas web) →', a: 'go', h: '#/inicio/creaciones' },
    { l: 'Ver Portafolio →', a: 'go', h: '#/portafolio' }
  ];
  function goChips(text, question) {
    // Si piden ejemplos, siempre se ofrecen las dos secciones de trabajos.
    if (question && EXAMPLES.test(question)) return EX_CHIPS.slice();
    var found = [];
    SECTIONS.forEach(function (sec) {
      if (found.length < 2 && sec.re.test(text) && !found.some(function (f) { return f.h === sec.h; })) {
        found.push({ l: 'Ir a ' + sec.l + ' →', a: 'go', h: sec.h });
      }
    });
    return found;
  }
  function go(hash) {
    if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = hash;
    // En celular el chat tapa la página: se cierra para que vean la sección.
    if (window.matchMedia('(max-width: 600px)').matches) shut();
  }

  // ---------- Flujo guiado ----------
  var MAIN = [
    { l: '¿Qué paquete me conviene?', a: 'recomendar' },
    { l: 'Ver precios', a: 'precios' },
    { l: 'Quiero una página web', a: 'web' },
    { l: 'Servicios sueltos', a: 'servicios' },
    { l: 'Hablar por WhatsApp', a: 'wa' }
  ];
  var AFTER = [
    { l: 'Tengo otra pregunta', a: 'otra' },
    { l: 'Ver precios', a: 'precios' },
    { l: 'Hablar por WhatsApp', a: 'wa' }
  ];

  function greet() {
    if (state.log.length) return;
    bot('¡Hola! Soy el asistente de Over Project. Te ayudo a elegir un paquete, ver precios o resolver tus dudas. ¿Qué necesitas?');
    chips(MAIN);
  }

  function planCard(p, kicker) {
    var feats = (p.features || []).map(function (f) { return clean(f).split(':')[0]; });
    push({ t: 'card', kicker: kicker || 'Paquete recomendado', name: title(p.name), price: price(p.price), per: /landing|informativa|tienda|e-?commerce/i.test(p.name) ? '' : 'pago único', items: feats.slice(0, 8) });
  }

  function act(ch) {
    if (ch.a === 'go') { go(ch.h); return; }
    if (ch.a === 'brief') { user(ch.l); loadContent().then(function () { briefAnswer(ch.l); }); return; }
    if (ch.a === 'brief-resume') { loadContent().then(function () { if (state.brief) { state.brief.paused = false; briefAsk(state.brief.step); } }); return; }
    // Cualquier otro botón deja en pausa la entrevista (se puede retomar con "Seguir con mi cotización").
    if (state.brief && state.brief.step && state.brief.step !== 'done' && ch.a !== 'wa') state.brief.paused = true;
    if (ch.a !== 'wa' && ch.a !== 'otra') user(ch.l);
    loadContent().then(function () { route(ch); });
  }

  function route(ch) {
    if (!content && ch.a !== 'wa') { bot('No pude cargar la información en este momento. Escríbenos por WhatsApp y te ayudamos.'); chips([{ l: 'Hablar por WhatsApp', a: 'wa' }]); return; }
    switch (ch.a) {
      case 'recomendar':
        bot('¿Qué necesitas principalmente?');
        chips([
          { l: 'Contenido para redes', a: 'redes' },
          { l: 'Página web informativa', a: 'web-info' },
          { l: 'Tienda en línea', a: 'web-shop' },
          { l: 'Foto o video suelto', a: 'servicios' }
        ]);
        break;
      case 'redes':
        var opts = monthlyPlans().map(function (p) { var r = reelsOf(p); return r ? { l: r + ' reels', a: 'reels', n: r } : null; }).filter(Boolean);
        if (!opts.length) { route({ a: 'precios' }); break; }
        bot('¿Cuántos reels necesitas?');
        opts.push({ l: 'No estoy seguro', a: 'reels', n: 0 });
        chips(opts);
        break;
      case 'reels':
        var list = monthlyPlans().filter(function (p) { return reelsOf(p) != null; }).sort(function (a, b) { return reelsOf(a) - reelsOf(b); });
        var pick = ch.n ? (list.filter(function (p) { return reelsOf(p) >= ch.n; })[0] || list[list.length - 1]) : (list.filter(function (p) { return /m[aá]s elegido/i.test(p.badge || ''); })[0] || list[Math.floor(list.length / 2)]);
        if (!pick) { route({ a: 'precios' }); break; }
        state.topic = 'Paquete ' + title(pick.name);
        bot(ch.n ? 'Para ' + ch.n + ' reels te recomiendo este paquete (pago único):' : 'Si apenas vas a empezar, este es el que más eligen nuestros clientes:');
        planCard(pick);
        chips([{ l: 'Quiero este paquete', a: 'wa', topic: 'Paquete ' + title(pick.name) }, { l: 'Ir a Planes →', a: 'go', h: '#/planes' }].concat(AFTER.slice(0, 1)));
        break;
      case 'web':
        briefStart();
        break;
      case 'web-planes':
        bot('Tenemos dos opciones de página web:');
        webPlans().forEach(function (p) { planCard(p, 'Página web'); });
        chips([
          { l: 'Quiero una informativa', a: 'wa', topic: title((webPlans()[0] || {}).name || 'Página web') },
          { l: 'Quiero una tienda en línea', a: 'wa', topic: title((webPlans()[1] || {}).name || 'Tienda en línea') },
          EX_CHIPS[0],
          { l: 'Ir a Planes →', a: 'go', h: '#/planes' },
          { l: 'Tengo otra pregunta', a: 'otra' }
        ]);
        break;
      case 'web-info':
      case 'web-shop':
        var wp = webPlans().filter(function (p) { return ch.a === 'web-shop' ? /tienda|e-?commerce/i.test(p.name) : /landing|informativa/i.test(p.name); })[0];
        if (!wp) { route({ a: 'web' }); break; }
        state.topic = title(wp.name);
        bot(ch.a === 'web-shop' ? 'Para vender en línea, esta es la opción:' : 'Para dar a conocer tu negocio, esta es la opción:');
        planCard(wp, 'Página web');
        chips([{ l: 'Quiero esta opción', a: 'wa', topic: title(wp.name) }, EX_CHIPS[0]].concat(AFTER.slice(0, 1)));
        break;
      case 'precios':
        bot('Estos son nuestros precios (MXN):');
        var rows = monthlyPlans().map(function (p) { return ['Paquete ' + title(p.name), price(p.price)]; })
          .concat(webPlans().map(function (p) { return [title(p.name), price(p.price)]; }))
          .concat(((content.plans && content.plans.addons) || []).map(function (a) { return [clean(a.name), price(a.price)]; }));
        push({ t: 'list', rows: rows });
        chips([{ l: '¿Qué paquete me conviene?', a: 'recomendar' }, { l: 'Ir a Planes →', a: 'go', h: '#/planes' }, { l: 'Hablar por WhatsApp', a: 'wa' }]);
        break;
      case 'servicios':
        bot('Servicios que puedes contratar por separado:');
        push({ t: 'list', rows: ((content.services && content.services.items) || []).map(function (s) { return [clean(s.name), price(s.price)]; }) });
        chips([{ l: 'Ir a Servicios →', a: 'go', h: '#/servicios' }].concat(AFTER));
        break;
      case 'otra':
        bot('Claro, escríbeme tu pregunta abajo.');
        setTimeout(function () { input.focus(); }, 50);
        break;
      case 'wa':
        if (ch.topic) state.topic = ch.topic;
        user(ch.l);
        bot('¡Perfecto! Te abro WhatsApp con el resumen de lo que platicamos para que te atiendan personalmente.');
        save();
        window.open(waLink(ch.topic), '_blank', 'noopener');
        chips([{ l: 'Abrir WhatsApp otra vez', a: 'wa' }, { l: 'Seguir preguntando', a: 'otra' }]);
        break;
    }
  }

  // ---------- Entrevista para cotizar una página web ----------
  // "Hola, quiero una página web" (o el botón) abre unas preguntas rápidas y al final arma la cotización.
  var WEB_INTENT = /p[aá]gina|sitio|\bweb\b|landing|tienda (en )?l[ií]nea|tienda online|e-?commerce|ecomerce/i;
  var WANT = /quiero|quisiera|necesito|ocupo|busco|me interesa|cotiz|hacer|crear|dise[ñn]ar|cu[aá]nto|precio|costo|una p[aá]gina|un sitio|una tienda|mi p[aá]gina|mi tienda/i;
  function wantsWeb(t) {
    return WEB_INTENT.test(t) && WANT.test(t) && !/ejemplo|han hecho|hayan hecho|portafolio|creaciones|d[oó]nde|en qu[eé] parte/i.test(t);
  }
  function guessType(t) {
    if (/tienda|e-?commerce|ecomerce|vender|venta|productos|carrito/i.test(t)) return 'shop';
    if (/informativa|landing|dar a conocer|presentar|mostrar mi negocio/i.test(t)) return 'info';
    return '';
  }
  var BRIEF_ORDER = ['type', 'negocio', 'tamano', 'funciones', 'marca', 'dominio', 'cuando'];
  function briefDef(step) {
    var shop = state.brief && state.brief.a.type === 'shop';
    switch (step) {
      case 'type': return { q: '¿Qué tipo de página necesitas?', opts: ['Informativa (dar a conocer mi negocio)', 'Tienda en línea (vender productos)', 'No estoy seguro'] };
      case 'negocio': return { q: '¿De qué es tu negocio o marca? Escríbelo abajo (por ejemplo: cafetería, consultorio, ropa deportiva).', opts: ['Prefiero no decir'], free: true, label: 'Negocio' };
      case 'tamano': return shop
        ? { q: '¿Cuántos productos venderías, más o menos?', opts: ['Menos de 20', 'De 20 a 100', 'Más de 100', 'Aún no sé'], label: 'Productos' }
        : { q: '¿Cuántas secciones te imaginas? (por ejemplo: Inicio, Servicios, Nosotros, Contacto)', opts: ['Una sola página', 'De 3 a 5 secciones', 'Más de 5 secciones', 'Aún no sé'], label: 'Secciones' };
      case 'funciones': return shop
        ? { q: '¿Cómo quieres cobrar y entregar?', opts: ['Pago con tarjeta en línea', 'Pago en línea y envíos a domicilio', 'Pedidos por WhatsApp', 'Aún no sé'], label: 'Cobro y entrega' }
        : { q: '¿Qué es lo más importante que debe tener?', opts: ['WhatsApp y formulario de contacto', 'Galería o portafolio', 'Reservas o citas', 'Blog o noticias', 'Lo básico'], label: 'Lo principal' };
      case 'marca': return { q: '¿Ya tienes logo e identidad de marca (colores, tipografía)?', opts: ['Sí, ya tengo', 'Tengo logo, pero quiero mejorarlo', 'No, también lo necesito'], label: 'Logo e identidad' };
      case 'dominio': return { q: '¿Ya tienes dominio? (la dirección de tu página, por ejemplo tunegocio.com)', opts: ['Sí, ya tengo', 'No, aún no', 'No sé qué es'], label: 'Dominio' };
      case 'cuando': return { q: 'Por último, ¿para cuándo la necesitas?', opts: ['Lo antes posible', 'En las próximas semanas', 'Sin prisa'], label: 'Para cuándo' };
    }
    return null;
  }
  function briefAsk(step) {
    var d = briefDef(step);
    if (!d) return briefQuote();
    state.brief.step = step;
    bot(d.q);
    chips(d.opts.map(function (o) { return { l: o, a: 'brief' }; }));
    if (d.free) setTimeout(function () { input.focus(); }, 50);
  }
  function briefNext() {
    var i = BRIEF_ORDER.indexOf(state.brief.step);
    var nx = BRIEF_ORDER[i + 1];
    if (nx) briefAsk(nx); else briefQuote();
  }
  function briefStart(pre) {
    state.quote = null;
    state.brief = { step: null, a: {}, paused: false };
    if (pre) {
      state.brief.a.type = pre;
      state.brief.step = 'type';
      bot('¡Claro! ' + (pre === 'shop' ? 'Una tienda en línea para vender tus productos.' : 'Una página informativa para dar a conocer tu negocio.') + ' Te hago unas preguntas rápidas para armar tu cotización.');
      briefNext();
    } else {
      bot('¡Claro! Te hago unas preguntas rápidas para armar tu cotización.');
      briefAsk('type');
    }
  }
  function briefAnswer(v, typed) {
    var b = state.brief;
    if (!b || !b.step || b.step === 'done') return;
    b.paused = false;
    if (b.step === 'type') {
      var g = /no estoy seguro|no s[eé]/i.test(v) ? '' : (guessType(v) || (/^informativa/i.test(v) ? 'info' : ''));
      if (!g) {
        bot('Te explico rápido:\n• **Informativa:** presenta tu negocio, tus servicios y cómo contactarte (ideal para que te encuentren y te escriban).\n• **Tienda en línea:** tus clientes ven tus productos, los agregan al carrito y pagan desde la página.');
        bot('¿Cuál se parece más a lo que buscas?');
        chips([{ l: 'Informativa (dar a conocer mi negocio)', a: 'brief' }, { l: 'Tienda en línea (vender productos)', a: 'brief' }]);
        return;
      }
      b.a.type = g;
    } else {
      b.a[b.step] = String(v).slice(0, 160);
    }
    save();
    briefNext();
  }
  function briefQuote() {
    var b = state.brief, a = b.a, shop = a.type === 'shop';
    b.step = 'done';
    var p = webPlans().filter(function (x) { return shop ? /tienda|e-?commerce/i.test(x.name) : /landing|informativa/i.test(x.name); })[0];
    var name = shop ? 'Tienda en línea' : 'Página web informativa';
    var rows = [['Tipo', name]];
    BRIEF_ORDER.slice(1).forEach(function (k) { var d = briefDef(k); if (a[k]) rows.push([d.label, a[k]]); });
    if (p) rows.push(['Precio', price(p.price)]);
    state.quote = rows;
    state.topic = 'Cotización: ' + name;
    bot('¡Gracias! Con lo que me contaste, esta es tu cotización:');
    if (p) planCard(p, 'Tu cotización');
    // En el resumen se recortan textos largos (en WhatsApp va completo).
    push({ t: 'list', rows: rows.filter(function (r) { return r[0] !== 'Precio'; }).map(function (r) { return [r[0], r[1].length > 38 ? r[1].slice(0, 36) + '…' : r[1]]; }) });
    var notes = [];
    notes.push('• Es un **pago único** a partir del precio de la tarjeta, e incluye lo que ahí aparece.');
    if (/Más de 5|Más de 100|Reservas|Blog|envíos/i.test([a.tamano, a.funciones].join(' '))) notes.push('• Por el tamaño o las funciones que necesitas, el precio final puede ajustarse; te lo confirmamos por WhatsApp.');
    if (a.dominio && !/^Sí/.test(a.dominio)) notes.push('• El costo del dominio lo cubre el cliente; nosotros te ayudamos a elegirlo y configurarlo.');
    if (a.marca && !/^Sí/.test(a.marca)) notes.push('• El diseño o la mejora del logo se cotiza aparte; lo incluimos en tu propuesta.');
    notes.push('Envíanos tu cotización por WhatsApp y te respondemos con la propuesta final.');
    bot(notes.join('\n'));
    chips([
      { l: 'Enviar mi cotización por WhatsApp', a: 'wa' },
      EX_CHIPS[0],
      { l: 'Empezar de nuevo', a: 'web' },
      { l: 'Tengo otra pregunta', a: 'otra' }
    ]);
  }

  // ---------- Preguntas libres (IA) ----------
  var busy = false;
  function ask(text) {
    if (busy) return;
    if (state.asked >= MAX_QUESTIONS) {
      bot('¡Ya platicamos bastante! Para darte una atención más personal, sigamos por WhatsApp; te llevas un resumen de tus preguntas.');
      chips([{ l: 'Hablar por WhatsApp', a: 'wa' }]);
      return;
    }
    user(text);
    state.asked++;
    state.ai.push({ role: 'user', content: text });
    if (state.ai.length > 40) state.ai = state.ai.slice(-40);
    busy = true; render();
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: state.ai.slice(-HISTORY) }) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, fallback: true }; })
      .then(function (j) {
        busy = false;
        if (j && j.ok && j.reply) {
          state.ai.push({ role: 'assistant', content: j.reply });
          bot(j.reply);
          chips((state.brief && state.brief.paused ? [{ l: 'Seguir con mi cotización', a: 'brief-resume' }] : []).concat(goChips(j.reply, text), AFTER));
        } else if (j && j.limit) {
          bot('¡Ya platicamos bastante! Para darte una atención más personal, sigamos por WhatsApp; te llevas un resumen de tus preguntas.');
          chips([{ l: 'Hablar por WhatsApp', a: 'wa' }]);
        } else {
          state.ai.pop();
          bot('Ahorita no puedo responder eso, pero te contestamos personalmente por WhatsApp. También puedes usar los botones para ver paquetes y precios.');
          chips([{ l: 'Hablar por WhatsApp', a: 'wa' }, { l: '¿Qué paquete me conviene?', a: 'recomendar' }, { l: 'Ver precios', a: 'precios' }]);
        }
        save();
        render();
      });
  }

  // ---------- Eventos ----------
  function open() { state.open = true; loadContent(); greet(); save(); render(); setTimeout(function () { if (window.matchMedia('(hover: hover)').matches) input.focus(); }, 120); }
  function shut() { state.open = false; save(); render(); fab.focus(); }
  fab.addEventListener('click', open);
  close.addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) shut(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = input.value.trim();
    if (!t) return;
    input.value = '';
    input.style.height = '';
    var b = state.brief;
    // Entrevista activa: lo que escriben es la respuesta (si es una pregunta, la contesta la IA y la entrevista queda en pausa).
    if (b && b.step && b.step !== 'done' && !b.paused) {
      if (/\?|^¿/.test(t)) { b.paused = true; ask(t); return; }
      user(t);
      loadContent().then(function () { briefAnswer(t, true); });
      return;
    }
    if (wantsWeb(t)) {
      user(t);
      loadContent().then(function () { briefStart(guessType(t)); });
      return;
    }
    ask(t);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
  });
  input.addEventListener('input', function () { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
})();
