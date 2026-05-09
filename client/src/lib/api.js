import { auth } from './firebase.js';

async function call(name, data) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export const fetchSection = (accountId, section) =>
  call('getSection', { accountId, section });

export const saveSection = (accountId, section, items, sha) =>
  call('saveSection', { accountId, section, items, sha });

export const fetchSettings = (accountId) =>
  call('getSettings', { accountId });

export const saveSettings = (accountId, settings) =>
  call('saveSettings', { accountId, ...settings });

export const getAccountUsers = (accountId) =>
  call('getAccountUsers', { accountId });

export const updateUserSections = (accountId, targetUid, sections) =>
  call('updateUserSections', { accountId, targetUid, sections });

export const getMyProfile = () =>
  call('getMyProfile', {});

export const uploadImage = (accountId, filename, content) =>
  call('uploadImage', { accountId, filename, content });

export const createUser = (accountId, email, name, password, isAdmin) =>
  call('createUser', { accountId, email, name, password, isAdmin });

export const deleteUser = (accountId, targetUid) =>
  call('deleteUser', { accountId, targetUid });

export const setUserAdmin = (accountId, targetUid, isAdmin) =>
  call('setUserAdmin', { accountId, targetUid, isAdmin });
