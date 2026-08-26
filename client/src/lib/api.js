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

export const fetchContactPage = (accountId) =>
  call('getContactPage', { accountId });

export const saveContactPage = (accountId, items, sha) =>
  call('saveContactPage', { accountId, items, sha });

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

export const resetUserPassword = (accountId, targetUid) =>
  call('resetUserPassword', { accountId, targetUid });

export const sendPasswordEmail = (accountId, targetUid, newPassword, siteUrl) =>
  call('sendPasswordEmail', { accountId, targetUid, newPassword, siteUrl });

export const getHtmlFiles = (accountId) =>
  call('getHtmlFiles', { accountId });

export const getHtmlFile = (accountId, path) =>
  call('getHtmlFile', { accountId, path });

export const saveHtmlFile = (accountId, path, content, sha) =>
  call('saveHtmlFile', { accountId, path, content, sha });

export const getChangeHistory = (accountId, section, limit) =>
  call('getChangeHistory', { accountId, section, limit });

export const getChangeDetail = (accountId, changeId) =>
  call('getChangeDetail', { accountId, changeId });

export const undoChange = (accountId, changeId) =>
  call('undoChange', { accountId, changeId });
