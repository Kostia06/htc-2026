// The only script on the page: the phone menu. Everything else is plain HTML and CSS.
const header = document.querySelector('.topbar');
const toggle = header?.querySelector('.topbar__menu');

function setMenu(open) {
  header.dataset.menu = open ? 'open' : 'closed';
  toggle.setAttribute('aria-expanded', String(open));
}

if (toggle) {
  toggle.addEventListener('click', () => setMenu(header.dataset.menu !== 'open'));
  header.querySelectorAll('.topbar__nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.dataset.menu === 'open') {
      setMenu(false);
      toggle.focus();
    }
  });
}
