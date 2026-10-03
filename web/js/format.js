/**
 * Shared display helpers for views.
 * Organization labels always come from organization records, never from fixed names.
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function orgLabel(state, orgId) {
  const organization = state.organizations.find(o => o.id === orgId);
  return organization ? organization.name : 'Unknown organization';
}

export function orgLabels(state, orgIds) {
  return orgIds.map(orgId => orgLabel(state, orgId)).join(', ');
}

/**
 * Formats a decimal amount string such as "1250.5" or "-30.00" as "PHP 1,250.50".
 * Works on the digits themselves, so no amount is ever converted to a floating-point number.
 */
export function formatPhp(amount) {
  const [, sign, pesos, centavos = ''] = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount)) || [];
  if (pesos === undefined) return `PHP ${amount}`;
  const grouped = pesos.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}PHP ${grouped}.${centavos.padEnd(2, '0')}`;
}

const manilaDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
const manilaTimeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false });

/** Today's calendar date in Asia/Manila as YYYY-MM-DD. */
export function manilaToday(now = new Date()) {
  return manilaDateFormat.format(now);
}

/** An ISO timestamp as "YYYY-MM-DD HH:mm" in Asia/Manila. */
export function formatManilaTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  return `${manilaDateFormat.format(date)} ${manilaTimeFormat.format(date)}`;
}
