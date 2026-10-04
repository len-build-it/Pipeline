/**
 * Accessible modal dialog helper: labelled dialog, initial focus, Escape to close,
 * Tab kept inside the dialog, and focus returned to the opener on close.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openModal({ id, title, bodyHtml, footerHtml = '', wide = false }) {
  const opener = document.activeElement;
  const titleId = `${id}-title`;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal-dialog"${wide ? ' style="max-width:960px;"' : ''}>
        <header class="modal-header">
          <h2 id="${titleId}" class="modal-title">${title}</h2>
          <button type="button" class="modal-close-btn" data-modal-close aria-label="Close dialog">&times;</button>
        </header>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<footer class="modal-footer">${footerHtml}</footer>` : ''}
      </div>
    </div>
  `);
  const element = document.getElementById(id);

  function close() {
    window.removeEventListener('keydown', onKeyDown);
    element.remove();
    if (opener && document.contains(opener)) opener.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...element.querySelectorAll(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  element.querySelectorAll('[data-modal-close]').forEach(button => button.addEventListener('click', close));

  const initialFocus = element.querySelector('[data-autofocus]') || element.querySelector(FOCUSABLE);
  initialFocus?.focus();

  return { element, close };
}
