// tests/pirate-battle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Pirate Battle — Technical Challenge E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Acessa a aplicação antes de cada teste
    await page.goto('http://localhost:5173');
  });

  test('should load the main menu correctly and check the title', async ({ page }) => {
    // Valida se o título principal em inglês exigido está visível
    const title = page.locator('h1');
    await expect(title).toContainText('⚓ Pirate Battle');
  });

  test('should navigate to Leaderboard and return to menu', async ({ page }) => {
    // Clica no botão de Ranking
    await page.click('button:has-text("🏆 Ranking")');
    
    // Verifica se a tabela ou o título do modal apareceu
    await expect(page.locator('h2')).toContainText('Global Leaderboard');
    
    // Clica para voltar ao menu principal
    await page.click('button:has-text("Back")');
    
    // Garante que o botão de Play voltou a ficar visível
    await expect(page.locator('button:has-text("▶️ Play Game")')).toBeVisible();
  });

  test('should navigate to Log History and check empty state or table', async ({ page }) => {
    // Clica no botão de Histórico
    await page.click('button:has-text("📜 History")');
    
    // Verifica se o container do histórico carregou
    await expect(page.locator('h2')).toContainText('Log History');
    
    // Volta ao menu
    await page.click('button:has-text("Back")');
  });

     test('should successfully launch the PixiJS canvas game instance', async ({ page }) => {
    // Clica para iniciar a partida
    await page.click('button:has-text("▶️ Play Game")');
    
    // Seleciona o primeiro canvas ativo
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    
    // Corrigido: Procura de forma flexível por partes da palavra (ex: "CONTROLES" ou "CONTROLS") 
    // ignorando maiúsculas e minúsculas
    await page.waitForTimeout(1000); // Aguarda 1 segundo para o canvas e textos renderizarem totalmente
    const controlsText = page.locator('text=/control/i').first();
    await expect(controlsText).toBeVisible();
  });

  /* --- REGRESSÃO VISUAL (VISUAL REGRESSION TESTING) --- */
  test('should pass visual regression snapshot for the Main Menu', async ({ page }) => {
    // Aguarda o carregamento completo do layout
    await page.waitForLoadState('networkidle');
    
    // Captura a tela e compara com o snapshot de referência salvo na pasta do projeto
    // Na primeira execução, o Playwright vai criar a imagem base automaticamente.
    await expect(page).toHaveScreenshot('main-menu-snapshot.png', {
      maxDiffPixelRatio: 0.05, // Margem de tolerância aceitável de 5% por conta de renderização de fontes
    });
  });
});
