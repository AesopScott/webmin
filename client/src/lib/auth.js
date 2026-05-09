import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  getMultiFactorResolver,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
  RecaptchaVerifier,
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

export const MFA_FACTOR_IDS = {
  PHONE: PhoneMultiFactorGenerator.FACTOR_ID,
  TOTP: TotpMultiFactorGenerator.FACTOR_ID,
};

export const getMfaResolver = (error) => getMultiFactorResolver(auth, error);

export const sendSmsMfaCode = async (resolver, recaptchaContainerId) => {
  const phoneHint = resolver.hints.find(
    (h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  );
  if (!phoneHint) throw new Error('No phone MFA factor enrolled');

  const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
    size: 'invisible',
  });
  try {
    const phoneAuthProvider = new PhoneAuthProvider(auth);
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      { multiFactorHint: phoneHint, session: resolver.session },
      recaptchaVerifier
    );
    return verificationId;
  } finally {
    recaptchaVerifier.clear();
  }
};

export const completePhoneMfaSignIn = (resolver, verificationId, code) => {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  return resolver.resolveSignIn(assertion);
};

export const completeTotpMfaSignIn = (resolver, code) => {
  const totpHint = resolver.hints.find(
    (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID
  );
  if (!totpHint) throw new Error('No TOTP MFA factor enrolled');
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code);
  return resolver.resolveSignIn(assertion);
};

export const sendVerificationEmail = (user) => sendEmailVerification(user);

export const getEnrolledFactors = (user) => multiFactor(user).enrolledFactors;

export const startPhoneEnrollment = async (user, phoneNumber, recaptchaContainerId) => {
  const session = await multiFactor(user).getSession();
  const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  try {
    const phoneAuthProvider = new PhoneAuthProvider(auth);
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      { phoneNumber, session },
      recaptchaVerifier
    );
    return verificationId;
  } finally {
    recaptchaVerifier.clear();
  }
};

export const completePhoneEnrollment = async (user, verificationId, code) => {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  await multiFactor(user).enroll(assertion, 'Phone');
};
