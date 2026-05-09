import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext.jsx';

const SECTION_META = {
  providers: { label: 'Providers', description: 'Add, edit, and remove provider profiles and photos' },
  locations: { label: 'Locations', description: 'Update clinic hours, addresses, and contact info' },
  services: { label: 'Services', description: 'Edit service descriptions and linked locations' },
  careers: { label: 'Careers', description: 'Update FAQs and benefits copy' },
  patients: { label: 'Patients', description: 'Edit patient resource and insurance content' },
  news: { label: 'News', description: 'Add and manage news posts and announcements' },
};

export default function Dashboard() {
  const { profile } = useUser();
  const userSections = profile?.sections ?? [];
  const hasAll = userSections.includes('*');
  const sections = hasAll ? Object.keys(SECTION_META) : userSections;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {profile?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Select a section to start editing.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((id) => {
          const meta = SECTION_META[id];
          if (!meta) return null;
          return (
            <Link
              key={id}
              to={`/${id}`}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-sm transition-all group"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {meta.label}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
