import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import { analytics } from '../lib/analytics.js';
import Navbar from '../components/Navbar.jsx';

const QUICK_TOPICS = [
  'Spanish vocabulary',
  'Biology cell structure',
  'JavaScript promises',
  'World War II causes',
];

export default function Welcome() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  // Step 2 state
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedDeckId, setGeneratedDeckId] = useState(null);
  const [genError, setGenError] = useState(null);
  const controllerRef = useRef(null);

  // Abort on unmount
  useEffect(() => () => controllerRef.current?.abort(), []);

  const abortGeneration = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGenerating(false);
  };

  // Step 1 — save display name
  const handleStep1 = async (e) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await api.updateProfile({ display_name: name });
      await refreshUser();
      setStep(2);
      analytics.track('onboarding_step_completed', { step: 1 });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Step 2 — generate first deck
  const handleGenerate = async (topicText) => {
    const t = topicText || topic;
    if (!t.trim()) return;

    abortGeneration();
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setGenError(null);

    try {
      const data = await api.generatePreview(t, t, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const saved = await api.saveDeck(t, t, data.cards);
      if (controller.signal.aborted) return;

      setGeneratedDeckId(saved.deck.id);
      analytics.track('onboarding_step_completed', { step: 2, first_deck_generated: true });
      setStep(3);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setGenError(err.message || 'Generation failed. Please try again.');
    } finally {
      if (controllerRef.current === controller) setGenerating(false);
    }
  };

  // Step 3 — finish onboarding
  const handleFinish = async (destination) => {
    analytics.track('onboarding_step_completed', { step: 3 });
    try {
      await api.updatePreferences({ onboarding_completed: true });
      await refreshUser();
    } catch {
      // Non-critical — preference will be set next time
    }
    navigate(destination, { replace: true });
  };

  const goBack = (toStep) => {
    abortGeneration();
    setGenError(null);
    setStep(toStep);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50/30 to-gray-50">
      <Navbar />
      <div className="flex items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? 'w-8 bg-brand-600' : s < step ? 'w-8 bg-brand-300' : 'w-8 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {/* Step 1 — Display Name */}
            {step === 1 && (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to AI Notecards</h1>
                <p className="text-gray-500 mb-8">What should we call you?</p>

                <form onSubmit={handleStep1} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                      placeholder="Your name"
                      autoFocus
                      maxLength={50}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !displayName.trim()}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Continue'}
                  </button>
                </form>
              </>
            )}

            {/* Step 2 — Generate First Deck */}
            {step === 2 && (
              <>
                <button
                  onClick={() => goBack(1)}
                  className="text-gray-400 hover:text-gray-600 mb-4 -ml-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <h1 className="text-2xl font-bold text-gray-900 mb-1">Let's create your first flashcards</h1>
                <p className="text-gray-500 mb-6">What are you studying?</p>

                {genError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
                    <p className="text-red-700 text-sm font-medium mb-3">We hit a snag. This usually works on the second try.</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleGenerate(topic)}
                        className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => setGenError(null)}
                        className="w-full py-2.5 text-gray-600 text-sm hover:text-gray-800"
                      >
                        Try a different topic
                      </button>
                      <button
                        onClick={() => { abortGeneration(); setStep(3); }}
                        className="text-sm text-gray-400 hover:text-gray-500"
                      >
                        Skip and explore on your own
                      </button>
                    </div>
                  </div>
                ) : generating ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-4 bg-brand-50 rounded-xl flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-brand-700 font-medium">Creating your flashcards...</p>
                    <p className="text-brand-500 text-sm mt-1">This usually takes 5-10 seconds</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && topic.trim() && handleGenerate()}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                        placeholder="e.g., Spanish vocabulary, Biology, JavaScript..."
                        autoFocus
                        maxLength={200}
                      />

                      <button
                        onClick={() => handleGenerate()}
                        disabled={!topic.trim()}
                        className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Generate
                      </button>

                      {/* Quick-start suggestions */}
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Or try one of these:</p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_TOPICS.map((t) => (
                            <button
                              key={t}
                              onClick={() => { setTopic(t); handleGenerate(t); }}
                              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!generating && !genError && (
                  <p className="mt-6 text-center">
                    <button
                      onClick={() => { abortGeneration(); setStep(3); }}
                      className="text-sm text-gray-400 hover:text-gray-500"
                    >
                      I'll do this later
                    </button>
                  </p>
                )}
              </>
            )}

            {/* Step 3 — Quick Tour */}
            {step === 3 && (
              <>
                <button
                  onClick={() => goBack(2)}
                  className="text-gray-400 hover:text-gray-600 mb-4 -ml-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <h1 className="text-2xl font-bold text-gray-900 mb-1">Here's what you can do</h1>
                <p className="text-gray-500 mb-6">A quick look at the key features</p>

                <div className="space-y-4 mb-8">
                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Study modes</h3>
                      <p className="text-gray-500 text-sm">Flip, multiple choice, type, and match</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">AI generation</h3>
                      <p className="text-gray-500 text-sm">Paste notes or type a topic to generate cards</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Marketplace</h3>
                      <p className="text-gray-500 text-sm">Buy and sell decks from other students</p>
                    </div>
                  </div>
                </div>

                {generatedDeckId ? (
                  <button
                    onClick={() => handleFinish(`/study/${generatedDeckId}`)}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
                  >
                    Start studying
                  </button>
                ) : (
                  <button
                    onClick={() => handleFinish('/dashboard')}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
