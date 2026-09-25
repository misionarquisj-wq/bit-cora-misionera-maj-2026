/* ─────────────────────────────────────────────────────────────
   IMPORTANTE: cada vez que se edite CUALQUIER archivo del sitio
   hay que cambiar VERSION. Si no se cambia, los teléfonos que ya
   tienen la Bitácora guardada NUNCA reciben la corrección.
   Usar la fecha del cambio: '2026-09-25a', '2026-09-25b', etc.
   ───────────────────────────────────────────────────────────── */
const VERSION = '2026-09-26c';

const CACHE = `bitacora-${VERSION}`;

/* Los mapas detallados van en una caché aparte y sin versión: pesan 10 MB
   y no tendría sentido volver a bajarlos cada vez que se corrige un texto.
   Solo se borran si alguien los borra a propósito. */
const CACHE_MAPAS = 'bitacora-mapas-v1';
const LISTA_TILES = './tiles/lista.json';

// Lo imprescindible para que la app abra. Es chico y se baja de una.
const NUCLEO = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './images/ui/cruz-maj-v2.png',
  './images/ui/icon-180-v2.png',
  './images/ui/icon-192-v2.png',
  './images/ui/icon-512-v2.png',
  './images/ui/icon-maskable-512-v2.png',
  './fonts/chewy.woff2',
  './fonts/fredoka-600.woff2',
  './fonts/patrick-hand.woff2',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './zonas.geojson',
  './calles.json',
  './tiles/lista.json'
];

// Lo pesado. Se baja después, de a poco y con reintentos, para que
// una señal mala no tire abajo la descarga entera.
const PESADO = [
  './images/ui/portada.png',
  './images/ui/oido.png',
  './images/ui/rosario-continentes.jpg',
  './images/maps/zona-1.jpg',
  './images/maps/zona-2.jpg',
  './images/maps/zona-3.jpg',
  './images/maps/zona-4.jpg',
  './images/maps/zona-5.jpg',
  './images/maps/zona-6.jpg',
  './images/maps/zona-7.jpg'
];

const TODO = [...NUCLEO, ...PESADO];

const ESPERA_MAXIMA = 15000;
const TAMANO_DE_LOTE = 3;
const INTENTOS_POR_ARCHIVO = 3;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(NUCLEO.map(url => guardarFresco(c, url))))
      .then(() => self.skipWaiting())
  );
});

/* Pide el archivo salteando la caché del navegador. Sin esto, al subir
   una versión nueva se puede terminar guardando el archivo viejo que el
   navegador todavía tenía dado por bueno, y queda servido hasta la
   próxima VERSION. Pasó con el ícono de la barra. */
function pedidoFresco(url) {
  return new Request(url, { cache: 'reload' });
}

async function guardarFresco(cache, url) {
  const respuesta = await traerConLimiteDeTiempo(pedidoFresco(url));
  if (!sePuedeGuardar(respuesta)) throw new Error('no se pudo guardar ' + url);
  await cache.put(url, respuesta);
}

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(
      claves.filter(k => k !== CACHE && k !== CACHE_MAPAS).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// La descarga pesada la dispara la página, no el activate: así el
// service worker sigue vivo mientras baja y puede ir informando.
self.addEventListener('message', e => {
  const orden = (e.data && e.data.tipo) || '';
  if (orden === 'estado') e.waitUntil(informarEstado());
  if (orden === 'descargar') e.waitUntil(descargarPendientes());
  if (orden === 'estado-mapas') e.waitUntil(informarMapas());
  if (orden === 'descargar-mapas') e.waitUntil(descargarMapas());
  if (orden === 'borrar-mapas') e.waitUntil(caches.delete(CACHE_MAPAS).then(informarMapas));
});

let descargaEnCurso = false;

async function descargarPendientes() {
  if (descargaEnCurso) return;
  descargaEnCurso = true;

  try {
    const cache = await caches.open(CACHE);
    const pendientes = [];
    for (const url of TODO) {
      if (!(await cache.match(url))) pendientes.push(url);
    }

    let guardados = TODO.length - pendientes.length;
    await avisar({ tipo: 'progreso', guardados, total: TODO.length });

    for (let i = 0; i < pendientes.length; i += TAMANO_DE_LOTE) {
      const lote = pendientes.slice(i, i + TAMANO_DE_LOTE);
      const resultados = await Promise.allSettled(
        lote.map(url => guardarConReintentos(cache, url))
      );
      guardados += resultados.filter(r => r.status === 'fulfilled' && r.value).length;
      await avisar({ tipo: 'progreso', guardados, total: TODO.length });
    }

    await informarEstado();
  } finally {
    descargaEnCurso = false;
  }
}

async function guardarConReintentos(cache, url) {
  for (let intento = 0; intento < INTENTOS_POR_ARCHIVO; intento++) {
    try {
      await guardarFresco(cache, url);
      return true;
    } catch (_) {}
    await esperar(800 * Math.pow(2, intento));
  }
  return false;
}

async function informarEstado() {
  const cache = await caches.open(CACHE);
  let guardados = 0;
  for (const url of TODO) {
    if (await cache.match(url)) guardados++;
  }
  await avisar({
    tipo: 'estado',
    version: VERSION,
    guardados,
    total: TODO.length,
    completo: guardados === TODO.length
  });
}

async function avisar(mensaje) {
  const ventanas = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  ventanas.forEach(v => v.postMessage(mensaje));
}

/* ── Mapas detallados, descarga aparte ── */

async function listaDeTiles() {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(LISTA_TILES);
  const respuesta = guardada || await traerConLimiteDeTiempo(pedidoFresco(LISTA_TILES));
  return respuesta.json();
}

async function informarMapas() {
  let lista;
  try { lista = await listaDeTiles(); }
  catch (_) { return avisar({ tipo: 'mapas', guardados: 0, total: 0, completo: false }); }

  const cache = await caches.open(CACHE_MAPAS);
  const hay = (await cache.keys()).length;
  await avisar({
    tipo: 'mapas',
    guardados: Math.min(hay, lista.length),
    total: lista.length,
    completo: hay >= lista.length
  });
}

let bajandoMapas = false;

async function descargarMapas() {
  if (bajandoMapas) return;
  bajandoMapas = true;

  try {
    const lista = await listaDeTiles();
    const cache = await caches.open(CACHE_MAPAS);
    const pendientes = [];
    for (const t of lista) {
      const url = `./tiles/${t}.jpg`;
      if (!(await cache.match(url))) pendientes.push(url);
    }

    let guardados = lista.length - pendientes.length;
    await avisar({ tipo: 'mapas-progreso', guardados, total: lista.length });

    // Lotes más grandes que el contenido: son archivos chicos y son muchos.
    const LOTE = 8;
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const lote = pendientes.slice(i, i + LOTE);
      const r = await Promise.allSettled(lote.map(u => guardarConReintentos(cache, u)));
      guardados += r.filter(x => x.status === 'fulfilled' && x.value).length;
      if (i % (LOTE * 5) === 0 || i + LOTE >= pendientes.length) {
        await avisar({ tipo: 'mapas-progreso', guardados, total: lista.length });
      }
    }
    await informarMapas();
  } finally {
    bajandoMapas = false;
  }
}

const ARCHIVOS_DE_CODIGO = ['', 'index.html', 'style.css', 'script.js', 'manifest.webmanifest'];

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/tiles/') && url.pathname.endsWith('.jpg')) {
    e.respondWith(servirTile(e.request));
    return;
  }

  const archivo = url.pathname.split('/').pop();
  const esCodigo = e.request.mode === 'navigate' || ARCHIVOS_DE_CODIGO.includes(archivo);

  e.respondWith(esCodigo ? servirYRefrescar(e.request) : servirDeCache(e.request));
});

// Textos, estilos y lógica: se sirven al instante desde el guardado
// y se refrescan de fondo, así la próxima apertura ya trae lo nuevo.
async function servirYRefrescar(request) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(request);

  const desdeRed = traerConLimiteDeTiempo(request)
    .then(respuesta => {
      if (sePuedeGuardar(respuesta)) cache.put(request, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);

  if (guardado) return guardado;
  return (await desdeRed) || respuestaDeEmergencia(request);
}

// Imágenes y mapas: no cambian nunca dentro de una misma versión.
async function servirDeCache(request) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  try {
    const respuesta = await traerConLimiteDeTiempo(request);
    if (sePuedeGuardar(respuesta)) cache.put(request, respuesta.clone());
    return respuesta;
  } catch (_) {
    return respuestaDeEmergencia(request);
  }
}

// Un pedacito de mapa que no está descargado no es un error: el mapa
// simplemente muestra ese cuadrado en gris y se sigue usando.
async function servirTile(request) {
  const cache = await caches.open(CACHE_MAPAS);
  const guardado = await cache.match(request);
  if (guardado) return guardado;
  try {
    return await traerConLimiteDeTiempo(request);
  } catch (_) {
    return new Response('', { status: 404 });
  }
}

// Con señal muy débil un pedido puede quedar colgado para siempre,
// que es peor que no tener señal. A los 15 segundos se corta.
function traerConLimiteDeTiempo(request) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA);
  return fetch(request, { signal: control.signal })
    .finally(() => clearTimeout(reloj));
}

// Sin esto se guardan los errores 404 y las páginas de login
// de los WiFi con portal cautivo, y quedan servidas para siempre.
function sePuedeGuardar(respuesta) {
  return respuesta && respuesta.ok && respuesta.status === 200 && respuesta.type === 'basic';
}

function esperar(ms) {
  return new Promise(listo => setTimeout(listo, ms));
}

async function respuestaDeEmergencia(request) {
  if (request.mode === 'navigate') {
    const inicio = await caches.match('./index.html');
    if (inicio) return inicio;

    return new Response(
      `<!doctype html><html lang="es"><head><meta charset="utf-8">
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <title>Bitácora Misionera</title></head>
       <body style="margin:0;padding:40px 24px;font-family:system-ui,sans-serif;background:#fffdfb;color:#222;text-align:center">
       <h1 style="color:#914f70;font-size:1.4rem">Falta contenido por descargar</h1>
       <p style="line-height:1.6">La Bitácora no terminó de guardarse en este teléfono.
       Conectate a internet y volvé a abrirla para completar la descarga.</p>
       </body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (request.destination === 'image') {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
       <rect width="400" height="260" fill="#f5edf1"/>
       <text x="200" y="124" text-anchor="middle" font-family="system-ui,sans-serif"
         font-size="17" font-weight="bold" fill="#914f70">Mapa no descargado</text>
       <text x="200" y="150" text-anchor="middle" font-family="system-ui,sans-serif"
         font-size="14" fill="#733b57">Abrí la app con internet para bajarlo</text>
       </svg>`,
      { status: 503, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } }
    );
  }

  return new Response('', { status: 503 });
}
