import { useState, useRef, useEffect } from 'react';
import shuffle from '../../lib/shuffle.js';

export default function MatchMode({ allCards, onRate, onAdvance }) {
  const [tiles, setTiles] = useState([]);
  const [selected, setSelected] = useState(null); // index of first selected tile
  const [matched, setMatched] = useState(new Set());
  const [incorrect, setIncorrect] = useState(new Set());
  const [attempts, setAttempts] = useState({}); // pairIndex -> number of attempts
  const evaluatingRef = useRef(false);
  const evalTimeoutRef = useRef(null);
  const matchCount = useRef(0);

  useEffect(() => {
    // Pick 6 random cards
    const picked = shuffle(allCards).slice(0, 6);
    // Create 12 tiles: 6 fronts + 6 backs
    const tileset = [];
    picked.forEach((card, i) => {
      tileset.push({ text: card.front, type: 'front', pairIndex: i });
      tileset.push({ text: card.back, type: 'back', pairIndex: i });
    });
    setTiles(shuffle(tileset));
    setSelected(null);
    setMatched(new Set());
    setIncorrect(new Set());
    setAttempts({});
    matchCount.current = 0;
    evaluatingRef.current = false;

    return () => clearTimeout(evalTimeoutRef.current);
  }, [allCards]);

  const handleTileClick = (index) => {
    if (evaluatingRef.current) return;
    if (matched.has(index)) return;

    if (selected === null) {
      // First selection
      setSelected(index);
    } else if (selected === index) {
      // Deselect
      setSelected(null);
    } else {
      // Second selection — evaluate pair
      const tile1 = tiles[selected];
      const tile2 = tiles[index];

      // Must be different types (front + back) and same pair
      if (tile1.type !== tile2.type && tile1.pairIndex === tile2.pairIndex) {
        // Correct match
        const newMatched = new Set(matched);
        newMatched.add(selected);
        newMatched.add(index);
        setMatched(newMatched);

        const pairAttempts = (attempts[tile1.pairIndex] || 0);
        const isFirstAttempt = pairAttempts === 0;
        onRate(isFirstAttempt ? 'correct' : 'missed');

        matchCount.current++;
        setSelected(null);

        if (matchCount.current === 6) {
          // All matched — advance after brief delay
          evaluatingRef.current = true;
          evalTimeoutRef.current = setTimeout(() => {
            evaluatingRef.current = false;
            onAdvance();
          }, 500);
        }
      } else {
        // Incorrect match
        const pairIndex = tile1.pairIndex;
        setAttempts((prev) => ({ ...prev, [pairIndex]: (prev[pairIndex] || 0) + 1 }));

        evaluatingRef.current = true;
        const incorrectSet = new Set([selected, index]);
        setIncorrect(incorrectSet);
        setSelected(null);

        evalTimeoutRef.current = setTimeout(() => {
          setIncorrect(new Set());
          evaluatingRef.current = false;
        }, 500);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="text-center text-white/50 text-sm mb-6">
        Match each question with its answer ({matched.size / 2}/6 pairs)
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {tiles.map((tile, i) => {
          const isMatched = matched.has(i);
          const isSelected = selected === i;
          const isIncorrect = incorrect.has(i);

          let bg = 'bg-white/10 border-white/10 hover:bg-white/20';
          if (isMatched) bg = 'bg-[#2D8A5E]/20 border-[#2D8A5E]/40 opacity-60';
          else if (isIncorrect) bg = 'bg-[#C0392B]/20 border-[#C0392B]/40';
          else if (isSelected) bg = 'bg-[#1B6B5A]/30 border-[#1B6B5A]/50';

          return (
            <button
              key={i}
              onClick={() => handleTileClick(i)}
              disabled={isMatched}
              className={`p-3 rounded-xl border transition-all text-sm text-white min-h-[80px] flex items-center justify-center text-center ${bg}`}
            >
              <span className={isMatched ? 'line-through opacity-60' : ''}>
                {tile.text.length > 60 ? tile.text.slice(0, 60) + '...' : tile.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
