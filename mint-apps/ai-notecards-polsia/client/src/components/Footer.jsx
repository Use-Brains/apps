import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 py-8 mt-16">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#6B635A]">
        <p>&copy; {new Date().getFullYear()} AI Notecards</p>
        <div className="flex gap-6">
          <Link to="/terms" className="hover:text-[#1A1614] transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-[#1A1614] transition-colors">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
