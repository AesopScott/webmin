import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Providers from './pages/sections/Providers.jsx';
import Locations from './pages/sections/Locations.jsx';
import Services from './pages/sections/Services.jsx';
import Careers from './pages/sections/Careers.jsx';
import Patients from './pages/sections/Patients.jsx';
import News from './pages/sections/News.jsx';
import Contact from './pages/sections/Contact.jsx';
import Settings from './pages/Settings.jsx';
import ActivityLog from './pages/ActivityLog.jsx';
import HtmlEditor from './pages/HtmlEditor.jsx';

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/services" element={<Services />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/news" element={<News />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/activity" element={<ActivityLog />} />
              <Route path="/html-editor" element={<HtmlEditor />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
