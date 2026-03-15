import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function SharePopover({ url, title, cardCount, price }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Click outside closes popover (mousedown to prevent toggle-bounce)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const shareText = `${title} — ${cardCount} flashcards for $${(price / 100).toFixed(2)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
    }
    setOpen(false);
  };

  const handleTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener'
    );
    setOpen(false);
  };

  const handleReddit = () => {
    window.open(
      `https://reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener'
    );
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="p-2 text-[#6B635A] hover:text-[#1B6B5A] hover:bg-[#E8F5F0] rounded-lg transition-colors"
        aria-label="Share listing"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20"
        >
          <button
            onClick={handleCopy}
            className="w-full px-3 py-2 text-left text-sm text-[#1A1614] hover:bg-[#FAF7F2] flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[#6B635A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-5.192a4.5 4.5 0 00-6.364 6.364l4.5 4.5" />
            </svg>
            Copy link
          </button>
          <button
            onClick={handleTwitter}
            className="w-full px-3 py-2 text-left text-sm text-[#1A1614] hover:bg-[#FAF7F2] flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[#6B635A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            Share on X
          </button>
          <button
            onClick={handleReddit}
            className="w-full px-3 py-2 text-left text-sm text-[#1A1614] hover:bg-[#FAF7F2] flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[#6B635A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            Share on Reddit
          </button>
        </div>
      )}
    </div>
  );
}
