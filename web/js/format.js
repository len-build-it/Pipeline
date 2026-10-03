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
