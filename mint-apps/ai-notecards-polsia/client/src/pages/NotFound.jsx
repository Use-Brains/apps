import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

export default function NotFound() {
  const { user, loading } = useAuth();

  const ctaTarget = loading ? '/' : (user ? '/dashboard' : '/');
  const ctaLabel = loading ? 'Go Home' : (user ? 'Go to Dashboard' : 'Go Home');

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-6xl font-bold text-[#1B6B5A] mb-4">404</h1>
        <p className="text-xl text-[#1A1614] mb-2">Page not found</p>
        <p className="text-[#6B635A] mb-8">
          We couldn't find the page you're looking for.
        </p>
        <Link
          to={ctaTarget}
          className="inline-block bg-[#1B6B5A] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#155a4a] transition-colors"
        >
          {ctaLabel}
        </Link>
      </main>
    </div>
  );
}
