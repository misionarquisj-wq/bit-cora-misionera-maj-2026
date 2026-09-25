/* El registro del service worker va PRIMERO y aislado del resto.
   Es lo que hace que la Bitácora funcione sin señal: si algo más
   de este archivo falla, esto ya se ejecutó. */
(function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const yaEstabaInstalada = !!navigator.serviceWorker.controller;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(error => console.error('No se pudo registrar el service worker:', error));
  });

  // En la primera visita el controlador aparece por primera vez y eso no es
  // una actualización, es la instalación. Solo avisamos si ya había una.
  if (yaEstabaInstalada) {
    navigator.serviceWorker.addEventListener('controllerchange', avisarActualizacion);
  }
})();

function avisarActualizacion() {
  const aviso = document.getElementById('avisoActualizacion');
  if (aviso) aviso.hidden = false;
}

/* Cada bloque corre aislado: si uno se rompe al editar el HTML,
   los demás siguen funcionando. */
function modulo(nombre, iniciar) {
  try {
    iniciar();
  } catch (error) {
    console.error(`Falló el módulo "${nombre}":`, error);
  }
}

let cerrarMenu = () => {};

modulo('menú', () => {
  const menu = document.getElementById('menu');
  const fondo = document.getElementById('backdrop');
  const botonAbrir = document.getElementById('menuBtn');
  const botonCerrar = document.getElementById('closeMenu');
  if (!menu || !fondo || !botonAbrir || !botonCerrar) return;

  const cerrarSinTocarHistorial = () => {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    botonAbrir.setAttribute('aria-expanded', 'false');
    fondo.hidden = true;
  };

  const abrir = () => {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    menu.inert = false;
    botonAbrir.setAttribute('aria-expanded', 'true');
    fondo.hidden = false;
    botonCerrar.focus();
    // Para que el botón Atrás de Android cierre el menú en vez de
    // salirse de la aplicación.
    history.pushState({ menuAbierto: true }, '');
  };

  cerrarMenu = () => {
    if (history.state && history.state.menuAbierto) {
      history.back();
      return;
    }
    cerrarSinTocarHistorial();
  };

  window.addEventListener('popstate', cerrarSinTocarHistorial);

  botonAbrir.addEventListener('click', abrir);
  botonCerrar.addEventListener('click', () => { cerrarMenu(); botonAbrir.focus(); });
  fondo.addEventListener('click', cerrarMenu);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) cerrarMenu();
  });

  cerrarSinTocarHistorial();
});

modulo('navegación', () => {
  const vistas = [...document.querySelectorAll('[data-view]')];
  if (!vistas.length) return;

  /* Se resuelve contra las vistas y no contra el documento entero.
     Con getElementById, un hash que exista pero no sea vista —como
     #contenido, que es el destino del propio link "Saltar al
     contenido"— dejaba la pantalla completamente en blanco. */
  const porId = new Map(vistas.map(vista => [vista.id, vista]));
  const inicio = porId.get('inicio') || vistas[0];

  const mostrarVista = () => {
    const id = (location.hash || '#inicio').slice(1);
    const destino = porId.get(id) || inicio;
    vistas.forEach(vista => { vista.hidden = vista !== destino; });
    cerrarMenu();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  window.addEventListener('hashchange', mostrarVista);
  mostrarVista();
});

modulo('saltar al contenido', () => {
  const salto = document.querySelector('.skip');
  const principal = document.getElementById('contenido');
  if (!salto || !principal) return;

  // Mueve el foco sin tocar el hash: si cambiara el hash, el router
  // se llevaría por delante la vista que se está mostrando.
  salto.addEventListener('click', e => {
    e.preventDefault();
    principal.focus();
    principal.scrollIntoView();
  });
});

modulo('buscador de oraciones', () => {
  const campo = document.getElementById('buscarOracion');
  const lista = document.getElementById('listaOraciones');
  const vacio = document.getElementById('sinResultados');
  if (!campo || !lista) return;

  // Sin tildes y en minúscula, para que "maria" encuentre "María".
  const normalizar = texto =>
    texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const oraciones = [...lista.querySelectorAll('.plegable')]
    .map(el => ({ el, texto: normalizar(el.textContent) }));
  const grupos = [...lista.querySelectorAll('.grupo-oraciones')];

  const filtrar = () => {
    const busca = normalizar(campo.value.trim());
    let visibles = 0;

    oraciones.forEach(({ el, texto }) => {
      const coincide = !busca || texto.includes(busca);
      el.hidden = !coincide;
      el.open = Boolean(busca) && coincide;
      if (coincide) visibles++;
    });

    // Un título de grupo solo se muestra si le queda alguna oración debajo.
    grupos.forEach(titulo => {
      let siguiente = titulo.nextElementSibling;
      let hayAlguna = false;
      while (siguiente && !siguiente.classList.contains('grupo-oraciones')) {
        if (siguiente.classList.contains('plegable') && !siguiente.hidden) {
          hayAlguna = true;
          break;
        }
        siguiente = siguiente.nextElementSibling;
      }
      titulo.hidden = !hayAlguna;
    });

    if (vacio) vacio.hidden = visibles > 0;
  };

  campo.addEventListener('input', filtrar);
  filtrar();
});

modulo('mapas', () => {
  const dialogo = document.getElementById('mapDialog');
  const imagen = document.getElementById('dialogImage');
  const lienzo = document.getElementById('dialogLienzo');
  if (!dialogo || !imagen || !lienzo || typeof dialogo.showModal !== 'function') return;

  const nivel = document.getElementById('zoomNivel');
  const MINIMO = 1, MAXIMO = 5, PASO = 0.5;
  let zoom = 1;

  const aplicarZoom = () => {
    lienzo.style.setProperty('--zoom', zoom);
    if (nivel) nivel.textContent = Math.round(zoom * 100) + '%';
  };

  const cambiarZoom = paso => {
    const anterior = zoom;
    zoom = Math.min(MAXIMO, Math.max(MINIMO, zoom + paso));
    if (zoom === anterior) return;
    // Mantiene el centro de lo que se está mirando al acercar o alejar.
    const centroX = (lienzo.scrollLeft + lienzo.clientWidth / 2) / anterior;
    const centroY = (lienzo.scrollTop + lienzo.clientHeight / 2) / anterior;
    aplicarZoom();
    lienzo.scrollLeft = centroX * zoom - lienzo.clientWidth / 2;
    lienzo.scrollTop = centroY * zoom - lienzo.clientHeight / 2;
  };

  document.querySelectorAll('.map-button').forEach(boton => {
    boton.addEventListener('click', () => {
      imagen.src = boton.dataset.map;
      imagen.alt = (boton.querySelector('img') || {}).alt || 'Mapa ampliado';
      zoom = 1;
      aplicarZoom();
      lienzo.scrollTo(0, 0);
      dialogo.showModal();
    });
  });

  const mas = document.getElementById('zoomMas');
  const menos = document.getElementById('zoomMenos');
  if (mas) mas.addEventListener('click', () => cambiarZoom(PASO));
  if (menos) menos.addEventListener('click', () => cambiarZoom(-PASO));

  // Doble toque para acercar de una, como en cualquier mapa.
  imagen.addEventListener('dblclick', () => cambiarZoom(zoom >= MAXIMO ? MINIMO - zoom : 1.5));

  const botonCerrar = dialogo.querySelector('.dialog-close');
  if (botonCerrar) botonCerrar.addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', e => { if (e.target === dialogo) dialogo.close(); });
});

modulo('aviso de actualización', () => {
  const boton = document.getElementById('btnActualizar');
  if (boton) boton.addEventListener('click', () => location.reload());

  /* Botón manual: obliga al navegador a ir a buscar una versión nueva
     en vez de esperar a que se le ocurra, y recarga. Es la salida
     cuando alguien quedó con contenido viejo y no sabe por qué. */
  const buscar = document.getElementById('btnBuscarActualizacion');
  if (!buscar || !('serviceWorker' in navigator)) return;

  buscar.addEventListener('click', async () => {
    const textoOriginal = buscar.textContent;
    buscar.textContent = 'Buscando…';
    buscar.disabled = true;
    try {
      const registro = await navigator.serviceWorker.getRegistration();
      if (registro) await registro.update();
    } catch (error) {
      console.error('No se pudo buscar actualización:', error);
    }
    setTimeout(() => location.reload(), 1200);
    setTimeout(() => { buscar.textContent = textoOriginal; buscar.disabled = false; }, 4000);
  });
});

/* Lo más importante de la app: que el misionero SEPA si ya puede
   irse sin señal. Antes no había forma de saberlo. */
modulo('estado de la descarga', () => {
  const caja = document.getElementById('estadoOffline');
  const texto = document.getElementById('estadoTexto');
  const progreso = document.getElementById('estadoProgreso');
  const reintentar = document.getElementById('estadoReintentar');
  if (!caja || !texto || !progreso || !reintentar) return;
  if (!('serviceWorker' in navigator)) return;

  const pintar = datos => {
    const total = datos.total || 1;
    caja.hidden = false;
    progreso.style.width = Math.round((datos.guardados / total) * 100) + '%';

    if (datos.tipo === 'progreso') {
      caja.dataset.estado = 'bajando';
      texto.textContent = `Descargando para usar sin señal… ${datos.guardados} de ${datos.total}`;
      reintentar.hidden = true;
      return;
    }

    if (datos.completo) {
      caja.dataset.estado = 'listo';
      texto.textContent = 'Listo para usar sin señal';
      reintentar.hidden = true;
      return;
    }

    caja.dataset.estado = 'incompleto';
    texto.textContent = `Descarga incompleta: faltan ${datos.total - datos.guardados} de ${datos.total}`;
    reintentar.hidden = false;
  };

  const pedirle = tipo => navigator.serviceWorker.ready.then(registro => {
    const trabajador = registro.active || navigator.serviceWorker.controller;
    if (trabajador) trabajador.postMessage({ tipo });
  }).catch(() => {});

  const etiquetaVersion = document.getElementById('versionApp');
  navigator.serviceWorker.addEventListener('message', e => {
    if (!e.data || !e.data.tipo) return;
    if (e.data.version && etiquetaVersion) etiquetaVersion.textContent = e.data.version;
    pintar(e.data);
  });

  reintentar.addEventListener('click', () => pedirle('descargar'));

  pedirle('estado');
  pedirle('descargar');

  // Le pide al navegador que no borre lo guardado cuando falte espacio.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
});

/* Instalarla en la pantalla de inicio es lo único que evita que
   iOS la borre a los 7 días y que Android la borre por espacio. */
/* ── Mapas detallados: descarga opcional, aparte del contenido ──
   Van en su propia caché para que no se borren cuando cambia la
   versión del contenido. Si no están, la app funciona igual: se
   siguen viendo las fotos de cada zona. */
modulo('mapas detallados', () => {
  const caja = document.getElementById('mapasOffline');
  const titulo = document.getElementById('mapasTitulo');
  const detalle = document.getElementById('mapasDetalle');
  const boton = document.getElementById('btnDescargarMapas');
  if (!caja || !boton || !('serviceWorker' in navigator)) return;

  const botonesMapa = [...document.querySelectorAll('.abrir-mapa')];

  const pedirle = tipo => navigator.serviceWorker.ready
    .then(registro => {
      const sw = registro.active || navigator.serviceWorker.controller;
      if (sw) sw.postMessage({ tipo });
    })
    .catch(() => {});

  const pintar = datos => {
    if (datos.tipo === 'mapas-progreso') {
      caja.dataset.estado = 'bajando';
      const pct = datos.total ? Math.round(datos.guardados / datos.total * 100) : 0;
      titulo.textContent = `Descargando mapas… ${pct}%`;
      detalle.textContent = `${datos.guardados} de ${datos.total} pedazos. Podés seguir usando la app.`;
      boton.disabled = true;
      boton.textContent = 'Descargando…';
      return;
    }

    const listos = datos.completo;
    caja.dataset.estado = listos ? 'listo' : 'sin';
    mapasListos = listos;
    botonesMapa.forEach(b => { b.hidden = !listos; });

    if (listos) {
      titulo.textContent = 'Mapas detallados listos';
      detalle.textContent = 'Ya podés abrir el mapa de cada zona sin señal.';
      boton.hidden = true;
    } else {
      titulo.textContent = 'Mapas detallados';
      detalle.textContent = 'Para ver tu zona con las calles y tu propia ubicación, sin señal. Unos 10 MB, se descargan una sola vez.';
      boton.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Descargar mapas';
    }
  };

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && (e.data.tipo === 'mapas' || e.data.tipo === 'mapas-progreso')) pintar(e.data);
  });

  boton.addEventListener('click', () => pedirle('descargar-mapas'));
  pedirle('estado-mapas');
});

let mapasListos = false;

modulo('mapa interactivo', () => {
  const dialogo = document.getElementById('mapaDialog');
  const lienzo = document.getElementById('mapaLienzo');
  const etiqueta = document.getElementById('mapaZona');
  const aviso = document.getElementById('mapaAviso');
  const cerrar = document.getElementById('cerrarMapa');
  const ubicar = document.getElementById('miUbicacion');
  if (!dialogo || !lienzo || typeof dialogo.showModal !== 'function') return;
  if (typeof L === 'undefined') return;

  let mapa, capaZonas, capaCalles, marcaYo, figuras, calles;

  const cargarCalles = async () => {
    if (calles) return calles;
    try { calles = (await fetch('./calles.json').then(r => r.json())).calles; }
    catch (_) { calles = []; }
    return calles;
  };

  /* Los nombres tapan todo si se muestran siempre: aparecen recién
     cuando estás lo bastante cerca como para que sirvan. */
  const pintarCalles = () => {
    if (!capaCalles || !calles) return;
    capaCalles.clearLayers();
    if (mapa.getZoom() < 16) return;

    const vista = mapa.getBounds();
    calles.forEach(via => {
      const puntos = via.c.map(p => [p[1], p[0]]);
      if (!puntos.some(p => vista.contains(p))) return;
      L.polyline(puntos, { color: '#fff', weight: 2, opacity: 0.45 }).addTo(capaCalles);
      const medio = puntos[Math.floor(puntos.length / 2)];
      L.marker(medio, {
        interactive: false,
        icon: L.divIcon({ className: 'nombre-calle', html: via.n, iconSize: null })
      }).addTo(capaCalles);
    });
  };

  const cargarFiguras = async () => {
    if (figuras) return figuras;
    figuras = await fetch('./zonas.geojson').then(r => r.json());
    return figuras;
  };

  const abrir = async zona => {
    etiqueta.textContent = 'Zona ' + zona;
    dialogo.showModal();

    if (!mapa) {
      mapa = L.map(lienzo, { zoomControl: true, attributionControl: true });
      L.tileLayer('./tiles/{z}/{x}/{y}.jpg', {
        minZoom: 12, maxZoom: 20, maxNativeZoom: 18,
        attribution: 'Esri, Maxar · nombres © OpenStreetMap'
      }).addTo(mapa);
      capaCalles = L.layerGroup().addTo(mapa);
      mapa.on('zoomend', pintarCalles);
    }

    const datos = await cargarFiguras();
    await cargarCalles();
    const propias = {
      type: 'FeatureCollection',
      features: datos.features.filter(f => f.properties.zona === zona)
    };
    if (capaZonas) capaZonas.remove();
    capaZonas = L.geoJSON(propias, {
      style: f => ({ color: f.properties.color, weight: 3, fillOpacity: 0.28 }),
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 8, color: '#fff', weight: 3, fillColor: f.properties.color, fillOpacity: 1
      })
    }).addTo(mapa);
    capaZonas.eachLayer(c => c.bindPopup(c.feature.properties.nombre));

    // showModal recién dimensiona el contenedor al abrirse
    setTimeout(() => {
      mapa.invalidateSize();
      mapa.fitBounds(capaZonas.getBounds(), { padding: [24, 24] });
      pintarCalles();
    }, 60);
  };

  document.querySelectorAll('.abrir-mapa').forEach(b => {
    b.addEventListener('click', () => abrir(Number(b.dataset.zona)));
  });

  if (cerrar) cerrar.addEventListener('click', () => dialogo.close());

  if (ubicar) ubicar.addEventListener('click', () => {
    if (!navigator.geolocation) {
      aviso.textContent = 'Este teléfono no permite ver la ubicación.';
      aviso.hidden = false;
      return;
    }
    aviso.textContent = 'Buscando tu ubicación…';
    aviso.hidden = false;
    navigator.geolocation.getCurrentPosition(pos => {
      const p = [pos.coords.latitude, pos.coords.longitude];
      if (marcaYo) marcaYo.remove();
      marcaYo = L.circleMarker(p, {
        radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1
      }).addTo(mapa).bindPopup('Estás acá');
      mapa.setView(p, Math.max(mapa.getZoom(), 17));
      aviso.hidden = true;
    }, () => {
      aviso.textContent = 'No se pudo obtener la ubicación. Revisá que el GPS esté encendido y que le hayas dado permiso.';
      aviso.hidden = false;
    }, { enableHighAccuracy: true, timeout: 12000 });
  });
});

modulo('instalar en el teléfono', () => {
  const caja = document.getElementById('instalar');
  const pasos = document.getElementById('instalarPasos');
  const cerrar = document.getElementById('instalarCerrar');
  if (!caja || !pasos) return;

  const yaEstaInstalada =
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (yaEstaInstalada) return;

  const CLAVE = 'bitacora-maj-2026-ocultar-instalar';
  try {
    if (localStorage.getItem(CLAVE) === 'si') return;
  } catch (_) {}

  const esIPhone = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  pasos.textContent = esIPhone
    ? 'Tocá el botón Compartir (el cuadradito con la flecha hacia arriba) y elegí "Agregar a inicio".'
    : 'Tocá los tres puntitos del navegador y elegí "Instalar aplicación" o "Agregar a pantalla principal".';

  caja.hidden = false;

  if (cerrar) {
    cerrar.addEventListener('click', () => {
      caja.hidden = true;
      try { localStorage.setItem(CLAVE, 'si'); } catch (_) {}
    });
  }
});
