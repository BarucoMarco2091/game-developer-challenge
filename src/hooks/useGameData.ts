// src/hooks/useGameData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface MatchPayload {
  id: string;
  playerName: string;
  score: number;
  duration: number;
  date: string;
  reason: 'health_depleted' | 'time_expired';
}

// Configuração básica do Axios
const api = axios.create({ baseURL: '/' });

export const useGameData = () => {
  const queryClient = useQueryClient();

  // Query para buscar histórico
  const matchHistoryQuery = useQuery({
    queryKey: ['matchHistory'],
    queryFn: async () => {
      const response = await api.get('/api/match-history');
      return response.data;
    },
  });

  // Query para buscar ranking global
  const rankingQuery = useQuery({
    queryKey: ['ranking'],
    queryFn: async () => {
      const response = await api.get('/api/ranking');
      return response.data;
    },
  });

  // Mutation para registrar o resultado ao final do jogo
  const saveMatchMutation = useMutation({
    mutationFn: async (newMatch: MatchPayload) => {
      const response = await api.post('/api/match-history', newMatch);
      return response.data;
    },
    // Invalida os caches imediatamente para atualizar as tabelas na tela do jogador
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchHistory'] });
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
    },
  });

  return {
    matchHistory: matchHistoryQuery.data || [],
    isLoadingHistory: matchHistoryQuery.isLoading,
    ranking: rankingQuery.data || [],
    isLoadingRanking: rankingQuery.isLoading,
    saveMatch: saveMatchMutation.mutate,
    isSaving: saveMatchMutation.isPending,
  };
};
