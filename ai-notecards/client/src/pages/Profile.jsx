import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [deckStats, setDeckStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const fileInputRef = useRef(null);
  const uploadGenRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      api.getStats(),
      api.getStudyHistory(),
      api.getDeckStats(),
    ]).then(([statsResult, historyResult, deckStatsResult]) => {
      if (controller.signal.aborted) return;
      if (statsResult.status === 'fulfilled') setStats(statsResult.value.stats);
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value.sessions);
        setHistoryCursor(historyResult.value.nextCursor);
      }
      if (deckStatsResult.status === 'fulfilled') setDeckStats(deckStatsResult.value.deckStats);
      setLoading(false);
    });

    return () => controller.abort();
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const gen = ++uploadGenRef.current;
    setUploading(true);
    try {
      await api.uploadAvatar(file);
      if (gen === uploadGenRef.current) {
        await refreshUser();
        toast.success('Avatar updated');
      }
    } catch (err) {
      if (gen === uploadGenRef.current) toast.error(err.message);
    } finally {
      if (gen === uploadGenRef.current) setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await api.deleteAvatar();
      await refreshUser();
      toast.success('Avatar removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await api.updateProfile({ display_name: nameValue });
      await refreshUser();
      setEditingName(false);
      toast.success('Name updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const loadMoreHistory = async () => {
    if (!historyCursor) return;
    setLoadingMore(true);
    try {
      const data = await api.getStudyHistory(historyCursor.cursor_date, historyCursor.cursor_id);
      setHistory(prev => [...prev, ...data.sessions]);
      setHistoryCursor(data.nextCursor);
    } catch (err) {
      toast.error('Failed to load more history');
    } finally {
      setLoadingMore(false);
    }
  };

  const initials = user?.display_name
    ? user.display_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase();

  const planBadge = () => {
    if (user?.plan === 'pro') {
      return <span className="px-2 py-0.5 bg-gradient-to-r from-[#C8A84E] to-[#b8943e] text-white text-xs font-semibold rounded-full">PRO</span>;
    }
    if (user?.plan === 'trial') {
      const daysLeft = user.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(user.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;
      return <span className="px-2 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-semibold rounded-full">TRIAL · {daysLeft}d</span>;
    }
    return <span className="px-2 py-0.5 bg-gray-100 text-[#6B635A] text-xs font-semibold rounded-full">FREE</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#1B6B5A] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Avatar + Identity */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded-full bg-[#1B6B5A] text-white text-2xl font-bold flex items-center justify-center overflow-hidden cursor-pointer hover:ring-4 hover:ring-[#1B6B5A]/20 transition-shadow disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              {user?.avatar_url && !uploading && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-[#6B635A] hover:text-red-500 transition-colors text-xs"
                  title="Remove avatar"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="px-3 py-1.5 bg-[#FAF7F2] border border-gray-200 rounded-lg text-[#1A1614] text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    />
                    <button onClick={handleSaveName} disabled={savingName}
                      className="px-3 py-1.5 bg-[#1B6B5A] text-white text-sm rounded-lg hover:bg-[#155a4a] disabled:opacity-50">
                      {savingName ? '...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingName(false)}
                      className="px-2 py-1.5 text-sm text-[#6B635A] hover:text-[#1A1614]">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-[#1A1614] truncate">
                      {user?.display_name || 'No display name'}
                    </h1>
                    <button
                      onClick={() => { setNameValue(user?.display_name || ''); setEditingName(true); }}
                      className="text-[#6B635A] hover:text-[#1B6B5A] transition-colors text-sm shrink-0"
                      title="Edit name"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm text-[#6B635A] truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                {planBadge()}
                <span className="text-xs text-[#6B635A]">
                  Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Study Stats Grid */}
        {stats && (
          <section className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
              <div className="text-2xl font-bold text-[#1A1614]">{user?.study_score || 0}</div>
              <div className="text-xs text-[#6B635A] mt-1 uppercase tracking-wide">Study Score</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
              <div className="text-2xl font-bold text-[#1A1614]">{stats.total_sessions}</div>
              <div className="text-xs text-[#6B635A] mt-1 uppercase tracking-wide">Total Sessions</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
              <div className="text-2xl font-bold text-[#1A1614]">{stats.total_cards_studied}</div>
              <div className="text-xs text-[#6B635A] mt-1 uppercase tracking-wide">Cards Studied</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
              <div className="text-2xl font-bold text-[#1A1614]">{stats.accuracy}%</div>
              <div className="text-xs text-[#6B635A] mt-1 uppercase tracking-wide">Overall Accuracy</div>
            </div>
          </section>
        )}

        {/* Session History */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Session History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-[#6B635A]">No study sessions yet. Start studying to see your history!</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#6B635A] text-xs uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Deck</th>
                      <th className="text-right py-2 font-medium">Score</th>
                      <th className="text-right py-2 font-medium">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((s) => (
                      <tr key={s.id} className="border-b border-gray-50">
                        <td className="py-2.5 text-[#6B635A]">
                          {new Date(s.completed_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 text-[#1A1614] truncate max-w-[200px]">{s.deck_title}</td>
                        <td className="py-2.5 text-right text-[#1A1614]">{s.correct}/{s.total_cards}</td>
                        <td className="py-2.5 text-right text-[#1A1614]">
                          {s.total_cards > 0 ? Math.round((s.correct / s.total_cards) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyCursor && (
                <button
                  onClick={loadMoreHistory}
                  disabled={loadingMore}
                  className="mt-4 w-full py-2 text-sm text-[#1B6B5A] border border-[#1B6B5A]/30 rounded-xl hover:bg-[#E8F5F0] transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </section>

        {/* Per-Deck Stats */}
        {deckStats.length > 0 && (
          <section className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Per-Deck Stats</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#6B635A] text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left py-2 font-medium">Deck</th>
                    <th className="text-right py-2 font-medium">Completed</th>
                    <th className="text-right py-2 font-medium">Best Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {deckStats.map((ds) => (
                    <tr key={ds.deck_id} className="border-b border-gray-50">
                      <td className="py-2.5 text-[#1A1614] truncate max-w-[250px]">{ds.deck_title}</td>
                      <td className="py-2.5 text-right text-[#6B635A]">{ds.times_completed}x</td>
                      <td className="py-2.5 text-right text-[#1A1614]">{Math.round(ds.best_accuracy)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
