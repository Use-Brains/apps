import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50/30 to-gray-50">
      <Navbar />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-100 text-brand-700 rounded-full text-sm font-medium mb-8">
          Powered by AI
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight">
          Turn any text into
          <br />
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            study flashcards
          </span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Paste your notes, type a topic, or upload text — AI generates smart flashcards instantly.
          Study smarter, remember more, ace everything.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="px-8 py-3.5 bg-brand-600 text-white rounded-xl text-lg font-semibold hover:bg-brand-700 transition-all hover:shadow-lg hover:shadow-brand-500/25 active:scale-[0.98]"
          >
            Start studying for free
          </Link>
          <a
            href="#pricing"
            className="px-8 py-3.5 bg-white text-gray-700 rounded-xl text-lg font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
          >
            View pricing
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Paste or type',
              desc: 'Drop in your lecture notes, textbook passages, or just type a topic you want to learn.',
            },
            {
              step: '2',
              title: 'AI generates cards',
              desc: 'Our AI reads your content and creates concise, effective flashcards in seconds.',
            },
            {
              step: '3',
              title: 'Study & retain',
              desc: 'Flip through cards, track your progress, and watch your knowledge stick.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Simple pricing</h2>
        <p className="text-center text-gray-600 mb-12 max-w-lg mx-auto">
          Start free. Upgrade when you need more power.
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Free</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">$0</span>
              <span className="text-gray-500">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-gray-600">
              {['3 AI generations per day', 'Up to 10 decks', 'Full study mode', 'Progress tracking'].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className="mt-8 block text-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Get started
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-8 text-white shadow-lg shadow-brand-500/20 relative">
            <div className="absolute -top-3 right-6 px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
              POPULAR
            </div>
            <h3 className="text-lg font-semibold">Pro</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">$5</span>
              <span className="text-brand-200">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-brand-100">
              {['Unlimited AI generations', 'Unlimited decks', 'Priority generation speed', 'Everything in Free'].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className="mt-8 block text-center px-6 py-3 bg-white text-brand-700 rounded-xl font-semibold hover:bg-brand-50 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <p className="text-center text-sm text-gray-500">
          AI Notecards — Study smarter, not harder.
        </p>
      </footer>
    </div>
  );
}
