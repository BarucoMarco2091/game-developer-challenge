import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { useGameData } from './hooks/useGameData';

// Definimos quais telas o nosso app pode exibir
type Screen = 'MENU' | 'GAME' | 'GAME_OVER' | 'RANKING' | 'HISTORY';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('MENU');
  const [lastScore, setLastScore] = useState(0);
  const { saveMatch, ranking, matchHistory, isSaving } = useGameData();

  // Função disparada automaticamente quando o jogador perde a vida no GameCanvas
  const handleGameOver = (finalScore: number) => {
    setLastScore(finalScore);
    setCurrentScreen('GAME_OVER');

    // Dispara a mutação do TanStack Query para salvar via MSW no LocalStorage
    saveMatch({
      id: crypto.randomUUID(), // Garante id único (Idempotência)
      playerName: 'Pirate Player',
      score: finalScore,
      duration: 60, // Tempo fixado para a simulação simples
      date: new Date().toISOString(),
      reason: 'health_depleted',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-900">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-wider text-amber-500 uppercase drop-shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
          ⚓ Pirate Battle
        </h1>
        <p className="text-slate-400 text-sm mt-1">Jungle Gaming Technical Challenge</p>
      </header>

      {/* 1. TELA: MENU PRINCIPAL */}
      {currentScreen === 'MENU' && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md flex flex-col gap-4 text-center">
          <button 
            onClick={() => setCurrentScreen('GAME')}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-6 rounded-lg transition text-lg shadow-lg shadow-amber-500/10 active:scale-[0.98]"
          >
            ▶️ Play Game
          </button>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button 
              onClick={() => setCurrentScreen('RANKING')}
              className="bg-slate-800 hover:bg-slate-700 font-medium py-2 px-4 rounded-md transition text-sm border border-slate-700"
            >
              🏆 Ranking
            </button>
            <button 
              onClick={() => setCurrentScreen('HISTORY')}
              className="bg-slate-800 hover:bg-slate-700 font-medium py-2 px-4 rounded-md transition text-sm border border-slate-700"
            >
              📜 History
            </button>
          </div>
        </div>
      )}

      {/* 2. TELA: ARENA DE GAMEPLAY (PIXIJS) */}
      {currentScreen === 'GAME' && (
        <div className="relative">
          <GameCanvas onGameOver={handleGameOver} />
          <button 
            onClick={() => setCurrentScreen('MENU')}
            className="absolute top-4 left-4 bg-slate-800/80 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded border border-slate-600 backdrop-blur-sm transition"
          >
            🏳️ Abandon Match
          </button>
        </div>
      )}

      {/* 3. TELA: RESULTADO (GAME OVER) */}
      {currentScreen === 'GAME_OVER' && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md text-center flex flex-col gap-5">
          <div>
            <h2 className="text-3xl font-black text-rose-500 uppercase tracking-wide">Ship Sunk!</h2>
            <p className="text-slate-400 text-sm mt-1">Your journey has ended.</p>
          </div>
          
          <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800/60">
            <span className="text-sm text-slate-400 block uppercase tracking-wider font-semibold">Final Score</span>
            <strong className="text-5xl font-black text-amber-400 block mt-1">{lastScore}</strong>
            <span className="text-xs text-slate-500 block mt-2">
              {isSaving ? '⏳ Saving record...' : '✅ Saved to Ledger'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setCurrentScreen('GAME')}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg transition"
            >
              🔄 Play Again
            </button>
            <button 
              onClick={() => setCurrentScreen('MENU')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-lg transition border border-slate-700"
            >
              🏠 Main Menu
            </button>
          </div>
        </div>
      )}

      {/* 4. TELA: LEADERBOARD / RANKING */}
      {currentScreen === 'RANKING' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-lg flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">🏆 Global Leaderboard</h2>
            <button onClick={() => setCurrentScreen('MENU')} className="text-xs text-slate-400 hover:text-white bg-slate-800 py-1 px-3 rounded transition">Back</button>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3">Pos</th>
                  <th className="p-3">Captain</th>
                  <th className="p-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {ranking.map((item: any, idx: number) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3 font-mono text-amber-500/70">#{idx + 1}</td>
                    <td className="p-3 font-medium">{item.playerName}</td>
                    <td className="p-3 text-right font-bold text-amber-400">{item.score} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TELA: HISTÓRICO DE PARTIDAS */}
      {currentScreen === 'HISTORY' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-xl flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-xl font-bold text-slate-300 flex items-center gap-2">📜 Log History</h2>
            <button onClick={() => setCurrentScreen('MENU')} className="text-xs text-slate-400 hover:text-white bg-slate-800 py-1 px-3 rounded transition">Back</button>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 max-h-[300px] overflow-y-auto">
            {matchHistory.length === 0 ? (
              <p className="text-center p-6 text-sm text-slate-500">No entries yet. Sail out first!</p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800 sticky top-0">
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {matchHistory.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition">
                      <td className="p-3 text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="p-3 text-right font-bold text-slate-200">{item.score} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
