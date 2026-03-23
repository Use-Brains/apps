import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-[#1A1614] mb-3">Content Moderation</h1>
          <p className="text-[#6B635A] mb-4">
            Admin moderation workflows stay visible in this sandbox, but the operational tooling is deferred for the Polsia handoff.
          </p>
          <p className="text-sm text-[#6B635A] mb-6">
            Flag queues, resolution actions, and seller suspension tools will return coming-soon placeholders until a later phase.
          </p>
          <Link
            to="/marketplace"
            className="inline-block px-5 py-2.5 border border-[#1B6B5A]/30 text-[#1B6B5A] rounded-xl font-medium hover:bg-[#E8F5F0] transition-colors"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
