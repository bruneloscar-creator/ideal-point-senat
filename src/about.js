import { loadScatterSenators, mountIdealScatter } from './idealScatter.js';
import { initI18n, mountLangToggle, onLangChange, t } from './i18n.js';

initI18n();
document.querySelectorAll('[data-lang-host]').forEach((host) => mountLangToggle(host));

/* The about page is a reading surface: preserve its fitted mobile layout. */
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
document.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });

const canvas = document.getElementById('about-ideal-scatter');
const legendEl = document.getElementById('about-ideal-legend');
const frame = document.querySelector('.about-ideal-frame');

async function init() {
  if (!canvas) return;
  try {
    const { senators, groupColors } = await loadScatterSenators('/assets/senators.json');
    mountIdealScatter(canvas, senators, {
      groupColors,
      legendEl,
      aspect: 0.72,
      pointRadius: 3.4,
    });
    if (frame) frame.classList.add('is-ready');
  } catch (err) {
    console.warn('Carte Ideal Point indisponible:', err);
    if (frame) {
      frame.classList.add('is-error');
      frame.setAttribute('data-error', t('about.map.error'));
    }
  }
}

onLangChange(() => {
  if (frame?.classList.contains('is-error')) {
    frame.setAttribute('data-error', t('about.map.error'));
  }
});

init();
