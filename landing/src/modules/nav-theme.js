// M4 – the nav pill, logo and "Book a call" button follow the colour of the section under the nav.
// Sections declare their colour with data-section-color="black|white".

const DARK = { nav: '#191919', btn: '#404040', btnText: '#fff', link: '#fff' };
const LIGHT = { nav: '#FAFAFA', btn: '#E5E5E5', btnText: '#080808', link: '#080808' };

export function initNavTheme() {
  const nav = document.querySelector('.nav-new');
  const logoWhite = document.querySelector('.logo-white');
  const logoBlack = document.querySelector('.logo-black');
  const sections = document.querySelectorAll('[data-section-color]');
  const btn = document.querySelector('.nav_link-c.contact.grey');
  const btnText = btn?.querySelector('.btn-text');
  const hoverFaces = document.querySelectorAll('.nav-new .footer-nav-link.hover');
  if (!nav) return;

  const showLogo = (dark) => {
    logoWhite.style.opacity = dark ? '1' : '0';
    logoWhite.style.zIndex = dark ? '3' : '2';
    logoBlack.style.opacity = dark ? '0' : '1';
    logoBlack.style.zIndex = dark ? '2' : '3';
  };

  const update = () => {
    const navRect = nav.getBoundingClientRect();
    let color = 'white';
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (navRect.top >= r.top && navRect.bottom <= r.bottom) color = s.dataset.sectionColor;
    }
    const dark = color === 'black';
    const theme = dark ? DARK : LIGHT;
    if (window.innerWidth > 767) nav.style.backgroundColor = theme.nav;
    showLogo(dark);
    if (btn) btn.style.backgroundColor = theme.btn;
    if (btnText) btnText.style.color = theme.btnText;
    hoverFaces.forEach((el) => (el.style.color = theme.link));
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}
