// FAQ:
//   M56 heading mask + side shadow sweep while scrolling (desktop)
//   M57 heading mask on mobile
//   M58 accordion – one item open at a time, a click elsewhere closes it
import { gsap, scrollKeyframes, MQ, EASE } from './motion.js';
import { maskOnView } from './reveal-mask.js';

function open(item) {
  item.classList.add('is-open');
  const q = (s) => item.querySelector(s);
  q('.dropdown-toggle').setAttribute('aria-expanded', 'true');
  gsap.to(q('.drop-list'), { height: 'auto', duration: 0.6, ease: EASE.ease, overwrite: 'auto' });
  gsap.to(q('.line-1'), { rotation: 0, duration: 0.4, ease: EASE.ease, overwrite: 'auto' });
  gsap.to(q('.plus-faq'), { rotation: 45, duration: 0.3, overwrite: 'auto' });
  gsap.to(q('.faq-answer-p'), { opacity: 1, duration: 0.6, ease: 'none', overwrite: 'auto' });
}

function close(item) {
  item.classList.remove('is-open');
  const q = (s) => item.querySelector(s);
  q('.dropdown-toggle').setAttribute('aria-expanded', 'false');
  gsap.to(q('.faq-answer-p'), { opacity: 0, duration: 0.6, ease: 'none', overwrite: 'auto' });
  gsap.to(q('.line-1'), { rotation: -90, duration: 0.35, ease: EASE.ease, overwrite: 'auto' });
  gsap.to(q('.plus-faq'), { rotation: 0, duration: 0.5, overwrite: 'auto' });
  gsap.to(q('.drop-list'), { height: 0, duration: 0.5, ease: EASE.ease, overwrite: 'auto' });
}

export function initFaq() {
  const section = document.querySelector('.section.is-faq');
  if (!section) return;
  const items = [...section.querySelectorAll('.faq-dropdown')];

  for (const item of items) {
    const toggle = item.querySelector('.dropdown-toggle');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-expanded', 'false');
    const flip = () => {
      const wasOpen = item.classList.contains('is-open');
      for (const other of items) if (other.classList.contains('is-open')) close(other);
      if (!wasOpen) open(item);
    };
    toggle.addEventListener('click', flip);
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      }
    });
  }
  document.addEventListener('click', (e) => {
    for (const item of items) if (item.classList.contains('is-open') && !item.contains(e.target)) close(item);
  });

  const mm = gsap.matchMedia();
  mm.add(MQ.desktop, () => {
    const heading = '.heading-3.text-align-center.text-color-white';
    scrollKeyframes(section, [
      ['.section-heading .shadow.vertical._2', 15, { yPercent: -40 }],
      [heading, 15, { opacity: 0 }],
      ['.shadow.hide-mob', 17, { xPercent: -54 }],
      [heading, 24, { opacity: 1 }],
      ['.section-heading .shadow.vertical._2', 25, { yPercent: 63 }],
      ['.shadow.hide-mob', 30, { xPercent: 30 }],
    ]);
  });
  mm.add(MQ.mobile, () => {
    maskOnView(section, section.querySelector('.shadow.vertical'), { from: -30, to: 30, duration: 1, offset: 20 });
  });
}
