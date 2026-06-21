import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>Loading...</div>;
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}
