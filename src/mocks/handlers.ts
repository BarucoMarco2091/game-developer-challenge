// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Tipagem das informações de partida conforme o enunciado
interface MatchRecord {
  id: string;
  playerName: string;
  score: number;
  duration: number;
  date: string;
  reason: 'health_depleted' | 'time_expired';
}

// Funções auxiliares para simular o Banco de Dados via LocalStorage
const getStoredHistory = (): MatchRecord[] => {
  const data = localStorage.getItem('pirate_match_history');
  return data ? JSON.parse(data) : [];
};

const saveMatchToStorage = (match: MatchRecord) => {
  const history = getStoredHistory();
  // Evitar duplicidade caso dê duplo clique (Idempotência)
  if (history.some(m => m.id === match.id)) return history;
  
  history.push(match);
  localStorage.setItem('pirate_match_history', JSON.stringify(history));
  return history;
};

export const handlers = [
  // 1. GET Match History (Histórico ordenado por data descendente)
  http.get('/api/match-history', () => {
    const history = getStoredHistory().sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return HttpResponse.json(history);
  }),

  // 2. POST Match History (Registrar uma nova partida)
  http.post('/api/match-history', async ({ request }) => {
    const newMatch = (await request.json()) as MatchRecord;
    
    // Simula uma pequena lentidão de rede de 400ms obrigatória nos testes
    await new Promise((resolve) => setTimeout(resolve, 400));
    
    const updatedHistory = saveMatchToStorage(newMatch);
    return HttpResponse.json({ success: true, data: updatedHistory });
  }),

  // 3. GET Ranking (Placar global ordenado por pontuação alta)
  http.get('/api/ranking', () => {
    const history = getStoredHistory();
    
    // Cria fixtures de outros jogadores fictícios para popular o ranking
    const fixtures: MatchRecord[] = [
      { id: 'f1', playerName: 'Blackbeard', score: 15, duration: 60, date: new Date().toISOString(), reason: 'time_expired' },
      { id: 'f2', playerName: 'Captain Kidd', score: 8, duration: 60, date: new Date().toISOString(), reason: 'health_depleted' },
      { id: 'f3', playerName: 'Anne Bonny', score: 12, duration: 60, date: new Date().toISOString(), reason: 'time_expired' },
    ];

    // Junta as fixtures com as partidas reais do jogador
    const allMatches = [...fixtures, ...history];

    // Ordenação determinística: Maior pontuação primeiro. Se empatar, menor tempo jogado vence.
    const sortedRanking = allMatches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.duration - b.duration; 
    });

    return HttpResponse.json(sortedRanking);
  }),
];
