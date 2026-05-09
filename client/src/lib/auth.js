import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const getCurrentUser = () => auth.currentUser;

export const getIdToken = () =>
  auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};
