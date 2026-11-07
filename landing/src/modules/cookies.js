// Cookie consent banner. Nothing non-essential is loaded today; the banner records the visitor's
// choice so any analytics added later can check it first with hasConsent(). Default is "denied".
// The footer's "Cookie settings" button reopens the banner.
import { gsap, EASE } from './motion.js';

const KEY = 'raven-cookie-consent';

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (value) => {
  try {
    localStorage.setItem(KEY, value);
  } catch {}
};

/** True only when the visitor explicitly accepted. */
export const hasConsent = () => read() === 'accepted';

export function initCookies() {
  const banner = document.querySelector('.cookie-banner');
  if (!banner) return;

  const show = () => {
    banner.hidden = false;
    gsap.fromTo(banner, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3, ease: EASE.ease });
  };
  const hide = () =>
    gsap.to(banner, { yPercent: 100, opacity: 0, duration: 0.3, ease: EASE.ease, onComplete: () => (banner.hidden = true) });

  for (const btn of banner.querySelectorAll('[data-cookie]')) {
    btn.addEventListener('click', () => {
      write(btn.dataset.cookie);
      document.dispatchEvent(new CustomEvent('cookie-consent', { detail: btn.dataset.cookie }));
      hide();
    });
  }
  for (const link of document.querySelectorAll('[data-cookie-settings]')) {
    link.addEventListener('click', () => {
      show();
      banner.querySelector('[data-cookie]')?.focus();
    });
  }

  if (!read()) show();
}
