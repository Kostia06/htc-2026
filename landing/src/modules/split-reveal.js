// M23/M24/M45 – headings marked [data-split-reveal] fade in character by character:
// scrubbed with the scroll on desktop, replayed on every entry on mobile.
import SplitType from 'split-type';
import { gsap } from './motion.js';

export function initSplitReveal() {
  for (const el of document.querySelectorAll('[data-split-reveal]')) {
    new SplitType(el, { types: 'lines, words, chars', tagName: 'span' });
    const chars = el.querySelectorAll('.char');

    if (window.innerWidth >= 767) {
      gsap.from(chars, {
        opacity: 0,
        duration: 2,
        ease: 'power2.out',
        stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 90%', end: 'bottom 20%', scrub: true },
      });
    } else {
      new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) gsap.from(chars, { opacity: 0, duration: 0.25, ease: 'power2.inOut', stagger: 0.03 });
          }
        },
        { threshold: 0.1 },
      ).observe(el);
    }
  }
}
