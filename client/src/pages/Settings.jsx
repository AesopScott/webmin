import { useState, useEffect } from 'react';
import { fetchSettings, saveSettings, getAccountUsers, updateUserSections } from '../lib/api.js';
import { useUser } from '../contexts/UserContext.jsx';

const ALL_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news'];

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
  const [ghSaving, setGhSaving] = useState(false);
  const [ghMsg, setGhMsg] = useState('');

  useEffect(() => {
    if (!accountId) return;
    Promise.all([fetchSettings(accountId), getAccountUsers(accountId)])
      .then(([cfg, { users: us }]) => {
        setGhConfig(cfg);
        setGhOwner(cfg.githubOwner);
        setGhRepo(cfg.githubRepo);
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
    const next = checked
      ? [...user.sections, section]
      : user.sections.filter((s) => s !== section);
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, sections: next } : u)));
    try {
      await updateUserSections(accountId, uid, next);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading settings…</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;

  return (
    <div className="max-w-3xl space-y-8">

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
          <div className="flex items-center gap-3">
            <button type="submit" disabled={ghSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {ghSaving ? 'Saving…' : 'Save GitHub Settings'}
            </button>
            {ghMsg && <span className="text-sm text-gray-500">{ghMsg}</span>}
          </div>
        </form>
      </section>

      {/* User Section Access */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-1">User Access</h2>
        <p className="text-sm text-gray-500 mb-5">
          Control which sections each user can edit. Changes save immediately.
          To add or remove users, use the Firebase Console.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-3 font-medium text-gray-500 pr-6">User</th>
                {ALL_SECTIONS.map((s) => (
                  <th key={s} className="pb-3 font-medium text-gray-500 capitalize px-2 text-center">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const hasAll = user.sections?.includes('*');
                return (
                  <tr key={user.uid} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pr-6">
                      <div className="font-medium text-gray-800">{user.name}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </td>
                    {ALL_SECTIONS.map((s) => (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

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
