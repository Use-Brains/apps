import Navbar from '../components/Navbar.jsx';

export default function Marketplace() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-3xl font-bold text-[#1A1614] mb-4">Marketplace</h1>
        <p className="text-[#6B635A]">Coming soon — browse and buy flashcard decks from other learners.</p>
      </div>
    </div>
  );
}
