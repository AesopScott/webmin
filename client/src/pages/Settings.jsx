import { useState, useEffect } from 'react';
import { fetchSection } from '../lib/api.js';

const request = async (path, body) => {
  const token = localStorage.getItem('webmin_token');
  const res = await fetch(`/api/settings${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // GitHub form state
  const [ghToken, setGhToken] = useState('');
  const [ghOwner, setGhOwner] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghSaving, setGhSaving] = useState(false);
  const [ghMsg, setGhMsg] = useState('');

  // Per-user password state: { [userId]: { password, saving, msg } }
  const [pwState, setPwState] = useState({});

  useEffect(() => {
    request('/')
      .then(data => {
        setConfig(data);
        setGhOwner(data.github.owner);
        setGhRepo(data.github.repo);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const saveGithub = async (e) => {
    e.preventDefault();
    setGhSaving(true);
    setGhMsg('');
    try {
      await request('/github', {
        token: ghToken || undefined,
        owner: ghOwner,
        repo: ghRepo,
      });
      setGhMsg('Saved.');
      setGhToken('');
      setConfig(prev => ({ ...prev, github: { ...prev.github, tokenSet: ghToken ? true : prev.github.tokenSet, owner: ghOwner, repo: ghRepo } }));
    } catch (err) {
      setGhMsg(err.message);
    } finally {
      setGhSaving(false);
    }
  };

  const setPassword = async (userId) => {
    const pw = pwState[userId]?.password || '';
    setPwState(prev => ({ ...prev, [userId]: { ...prev[userId], saving: true, msg: '' } }));
    try {
      await request(`/users/${userId}/password`, { password: pw });
      setPwState(prev => ({ ...prev, [userId]: { password: '', saving: false, msg: 'Password set.' } }));
      setConfig(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === userId ? { ...u, passwordSet: true } : u),
      }));
    } catch (err) {
      setPwState(prev => ({ ...prev, [userId]: { ...prev[userId], saving: false, msg: err.message } }));
    }
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading settings...</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;

  return (
    <div className="max-w-2xl space-y-8">

      {/* GitHub */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-1">GitHub Connection</h2>
        <p className="text-sm text-gray-500 mb-5">
          Webmin reads and writes CMC content via the GitHub API. The token needs repo read/write scope.
          {config.github.tokenSet && <span className="ml-2 text-green-600 font-medium">Token is set.</span>}
        </p>
        <form onSubmit={saveGithub} className="space-y-4">
          <Field
            label={config.github.tokenSet ? 'GitHub Token (leave blank to keep current)' : 'GitHub Token'}
            value={ghToken}
            onChange={setGhToken}
            type="password"
            placeholder={config.github.tokenSet ? '••••••••' : 'ghp_...'}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Repository Owner" value={ghOwner} onChange={setGhOwner} placeholder="AesopScott" />
            <Field label="Repository Name" value={ghRepo} onChange={setGhRepo} placeholder="cmc" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={ghSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {ghSaving ? 'Saving...' : 'Save GitHub Settings'}
            </button>
            {ghMsg && <span className="text-sm text-gray-500">{ghMsg}</span>}
          </div>
        </form>
      </section>

      {/* User Passwords */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-1">User Passwords</h2>
        <p className="text-sm text-gray-500 mb-5">
          Set or reset passwords for each user. Passwords are stored as secure hashes — they cannot be recovered, only reset.
        </p>
        <div className="space-y-4">
          {config.users.map(user => {
            const state = pwState[user.id] || {};
            return (
              <div key={user.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                <div className="w-48 shrink-0">
                  <div className="text-sm font-medium text-gray-800">{user.name}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </div>
                <input
                  type="password"
                  placeholder={user.passwordSet ? 'Reset password...' : 'Set password...'}
                  value={state.password || ''}
                  onChange={e => setPwState(prev => ({ ...prev, [user.id]: { ...prev[user.id], password: e.target.value } }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && setPassword(user.id)}
                />
                <button
                  onClick={() => setPassword(user.id)}
                  disabled={state.saving || !state.password}
                  className="px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors shrink-0"
                >
                  {state.saving ? 'Saving...' : user.passwordSet ? 'Reset' : 'Set'}
                </button>
                <div className="w-20 shrink-0 text-xs">
                  {user.passwordSet && !state.msg && <span className="text-green-600">Active</span>}
                  {state.msg && <span className={state.msg === 'Password set.' ? 'text-green-600' : 'text-red-500'}>{state.msg}</span>}
                </div>
              </div>
            );
          })}
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
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
