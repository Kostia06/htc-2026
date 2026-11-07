// M14 – mobile burger: lines cross, the header grows to a full-screen dark menu.
import { gsap } from './motion.js';

export function initBurger() {
  const burger = document.querySelector('.burger-wrap');
  const header = document.querySelector('.header-wrapper');
  if (!burger || !header) return;
  const first = burger.querySelector('.burger-line.first');
  const second = burger.querySelector('.burger-line.second');
  const logoWhite = document.querySelector('.logo-white');
  const logoBlack = document.querySelector('.logo-black');
  let open = false;

  burger.addEventListener('click', () => {
    open = !open;
    const ease = 'power1.inOut';
    if (open) {
      gsap.to(second, { rotation: -45, x: '-0.5rem', y: '-0.3rem', duration: 0.5, ease });
      gsap.to(first, { rotation: 45, x: '-0.5rem', y: '0.3rem', duration: 0.5, ease });
      gsap.to(burger, { x: '0.5rem', duration: 0.5, ease });
      gsap.to(header, { backgroundColor: '#080808', duration: 0.3, ease });
      gsap.to(header, { height: '100vh', duration: 0.9, ease });
      // logo forced to the white version while the menu is open
      Object.assign(logoWhite.style, { opacity: '1', zIndex: '3' });
      Object.assign(logoBlack.style, { opacity: '0', zIndex: '2' });
    } else {
      gsap.to([first, second, burger], { rotation: 0, x: 0, y: 0, duration: 0.5, ease });
      gsap.to(header, { height: '4rem', duration: 0.9, ease });
      gsap.to(header, { backgroundColor: 'rgba(8,8,8,0)', duration: 0.9, delay: 0.9, ease });
      for (const el of [logoWhite, logoBlack]) Object.assign(el.style, { opacity: '', zIndex: '' });
    }
  });
}
