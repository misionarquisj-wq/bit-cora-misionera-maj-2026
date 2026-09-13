/* ─────────────────────────────────────────────────────────────
   IMPORTANTE: cada vez que se edite CUALQUIER archivo del sitio
   hay que cambiar VERSION. Si no se cambia, los teléfonos que ya
   tienen la Bitácora guardada NUNCA reciben la corrección.
   Usar la fecha del cambio: '2026-09-25a', '2026-09-25b', etc.
   ───────────────────────────────────────────────────────────── */
const VERSION = '2026-09-12a';

const CACHE = `bitacora-${VERSION}`;

// Lo imprescindible para que la app abra. Es chico y se baja de una.
const NUCLEO = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './images/ui/cruz-maj.png',
  './images/ui/icon-180.png',
  './images/ui/icon-192.png',
  './images/ui/icon-512.png'
];

// Lo pesado. Se baja después, de a poco y con reintentos, para que
// una señal mala no tire abajo la descarga entera.
const PESADO = [
  './images/ui/portada.png',
  './images/ui/oido.png',
  './images/maps/map-015.jpg',
  './images/maps/map-016.jpg',
  './images/maps/map-017.jpg',
  './images/maps/map-018.jpg',
  './images/maps/map-019.jpg',
  './images/maps/map-020.jpg',
  './images/maps/map-021.jpg',
  './images/maps/map-022.jpg',
  './images/maps/map-023.jpg',
  './images/maps/map-024.jpg'
];

const TODO = [...NUCLEO, ...PESADO];

const ESPERA_MAXIMA = 15000;
const TAMANO_DE_LOTE = 3;
const INTENTOS_POR_ARCHIVO = 3;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(NUCLEO))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// La descarga pesada la dispara la página, no el activate: así el
// service worker sigue vivo mientras baja y puede ir informando.
self.addEventListener('message', e => {
  const orden = (e.data && e.data.tipo) || '';
  if (orden === 'estado') e.waitUntil(informarEstado());
  if (orden === 'descargar') e.waitUntil(descargarPendientes());
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
      const respuesta = await traerConLimiteDeTiempo(url);
      if (sePuedeGuardar(respuesta)) {
        await cache.put(url, respuesta);
        return true;
      }
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
    guardados,
    total: TODO.length,
    completo: guardados === TODO.length
  });
}

async function avisar(mensaje) {
  const ventanas = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  ventanas.forEach(v => v.postMessage(mensaje));
}

const ARCHIVOS_DE_CODIGO = ['', 'index.html', 'style.css', 'script.js', 'manifest.webmanifest'];

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

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
