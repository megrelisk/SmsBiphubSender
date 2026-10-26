async function request(path, options = {}) {
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

export const api = {
  config: () => request('/config'),
  templates: () => request('/templates'),
  saveTemplate: (t) => (t.id ? request(`/templates/${t.id}`, json('PUT', t)) : request('/templates', json('POST', t))),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  parseFile: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/parse', { method: 'POST', body: fd });
  },
  createCampaign: (c) => request('/campaigns', json('POST', c)),
  campaigns: () => request('/campaigns'),
  campaign: (id) => request(`/campaigns/${id}`),
  cancelCampaign: (id) => request(`/campaigns/${id}/cancel`, { method: 'POST' }),
  retryFailed: (id) => request(`/campaigns/${id}/retry-failed`, { method: 'POST' }),
  messages: (params) => request('/messages?' + new URLSearchParams(params)),
};
