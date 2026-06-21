import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav style={{
      background: 'white',
      borderBottom: '1px solid var(--gray-200)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
            EventTix
          </Link>
          <Link to="/events" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-600)' }}>
            Events
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <>
              <Link to="/dashboard" style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                  Admin
                </Link>
              )}
              <span style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>|</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>{user.name}</span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline" style={{ padding: '0.375rem 1rem', fontSize: '0.8rem' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '0.375rem 1rem', fontSize: '0.8rem' }}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer style={{
      background: 'white',
      borderTop: '1px solid var(--gray-200)',
      padding: '2rem 0',
      marginTop: '4rem',
    }}>
      <div className="container" style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.875rem' }}>
        &copy; {new Date().getFullYear()} EventTix. All rights reserved.
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
