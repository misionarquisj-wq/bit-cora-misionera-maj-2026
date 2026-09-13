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

modulo('teléfonos', () => {
  const formulario = document.getElementById('emergencyForm');
  const mensaje = document.getElementById('savedMsg');
  const lista = document.getElementById('listaGuardados');
  if (!formulario) return;

  const CLAVE = 'bitacora-maj-2026-telefonos';
  const NOMBRES = {
    coordinador: 'Coordinador/a',
    responsable: 'Responsable de misión',
    hospital: 'Hospital de la zona',
    parroquia: 'Parroquia',
    otro: 'Otro contacto'
  };
  let borrarMensaje;

  const soloMarcable = valor => String(valor).replace(/[^0-9+*#]/g, '');

  const dibujarLista = datos => {
    if (!lista) return;
    lista.textContent = '';
    Object.entries(NOMBRES).forEach(([campo, nombre]) => {
      const numero = soloMarcable(datos[campo] || '');
      if (!numero) return;
      const enlace = document.createElement('a');
      enlace.href = 'tel:' + numero;
      const etiqueta = document.createElement('span');
      etiqueta.textContent = nombre;
      const valor = document.createElement('strong');
      valor.textContent = datos[campo];
      enlace.append(etiqueta, valor);
      const item = document.createElement('li');
      item.append(enlace);
      lista.append(item);
    });
  };

  let guardado = {};
  try {
    guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {};
  } catch (_) {}

  Object.entries(guardado).forEach(([campo, valor]) => {
    const entrada = formulario.elements[campo];
    if (entrada instanceof HTMLInputElement) entrada.value = valor;
  });
  dibujarLista(guardado);

  formulario.addEventListener('submit', e => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(formulario).entries());

    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
      // Se relee para confirmar: en Safari privado setItem no guarda nada.
      if (!localStorage.getItem(CLAVE)) throw new Error('no quedó guardado');
    } catch (error) {
      console.error('No se pudieron guardar los teléfonos:', error);
      if (mensaje) mensaje.textContent = 'No se pudo guardar. Liberá espacio en el teléfono y probá de nuevo.';
      return;
    }

    dibujarLista(datos);
    if (!mensaje) return;
    mensaje.textContent = 'Guardado en este dispositivo.';
    clearTimeout(borrarMensaje);
    borrarMensaje = setTimeout(() => { mensaje.textContent = ''; }, 2500);
  });
});

modulo('aviso de actualización', () => {
  const boton = document.getElementById('btnActualizar');
  if (boton) boton.addEventListener('click', () => location.reload());
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

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.tipo) pintar(e.data);
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
