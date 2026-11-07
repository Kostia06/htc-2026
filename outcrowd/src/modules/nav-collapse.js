// M5 – desktop nav shrinks while scrolling down (links fold away, "Book a call" appears)
// and expands again while scrolling up. Plain CSS transitions, like the original.

const EASE = '0.7s ease';

export function initNavCollapse() {
  const btnWrap = document.querySelector('.header-btn-wrap');
  const links = document.querySelector('.nav-link-wrap');
  const nav = document.querySelector('.nav-new');
  const book = document.querySelector('.nav_link-c.contact.grey');
  if (!nav) return;

  const apply = (down) => {
    btnWrap.style.transition = `width ${EASE}`;
    btnWrap.style.width = down ? '16rem' : '7rem';
    links.style.transition = `transform ${EASE}, width ${EASE}, opacity ${EASE}`;
    links.style.transform = down ? 'scale(0.6)' : 'scale(1)';
    links.style.width = down ? '0rem' : '20rem';
    links.style.opacity = down ? '0' : '1';
    nav.style.transition = `width ${EASE}`;
    nav.style.width = down ? '24rem' : '41rem';
    book.style.transition = `transform ${EASE}, opacity ${EASE}`;
    book.style.transform = down ? 'scale(1)' : 'scale(0.6)';
    book.style.opacity = down ? '1' : '0';
  };

  let last = 0;
  document.addEventListener(
    'scroll',
    () => {
      if (window.innerWidth <= 767) return;
      const top = window.scrollY || document.documentElement.scrollTop;
      apply(top > last);
      last = top <= 0 ? 0 : top;
    },
    { passive: true },
  );
}
