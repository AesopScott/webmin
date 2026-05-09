import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../contexts/UserContext.jsx';

export default function ProtectedRoute() {
  const { isLoading, isAuthed } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return isAuthed ? <Outlet /> : <Navigate to="/login" replace />;
}
