import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/providers': 'Providers',
  '/locations': 'Locations',
  '/services': 'Services',
  '/careers': 'Careers',
  '/patients': 'Patients',
  '/news': 'News',
};

export default function Header() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'Webmin';

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <a
        href="https://cmcenters.org"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        View live site
      </a>
    </header>
  );
}
