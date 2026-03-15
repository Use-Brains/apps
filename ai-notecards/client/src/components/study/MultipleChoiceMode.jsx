import { useState, useRef, useEffect } from 'react';
import shuffle from '../../lib/shuffle.js';

export default function MultipleChoiceMode({ card, allCards, onRate, onAdvance }) {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const advancingRef = useRef(false);
  const advanceTimeoutRef = useRef(null);

  // Generate options when card changes
  useEffect(() => {
    const correctAnswer = card.back;
    // Get distractors: other cards' backs, deduplicated, excluding correct answer
    const otherBacks = allCards
      .filter((c) => c.back !== correctAnswer)
      .map((c) => c.back);
    const uniqueOthers = [...new Set(otherBacks)];
    const distractors = shuffle(uniqueOthers).slice(0, 3);
    const opts = shuffle([correctAnswer, ...distractors]);
    setOptions(opts);
    setSelected(null);
    advancingRef.current = false;
  }, [card, allCards]);

  useEffect(() => {
    return () => clearTimeout(advanceTimeoutRef.current);
  }, []);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= options.length) {
        e.preventDefault();
        handleOptionClick(num - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [options, card]);

  const handleOptionClick = (index) => {
    if (advancingRef.current || selected !== null) return;
    advancingRef.current = true;
    setSelected(index);

    const isCorrect = options[index] === card.back;
    onRate(isCorrect ? 'correct' : 'missed');

    advanceTimeoutRef.current = setTimeout(() => {
      advancingRef.current = false;
      setSelected(null);
      onAdvance();
    }, 1000);
  };

  const truncate = (text, max = 100) =>
    text.length > max ? text.slice(0, max) + '...' : text;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 mb-8 shadow-2xl shadow-black/20 border border-white/20 text-center">
        <p className="text-xs uppercase tracking-wider text-[#6B635A] font-medium mb-4">Question</p>
        <p className="text-xl sm:text-2xl text-[#1A1614] font-medium leading-relaxed">{card.front}</p>
      </div>

      {/* Options */}
      <div className="grid gap-3">
        {options.map((opt, i) => {
          let bg = 'bg-white/10 hover:bg-white/20 border-white/10';
          if (selected !== null) {
            if (opt === card.back) {
              bg = 'bg-[#2D8A5E]/30 border-[#2D8A5E]/50';
            } else if (i === selected) {
              bg = 'bg-[#C0392B]/30 border-[#C0392B]/50';
            } else {
              bg = 'bg-white/5 border-white/5 opacity-50';
            }
          }
          return (
            <button
              key={i}
              onClick={() => handleOptionClick(i)}
              disabled={selected !== null}
              className={`w-full text-left px-6 py-4 rounded-xl border transition-all text-white font-medium ${bg}`}
            >
              <span className="text-white/40 mr-3">{i + 1}.</span>
              {truncate(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
