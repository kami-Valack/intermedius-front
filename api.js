// Camada única de acesso ao backend Laravel (ver docs/FRONTEND.md).
// Os tokens e alguns caches de apresentação ficam em localStorage; USE_API controla as chamadas reais.
(function () {
  const C = window.APP_CONFIG || {};
  const getToken = () => localStorage.getItem('inter_token') || '';
  const setToken = t => (t ? localStorage.setItem('inter_token', t) : localStorage.removeItem('inter_token'));

  async function request(method, path, body) {
    if (!C.USE_API) throw new Error('API desligada: modo demonstração');
    const isForm = body instanceof FormData;               // criar imóvel = multipart (photos[], video)
    const res = await fetch(C.API_BASE_URL + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {})
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const first = data.errors && Object.values(data.errors)[0];
      const err = new Error((first && first[0]) || data.message || res.statusText);
      err.status = res.status; err.code = data.code; err.errors = data.errors;   // ex.: property_duplicate, agent_limit
      throw err;
    }
    return data;
  }
  const get = p => request('GET', p), post = (p, b) => request('POST', p, b),
        patch = (p, b) => request('PATCH', p, b), put = (p, b) => request('PUT', p, b), del = p => request('DELETE', p);
  const qs = q => (q ? '?' + new URLSearchParams(q) : '');
  const keep = r => { if (r && r.token) setToken(r.token); return r; };
  const resource = r => r && r.data && !Array.isArray(r.data) ? (r.data.data || r.data) : r;
  const rows = r => Array.isArray(r) ? r : Array.isArray(r && r.data) ? r.data : Array.isArray(r && r.data && r.data.data) ? r.data.data : [];

  window.Api = {
    enabled: () => !!C.USE_API, request, getToken, setToken, resource, rows,
    auth: {
      phoneVerifications: {
        request: b => post('/auth/phone-verifications', b),
        verify: b => post('/auth/phone-verifications/verify', b)
      },
      register: b => post('/auth/register', b).then(keep),      // b pode ser FormData (documento BI/NIF)
      login: b => post('/auth/login', b).then(keep),
      me: () => get('/auth/me'),
      logout: () => post('/auth/logout').finally(() => setToken(null))
    },
    properties: {
      list: q => get('/properties' + qs(q)), get: id => get('/properties/' + id), mine: q => get('/properties/mine' + qs(q)),
      create: formData => post('/properties', formData),        // 409 duplicado · 422 menos de 5 fotos
      remove: id => del('/properties/' + id), favorite: id => post('/properties/' + id + '/favorite'), favorites: () => get('/favorites')
    },
    agentLinks: {
      list: q => get('/agent-links' + qs(q)),
      invite: (propertyId, b) => post('/properties/' + propertyId + '/agents', b),   // 422 agent_limit (máx. 5)
      respond: (id, status) => patch('/agent-links/' + id, { status })               // approved | rejected | revoked
    },
    availability: { get: () => get('/availability'), save: b => put('/availability', b) },   // days: 1=segunda … 7=domingo
    visits: { list: q => get('/visits' + qs(q)), create: b => post('/visits', b), checkin: code => post('/visits/checkin', { code }) },
    rentals: { list: () => get('/rentals'), create: b => post('/rentals', b) },
    commissions: { list: () => get('/commissions'), pay: (id, body) => patch('/commissions/' + id + '/pay', body) },
    community: {
      list: () => get('/community/requests'), create: b => post('/community/requests', b),
      close: id => patch('/community/requests/' + id + '/close'),
      respond: (requestId, propertyId, accept) => post('/community/requests/' + requestId + '/offers', { property_id: propertyId, accept })
    },
    notifications: { list: () => get('/notifications'), read: id => patch('/notifications/' + id + '/read'), readAll: () => post('/notifications/read-all') },
    admin: {
      stats: () => get('/admin/stats'), users: q => get('/admin/users' + qs(q)), reviewUser: (id, b) => patch('/admin/users/' + id, b),
      properties: q => get('/admin/properties' + qs(q)), reviewProperty: (id, b) => patch('/admin/properties/' + id, b),
      payments: q => get('/admin/payments' + qs(q)), settings: () => get('/admin/settings'), saveSettings: b => put('/admin/settings', b)
    }
  };
})();
