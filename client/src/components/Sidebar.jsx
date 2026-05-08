import { NavLink, useNavigate } from 'react-router-dom';
import { getUser, clearAuth } from '../lib/auth.js';

const SECTIONS = [
  { id: 'providers', label: 'Providers', path: '/providers' },
  { id: 'locations', label: 'Locations', path: '/locations' },
  { id: 'services', label: 'Services', path: '/services' },
  { id: 'careers', label: 'Careers', path: '/careers' },
  { id: 'patients', label: 'Patients', path: '/patients' },
  { id: 'news', label: 'News', path: '/news' },
];

export default function Sidebar() {
  const user = getUser();
  const navigate = useNavigate();
  const sections = SECTIONS.filter(s => user?.sections.includes(s.id));

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">Webmin</h1>
        <p className="text-slate-400 text-xs mt-0.5">CMC Website</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">D</span>
          Dashboard
        </NavLink>

        {sections.map(section => (
          <NavLink
            key={section.id}
            to={section.path}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">
              {section.label[0]}
            </span>
            {section.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-0.5">
        {user?.isAdmin && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">S</span>
            Settings
          </NavLink>
        )}
        <div className="px-3 py-1 text-xs text-slate-500 truncate">{user?.email}</div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
