// Cookie consent banner: shown until the visitor accepts or denies; the choice is remembered.
import { gsap, EASE } from './motion.js';

const KEY = 'cookie-consent';

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
};

export function initCookies() {
  const banner = document.querySelector('.cookie-banner');
  if (!banner || read()) return;
  banner.hidden = false;
  gsap.fromTo(banner, { yPercent: 100 }, { yPercent: 0, duration: 0.3, ease: EASE.ease });
  for (const btn of banner.querySelectorAll('[data-cookie]')) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      write(btn.dataset.cookie);
      gsap.to(banner, { yPercent: 100, duration: 0.3, ease: EASE.ease, onComplete: () => (banner.hidden = true) });
    });
  }
}
