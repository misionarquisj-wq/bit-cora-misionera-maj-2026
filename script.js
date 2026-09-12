const views = [...document.querySelectorAll('[data-view]')];
const menu = document.getElementById('menu');
const backdrop = document.getElementById('backdrop');
const menuBtn = document.getElementById('menuBtn');
const closeMenuBtn = document.getElementById('closeMenu');

function showView() {
  const id = (location.hash || '#inicio').slice(1);
  const target = document.getElementById(id) || document.getElementById('inicio');
  views.forEach(v => v.hidden = v !== target);
  closeMenu();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function openMenu() {
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
  menuBtn.setAttribute('aria-expanded', 'true');
  backdrop.hidden = false;
}
function closeMenu() {
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  menuBtn.setAttribute('aria-expanded', 'false');
  backdrop.hidden = true;
}
menuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
backdrop.addEventListener('click', closeMenu);
window.addEventListener('hashchange', showView);
showView();

const dialog = document.getElementById('mapDialog');
const dialogImage = document.getElementById('dialogImage');
document.querySelectorAll('.map-button').forEach(btn => {
  btn.addEventListener('click', () => {
    dialogImage.src = btn.dataset.map;
    dialog.showModal();
  });
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

const emergencyForm = document.getElementById('emergencyForm');
const savedMsg = document.getElementById('savedMsg');
const STORAGE_KEY = 'bitacora-maj-2026-telefonos';
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  Object.entries(saved).forEach(([key, value]) => {
    if (emergencyForm.elements[key]) emergencyForm.elements[key].value = value;
  });
} catch (_) {}
emergencyForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(emergencyForm).entries());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  savedMsg.textContent = 'Guardado en este dispositivo.';
  setTimeout(() => savedMsg.textContent = '', 2500);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
