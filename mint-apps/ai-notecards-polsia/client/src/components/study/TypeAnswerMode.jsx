import { useState, useRef, useEffect } from 'react';

function similarity(a, b) {
  const normalize = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (s1 === s2) return 1;
  // Max-length guard: Levenshtein is O(m*n), skip for long strings
  if (s1.length > 500 || s2.length > 500) return s1 === s2 ? 1 : 0;
  // Early exit: if length ratio > 5:1, similarity will be very low
  if (Math.max(s1.length, s2.length) > 5 * Math.min(s1.length, s2.length)) return 0;
  const len = Math.max(s1.length, s2.length);
  if (len === 0) return 1;

  // Two-row Levenshtein
  let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
  let curr = new Array(s2.length + 1);
  for (let i = 1; i <= s1.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return 1 - prev[s2.length] / len;
}

export default function TypeAnswerMode({ card, onRate, onAdvance }) {
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState('answering'); // 'answering' | 'showing'
  const [result, setResult] = useState(null); // { score, isCorrect, isClose }
  const inputRef = useRef(null);
  const lockoutRef = useRef(false);
  const timeoutRef = useRef(null);

  // Auto-focus input on card change
  useEffect(() => {
    setAnswer('');
    setPhase('answering');
    setResult(null);
    lockoutRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeoutRef.current);
  }, [card]);

  const handleSubmit = () => {
    if (phase === 'answering') {
      if (!answer.trim()) return;
      const score = similarity(answer, card.back);
      const isCorrect = score >= 0.85;
      const isClose = !isCorrect && score >= 0.70;
      setResult({ score, isCorrect, isClose });
      setPhase('showing');
      onRate(isCorrect ? 'correct' : 'missed');

      // 200ms lockout to prevent Enter-Enter skip
      lockoutRef.current = true;
      setTimeout(() => { lockoutRef.current = false; }, 200);

      // Auto-advance after 1.5s
      timeoutRef.current = setTimeout(() => {
        onAdvance();
      }, 1500);
    } else if (phase === 'showing' && !lockoutRef.current) {
      clearTimeout(timeoutRef.current);
      onAdvance();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 mb-8 shadow-2xl shadow-black/20 border border-white/20 text-center">
        <p className="text-xs uppercase tracking-wider text-[#6B635A] font-medium mb-4">Question</p>
        <p className="text-xl sm:text-2xl text-[#1A1614] font-medium leading-relaxed">{card.front}</p>
      </div>

      {/* Input */}
      <div className="mb-6">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => phase === 'answering' && setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          readOnly={phase === 'showing'}
          className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 text-lg focus:outline-none focus:border-[#1B6B5A]"
        />
      </div>

      {/* Result */}
      {phase === 'showing' && result && (
        <div className={`rounded-xl p-4 mb-6 text-center ${
          result.isCorrect ? 'bg-[#2D8A5E]/20 border border-[#2D8A5E]/30' :
          result.isClose ? 'bg-[#C8A84E]/20 border border-[#C8A84E]/30' :
          'bg-[#C0392B]/20 border border-[#C0392B]/30'
        }`}>
          <p className={`text-lg font-semibold mb-2 ${
            result.isCorrect ? 'text-[#2D8A5E]' :
            result.isClose ? 'text-[#C8A84E]' :
            'text-[#C0392B]'
          }`}>
            {result.isCorrect ? 'Correct!' : result.isClose ? 'Close!' : 'Incorrect'}
          </p>
          {!result.isCorrect && (
            <p className="text-white/70 text-sm">
              Correct answer: <span className="text-white font-medium">{card.back}</span>
            </p>
          )}
        </div>
      )}

      {phase === 'answering' && (
        <button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="w-full py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
        >
          Check Answer
        </button>
      )}
    </div>
  );
}
