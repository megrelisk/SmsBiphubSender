import { demoRequest } from './demo.js';

// VITE_DEMO=1 (ონლაინ ვერსია, სანამ ბექენდი არ გამოქვეყნებულა): მონაცემები ბრაუზერის მეხსიერებიდან
const DEMO = import.meta.env.VITE_DEMO === '1';

async function request(path, options = {}) {
  if (DEMO) return demoRequest(path, options);
  const res = await fetch('/api' + path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `შეცდომა (${res.status})`), { data });
  return data;
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const qs = (params) => new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)));

export const api = {
  config: () => request('/config'),
  cabinets: () => request('/cabinets'),
  saveCabinet: (id, c) => request(`/cabinets/${id}`, json('PUT', c)),
  templates: (cabinet) => request('/templates?' + qs({ cabinet })),
  saveTemplate: (t) => (t.id ? request(`/templates/${t.id}`, json('PUT', t)) : request('/templates', json('POST', t))),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  moveTemplate: (id, folder) => request(`/templates/${id}/folder`, json('PATCH', { folder })),
  templateFolders: (cabinet) => request('/template-folders?' + qs({ cabinet })),
  addTemplateFolder: (cabinet, name) => request('/template-folders', json('POST', { cabinet, name })),
  deleteTemplateFolder: (cabinet, name) => request('/template-folders?' + qs({ cabinet, name }), { method: 'DELETE' }),
  parseFile: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/parse', { method: 'POST', body: fd });
  },
  previewCampaign: (c) => request('/campaigns/preview', json('POST', c)),
  createCampaign: (c) => request('/campaigns', json('POST', c)),
  stats: (cabinet) => request('/stats?' + qs({ cabinet })),
  blocked: () => request('/blocked'),
  addBlocked: (phones, note) => request('/blocked', json('POST', { phones, note })),
  removeBlocked: (phone) => request(`/blocked/${phone}`, { method: 'DELETE' }),
  campaigns: (cabinet) => request('/campaigns?' + qs({ cabinet })),
  campaign: (id) => request(`/campaigns/${id}`),
  cancelCampaign: (id) => request(`/campaigns/${id}/cancel`, { method: 'POST' }),
  retryFailed: (id) => request(`/campaigns/${id}/retry-failed`, { method: 'POST' }),
  messages: (params) => request('/messages?' + qs(params)),
};
