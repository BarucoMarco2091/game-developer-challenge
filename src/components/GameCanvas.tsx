import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
}

// Interface simples para gerenciar os dados dos inimigos
interface Enemy {
  graphic: Graphics;
  health: number;
  maxHealth: number;
  healthBar: Graphics;
}

export const GameCanvas = ({ onGameOver }: GameCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDestroyedRef = useRef(false);

  useEffect(() => {
    isDestroyedRef.current = false;
    if (!containerRef.current) return;

    // 1. Configurações Centrais do Jogo
    const config = {
      playerSpeed: 4,
      playerRotationSpeed: 0.05,
      bulletSpeed: 7,
      shootCooldown: 300,
      
      // Configurações do Inimigo Chaser
      enemySpawnInterval: 2000, // Surge 1 inimigo a cada 2 segundos
      chaserSpeed: 2.2,
      chaserDamage: 25,
      chaserMaxHealth: 1, // Chaser morre com 1 tiro geralmente
    };

    // Estado do Jogo (Variáveis de controle locais no loop)
    let playerScore = 0;
    let playerHealth = 100;
    const maxPlayerHealth = 100;

    // 2. Estado dos Inputs (Teclado)
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 3. Inicializa o PixiJS v8
    const app = new Application();
    let lastShootTime = 0;
    let lastSpawnTime = 0;

    app.init({ 
      width: 800, 
      height: 600, 
      backgroundColor: 0x1099bb,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    }).then(() => {
      if (isDestroyedRef.current) {
        app.destroy(true, { children: true, texture: true });
        return;
      }

      containerRef.current?.appendChild(app.canvas);

      // Arrays para gerenciar as entidades de combate
      const bullets: Graphics[] = [];
      const enemies: Enemy[] = [];

      // 4. Cria o Navio do Jogador (Vermelho)
      const player = new Graphics()
        .poly([-15, -10, 20, 0, -15, 10, -10, 0])
        .fill({ color: 0xe74c3c });

      player.x = 400;
      player.y = 300;
      player.rotation = 0;
      app.stage.addChild(player);

      // Barra de Vida flutuante do Jogador (Fundo cinza, barra verde)
      const playerHealthBar = new Graphics();
      app.stage.addChild(playerHealthBar);

      const updatePlayerHealthBar = () => {
        playerHealthBar.clear();
        if (playerHealth <= 0) return;
        // Fundo
        playerHealthBar.rect(player.x - 20, player.y - 25, 40, 5).fill({ color: 0x333333 });
        // Vida Atual
        const width = (playerHealth / maxPlayerHealth) * 40;
        playerHealthBar.rect(player.x - 20, player.y - 25, width, 5).fill({ color: 0x2ecc71 });
      };

      // Função auxiliar para disparar projétil
      const fireBullet = () => {
        const now = Date.now();
        if (now - lastShootTime < config.shootCooldown) return;
        lastShootTime = now;

        const bullet = new Graphics().circle(0, 0, 4).fill({ color: 0xf1c40f });
        bullet.x = player.x + Math.cos(player.rotation) * 20;
        bullet.y = player.y + Math.sin(player.rotation) * 20;
        bullet.rotation = player.rotation;
        
        app.stage.addChild(bullet);
        bullets.push(bullet);
      };

      // Função para criar/spawnar um Chaser
      const spawnChaser = () => {
        // Escolhe uma posição aleatória nas bordas da arena para não nascer colado no jogador
        let spawnX = 0;
        let spawnY = 0;
        if (Math.random() > 0.5) {
          spawnX = Math.random() > 0.5 ? 50 : 750;
          spawnY = Math.random() * 600;
        } else {
          spawnX = Math.random() * 800;
          spawnY = Math.random() > 0.5 ? 50 : 550;
        }

        // Desenha o navio inimigo Chaser (Roxo/Preto e menor)
        const enemyG = new Graphics()
          .poly([-10, -7, 15, 0, -10, 7, -7, 0])
          .fill({ color: 0x8e44ad }); // Roxo

        enemyG.x = spawnX;
        enemyG.y = spawnY;
        app.stage.addChild(enemyG);

        // Cria a barra de vida específica do inimigo
        const hBar = new Graphics();
        app.stage.addChild(hBar);

        enemies.push({
          graphic: enemyG,
          health: config.chaserMaxHealth,
          maxHealth: config.chaserMaxHealth,
          healthBar: hBar
        });
      };

      // 5. Game Loop Principal
      const update = (ticker: any) => {
        const dt = ticker.deltaTime;

        // Se o jogador morreu, para o loop e encerra a partida
        if (playerHealth <= 0) {
          app.ticker.remove(update);
          onGameOver(playerScore);
          return;
        }

        // --- MOVIMENTAÇÃO DO JOGADOR ---
        if (keys['a']) player.rotation -= config.playerRotationSpeed * dt;
        if (keys['d']) player.rotation += config.playerRotationSpeed * dt;
        if (keys['w'] || keys['arrowup']) {
          player.x += Math.cos(player.rotation) * config.playerSpeed * dt;
          player.y += Math.sin(player.rotation) * config.playerSpeed * dt;
        }

        if (keys[' ']) fireBullet();

        // Limita jogador na tela
        if (player.x < 15) player.x = 15;
        if (player.x > 785) player.x = 785;
        if (player.y < 15) player.y = 15;
        if (player.y > 585) player.y = 585;

        updatePlayerHealthBar();

        // --- CONTROLE DE SPAWN DE INIMIGOS ---
        const currentTime = Date.now();
        if (currentTime - lastSpawnTime > config.enemySpawnInterval) {
          spawnChaser();
          lastSpawnTime = currentTime;
        }

        // --- ATUALIZAR PROJÉTEIS ---
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.x += Math.cos(b.rotation) * config.bulletSpeed * dt;
          b.y += Math.sin(b.rotation) * config.bulletSpeed * dt;

          let bulletRemoved = false;

          // Colisão Projétil -> Inimigos
          for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = b.x - enemy.graphic.x;
            const dy = b.y - enemy.graphic.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Raio de acerto simples de 15 pixels
            if (distance < 15) {
              enemy.health -= 1; // Toma dano
              
              // Remove o projétil
              app.stage.removeChild(b);
              bullets.splice(i, 1);
              b.destroy();
              bulletRemoved = true;

              // Verifica se o inimigo morreu
              if (enemy.health <= 0) {
                playerScore += 1; // Pontua se o jogador destruir
                app.stage.removeChild(enemy.graphic);
                app.stage.removeChild(enemy.healthBar);
                enemy.graphic.destroy();
                enemy.healthBar.destroy();
                enemies.splice(j, 1);
              }
              break;
            }
          }

          if (bulletRemoved) continue;

          // Remove tiro que saiu da tela
          if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
            app.stage.removeChild(b);
            bullets.splice(i, 1);
            b.destroy();
          }
        }

        // --- ATUALIZAR INIMIGOS (IA PERSEGUIÇÃO) ---
        for (let i = enemies.length - 1; i >= 0; i--) {
          const enemy = enemies[i];

          // 1. Apontar/Olhar para o jogador
          const dx = player.x - enemy.graphic.x;
          const dy = player.y - enemy.graphic.y;
          enemy.graphic.rotation = Math.atan2(dy, dx);

          // 2. Mover na direção do jogador
          enemy.graphic.x += Math.cos(enemy.graphic.rotation) * config.chaserSpeed * dt;
          enemy.graphic.y += Math.sin(enemy.graphic.rotation) * config.chaserSpeed * dt;

          // 3. Atualizar a barrinha de vida acima do inimigo
          enemy.healthBar.clear();
          enemy.healthBar.rect(enemy.graphic.x - 10, enemy.graphic.y - 15, 20, 3).fill({ color: 0x333333 });
          const enemyHealthWidth = (enemy.health / enemy.maxHealth) * 20;
          enemyHealthBar.rect(enemy.graphic.x - 10, enemy.graphic.y - 15, enemyHealthWidth, 3).fill({ color: 0x9b59b6 });

          // 4. Detecção de Impacto com o Jogador (Ataque Kamikaze do Chaser)
          const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
          if (distanceToPlayer < 20) {
            playerHealth -= config.chaserDamage; // Causa dano no jogador
            
            // O Chaser explode e se autodestrói (Não dá ponto de acordo com as regras)
            app.stage.removeChild(enemy.graphic);
            app.stage.removeChild(enemy.healthBar);
            enemy.graphic.destroy();
            enemy.healthBar.destroy();
            enemies.splice(i, 1);
          }
        }
      };

      app.ticker.add(update);
    });

    return () => {
      isDestroyedRef.current = true;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center bg-slate-900 p-4 rounded-lg">
      <div ref={containerRef} className="border-4 border-slate-700 rounded shadow-2xl overflow-hidden" />
      <div className="text-white mt-4 text-sm bg-slate-800 p-3 rounded w-full max-w-md text-center">
        <p className="font-bold text-amber-400 mb-1">🎮 CONTROLES:</p>
        <p><strong>W</strong>: Avançar | <strong>A / D</strong>: Rotacionar Navio</p>
        <p><strong>Espaço</strong>: Disparo Frontal</p>
      </div>
    </div>
  );
};

