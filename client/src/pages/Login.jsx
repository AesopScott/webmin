import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  login,
  logout,
  getCurrentUser,
  getEnrolledFactors,
  sendVerificationEmail,
  startPhoneEnrollment,
  completePhoneEnrollment,
  getMfaResolver,
  sendSmsMfaCode,
  completePhoneMfaSignIn,
  completeTotpMfaSignIn,
  MFA_FACTOR_IDS,
} from '../lib/auth.js';
import { useUser } from '../contexts/UserContext.jsx';

// step: null | 'totp' | 'phone' | 'verify-email' | 'enroll' | 'enroll-verify'
export default function Login() {
  const { isAuthed, isLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(null);
  const [mfaResolver, setMfaResolver] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const navigate = useNavigate();

  // Send SMS after phone MFA challenge step renders so #recaptcha-container exists in DOM
  useEffect(() => {
    if (step !== 'phone' || !mfaResolver) return;
    sendSmsMfaCode(mfaResolver, 'recaptcha-container')
      .then(setVerificationId)
      .catch(() => {
        setError('Failed to send verification code. Please try again.');
        setStep(null);
        setMfaResolver(null);
      });
  }, [step, mfaResolver]);

  // Redirect only when the user is signed in AND has MFA enrolled.
  // Without this check, unenrolled users get bounced before the enrollment step renders.
  const currentUser = getCurrentUser();
  const hasEnrolledFactors = currentUser ? getEnrolledFactors(currentUser).length > 0 : false;
  if (!isLoading && isAuthed && hasEnrolledFactors) return <Navigate to="/" replace />;

  const resetToCredentials = () => {
    setStep(null);
    setMfaResolver(null);
    setVerificationId(null);
    setOtpCode('');
    setPhoneNumber('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      const user = getCurrentUser();
      if (getEnrolledFactors(user).length === 0) {
        if (!user.emailVerified) {
          await sendVerificationEmail(user);
          await logout();
          setStep('verify-email');
        } else {
          setStep('enroll');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      if (err.code === 'auth/multi-factor-auth-required') {
        const resolver = getMfaResolver(err);
        const firstHint = resolver.hints[0];
        setMfaResolver(resolver);
        if (firstHint?.factorId === MFA_FACTOR_IDS.TOTP) {
          setStep('totp');
        } else if (firstHint?.factorId === MFA_FACTOR_IDS.PHONE) {
          setStep('phone');
        } else {
          setError('Unsupported MFA method. Contact your administrator.');
        }
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (step === 'totp') {
        await completeTotpMfaSignIn(mfaResolver, otpCode);
      } else {
        await completePhoneMfaSignIn(mfaResolver, verificationId, otpCode);
      }
      navigate('/');
    } catch {
      setError('Invalid verification code. Please try again.');
      setOtpCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollPhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const normalized = phoneNumber.trim().startsWith('+')
        ? phoneNumber.trim()
        : `+1${phoneNumber.replace(/\D/g, '')}`;
      const vid = await startPhoneEnrollment(getCurrentUser(), normalized, 'recaptcha-container');
      setVerificationId(vid);
      setStep('enroll-verify');
    } catch (err) {
      setError(`Failed to send code: ${err.message ?? 'Please check the number and try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await completePhoneEnrollment(getCurrentUser(), verificationId, otpCode);
      navigate('/');
    } catch {
      setError('Invalid code. Please try again.');
      setOtpCode('');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'verify-email') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
            <p className="text-gray-500 text-sm mt-1">
              We sent a verification link to{' '}
              <span className="font-medium text-gray-700">{email}</span>. Click the link to verify
              your address, then come back and sign in to finish setting up two-factor authentication.
            </p>
          </div>

          <button
            type="button"
            onClick={resetToCredentials}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (step === 'enroll') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div id="recaptcha-container" />
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Secure Your Account</h1>
            <p className="text-gray-500 text-sm mt-1">
              Add a phone number to enable two-factor authentication. You'll receive a
              verification code by SMS each time you sign in.
            </p>
          </div>

          <form onSubmit={handleEnrollPhoneSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 555 000 0000"
                autoComplete="tel"
                autoFocus
                required
              />
              <p className="text-xs text-gray-400 mt-1.5">Include country code, e.g. +1 for US</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !phoneNumber.trim()}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Sending code…' : 'Send Verification Code'}
            </button>

            <button
              type="button"
              onClick={resetToCredentials}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'enroll-verify') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Verify Your Phone</h1>
            <p className="text-gray-500 text-sm mt-1">
              Enter the 6-digit code sent to <span className="font-medium text-gray-700">{phoneNumber}</span>.
            </p>
          </div>

          <form onSubmit={handleEnrollVerifySubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest text-center text-lg"
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || otpCode.length < 6}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Activating…' : 'Activate Two-Factor Authentication'}
            </button>

            <button
              type="button"
              onClick={resetToCredentials}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'totp' || step === 'phone') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div id="recaptcha-container" />
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
            <p className="text-gray-500 text-sm mt-1">
              {step === 'totp'
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Enter the code sent to your phone.'}
            </p>
          </div>

          <form onSubmit={handleMfaSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest text-center text-lg"
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || otpCode.length < 6 || (step === 'phone' && !verificationId)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={resetToCredentials}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Webmin <span className="text-sm font-normal text-gray-400">v{__APP_VERSION__}</span></h1>
          <p className="text-gray-500 text-sm mt-1">Website Management</p>
        </div>

        <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              autoComplete="email"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
