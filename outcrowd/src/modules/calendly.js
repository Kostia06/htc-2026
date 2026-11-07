// "Book a call" buttons ([data-calendly]) open the Calendly popup. The widget is only
// downloaded on the first click.
const SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';
const STYLE = 'https://assets.calendly.com/assets/external/widget.css';

let loading;
function loadCalendly() {
  if (window.Calendly) return Promise.resolve(window.Calendly);
  loading ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = STYLE;
    document.head.append(css);
    const js = document.createElement('script');
    js.src = SCRIPT;
    js.async = true;
    js.onload = () => resolve(window.Calendly);
    js.onerror = reject;
    document.head.append(js);
  });
  return loading;
}

export function initCalendly() {
  for (const link of document.querySelectorAll('[data-calendly]')) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      loadCalendly()
        .then((c) => c.initPopupWidget({ url: link.dataset.calendly }))
        .catch(() => window.open(link.dataset.calendly, '_blank', 'noopener'));
    });
  }
}
