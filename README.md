# Bitácora Misionera — MAJ 2026

Aplicación web que funciona **sin conexión**. Se misiona en zonas sin señal, así
que el contenido tiene que quedar guardado en el teléfono antes de salir.

Dirección oficial:
<https://misionarquisj-wq.github.io/bit-cora-misionera-maj-2026/>

---

## ⚠️ La regla más importante

**Cada vez que se edite cualquier archivo hay que cambiar `VERSION` en la
primera parte de `sw.js`.**

```js
const VERSION = '2026-09-12a';   // ← cambiar SIEMPRE al editar
```

Si no se cambia, los teléfonos que ya tienen la Bitácora guardada **nunca
reciben la corrección**. No es que tarde: no llega nunca. El navegador solo
busca contenido nuevo cuando cambian los bytes de `sw.js`.

Formato: fecha del cambio más una letra. `2026-09-25a`, y si ese mismo día hay
otro cambio, `2026-09-25b`.

---

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Todo el contenido. Cada apartado es un `<section data-view>` |
| `style.css` | Estilos. Colores y tipografías arriba de todo, en `:root` |
| `fonts/` | Las tres tipografías, autoalojadas (no se pueden cargar de internet) |
| `script.js` | Navegación, menú, visor de mapas, teléfonos, estado de descarga |
| `sw.js` | Funcionamiento sin conexión. **Acá está `VERSION`** |
| `manifest.webmanifest` | Datos para instalarla en el teléfono |
| `images/` | Portada, íconos y los 7 mapas de zona |
| `tiles/` | Los 710 pedacitos del mapa satelital para usar sin señal |
| `vendor/` | Leaflet, la librería del mapa interactivo (autoalojada) |
| `zonas.geojson` | Las figuras de las zonas, exportadas del mapa de Google |

## Si agregás o sacás una imagen

Hay que tocar **dos** archivos:

1. `index.html` — la etiqueta `<img>`
2. `sw.js` — la lista `PESADO` (o `NUCLEO` si es un ícono)

Si se agrega en uno y se olvida el otro, la imagen **no queda disponible sin
señal**. El contador del cartel verde ("Listo para usar sin señal") cuenta
contra la lista de `sw.js`, así que revisá que el número total cambie.

## Las tipografías

El manual de diseño pide **LazyDog** (títulos), **Bobby Jones** (subtítulos) y
**Marykate** (textos). Son comerciales y no tenemos los archivos, así que están
puestas tres libres con el mismo carácter: Chewy, Fredoka y Patrick Hand.

Si aparecen las originales en formato `.woff2`, se reemplaza el archivo dentro
de `fonts/` y se ajusta el `@font-face` arriba de `style.css`. Nada más.

**No se pueden cargar desde internet** (ni Google Fonts ni ningún otro lado):
romperían el funcionamiento sin señal. Van siempre autoalojadas y listadas en
`NUCLEO` dentro de `sw.js`.

## Los mapas

Están en JPG, no en PNG. En PNG pesaban 5,6 MB en total; en JPG pesan 1,4 MB y
se ven igual. **No los vuelvas a guardar como PNG.** Si hay que reemplazar uno,
exportalo como JPG con calidad 85.

Los mapas actuales son de baja resolución porque así venían en el PDF original.
Si alguna vez se consiguen las capturas originales en mejor calidad, conviene
rehacerlos: hoy los nombres de calle se leen justo.

---

## Antes de cada misión: verificación obligatoria

No alcanza con que la app "se vea bien". Hay que probarla sin señal:

1. Teléfono limpio (borrar datos del sitio)
2. Abrir la app con WiFi o datos
3. Esperar a que el cartel de arriba diga **"✓ Listo para usar sin señal"**
4. **Modo avión**
5. Cerrar la app del todo y volver a abrirla
6. Recorrer los 10 apartados y abrir los 7 mapas
7. Probar que los teléfonos de emergencia se puedan tocar para llamar

Repetir en **un iPhone y un Android**, no en uno solo.

## Lo que hay que decirle a cada misionero

1. **Abrir el link en Safari o Chrome, no dentro de WhatsApp.** Desde el
   navegador chiquito de WhatsApp no se puede instalar y lo que se descargue
   puede perderse.
2. **Agregarla a la pantalla de inicio.** No es por comodidad: es lo único que
   evita que el iPhone la borre sola a los 7 días y que Android la borre cuando
   falte espacio.
3. Esperar el cartel verde antes de irse.

---

## Los mapas detallados

Son 710 imágenes de 256×256 en `tiles/`, unos 9,6 MB. **No se descargan con el
resto**: van en una caché aparte (`bitacora-mapas-v1`) y solo cuando alguien
toca el botón dentro de Zonas de misión.

Están aparte a propósito. Si fueran con el resto, cada corrección de un texto
obligaría a los 350 a volver a bajar 10 MB, y una descarga fallida dejaría a
alguien sin oraciones ni teléfonos. Así, si los mapas fallan, la bitácora sigue
entera.

Si hiciera falta regenerarlos (porque cambian las zonas), están los guiones en
el historial de esta conversación: se baja el KML del mapa de Google, se calcula
qué pedacitos hacen falta y se descargan recomprimidos.

## Pendiente

- Teléfonos se entra solo por el ícono rojo de arriba a la derecha: no tiene
  tarjeta en el inicio. Los números están fijos en `index.html`, no se editan
  desde la app.
- La página lleva `robots: noindex` porque publica teléfonos personales de los
  coordinadores. Si alguna vez se quieren sacar esos números, hay que quitar
  también esa etiqueta.
- "Cronograma" está creado pero vacío, esperando el contenido.
- La navegación está declarada en tres lugares (menú lateral, tarjetas del
  inicio y las secciones). Si se agrega un apartado hay que tocarlos los tres.
- "Modelos de misión" está creado pero vacío, esperando el contenido.
- Las zonas todavía no tienen los enlaces a Google Maps: hacen falta las
  coordenadas exactas de cada barrio.
