import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { resizeImages } from '../lib/imageResize.js';
import Navbar from '../components/Navbar.jsx';

const MAX_PHOTOS = 5;
const MAX_INPUT_LENGTH = 50000;
const supportsImageBitmap = typeof createImageBitmap === 'function';

export default function Generate() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [previewCards, setPreviewCards] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const previewUrls = useRef([]);
  const controllerRef = useRef(null);
  const savingRef = useRef(false);

  // Revoke all preview URLs on unmount + abort in-flight generation
  useEffect(() => {
    return () => {
      previewUrls.current.forEach(url => URL.revokeObjectURL(url));
      controllerRef.current?.abort();
    };
  }, []);

  // Navigate-away confirmation while preview is active
  useEffect(() => {
    if (!previewCards || previewCards.length === 0) return;
    const handler = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [previewCards]);

  const addPhotos = (files) => {
    const newFiles = Array.from(files);
    setPhotos(prev => {
      const remaining = MAX_PHOTOS - prev.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_PHOTOS} photos allowed.`);
        return prev;
      }
      const toAdd = newFiles.slice(0, remaining);
      if (newFiles.length > remaining) {
        toast.error(`Only added ${remaining} photo${remaining === 1 ? '' : 's'} (limit: ${MAX_PHOTOS}).`);
      }
      toAdd.forEach(f => {
        const url = URL.createObjectURL(f);
        previewUrls.current.push(url);
      });
      return [...prev, ...toAdd];
    });
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(previewUrls.current[index]);
    previewUrls.current.splice(index, 1);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() && photos.length === 0) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    try {
      let data;
      if (photos.length > 0) {
        let resizedFiles;
        try {
          resizedFiles = await resizeImages(photos);
        } catch {
          toast.error('Could not process one of your photos. Try removing it.');
          return;
        }
        data = await api.generatePreviewWithPhotos(input, title || undefined, resizedFiles, { signal: controller.signal });
      } else {
        data = await api.generatePreview(input, title || undefined, { signal: controller.signal });
      }
      if (controller.signal.aborted) return;
      setPreviewCards(data.cards);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.data?.limit) {
        toast.error(err.message);
      } else {
        toast.error(err.message || 'Generation failed. Please try again.');
      }
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!previewCards || previewCards.length === 0) return;
    savingRef.current = true;
    try {
      const deckTitle = title.trim() || (input ? input.slice(0, 60).trim() + (input.length > 60 ? '...' : '') : 'Photo flashcards');
      const data = await api.saveDeck(deckTitle, input || null, previewCards);
      toast.success(`Saved ${previewCards.length} flashcards!`);
      setPreviewCards(null);
      navigate(`/decks/${data.deck.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to save deck');
    } finally {
      savingRef.current = false;
    }
  };

  const handleEditCard = (index, field, value) => {
    setPreviewCards(prev => prev.map((card, i) => i === index ? { ...card, [field]: value } : card));
  };

  const handleDeleteCard = (index) => {
    setPreviewCards(prev => prev.filter((_, i) => i !== index));
  };

  const canSubmit = (input.trim() || photos.length > 0) && !loading;

  // Preview mode
  if (previewCards) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Preview Cards</h1>
              <p className="text-gray-500 text-sm mt-1">{previewCards.length} card{previewCards.length !== 1 ? 's' : ''} — edit or remove before saving</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button
                onClick={handleSave}
                disabled={previewCards.length === 0 || savingRef.current}
                className="px-5 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                Save Deck
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {previewCards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Front</label>
                      <textarea
                        value={card.front}
                        onChange={(e) => handleEditCard(i, 'front', e.target.value)}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Back</label>
                      <textarea
                        value={card.back}
                        onChange={(e) => handleEditCard(i, 'back', e.target.value)}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCard(i)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    aria-label={`Delete card ${i + 1}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {previewCards.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">All cards removed. Regenerate or go back.</p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Input mode
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Flashcards</h1>
        <p className="text-gray-500 mb-8">
          Paste your notes, type a topic, or snap photos of your notes — AI will create study cards for you.
        </p>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Deck title <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="e.g., Biology Chapter 5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes or topic
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
              rows={10}
              maxLength={MAX_INPUT_LENGTH}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y leading-relaxed"
              placeholder="Paste your lecture notes here, or type a topic like 'Photosynthesis' or 'World War II causes'..."
            />
            <p className="text-xs text-gray-400 mt-1.5">{input.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()} characters</p>
          </div>

          {/* Photo Upload */}
          {supportsImageBitmap && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Photos <span className="text-gray-400">(optional — snap notes, textbooks, or whiteboards)</span>
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photos.length >= MAX_PHOTOS}
                  aria-label="Upload photos"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Photos
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={photos.length >= MAX_PHOTOS}
                  aria-label="Take photo"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed sm:hidden"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Camera
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files.length) addPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files.length) addPhotos(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Photo previews */}
              {photos.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {photos.map((photo, i) => (
                    <div key={previewUrls.current[i]} className="relative flex-shrink-0">
                      <img
                        src={previewUrls.current[i]}
                        alt={`Photo ${i + 1} of ${photos.length}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={`Remove photo ${i + 1} of ${photos.length}`}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <span className="self-center text-xs text-gray-400 flex-shrink-0">{photos.length}/{MAX_PHOTOS}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {photos.length > 0 ? 'Reading your photos...' : 'Generating cards...'}
              </>
            ) : (
              'Generate Flashcards'
            )}
          </button>
        </form>

        {loading && (
          <div className="mt-8 bg-brand-50 border border-brand-100 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-brand-100 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
            {photos.length > 0 ? (
              <>
                <p className="text-brand-700 font-medium">AI is reading your photos and creating flashcards...</p>
                <p className="text-brand-500 text-sm mt-1">This usually takes 10-20 seconds</p>
              </>
            ) : (
              <>
                <p className="text-brand-700 font-medium">AI is reading your content and creating flashcards...</p>
                <p className="text-brand-500 text-sm mt-1">This usually takes 5-10 seconds</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
