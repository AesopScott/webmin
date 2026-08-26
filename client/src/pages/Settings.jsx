import { useState, useEffect } from 'react';
import {
  fetchSettings, saveSettings,
  getAccountUsers, updateUserSections,
  createUser, deleteUser, setUserAdmin,
  resetUserPassword, sendPasswordEmail,
} from '../lib/api.js';
import { useUser } from '../contexts/UserContext.jsx';

const CONTENT_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news', 'contact'];
const FEATURE_SECTIONS = ['activity', 'html-editor'];
const ALL_SECTIONS = [...CONTENT_SECTIONS, ...FEATURE_SECTIONS];

const SECTION_LABELS = {
  providers: 'Providers', locations: 'Locations', services: 'Services',
  careers: 'Careers', patients: 'Patients', news: 'News', contact: 'Contact',
  activity: 'Activity Log', 'html-editor': 'Page Editor',
};

export default function Settings() {
  const { profile } = useUser();
  const accountId = profile?.accountId;

  const [ghConfig, setGhConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ghToken, setGhToken] = useState('');
  const [ghOwner, setGhOwner] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghSiteUrl, setGhSiteUrl] = useState('');
  const [ghSaving, setGhSaving] = useState(false);
  const [ghMsg, setGhMsg] = useState('');

  const [addingUser, setAddingUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [resetModalUser, setResetModalUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [shouldSendEmail, setShouldSendEmail] = useState(true);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    Promise.all([fetchSettings(accountId), getAccountUsers(accountId)])
      .then(([cfg, { users: us }]) => {
        setGhConfig(cfg);
        setGhOwner(cfg.githubOwner);
        setGhRepo(cfg.githubRepo);
        setGhSiteUrl(cfg.siteUrl || '');
        setUsers(us);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [accountId]);

  const saveGithub = async (e) => {
    e.preventDefault();
    setGhSaving(true);
    setGhMsg('');
    try {
      await saveSettings(accountId, {
        githubOwner: ghOwner,
        githubRepo: ghRepo,
        siteUrl: ghSiteUrl,
        ...(ghToken ? { githubToken: ghToken } : {}),
      });
      setGhMsg('Saved.');
      setGhToken('');
      setGhConfig((prev) => ({
        ...prev,
        githubOwner: ghOwner,
        githubRepo: ghRepo,
        tokenSet: ghToken ? true : prev.tokenSet,
      }));
    } catch (err) {
      setGhMsg(err.message);
    } finally {
      setGhSaving(false);
    }
  };

  const toggleSection = async (uid, section, checked) => {
    const user = users.find((u) => u.uid === uid);
    if (!user) return;
    const current = Array.isArray(user.sections) ? user.sections : [];
    const next = checked ? [...current, section] : current.filter((s) => s !== section);
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, sections: next } : u)));
    try {
      await updateUserSections(accountId, uid, next);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAdmin = async (uid, checked) => {
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, isAdmin: checked } : u)));
    try {
      await setUserAdmin(accountId, uid, checked);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (targetUid, name) => {
    if (!confirm(`Delete user "${name}" permanently? This cannot be undone.`)) return;
    try {
      await deleteUser(accountId, targetUid);
      setUsers((prev) => prev.filter((u) => u.uid !== targetUid));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    try {
      const user = await createUser(accountId, newEmail, newName, newPassword, newIsAdmin);
      setUsers((prev) => [...prev, user]);
      setAddingUser(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewIsAdmin(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  };

  const handleResetPassword = async (user) => {
    setResetModalUser(user);
    setResetPassword('');
    setShouldSendEmail(true);
    setResetMsg('');
  };

  const submitResetPassword = async () => {
    if (!resetModalUser) return;
    setResetSaving(true);
    setResetMsg('');
    try {
      const { newPassword } = await resetUserPassword(accountId, resetModalUser.uid);
      setResetPassword(newPassword);

      if (shouldSendEmail) {
        const siteUrl = window.location.origin;
        await sendPasswordEmail(accountId, resetModalUser.uid, newPassword, siteUrl);
        setResetMsg(`Password reset and email sent to ${resetModalUser.email}`);
      } else {
        setResetMsg(`Password reset. Copy above and share with user.`);
      }
    } catch (err) {
      setResetMsg(`Error: ${err.message}`);
    } finally {
      setResetSaving(false);
    }
  };

  const closeResetModal = () => {
    setResetModalUser(null);
    setResetPassword('');
    setResetMsg('');
  };

  if (!accountId) return <div className="text-gray-400 text-sm">Your account is not linked to any workspace. Add an <code>accountId</code> to your user profile in Firestore.</div>;
  if (loading) return <div className="text-gray-400 text-sm">Loading settings…</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;

  return (
    <div className="max-w-4xl space-y-8">

      {/* GitHub */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-1">GitHub Connection</h2>
        <p className="text-sm text-gray-500 mb-5">
          Webmin reads and writes content via the GitHub API. The token needs{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">contents: read/write</code> scope on the target repo.
          {ghConfig?.tokenSet && <span className="ml-2 text-green-600 font-medium">Token is set.</span>}
        </p>
        <form onSubmit={saveGithub} className="space-y-4">
          <Field
            label={ghConfig?.tokenSet ? 'GitHub Token (leave blank to keep current)' : 'GitHub Token'}
            value={ghToken}
            onChange={setGhToken}
            type="password"
            placeholder={ghConfig?.tokenSet ? '••••••••' : 'ghp_…'}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Repository Owner" value={ghOwner} onChange={setGhOwner} placeholder="AesopScott" />
            <Field label="Repository Name" value={ghRepo} onChange={setGhRepo} placeholder="cmc" />
          </div>
          <Field label="Site URL (used by HTML Page Editor for live preview)" value={ghSiteUrl} onChange={setGhSiteUrl} placeholder="https://dev.cmcenters.org" />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={ghSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {ghSaving ? 'Saving…' : 'Save GitHub Settings'}
            </button>
            {ghMsg && <span className="text-sm text-gray-500">{ghMsg}</span>}
          </div>
        </form>
      </section>

      {/* User Management */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-gray-900">Users</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage accounts and section access. Changes save immediately.</p>
          </div>
          <button
            onClick={() => { setAddingUser((v) => !v); setAddError(''); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {addingUser ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {addingUser && (
          <form onSubmit={handleAddUser} className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">New User</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" value={newName} onChange={setNewName} placeholder="Jane Smith" />
              <Field label="Email" value={newEmail} onChange={setNewEmail} type="email" placeholder="jane@example.com" />
            </div>
            <Field label="Password" value={newPassword} onChange={setNewPassword} type="password" placeholder="Temporary password" />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              Admin (can manage users and settings)
            </label>
            {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}
            <button type="submit" disabled={addSaving || !newName || !newEmail || !newPassword}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {addSaving ? 'Creating…' : 'Create User'}
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-3 font-medium text-gray-500 pr-6">User</th>
                <th className="pb-3 font-medium text-gray-500 px-3 text-center">Admin</th>
                {CONTENT_SECTIONS.map((s) => (
                  <th key={s} className="pb-3 font-medium text-gray-500 px-2 text-center">{SECTION_LABELS[s]}</th>
                ))}
                <th className="pb-3 px-1"><div className="w-px h-4 bg-gray-200 mx-auto" /></th>
                {FEATURE_SECTIONS.map((s) => (
                  <th key={s} className="pb-3 font-medium text-blue-500 px-2 text-center whitespace-nowrap">{SECTION_LABELS[s]}</th>
                ))}
                <th className="pb-3 font-medium text-gray-500 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const hasAll = user.isAdmin || user.sections?.includes('*');
                const isSelf = user.uid === profile?.uid;
                return (
                  <tr key={user.uid} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pr-6">
                      <div className="font-medium text-gray-800">{user.name}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.isAdmin ?? false}
                        disabled={isSelf}
                        onChange={(e) => toggleAdmin(user.uid, e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        title={isSelf ? 'Cannot change your own admin status' : ''}
                      />
                    </td>
                    {CONTENT_SECTIONS.map((s) => (
                      <td key={s} className="py-3 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={hasAll || (user.sections?.includes(s) ?? false)}
                          disabled={hasAll}
                          onChange={(e) => toggleSection(user.uid, s, e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className="py-3 px-1"><div className="w-px h-4 bg-gray-200 mx-auto" /></td>
                    {FEATURE_SECTIONS.map((s) => (
                      <td key={s} className="py-3 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={hasAll || (user.sections?.includes(s) ?? false)}
                          disabled={hasAll}
                          onChange={(e) => toggleSection(user.uid, s, e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className="py-3 px-3 text-center text-xs space-y-1">
                      <button
                        onClick={() => handleResetPassword(user)}
                        disabled={isSelf}
                        className="block text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={isSelf ? 'Cannot reset your own password' : 'Reset password'}
                      >
                        Reset Pwd
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.uid, user.name)}
                        disabled={isSelf}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {resetModalUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reset Password: {resetModalUser.name}
            </h3>

            {resetPassword && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-xs text-blue-600 font-medium mb-2">New Temporary Password:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-blue-300 px-3 py-2 rounded font-mono text-sm text-gray-800">
                    {resetPassword}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(resetPassword)}
                    className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {!resetPassword && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={shouldSendEmail}
                    onChange={(e) => setShouldSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Send password email to user
                </label>
                <p className="text-xs text-gray-500 mb-5">
                  {shouldSendEmail
                    ? 'User will receive an email with their temporary password and login link.'
                    : 'You can copy the password below and share it manually with the user.'}
                </p>
              </>
            )}

            {resetMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg mb-4 ${
                resetMsg.includes('Error')
                  ? 'bg-red-50 text-red-600'
                  : 'bg-green-50 text-green-600'
              }`}>
                {resetMsg}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeResetModal}
                disabled={resetSaving}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Close
              </button>
              {!resetPassword && (
                <button
                  onClick={submitResetPassword}
                  disabled={resetSaving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {resetSaving ? 'Resetting…' : 'Reset Password'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
