import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
}

interface Enemy {
  graphic: Graphics;
  type: 'chaser' | 'shooter';
  health: number;
  maxHealth: number;
  healthBar: Graphics;
  lastShotTime?: number;
}

export const GameCanvas = ({ onGameOver }: GameCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDestroyedRef = useRef(false);

  useEffect(() => {
    isDestroyedRef.current = false;
    if (!containerRef.current) return;

    // Configurações de Gameplay centralizadas
    const config = {
      playerSpeed: 3.5,
      playerRotationSpeed: 0.04,
      bulletSpeed: 9,
      shootCooldown: 250,
      sideShootCooldown: 500,
      
      enemySpawnInterval: 2500,
      chaserSpeed: 2.0,
      chaserDamage: 20,
      
      shooterSpeed: 1.5,
      shooterRange: 250,
      shooterCooldown: 1800,
      shooterBulletSpeed: 5,
    };

    let playerScore = 0;
    let playerHealth = 100;
    const maxPlayerHealth = 100;

    // Gerenciamento de Teclado
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const app = new Application();
    let lastShootTime = 0;
    let lastSideShootTime = 0;
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

      const bullets: { graphic: Graphics; vx: number; vy: number; isEnemy?: boolean }[] = [];
      const enemies: Enemy[] = [];

      // Navio do Jogador
      const player = new Graphics()
        .poly([-15, -10, 20, 0, -15, 10, -10, 0])
        .fill({ color: 0xe74c3c });

      player.x = 400;
      player.y = 300;
      player.rotation = 0;
      app.stage.addChild(player);

      const playerHealthBar = new Graphics();
      app.stage.addChild(playerHealthBar);

      const updatePlayerHealthBar = () => {
        playerHealthBar.clear();
        if (playerHealth <= 0) return;
        playerHealthBar.rect(player.x - 20, player.y - 25, 40, 5).fill({ color: 0x333333 });
        const width = (playerHealth / maxPlayerHealth) * 40;
        playerHealthBar.rect(player.x - 20, player.y - 25, width, 5).fill({ color: 0x2ecc71 });
      };

      // Disparo Frontal
      const fireFrontBullet = () => {
        const now = Date.now();
        if (now - lastShootTime < config.shootCooldown) return;
        lastShootTime = now;

        const bullet = new Graphics().circle(0, 0, 4).fill({ color: 0xf1c40f });
        bullet.x = player.x + Math.cos(player.rotation) * 20;
        bullet.y = player.y + Math.sin(player.rotation) * 20;
        
        app.stage.addChild(bullet);
        bullets.push({
          graphic: bullet,
          vx: Math.cos(player.rotation) * config.bulletSpeed,
          vy: Math.sin(player.rotation) * config.bulletSpeed
        });
      };

      // Disparo Lateral (Esquerda ou Direita: 3 projéteis paralelos)
      const fireSideBullets = (side: 'left' | 'right') => {
        const now = Date.now();
        if (now - lastSideShootTime < config.sideShootCooldown) return;
        lastSideShootTime = now;

        // Ângulo perpendicular ao navio
        const angleOffset = side === 'left' ? -Math.PI / 2 : Math.PI / 2;
        const sideAngle = player.rotation + angleOffset;

        // Ponto de origem lateral
        const originX = player.x + Math.cos(sideAngle) * 15;
        const originY = player.y + Math.sin(sideAngle) * 15;

        // Cria 3 projéteis paralelos disparados na direção para onde o navio aponta
        for (let i = -1; i <= 1; i++) {
          const bullet = new Graphics().circle(0, 0, 3).fill({ color: 0x3498db });
          // Desloca levemente cada projétil ao longo do corpo do navio para espaçá-los
          const spacingX = originX + Math.cos(player.rotation) * (i * 8);
          const spacingY = originY + Math.sin(player.rotation) * (i * 8);
          
          bullet.x = spacingX;
          bullet.y = spacingY;

          app.stage.addChild(bullet);
          bullets.push({
            graphic: bullet,
            vx: Math.cos(player.rotation) * config.bulletSpeed,
            vy: Math.sin(player.rotation) * config.bulletSpeed
          });
        }
      };

      // Spawn de Inimigos (Alterna entre Chaser e Shooter)
      const spawnEnemy = () => {
        let spawnX = Math.random() > 0.5 ? (Math.random() > 0.5 ? 40 : 760) : Math.random() * 800;
        let spawnY = spawnX === 40 || spawnX === 760 ? Math.random() * 600 : (Math.random() > 0.5 ? 40 : 560);

        const isShooter = Math.random() > 0.5;
        const enemyG = new Graphics();

        if (isShooter) {
          // Shooter (Azul escuro/Verde)
          enemyG.poly([-12, -10, 15, 0, -12, 10]).fill({ color: 0x1abc9c });
        } else {
          // Chaser (Roxo)
          enemyG.poly([-10, -7, 15, 0, -10, 7]).fill({ color: 0x8e44ad });
        }

        enemyG.x = spawnX;
        enemyG.y = spawnY;
        app.stage.addChild(enemyG);

        const hBar = new Graphics();
        app.stage.addChild(hBar);

        enemies.push({
          graphic: enemyG,
          type: isShooter ? 'shooter' : 'chaser',
          health: isShooter ? 2 : 1,
          maxHealth: isShooter ? 2 : 1,
          healthBar: hBar,
          lastShotTime: 0
        });
      };

      // Game Loop Principal com tratamento de tempo fluido
      const update = (ticker: any) => {
        const dt = ticker.deltaTime;

        if (playerHealth <= 0) {
          app.ticker.remove(update);
          onGameOver(playerScore);
          return;
        }

        // Movimentação do Jogador
        if (keys['a'] || keys['arrowleft']) player.rotation -= config.playerRotationSpeed * dt;
        if (keys['d'] || keys['arrowright']) player.rotation += config.playerRotationSpeed * dt;
        if (keys['w'] || keys['arrowup']) {
          player.x += Math.cos(player.rotation) * config.playerSpeed * dt;
          player.y += Math.sin(player.rotation) * config.playerSpeed * dt;
        }

        if (keys[' ']) fireFrontBullet();
        if (keys['q']) fireSideBullets('left');
        if (keys['e']) fireSideBullets('right');

        // Limites da Arena
        player.x = Math.max(20, Math.min(780, player.x));
        player.y = Math.max(20, Math.min(580, player.y));

        updatePlayerHealthBar();

        // Spawn automático
        const currentTime = Date.now();
        if (currentTime - lastSpawnTime > config.enemySpawnInterval) {
          spawnEnemy();
          lastSpawnTime = currentTime;
        }

        // Atualização de Projéteis
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.graphic.x += b.vx * dt;
          b.graphic.y += b.vy * dt;

          let removeBullet = false;

          // Se o tiro for do inimigo contra o jogador
          if (b.isEnemy) {
            const dx = b.graphic.x - player.x;
            const dy = b.graphic.y - player.y;
            if (Math.sqrt(dx * dx + dy * dy) < 18) {
              playerHealth -= 15;
              removeBullet = true;
            }
          } else {
            // Tiro do jogador contra inimigos
            for (let j = enemies.length - 1; j >= 0; j--) {
              const enemy = enemies[j];
              const dx = b.graphic.x - enemy.graphic.x;
              const dy = b.graphic.y - enemy.graphic.y;
              if (Math.sqrt(dx * dx + dy * dy) < 16) {
                enemy.health -= 1;
                removeBullet = true;

                if (enemy.health <= 0) {
                  playerScore += 1;
                  app.stage.removeChild(enemy.graphic);
                  app.stage.removeChild(enemy.healthBar);
                  enemy.graphic.destroy();
                  enemy.healthBar.destroy();
                  enemies.splice(j, 1);
                }
                break;
              }
            }
          }

          if (removeBullet || b.graphic.x < 0 || b.graphic.x > 800 || b.graphic.y < 0 || b.graphic.y > 600) {
            app.stage.removeChild(b.graphic);
            bullets.splice(i, 1);
            b.graphic.destroy();
          }
        }

        // Atualização de Inimigos (IA)
        for (let i = enemies.length - 1; i >= 0; i--) {
          const enemy = enemies[i];
          const dx = player.x - enemy.graphic.x;
          const dy = player.y - enemy.graphic.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          enemy.graphic.rotation = Math.atan2(dy, dx);

          if (enemy.type === 'chaser') {
            // Chaser persegue diretamente
            enemy.graphic.x += Math.cos(enemy.graphic.rotation) * config.chaserSpeed * dt;
            enemy.graphic.y += Math.sin(enemy.graphic.rotation) * config.chaserSpeed * dt;

            if (dist < 20) {
              playerHealth -= config.chaserDamage;
              app.stage.removeChild(enemy.graphic);
              app.stage.removeChild(enemy.healthBar);
              enemy.graphic.destroy();
              enemy.healthBar.destroy();
              enemies.splice(i, 1);
              continue;
            }
          } else if (enemy.type === 'shooter') {
            // Shooter mantém distância e atira
            if (dist > config.shooterRange) {
              enemy.graphic.x += Math.cos(enemy.graphic.rotation) * config.shooterSpeed * dt;
              enemy.graphic.y += Math.sin(enemy.graphic.rotation) * config.shooterSpeed * dt;
            }

            // Dispara se estiver no alcance
            if (dist <= config.shooterRange + 50) {
              const now = Date.now();
              if (!enemy.lastShotTime || now - enemy.lastShotTime > config.shooterCooldown) {
                enemy.lastShotTime = now;
                const sBullet = new Graphics().circle(0, 0, 4).fill({ color: 0xe67e22 });
                sBullet.x = enemy.graphic.x;
                sBullet.y = enemy.graphic.y;
                app.stage.addChild(sBullet);
                bullets.push({
                  graphic: sBullet,
                  vx: Math.cos(enemy.graphic.rotation) * config.shooterBulletSpeed,
                  vy: Math.sin(enemy.graphic.rotation) * config.shooterBulletSpeed,
                  isEnemy: true
                });
              }
            }
          }

          // Atualiza barra de vida do inimigo
          enemy.healthBar.clear();
          enemy.healthBar.rect(enemy.graphic.x - 10, enemy.graphic.y - 15, 20, 3).fill({ color: 0x333333 });
          const barW = (enemy.health / enemy.maxHealth) * 20;
          enemy.healthBar.rect(enemy.graphic.x - 10, enemy.graphic.y - 15, barW, 3).fill({ color: 0xe74c3c });
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
      <div className="text-white mt-4 text-xs bg-slate-800 p-3 rounded w-full max-w-lg text-center space-y-1">
        <p className="font-bold text-amber-400">🎮 CONTROLES ATUALIZADOS:</p>
        <p><strong>W / Seta Cima</strong>: Avançar | <strong>A / D</strong>: Rotacionar</p>
        <p><strong>Espaço</strong>: Tiro Frontal | <strong className="text-blue-400">Q / E</strong>: Tiros Laterais (Esquerda / Direita)</p>
      </div>
    </div>
  );
};



