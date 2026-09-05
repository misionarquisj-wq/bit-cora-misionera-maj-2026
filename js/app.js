
(function(){
const D=window.BITACORA_DATA; const $=s=>document.querySelector(s); const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sectionDefs=[
{id:'oraciones',icon:'✝️',ey:'Vida espiritual',title:'Oraciones',filter:x=>['Oraciones','Salir a misionar','En las casas'].includes(x.section)},
{id:'examen',icon:'❤️',ey:'Interioridad',title:'Examen de conciencia',filter:x=>x.section==='Examen de conciencia'},
{id:'salir',icon:'👣',ey:'Antes de caminar',title:'Salir a misionar',filter:x=>x.section==='Salir a misionar'||['tip-tres-sentidos','tip-destino','etapa-espiritu'].includes(x.id)},
{id:'casas',icon:'🏠',ey:'Durante la visita',title:'En las casas',filter:x=>x.section==='En las casas'||['etapa-saludo','etapa-conocerse','etapa-compartir','etapa-escuchar','etapa-mensajes','etapa-avisos','etapa-despedida','tip-puertas'].includes(x.id)},
{id:'herramientas',icon:'🧰',ey:'Guía práctica',title:'Herramientas para el misionero',filter:x=>x.section==='Herramientas'},
{id:'tips',icon:'💡',ey:'Para tener a mano',title:'Tips misioneros',filter:x=>x.section==='Tips misioneros'},
{id:'formacion',icon:'📖',ey:'Identidad y misión',title:'Material de formación',filter:x=>x.id==='que-es-misionero'}];
let favs=new Set(JSON.parse(localStorage.getItem('maj-favoritos')||'[]'));
function card(x,steps=false){return `<article class="content-card ${steps?'step-card':''}" id="${x.id}"><details><summary>${esc(x.title)}</summary><div class="card-body"><button class="fav-toggle ${favs.has(x.id)?'active':''}" data-fav="${x.id}" aria-label="Marcar favorito">★</button><div class="card-meta">${esc(x.section)} · PDF pág. ${x.page}</div>${esc(x.body)}${x.note?`<p class="source-note">${esc(x.note)}</p>`:''}</div></details></article>`}
$('#dynamicSections').innerHTML=sectionDefs.map(s=>`<section id="${s.id}" class="section"><div class="section-head"><span>${s.icon}</span><div><p class="eyebrow">${s.ey}</p><h2>${s.title}</h2></div></div><div class="cards ${s.id==='herramientas'?'step-list':''}">${D.items.filter(s.filter).map(x=>card(x,s.id==='herramientas'&&/^etapa-/.test(x.id))).join('')}</div></section>`).join('');
function syncFav(id){if(favs.has(id))favs.delete(id);else favs.add(id);localStorage.setItem('maj-favoritos',JSON.stringify([...favs]));document.querySelectorAll(`[data-fav="${id}"]`).forEach(b=>b.classList.toggle('active',favs.has(id)));}
document.addEventListener('click',e=>{const b=e.target.closest('[data-fav]');if(b){e.preventDefault();syncFav(b.dataset.fav)}});
// navigation drawer
const drawer=$('#drawer'),scrim=$('#scrim'); function drawerSet(open){drawer.classList.toggle('open',open);scrim.hidden=!open;$('#menuBtn').setAttribute('aria-expanded',String(open));}
$('#menuBtn').onclick=()=>drawerSet(true);$('#drawerClose').onclick=()=>drawerSet(false);scrim.onclick=()=>drawerSet(false);drawer.addEventListener('click',e=>{if(e.target.tagName==='A')drawerSet(false)});
// search
const q=$('#globalSearch'),results=$('#searchResults');function renderSearch(){const val=q.value.trim();if(!val){results.hidden=true;results.innerHTML='';return}const found=window.BitacoraSearch.find(val);results.innerHTML=found.length?found.map(x=>`<a class="search-result" href="#${x.id}"><small>${esc(x.section)} · pág. ${x.page}</small><br><strong>${esc(x.title)}</strong></a>`).join(''):`<div class="search-result">No se encontraron coincidencias.</div>`;results.hidden=false}q.addEventListener('input',renderSearch);$('#clearSearch').onclick=()=>{q.value='';renderSearch();q.focus()};results.addEventListener('click',e=>{if(e.target.closest('a'))results.hidden=true});
// maps + lightbox
$('#mapGallery').innerHTML=D.maps.map(m=>`<figure><img src="${m.src}" alt="${esc(m.title)}" loading="lazy" data-zoom><figcaption>${esc(m.title)} · PDF pág. ${m.page}</figcaption></figure>`).join('');
const lb=$('#lightbox'),lbi=$('#lightboxImg'),lbc=$('#lightboxCaption');document.addEventListener('click',e=>{const im=e.target.closest('[data-zoom]');if(!im)return;lbi.src=im.src;lbi.alt=im.alt;lbc.textContent=im.alt;lb.showModal()});$('#lightboxClose').onclick=()=>lb.close();
// full archive: every source page is represented
$('#pageArchive').innerHTML=Array.from({length:D.sourcePages},(_,i)=>{const p=i+1;return `<details data-page="${p}"><summary>☐ Página ${p} revisada</summary><img loading="lazy" src="images/pdf/pagina-${String(p).padStart(2,'0')}.webp" alt="Reproducción completa de la página ${p} del PDF" data-zoom></details>`}).join('');
$('#openAllPages').onclick=()=>document.querySelectorAll('#pageArchive details').forEach(d=>d.open=true);$('#closeAllPages').onclick=()=>document.querySelectorAll('#pageArchive details').forEach(d=>d.open=false);
// favorites panel
function renderFavs(){const list=D.items.filter(x=>favs.has(x.id));$('#favoritesList').innerHTML=list.length?list.map(x=>`<a class="fav-item" href="#${x.id}"><strong>${esc(x.title)}</strong><br><small>${esc(x.section)}</small></a>`).join(''):'<p class="empty-card">Todavía no marcaste contenidos como favoritos.</p>'}
$('#favBtn').onclick=()=>{renderFavs();$('#favoritesPanel').hidden=false};$('#closeFavs').onclick=()=>$('#favoritesPanel').hidden=true;$('#favoritesList').onclick=e=>{if(e.target.closest('a'))$('#favoritesPanel').hidden=true};
// offline state
function state(){const el=$('#offlineStatus');if(!navigator.onLine){el.textContent='● Estás sin conexión · la Bitácora sigue disponible';}else{el.textContent='● En línea · contenido preparado para uso offline';}}window.addEventListener('online',state);window.addEventListener('offline',state);state();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));}
})();
