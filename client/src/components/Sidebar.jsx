import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../lib/auth.js';
import { useUser } from '../contexts/UserContext.jsx';

const ALL_SECTIONS = [
  { id: 'providers', label: 'Providers', path: '/providers' },
  { id: 'locations', label: 'Locations', path: '/locations' },
  { id: 'services', label: 'Services', path: '/services' },
  { id: 'careers', label: 'Careers', path: '/careers' },
  { id: 'patients', label: 'Patients', path: '/patients' },
  { id: 'news', label: 'News', path: '/news' },
  { id: 'contact', label: 'Contact', path: '/contact' },
];

const navClass = ({ isActive }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

export default function Sidebar() {
  const { firebaseUser, profile } = useUser();
  const navigate = useNavigate();

  const userSections = profile?.sections ?? [];
  const isAdmin = profile?.isAdmin ?? false;
  const visibleSections = ALL_SECTIONS.filter(
    (s) => isAdmin || userSections.includes('*') || userSections.includes(s.id)
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">Webmin <span className="text-xs font-normal text-slate-500">v{__APP_VERSION__}</span></h1>
        <p className="text-slate-400 text-xs mt-0.5">{profile?.name ?? ''}</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        <NavLink to="/" end className={navClass}>
          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">D</span>
          Dashboard
        </NavLink>

        {visibleSections.map((section) => (
          <NavLink key={section.id} to={section.path} className={navClass}>
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">
              {section.label[0]}
            </span>
            {section.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-0.5">
        {(isAdmin || userSections.includes('*') || userSections.includes('activity')) && (
          <NavLink to="/activity" className={navClass}>
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">A</span>
            Activity Log
          </NavLink>
        )}
        {(isAdmin || userSections.includes('*') || userSections.includes('html-editor')) && (
          <NavLink to="/html-editor" className={navClass}>
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">E</span>
            Page Editor
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/settings" className={navClass}>
            <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">S</span>
            Settings
          </NavLink>
        )}
        <div className="px-3 py-1 text-xs text-slate-500 truncate">
          {firebaseUser?.email}
        </div>
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
