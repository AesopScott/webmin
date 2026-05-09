import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';

const call = (name) => (data) =>
  httpsCallable(functions, name)(data).then((r) => r.data);

export const fetchSection = (accountId, section) =>
  call('getSection')({ accountId, section });

export const saveSection = (accountId, section, items, sha) =>
  call('saveSection')({ accountId, section, items, sha });

export const fetchSettings = (accountId) =>
  call('getSettings')({ accountId });

export const saveSettings = (accountId, settings) =>
  call('saveSettings')({ accountId, ...settings });

export const getAccountUsers = (accountId) =>
  call('getAccountUsers')({ accountId });

export const updateUserSections = (accountId, targetUid, sections) =>
  call('updateUserSections')({ accountId, targetUid, sections });

export const getMyProfile = () =>
  call('getMyProfile')({});
