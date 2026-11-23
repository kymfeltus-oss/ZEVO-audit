/* FELTUS LABS standalone review only. Do not replace existing app routing/forms. */
(() => {
  const root = document.querySelector('#feltus-homepage');
  if (!root) return;
  const menuButton = root.querySelector('.menu-toggle');
  const nav = root.querySelector('#primary-nav');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Close main menu' : 'Open main menu');
      nav.classList.toggle('open', open);
    });
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label','Open main menu'); }
    });
  }
  const serviceSelect = root.querySelector('#service-choice');
  root.querySelectorAll('[data-service]').forEach(a => a.addEventListener('click', () => {
    if (serviceSelect) serviceSelect.value = a.dataset.service;
  }));
  const form = root.querySelector('#preview-inquiry-form');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const lines = [ 'FELTUS LABS — Project inquiry', 'Name: ' + values.get('name'), 'Email: ' + values.get('email'), 'Organization: ' + (values.get('company')||'Not specified'), 'Business stage: ' + (values.get('stage')||'Not specified'), 'Service: ' + values.get('service'), 'Project: ' + (values.get('details')||'Not specified') ];
    const result = root.querySelector('#inquiry-result');
    result.querySelector('textarea').value = lines.join('\n');
    result.hidden = false;
  });
  root.querySelector('.copy-inquiry')?.addEventListener('click', e => {
    const box = root.querySelector('#inquiry-result textarea');
    if (!box) return;
    box.focus(); box.select();
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(box.value).then(() => { e.currentTarget.textContent = 'Copied'; }).catch(() => { e.currentTarget.textContent = 'Select and copy above'; });
    else e.currentTarget.textContent = 'Select and copy above';
  });
})();
