import { getToken, clearAuth } from './auth.js';

const request = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const fetchSection = (section) =>
  request(`/github/${section}`);

export const saveSection = (section, content, sha) =>
  request(`/github/${section}`, {
    method: 'PUT',
    body: JSON.stringify({ content, sha }),
  });

export const fetchSettings = () =>
  request('/settings');

export const saveGithubSettings = (data) =>
  request('/settings/github', { method: 'POST', body: JSON.stringify(data) });

export const setUserPassword = (userId, password) =>
  request(`/settings/users/${userId}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
