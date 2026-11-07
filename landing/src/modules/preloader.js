// M1 + M2 – white curtain where the wordmark wipes in on fresh loads, then a quick page fade-in.
// The curtain is skipped when arriving through an internal link (sessionStorage flag).
import { gsap } from './motion.js';

const KEY = 'preloaderClicked';

function storage(fn, fallback) {
  try {
    return fn(window.sessionStorage);
  } catch {
    return fallback;
  }
}

export function initPreloader() {
  const preloader = document.getElementById('preloader');
  const faded = document.querySelectorAll('[data-fade-in]');

  // M2: everything marked [data-fade-in] switches to visible 100ms after start
  gsap.set(faded, { opacity: 1, delay: 0.1 });

  // tells other modules (hero message pop-in) that the page is uncovered
  const done = () => {
    if (window.__preloaderDone) return;
    window.__preloaderDone = true;
    document.dispatchEvent(new Event('preloader:done'));
  };

  if (!preloader) return done();
  const hide = () => {
    preloader.style.display = 'none';
    done();
  };

  window.addEventListener('beforeunload', () => {
    if (!document.activeElement?.hasAttribute('internal-link')) storage((s) => s.setItem(KEY, 'false'));
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[internal-link]')) hide();
  });

  const seen = storage((s) => s.getItem(KEY), null);
  if (seen && seen !== 'false') {
    preloader.style.display = 'none';
    // let the first paint happen before the messages pop
    setTimeout(done, 350);
    return;
  }
  storage((s) => s.setItem(KEY, 'true'));

  const home = preloader.querySelector('.preloader-home');
  const frame = preloader.querySelector('.preloader-frame');
  const hero = document.querySelector('.hero.home .container.is-big.full');
  const logo = preloader.querySelector('.wordmark');

  const tl = gsap.timeline();
  tl.set(frame, { height: '100%' })
    .set(hero, { y: '-20vh' }, 0.2)
    .fromTo(logo, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'power2.inOut' }, 0.2)
    .to(hero, { y: '0vh', duration: 1, ease: 'expo.out' }, 1.8)
    .to(frame, { height: '0%', duration: 1, ease: 'expo.out' }, 1.85)
    .call(done, null, 1.7)
    .set(home, { display: 'none' }, 2.2);
}
