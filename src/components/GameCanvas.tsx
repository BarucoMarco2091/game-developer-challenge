import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
}

interface Enemy {
  graphic: Graphics;
  type: 'CHASER' | 'SHOOTER';
  health: number;
  maxHealth: number;
  healthBar: Graphics;
  lastShotTime: number;
}

export const GameCanvas = ({ onGameOver }: GameCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDestroyedRef = useRef(false);

  useEffect(() => {
    isDestroyedRef.current = false;
    if (!containerRef.current) return;

    // 1. Configurações Centrais de Gameplay
    const config = {
      playerSpeed: 4,
      playerRotationSpeed: 0.05,
      bulletSpeed: 8,
      shootCooldown: 300,
      sideShootCooldown: 600,
      enemySpawnInterval: 2000,
      chaserSpeed: 2.3,
      chaserDamage: 25,
      chaserMaxHealth: 1,
      shooterSpeed: 1.6,
      shooterMaxHealth: 2,
      shooterAttackRange: 220,
      shooterShootCooldown: 1400,
      enemyBulletSpeed: 5.5,
      enemyBulletDamage: 15,
    };

    let playerScore = 0;
    let playerHealth = 100;
    const maxPlayerHealth = 100;

    // 2. Estado de Input do Teclado
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 3. Inicialização Assíncrona do PixiJS v8
    const app = new Application();
    let lastShootTime = 0;
    let lastLeftSideShootTime = 0;
    let lastRightSideShootTime = 0;
    let lastSpawnTime = 0;

    // Criamos uma flag interna para monitorar se a inicialização concluiu antes do unmount
    let isInitialized = false;

    app.init({
      width: 800,
      height: 600,
      backgroundColor: 0x1a365d,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    }).then(() => {
      // Se o componente desmontou antes do término do init, não anexa o canvas nem inicia loops
      if (isDestroyedRef.current) {
        // Safe check interno para evitar que o resize quebre caso acionado antes da hora
        if (typeof (app as any)._cancelResize === 'function') {
          app.destroy(true, { children: true, texture: true });
        }
        return;
      }

      isInitialized = true;
      containerRef.current?.appendChild(app.canvas);

      // Listas de controle de entidades no Stage
      const playerBullets: Graphics[] = [];
      const enemyBullets: Graphics[] = [];
      const enemies: Enemy[] = [];

      // 4. Criação do Navio do Jogador
      const player = new Graphics()
        .poly([-15, -10, 22, 0, -15, 10, -9, 0])
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
        playerHealthBar.rect(player.x - 20, player.y - 25, 40, 5).fill({ color: 0x2d3748 });
        const width = (playerHealth / maxPlayerHealth) * 40;
        playerHealthBar.rect(player.x - 20, player.y - 25, width, 5).fill({ color: 0x2ecc71 });
      };

      // Mecânica: Disparo Frontal Padrão
      const fireFrontBullet = () => {
        const now = Date.now();
        if (now - lastShootTime < config.shootCooldown) return;
        lastShootTime = now;

        const bullet = new Graphics().circle(0, 0, 4).fill({ color: 0xf1c40f });
        bullet.x = player.x + Math.cos(player.rotation) * 22;
        bullet.y = player.y + Math.sin(player.rotation) * 22;
        bullet.rotation = player.rotation;

        app.stage.addChild(bullet);
        playerBullets.push(bullet);
      };

      // Mecânica: Disparo Lateral Triplo (Q / E)
      const fireSideBullets = (isLeft: boolean) => {
        const now = Date.now();
        if (isLeft) {
          if (now - lastLeftSideShootTime < config.sideShootCooldown) return;
          lastLeftSideShootTime = now;
        } else {
          if (now - lastRightSideShootTime < config.sideShootCooldown) return;
          lastRightSideShootTime = now;
        }

        const targetAngle = player.rotation + (isLeft ? -Math.PI / 2 : Math.PI / 2);
        const offsets = [-12, 0, 12];

        offsets.forEach((offset) => {
          const bullet = new Graphics().circle(0, 0, 4).fill({ color: 0xe67e22 });
          const spawnX = player.x + Math.cos(player.rotation) * offset;
          const spawnY = player.y + Math.sin(player.rotation) * offset;

          bullet.x = spawnX + Math.cos(targetAngle) * 12;
          bullet.y = spawnY + Math.sin(targetAngle) * 12;
          bullet.rotation = targetAngle;

          app.stage.addChild(bullet);
          playerBullets.push(bullet);
        });
      };

      // Fábrica de Inimigos (Spawn Dinâmico)
      const spawnEnemy = () => {
        const useHorizontal = Math.random() > 0.5;
        const spawnX = useHorizontal ? (Math.random() > 0.5 ? 40 : 760) : Math.random() * 800;
        const spawnY = useHorizontal ? Math.random() * 600 : (Math.random() > 0.5 ? 40 : 560);

        const isShooter = Math.random() > 0.4;

        const enemyG = new Graphics();
        if (isShooter) {
          enemyG.poly([-14, -10, 18, 0, -14, 10, -9, 0]).fill({ color: 0x2980b9 });
        } else {
          enemyG.poly([-10, -7, 16, 0, -10, 7, -6, 0]).fill({ color: 0x8e44ad });
        }

        enemyG.x = spawnX;
        enemyG.y = spawnY;
        app.stage.addChild(enemyG);

        const hBar = new Graphics();
        app.stage.addChild(hBar);

        enemies.push({
          type: isShooter ? 'SHOOTER' : 'CHASER',
          graphic: enemyG,
          health: isShooter ? config.shooterMaxHealth : config.chaserMaxHealth,
          maxHealth: isShooter ? config.shooterMaxHealth : config.chaserMaxHealth,
          healthBar: hBar,
          lastShotTime: 0
        });
      };

      // 5. Game Loop de Alta Performance
      const update = (ticker: any) => {
        const dt = ticker.deltaTime;

        if (playerHealth <= 0) {
          app.ticker.remove(update);
          onGameOver(playerScore);
          return;
        }

        if (keys['a']) player.rotation -= config.playerRotationSpeed * dt;
        if (keys['d']) player.rotation += config.playerRotationSpeed * dt;
        if (keys['w'] || keys['arrowup']) {
          player.x += Math.cos(player.rotation) * config.playerSpeed * dt;
          player.y += Math.sin(player.rotation) * config.playerSpeed * dt;
        }

        if (keys[' ']) fireFrontBullet();
        if (keys['q']) fireSideBullets(true);
        if (keys['e']) fireSideBullets(false);

        if (player.x < 15) player.x = 15;
        if (player.x > 785) player.x = 785;
        if (player.y < 15) player.y = 15;
        if (player.y > 585) player.y = 585;

        updatePlayerHealthBar();

        const currentTime = Date.now();
        if (currentTime - lastSpawnTime > config.enemySpawnInterval) {
          spawnEnemy();
          lastSpawnTime = currentTime;
        }

        for (let i = playerBullets.length - 1; i >= 0; i--) {
          const b = playerBullets[i];
          b.x += Math.cos(b.rotation) * config.bulletSpeed * dt;
          b.y += Math.sin(b.rotation) * config.bulletSpeed * dt;

          let bulletRemoved = false;

          for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = b.x - enemy.graphic.x;
            const dy = b.y - enemy.graphic.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 18) {
              enemy.health -= 1;
              app.stage.removeChild(b);
              playerBullets.splice(i, 1);
              b.destroy();
              bulletRemoved = true;

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

          if (bulletRemoved) continue;

          if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
            app.stage.removeChild(b);
            playerBullets.splice(i, 1);
            b.destroy();
          }
        }

        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const eb = enemyBullets[i];
          eb.x += Math.cos(eb.rotation) * config.enemyBulletSpeed * dt;
          eb.y += Math.sin(eb.rotation) * config.enemyBulletSpeed * dt;

          const dx = eb.x - player.x;
          const dy = eb.y - player.y;
          const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

          if (distanceToPlayer < 16) {
            playerHealth -= config.enemyBulletDamage;
            app.stage.removeChild(eb);
            enemyBullets.splice(i, 1);
            eb.destroy();
            continue;
          }

          if (eb.x < 0 || eb.x > 800 || eb.y < 0 || eb.y > 600) {
            app.stage.removeChild(eb);
            enemyBullets.splice(i, 1);
            eb.destroy();
          }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
          const enemy = enemies[i];
          const dx = player.x - enemy.graphic.x;
          const dy = player.y - enemy.graphic.y;
          const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

          enemy.graphic.rotation = Math.atan2(dy, dx);

          if (enemy.type === 'CHASER') {
            enemy.graphic.x += Math.cos(enemy.graphic.rotation) * config.chaserSpeed * dt;
            enemy.graphic.y += Math.sin(enemy.graphic.rotation) * config.chaserSpeed * dt;

            if (distanceToPlayer < 20) {
              playerHealth -= config.chaserDamage;
              app.stage.removeChild(enemy.graphic);
              app.stage.removeChild(enemy.healthBar);
              enemy.graphic.destroy();
              enemy.healthBar.destroy();
              enemies.splice(i, 1);
              continue;
            }
          } else {
            if (distanceToPlayer > config.shooterAttackRange) {
              enemy.graphic.x += Math.cos(enemy.graphic.rotation) * config.shooterSpeed * dt;
              enemy.graphic.y += Math.sin(enemy.graphic.rotation) * config.shooterSpeed * dt;
            } else {
              const now = Date.now();
              if (now - enemy.lastShotTime > config.shooterShootCooldown) {
                enemy.lastShotTime = now;
                const enemyBullet = new Graphics().circle(0, 0, 4).fill({ color: 0xe74c3c });
                enemyBullet.x = enemy.graphic.x + Math.cos(enemy.graphic.rotation) * 18;
                enemyBullet.y = enemy.graphic.y + Math.sin(enemy.graphic.rotation) * 18;
                enemyBullet.rotation = enemy.graphic.rotation;
                app.stage.addChild(enemyBullet);
                enemyBullets.push(enemyBullet);
              }
            }
          }
          enemy.healthBar.clear();
          enemy.healthBar.rect(enemy.graphic.x - 10, enemy.graphic.y - 16, 20, 3).fill({ color: 0x2d3748 });
          const enemyHealthWidth = (enemy.health / enemy.maxHealth) * 20;
          const barColor = enemy.type === 'SHOOTER' ? 0x3498db : 0x9b59b6;
          enemy.healthBar.rect(enemy.graphic.x - 10, enemy.graphic.y - 16, enemyHealthWidth, 3).fill({ color: barColor });
        }
      };
      app.ticker.add(update);
    });
    // 6. Bloco de Limpeza Seguro Contra Bugs de Ciclo de Vida do PixiJS v8
    return () => {
      isDestroyedRef.current = true;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Só invoca o destroy se o Pixi terminou o init e possui o método interno de cancelamento
      if (isInitialized && typeof (app as any)._cancelResize === 'function') {
        app.destroy(true, { children: true, texture: true });
      } else {
        // Força uma desmontagem tardia segura caso o init termine após o React deslogar a tela
        app.init().then(() => {
          try { app.destroy(true, { children: true, texture: true }); } catch (e) { }
        }).catch(() => { });
      }
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



