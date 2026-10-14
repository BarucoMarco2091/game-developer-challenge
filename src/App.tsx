import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { useGameData } from './hooks/useGameData';

type Screen = 'MENU' | 'GAME' | 'GAME_OVER' | 'RANKING' | 'HISTORY';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('MENU');
  const [lastScore, setLastScore] = useState(0);
  const { saveMatch, ranking, matchHistory, isSaving } = useGameData();

  const handleGameOver = (finalScore: number) => {
    setLastScore(finalScore);
    setCurrentScreen('GAME_OVER');

    saveMatch({
      id: crypto.randomUUID(),
      playerName: 'Pirate Captain',
      score: finalScore,
      duration: 60,
      date: new Date().toISOString(),
      reason: 'health_depleted',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 md:p-8 font-sans selection:bg-amber-500 selection:text-slate-900">
      
      {/* HEADER GLOBAL */}
      <header className="w-full max-w-4xl text-center py-4">
        <h1 className="text-3xl md:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 uppercase drop-shadow-[0_4px_12px_rgba(245,158,11,0.4)] animate-pulse">
          ⚓ Pirate Battle
        </h1>
        <p className="text-slate-500 text-xs md:text-sm mt-1 font-mono tracking-widest uppercase">
          Jungle Gaming Technical Challenge
        </p>
      </header>

      {/* CONTEÚDO PRINCIPAL - CENTRALIZADO E RESPONSIVO */}
      <main className="w-full max-w-4xl flex-1 flex items-center justify-center py-6">
        
        {/* 1. TELA: MENU PRINCIPAL */}
        {currentScreen === 'MENU' && (
          <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-md p-6 md:p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] w-full max-w-md flex flex-col gap-5 text-center">
            <div className="py-2">
              <span className="text-4xl">🏴‍☠️</span>
              <h2 className="text-xl font-bold text-slate-200 mt-2">Ready to Sail, Captain?</h2>
            </div>

            <button 
              onClick={() => setCurrentScreen('GAME')}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold py-4 px-6 rounded-xl transition-all duration-200 text-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] border border-amber-400/20"
            >
              ▶ Play Game
            </button>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setCurrentScreen('RANKING')}
                className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                🏆 Leaderboard
              </button>
              <button 
                onClick={() => setCurrentScreen('HISTORY')}
                className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                📜 Match History
              </button>
            </div>
          </div>
        )}

        {/* 2. TELA: ARENA DE GAMEPLAY */}
        {currentScreen === 'GAME' && (
          <div className="relative w-full flex flex-col items-center">
            <button 
              onClick={() => setCurrentScreen('MENU')}
              className="mb-4 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold py-2 px-4 rounded-lg border border-rose-800/50 backdrop-blur-sm transition self-start md:self-center"
            >
              🏳️ Abandon Match
            </button>
            <GameCanvas onGameOver={handleGameOver} />
          </div>
        )}

        {/* 3. TELA: RESULTADO (GAME OVER) */}
        {currentScreen === 'GAME_OVER' && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md text-center flex flex-col gap-6">
            <div>
              <h2 className="text-3xl font-black text-rose-500 uppercase tracking-wider">Ship Sunk!</h2>
              <p className="text-slate-400 text-sm mt-1">Your journey has ended in this sector.</p>
            </div>
            
            <div className="bg-slate-950/80 rounded-xl p-6 border border-slate-800">
              <span className="text-xs text-slate-500 block uppercase tracking-widest font-mono font-bold">Final Score</span>
              <strong className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-500 block mt-1">{lastScore}</strong>
              <span className="text-xs text-slate-400 block mt-3 font-mono">
                {isSaving ? '⏳ Archiving to ledger...' : '✅ Securely recorded'}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setCurrentScreen('GAME')}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold py-3 px-4 rounded-xl transition shadow-md"
              >
                🔄 Play Again
              </button>
              <button 
                onClick={() => setCurrentScreen('MENU')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 px-4 rounded-xl transition border border-slate-700"
              >
                🏠 Main Menu
              </button>
            </div>
          </div>
        )}

        {/* 4. TELA: RANKING */}
        {currentScreen === 'RANKING' && (
          <div className="bg-slate-900/90 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg md:text-xl font-bold text-amber-400 flex items-center gap-2">🏆 Global Leaderboard</h2>
              <button onClick={() => setCurrentScreen('MENU')} className="text-xs text-slate-400 hover:text-white bg-slate-800 py-1.5 px-4 rounded-lg transition border border-slate-700">Back</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                    <th className="p-3">Pos</th>
                    <th className="p-3">Captain</th>
                    <th className="p-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {ranking.map((item: any, idx: number) => (
                    <tr key={item.id} className="hover:bg-slate-900/30 transition">
                      <td className="p-3 font-mono text-amber-500/80 font-bold">#{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-200">{item.playerName}</td>
                      <td className="p-3 text-right font-black text-amber-400">{item.score} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. TELA: HISTÓRICO */}
        {currentScreen === 'HISTORY' && (
          <div className="bg-slate-900/90 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-300 flex items-center gap-2">📜 Captain's Log</h2>
              <button onClick={() => setCurrentScreen('MENU')} className="text-xs text-slate-400 hover:text-white bg-slate-800 py-1.5 px-4 rounded-lg transition border border-slate-700">Back</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50 max-h-[320px] overflow-y-auto">
              {matchHistory.length === 0 ? (
                <p className="text-center p-8 text-sm text-slate-500 font-mono">No log entries found. Sail out first!</p>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800 sticky top-0 backdrop-blur-md">
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {matchHistory.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-900/30 transition">
                        <td className="p-3 text-xs text-slate-400 font-mono">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="p-3 text-right font-bold text-slate-200">{item.score} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER GLOBAL */}
      <footer className="w-full text-center py-4 text-xs text-slate-600 font-mono">
        &copy; {new Date().getFullYear()} Pirate Battle. Built with React & PixiJS.
      </footer>
    </div>
  );
}

