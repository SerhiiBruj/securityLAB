import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Activate from './pages/Activate.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';

// RBAC на клієнті: лише зручність інтерфейсу. Справжній захист робить сервер (requireAuth/requireRole).
function Guard({ children, admin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Завантаження…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/profile" replace />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const onLogout = async () => {
    await logout();
    navigate('/login');
  };
  return (
    <header className="topbar">
      <Link to="/" className="brand">Auth Lab</Link>
      <nav>
        {user ? (
          <>
            <NavLink to="/profile">Профіль</NavLink>
            {user.role === 'admin' && <NavLink to="/admin">Адмін-панель</NavLink>}
            <button className="linklike" onClick={onLogout}>Вийти</button>
          </>
        ) : (
          <>
            <NavLink to="/login">Вхід</NavLink>
            <NavLink to="/register">Реєстрація</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to={user ? '/profile' : '/login'} replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/activate" element={<Activate />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Guard><Profile /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
