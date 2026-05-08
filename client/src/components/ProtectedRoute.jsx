import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth.js';

export default function ProtectedRoute() {
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />;
}
