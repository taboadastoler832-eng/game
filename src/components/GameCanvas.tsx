/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PlayerSkills, Bullet, BossLaser, Particle, FloatingText, Boss, GameState, MainWeaponType, SubWeaponType, PassiveCoreType } from '../types';
import { MusicAudio } from '../audio';
import { Volume2, VolumeX, Shield, Play, RotateCcw, AlertTriangle, Zap, Target, Star, Radio } from 'lucide-react';

interface GameCanvasProps {
  skills: PlayerSkills;
  onExit: () => void;
}

const checkLaserCollision = (laser: BossLaser, px: number, py: number) => {
  const ax = laser.x;
  const ay = laser.y;
  const bx = laser.x + Math.cos(laser.angle) * laser.length;
  const by = laser.y + Math.sin(laser.angle) * laser.length;

  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    const dx = px - ax;
    const dy = py - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const apx = px - ax;
  const apy = py - ay;

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * abx;
  const cy = ay + t * aby;

  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
};

export default function GameCanvas({ skills, onExit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sound and Mute State
  const [isMuted, setIsMuted] = useState(MusicAudio.getMuteState());

  // Input States
  const [controlMode, setControlMode] = useState<'mouse' | 'keyboard'>('mouse');
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mousePosition = useRef<{ x: number; y: number }>({ x: 300, y: 700 });

  // Score states for rendering React HUD beside/overlaying canvas
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('shmup_highscore') || '0', 10),
    grazeCount: 0,
    bombCharge: 0,
    bombsLeft: 2,
    playerHp: 999,
    playerMaxHp: 999,
    isGameOver: false,
    isVictory: false,
    gameTime: 0,
    difficulty: 1,
  });

  const [bossHpState, setBossHpState] = useState({
    hp: 1,
    maxHp: 1,
    phase: 1,
  });

  // Game active toggle
  const [isPaused, setIsPaused] = useState(false);

  // References to keep precise variables for high performance loop
  const statsRef = useRef<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('shmup_highscore') || '0', 10),
    grazeCount: 0,
    bombCharge: 30, // Start with some bomb juice!
    bombsLeft: 3,
    playerHp: 999,
    playerMaxHp: 999,
    isGameOver: false,
    isVictory: false,
    gameTime: 0,
    difficulty: 1,
  });

  // Canvas bounds (auto updated)
  const bounds = useRef({ width: 600, height: 800 });

  // Gameplay Entity Queues
  const playerX = useRef(300);
  const playerY = useRef(650);
  const playerRadius = 3; // True core hitbox is tiny!
  const playerShipRadius = 14; // Grazing zone boundary
  const playerInvulnFrames = useRef(0);

  // Boss
  const boss = useRef<Boss>({
    x: 300,
    y: 160,
    vx: 1.5,
    vy: 0,
    radius: 35,
    hp: 1600, // Total HP across phases
    maxHp: 1600,
    phase: 1,
    phaseMaxHp: [500, 700, 1000],
    stateTime: 0,
    patternTimer: 0,
    laserAngle: 0,
    pulseScale: 1,
  });

  // Entities
  const bullets = useRef<Bullet[]>([]);
  const bossLasers = useRef<BossLaser[]>([]);
  const particles = useRef<Particle[]>([]);
  const floatingTexts = useRef<FloatingText[]>([]);
  
  // Custom interactive events
  const bombActiveDuration = useRef(0);
  const bombShockwaveRadius = useRef(0);
  const bombTriggered = useRef(false);

  // Orbit drone angles
  const droneAngle = useRef(0);

  // Shooting timings
  const lastShotTime = useRef(0);
  const lastSubShotTime = useRef(0);

  // Floating text creator
  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    floatingTexts.current.push({
      id: Math.random().toString(),
      x,
      y,
      text,
      color,
      alpha: 1.0,
      life: 45, // frames
    });
  };

  // Particle creator
  const spawnExplosion = (x: number, y: number, color: string, count = 12, speed = 3, glow = true) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (0.3 + Math.random() * 0.7) * speed;
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        radius: 1.5 + Math.random() * 2.5,
        color,
        alpha: 1.0,
        life: 50 + Math.floor(Math.random() * 30),
        maxLife: 80,
        glow,
      });
    }
  };

  // Trigger Bomb Command
  const triggerBomb = () => {
    if (statsRef.current.isGameOver || statsRef.current.isVictory) return;
    if (statsRef.current.bombsLeft <= 0 && statsRef.current.bombCharge < 100) {
      addFloatingText(playerX.current, playerY.current - 20, "NO BOMB ENERGY!", "#ef4444");
      return;
    }

    if (statsRef.current.bombCharge >= 100) {
      statsRef.current.bombCharge = 0;
    } else {
      statsRef.current.bombsLeft--;
    }

    bombActiveDuration.current = 60; // 1 second screen clear
    bombShockwaveRadius.current = 5;
    bombTriggered.current = true;
    MusicAudio.playBomb();

    // Damage Boss heavily
    boss.current.hp = Math.max(1, boss.current.hp - 180);
    spawnExplosion(boss.current.x, boss.current.y, '#ec4899', 40, 6, true);
    addFloatingText(300, boss.current.y, "CRITICAL BOMB IMPACT!", "#ec4899");

    // Force score updates
    statsRef.current.score += 5000;
    setGameState({ ...statsRef.current });
  };

  // Mute toggle
  const toggleMute = () => {
    const nextMute = MusicAudio.toggleMute();
    setIsMuted(nextMute);
  };

  // Restart trigger
  const handleRestart = () => {
    // Reset parameters
    statsRef.current = {
      score: 0,
      highScore: parseInt(localStorage.getItem('shmup_highscore') || '0', 10),
      grazeCount: 0,
      bombCharge: 30,
      bombsLeft: 3,
      playerHp: 999,
      playerMaxHp: 999,
      isGameOver: false,
      isVictory: false,
      gameTime: 0,
      difficulty: 1,
    };
    
    // Set boss
    boss.current = {
      x: 300,
      y: 160,
      vx: 1.6,
      vy: 0,
      radius: 35,
      hp: boss.current.phaseMaxHp[0], // Phase 1 Max
      maxHp: boss.current.phaseMaxHp[0],
      phase: 1,
      phaseMaxHp: [500, 700, 1000],
      stateTime: 0,
      patternTimer: 0,
      laserAngle: 0,
      pulseScale: 1,
    };

    playerX.current = 300;
    playerY.current = 650;
    bullets.current = [];
    bossLasers.current = [];
    particles.current = [];
    floatingTexts.current = [];
    bombActiveDuration.current = 0;
    playerInvulnFrames.current = 60;

    MusicAudio.setBossPhase(1);
    MusicAudio.resume();

    setGameState({ ...statsRef.current });
    setBossHpState({
      hp: boss.current.hp,
      maxHp: boss.current.maxHp,
      phase: 1,
    });
  };

  // Trigger audio initialization on user visual engagement
  useEffect(() => {
    MusicAudio.init();
    MusicAudio.setBossPhase(1);
    MusicAudio.resume();
    return () => {
      MusicAudio.stopSequencer();
    };
  }, []);

  // Listen for keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      
      // Prevent scrolling when playing with space/arrows
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        triggerBomb();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Responsive canvas size listener
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let { width, height } = entry.contentRect;
        
        // Ensure a decent aspect ratio or minimum dimensions
        if (width < 320) width = 320;
        if (height < 450) height = 450;

        bounds.current.width = width;
        bounds.current.height = height;

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // CORE INTERACTIVE GAMEPLAY LOOP
  useEffect(() => {
    let animId: number;
    let localFrame = 0;

    const updateGame = () => {
      if (isPaused) {
        animId = requestAnimationFrame(updateGame);
        return;
      }

      localFrame++;
      const currentDifficulty = 1 + (statsRef.current.score / 50000);
      statsRef.current.difficulty = currentDifficulty;

      const audioStats = MusicAudio.getStats();

      // Decrement invuln frames
      if (playerInvulnFrames.current > 0) {
        playerInvulnFrames.current--;
      }

      // 1. Update Player Positions based on active controls
      if (controlMode === 'mouse' && !statsRef.current.isGameOver && !statsRef.current.isVictory) {
        // Smoothly interpolate player coordinates to mouse position
        const dx = mousePosition.current.x - playerX.current;
        const dy = mousePosition.current.y - playerY.current;
        // Follow closely with high speeds
        playerX.current += dx * 0.42;
        playerY.current += dy * 0.42;
      } else if (controlMode === 'keyboard' && !statsRef.current.isGameOver && !statsRef.current.isVictory) {
        // Determine player speed
        const isShift = keysPressed.current['shift'];
        const moveSpeed = isShift ? 2.2 : 5.8; // Shift slows down player for hyper-precise micro-dodging
        
        let dx = 0;
        let dy = 0;
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) dy -= 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dy += 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx -= 1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx += 1;

        // Normalise diagonal speeds
        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        playerX.current += dx * moveSpeed;
        playerY.current += dy * moveSpeed;
      }

      // Clamp player within boundaries
      playerX.current = Math.max(15, Math.min(bounds.current.width - 15, playerX.current));
      playerY.current = Math.max(30, Math.min(bounds.current.height - 30, playerY.current));

      // 2. Playable Weapons Engine (Fire on intervals)
      const now = Date.now();
      
      // Determine fire rate based on Passive: Overcharge
      let fireRateInterval = 120; // ms
      if (skills.passive === PassiveCoreType.OVERCHARGE) {
        // High fire rates based on audio kick rhythms
        const speedFactor = audioStats.currentFreqAmplitude; // ranges from 0 to 1
        fireRateInterval = 120 - Math.floor(speedFactor * 45); // up to 40% faster on beats!
      }

      if (now - lastShotTime.current > fireRateInterval && !statsRef.current.isGameOver && !statsRef.current.isVictory) {
        lastShotTime.current = now;
        
        // Shoot Main Weapons
        if (skills.main === MainWeaponType.SPREAD) {
          MusicAudio.playShoot();
          const spreadAngles = [-0.25, -0.12, 0, 0.12, 0.25];
          spreadAngles.forEach(angle => {
            bullets.current.push({
              id: Math.random().toString(),
              x: playerX.current,
              y: playerY.current - 12,
              vx: Math.sin(angle) * 8.5,
              vy: -Math.cos(angle) * 8.5,
              radius: 3.5,
              color: '#fbbf24',
              glowColor: '#f59e0b',
              isEnemy: false,
              damage: 10,
              type: 'standard',
            });
          });
        } else if (skills.main === MainWeaponType.LASER) {
          // Continuous piercing light beams
          MusicAudio.playLaser();
          bullets.current.push({
            id: Math.random().toString(),
            x: playerX.current,
            y: playerY.current - 12,
            vx: 0,
            vy: -18,
            radius: 4,
            color: '#22d3ee',
            glowColor: '#06b6d4',
            isEnemy: false,
            damage: 22,
            type: 'laser',
          });
        } else if (skills.main === MainWeaponType.WAVE) {
          MusicAudio.playWaveSlash();
          bullets.current.push({
            id: Math.random().toString(),
            x: playerX.current,
            y: playerY.current - 12,
            vx: 0,
            vy: -5.5,
            radius: 15,
            color: '#ec4899',
            glowColor: '#ec4899',
            isEnemy: false,
            damage: 32,
            type: 'wave',
          });
        }
      }

      // Fire autonomous sub weapons (Homing missiles or side supports)
      if (now - lastSubShotTime.current > 750 && !statsRef.current.isGameOver && !statsRef.current.isVictory) {
        lastSubShotTime.current = now;

        if (skills.sub === SubWeaponType.MISSILE) {
          MusicAudio.playMissile();
          // Fire 4 homing proton missiles from wings
          const sideOffs = [-16, 16];
          sideOffs.forEach((offset, idx) => {
            bullets.current.push({
              id: Math.random().toString(),
              x: playerX.current + offset,
              y: playerY.current,
              vx: offset * 0.1,
              vy: -2.5,
              radius: 4,
              color: '#4ade80',
              glowColor: '#22c55e',
              isEnemy: false,
              damage: 26,
              type: 'missile',
              angle: idx === 0 ? -1.5 : 1.5,
            });
          });
        }
      }

      // Increment drone orbits
      droneAngle.current += 0.055;

      // 3. Boss Artificial Intelligence - Multi Stage Rhythm Danmaku Pattern Scheduler
      if (!statsRef.current.isGameOver && !statsRef.current.isVictory) {
        const b = boss.current;
        b.stateTime++;
        b.patternTimer++;

        // Smooth breathing visual scale synchronized with bass beat intensity!
        b.pulseScale = 1.0 + (audioStats.currentFreqAmplitude * 0.12);

        // Stage 1, 2, 3 Movement logic
        if (b.phase === 1) {
          // Slow side to side hovering
          b.x += b.vx;
          if (b.x < 80 || b.x > bounds.current.width - 80) {
            b.vx = -b.vx;
          }
          b.y += (110 + Math.sin(b.stateTime / 20) * 12 - b.y) * 0.05;
        } else if (b.phase === 2) {
          // Oscillate vertically in infinity coordinate paths
          b.x = (bounds.current.width / 2) + Math.sin(b.stateTime / 35) * (bounds.current.width * 0.32);
          b.y = 150 + Math.cos(b.stateTime / 20) * 35;
        } else {
          // Phase 3 Climax: absolute center magnetic black hole positioning
          b.x += ((bounds.current.width / 2) - b.x) * 0.05;
          b.y += (190 - b.y) * 0.05;
        }

        // Danmaku Bullets spawns (Tied to soundtrack rhythm and BPM timing!)
        const spawnBossBullet = (
          x: number,
          y: number,
          angle: number,
          speed: number,
          type: 'standard' | 'ring' | 'curved',
          color: string,
          glowColor: string,
          size = 4,
          acceleration?: number,
          angularVelocity?: number,
          extraProps?: Partial<Bullet>
        ) => {
          // Inject minor accordion speed pulsing linked to visual beats!
          const pulseBias = audioStats.currentFreqAmplitude * 0.8;
          const adjustedSpeed = speed + pulseBias;
          bullets.current.push({
            id: Math.random().toString(),
            x,
            y,
            vx: Math.cos(angle) * adjustedSpeed,
            vy: Math.sin(angle) * adjustedSpeed,
            radius: size,
            color,
            glowColor,
            isEnemy: true,
            damage: 1,
            type,
            angle,
            acceleration,
            angularVelocity,
            age: 0,
            ...extraProps,
          });
        };

const spawnBossLaser = (
          x: number,
          y: number,
          angle: number,
          angularVelocity: number,
          length: number,
          width: number,
          maxDuration: number,
          warningDuration: number,
          color = '#ef4444',
          glowColor = '#f43f5e'
        ) => {
          bossLasers.current.push({
            id: Math.random().toString(),
            x,
            y,
            angle,
            angularVelocity,
            length,
            width,
            maxDuration,
            warningDuration,
            duration: 0,
            color,
            glowColor,
          });
        };

        // PHASE 1: 星旋曼陀罗与分形花瓣 (Symphonic Nebula Spiral & Splitting Petals)
        // Option 1 & 2 Fusion: Alternating high-density spiral waves + periodic fission seeds + heavy beat rings
        if (b.phase === 1) {
          const patternStep = b.patternTimer % 180;
          
          if (patternStep < 100) {
            // Rapid spiral bursts perfectly synchronized with music arpeggio notes!
            // Alternates spiral directions every wave for gorgeous symmetric intersections
            const fireInterval = 4;
            if (b.patternTimer % fireInterval === 0) {
              const spiralArms = 4;
              const direction = (Math.floor(b.patternTimer / 180) % 2 === 0) ? 1 : -1;
              const rotationalOffset = (b.stateTime * 0.055) * direction;
              for (let a = 0; a < spiralArms; a++) {
                const angle = rotationalOffset + (a * (Math.PI * 2 / spiralArms));
                // Fire beautiful hot orange standard bullets winding gracefully
                spawnBossBullet(b.x, b.y, angle, 2.3, 'standard', '#f97316', '#ef4444', 4, 0.005);
              }
            }
          }

          // Fractured Splitting Seed launcher: Launches bullets that explode in mid-air in patterns!
          if (b.patternTimer % 36 === 0) {
            const seedCount = 3;
            const baseAngle = (b.stateTime * 0.02);
            for (let i = 0; i < seedCount; i++) {
              const angle = baseAngle + (i * (Math.PI * 2 / seedCount));
              // Seed has maximum age of 48. After 48 frames, it splits into small circular fragments
              spawnBossBullet(b.x, b.y, angle, 2.0, 'curved', '#ec4899', '#db2777', 6, -0.01, 0.005, { maxAge: 48 });
            }
          }

          // Concentric circular explosions on heavy beat kicks
          if (audioStats.isBeatKick && patternStep >= 110) {
            const ringsCount = 18;
            const rotOffset = Math.random() * Math.PI;
            for (let r = 0; r < ringsCount; r++) {
              const angle = rotOffset + (r * (Math.PI * 2 / ringsCount));
              spawnBossBullet(b.x, b.y, angle, 1.6, 'ring', '#eab308', '#ca8a04', 4.5);
            }
          }

          // Twin cosmic sweeping lasers
          if (patternStep === 110) {
            const startAngle = Math.random() * Math.PI;
            spawnBossLaser(b.x, b.y, startAngle, 0.007, 900, 15, 120, 40, '#a855f7', '#c084fc');
            spawnBossLaser(b.x, b.y, startAngle + Math.PI, -0.007, 900, 15, 120, 40, '#c084fc', '#e9d5ff');
          }
        }

        // PHASE 2: 极光共振矩阵与变频弯弦波 (Resonant Cross-Laser Warning & Sinuous Wave Interception)
        // Option 1 & 2 Fusion: Continuous sweeping hazard lines + Sinuous weaving trails + Temporal Dilation rings
        else if (b.phase === 2) {
          const patternStep = b.patternTimer % 240;

          // Sinuous Side Wave Matrix
          if (patternStep < 120) {
            if (b.patternTimer % 6 === 0) {
              const ways = 3;
              const baseAngle = Math.sin(b.stateTime * 0.03) * (Math.PI * 0.4) + (Math.PI / 2);
              for (let w = 0; w < ways; w++) {
                const angle = baseAngle + (w - 1) * 0.4;
                // Cyan and purple snake bullets weaving crosswise
                spawnBossBullet(b.x, b.y, angle, 1.8, 'curved', '#06b6d4', '#0891b2', 4.5);
                spawnBossBullet(b.x, b.y, angle + 0.15, 1.5, 'curved', '#a855f7', '#7c3aed', 3.5);
              }
            }
          }

          // Laser sweep targeting & warning matrices firing dense interceptor sparklers
          b.laserAngle = (b.stateTime * 0.0075) % (Math.PI * 2);
          if (patternStep >= 100 && patternStep < 220) {
            if (b.patternTimer % 18 === 0) {
              // Fire fast sparklers precisely following the sweeping quad cross laser vectors!
              const directions = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
              directions.forEach(dir => {
                const angle = b.laserAngle + dir;
                spawnBossBullet(b.x, b.y, angle, 3.4, 'standard', '#f43f5e', '#ef4444', 3);
              });
            }
          }

          // Real Rotating Quad Cross Lasers matching visual sweep
          if (patternStep === 100) {
            const directions = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
            directions.forEach((dir) => {
              spawnBossLaser(
                b.x,
                b.y,
                b.laserAngle + dir,
                0.0075,
                900,
                16,
                130,
                30,
                '#38bdf8',
                '#0284c7'
              );
            });
          }

          // Expand & Brake (Temporal slow down) ring bursts on beats
          if (patternStep >= 130 && patternStep < 210) {
            if (b.patternTimer % 35 === 0) {
              const points = 16;
              const angleRand = Math.random() * Math.PI;
              for (let p = 0; p < points; p++) {
                const angle = angleRand + (p * (Math.PI * 2 / points));
                // Marked with maxAge === 999 to trigger our Expand & Brake sequence
                spawnBossBullet(b.x, b.y, angle, 2.5, 'ring', '#ea580c', '#eab308', 5, 0, 0, { maxAge: 999, speedMultiplier: 1.0 });
              }
            }
          }
        }

        // PHASE 3: 深空黑洞与彩虹曼陀罗终焉之光 (Singularity Gravity Collapse & Rainbow Mandala Catastrophe)
        // Option 1 & 2 Fusion: Continuous suction warp + layered rainbow kaleidoscope rings + homing comets
        else {
          const patternStep = b.patternTimer % 300;

          // Ultimate Rainbow Mandala Hex-Star Beams
          if (patternStep === 0) {
            const numRays = 6;
            const startAngle = Math.random() * Math.PI;
            for (let i = 0; i < numRays; i++) {
              const angle = startAngle + (i * (Math.PI * 2) / numRays);
              spawnBossLaser(
                b.x,
                b.y,
                angle,
                0.005, // slow clockwise crawl
                900,
                18,
                200, // extremely grand presence!
                45,  // 45 frames warning
                '#f43f5e',
                '#fda4af'
              );
            }
          }

          if (patternStep === 150) {
            const numRays = 6;
            const startAngle = Math.random() * Math.PI;
            for (let i = 0; i < numRays; i++) {
              const angle = startAngle + (i * (Math.PI * 2) / numRays);
              spawnBossLaser(
                b.x,
                b.y,
                angle,
                -0.005, // counterclockwise crawl
                900,
                18,
                200,
                45,
                '#eab308',
                '#fef08a'
              );
            }
          }

          // Ultimate Multi-Layered Rainbow Mandala Ring on heavy beats
          if (audioStats.isBeatKick) {
            const starPoints = 26;
            // Palette cycling based on stateTime
            const hues = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];
            const color1 = hues[Math.floor(b.stateTime / 15) % hues.length];
            const color2 = hues[(Math.floor(b.stateTime / 15) + 3) % hues.length];
            
            for (let s = 0; s < starPoints; s++) {
              // Outer clockwise ring
              const angle1 = (s * (Math.PI * 2 / starPoints)) + (b.stateTime * 0.05);
              spawnBossBullet(b.x, b.y, angle1, 1.8, 'ring', color1, '#ffffff', 5);
              
              // Inner counter-clockwise ring
              const angle2 = (s * (Math.PI * 2 / starPoints)) - (b.stateTime * 0.05);
              spawnBossBullet(b.x, b.y, angle2, 1.3, 'ring', color2, '#e2e8f0', 4);
            }
          }

          // Chaotic sweep warning lasers during intervals
          b.laserAngle = (b.stateTime * 0.015) % (Math.PI * 2);

          // Homing Starcomet bursts with sparkling trails
          if (patternStep < 150) {
            if (b.patternTimer % 10 === 0) {
              const angleToPlayer = Math.atan2(playerY.current - b.y, playerX.current - b.x);
              // Launch homing comet streams
              const deviations = [-0.25, 0.25];
              deviations.forEach(dev => {
                // Curved homing bullets with small acceleration
                spawnBossBullet(b.x, b.y, angleToPlayer + dev, 1.2, 'curved', '#10b981', '#34d399', 5, 0.03);
              });
            }
          } else if (patternStep >= 150 && patternStep < 270) {
            // High-octane rotating spiral galaxy arms
            if (b.patternTimer % 3 === 0) {
              const arms = 3;
              const baseAngle = (b.stateTime * 0.08);
              for (let a = 0; a < arms; a++) {
                const angle = baseAngle + (a * (Math.PI * 2 / arms));
                // Curving bullets winding outwards
                spawnBossBullet(b.x, b.y, angle, 2.2, 'curved', '#c084fc', '#a855f7', 3.5, 0.01, 0.006);
              }
            }
          }
        }
      }

      // 4. Update Bullet positions, behaviors and hitbox collisions
      let activeBullets = bullets.current;

      // 4b. Update Boss Lasers and collision checks
      bossLasers.current = bossLasers.current.filter((laser) => {
        laser.duration++;
        if (laser.duration > laser.maxDuration) {
          return false;
        }

        // Attach laser source to boss center if close to boss center originally
        const dxToBoss = Math.abs(laser.x - boss.current.x);
        const dyToBoss = Math.abs(laser.y - boss.current.y);
        if (dxToBoss < 120 && dyToBoss < 120) {
          laser.x = boss.current.x;
          laser.y = boss.current.y;
        }

        laser.angle += laser.angularVelocity;

        // Active laser behavior
        if (laser.duration > laser.warningDuration) {
          // If an active bomb is purging, lasers are suppressed (do zero damage)
          if (bombActiveDuration.current <= 0) {
            const closestDist = checkLaserCollision(laser, playerX.current, playerY.current);

            // True hitbox damage
            if (closestDist <= playerRadius && !statsRef.current.isGameOver) {
              if (playerInvulnFrames.current <= 0) {
                statsRef.current.playerHp--;
                playerInvulnFrames.current = 80;
                MusicAudio.playPlayerHurt();
                spawnExplosion(playerX.current, playerY.current, '#ef4444', 35, 4.5, true);
                addFloatingText(playerX.current, playerY.current - 15, "LASER BLASTED!", "#f87171");

                if (statsRef.current.playerHp <= 0) {
                  statsRef.current.isGameOver = true;
                  MusicAudio.playDefeat();
                  addFloatingText(playerX.current, playerY.current, "COMBAT DEFEAT DETECTED", "#ef4444");
                }
              }
            }

            // Graze handling (throttled)
            if (closestDist <= playerShipRadius && closestDist > playerRadius && !statsRef.current.isGameOver) {
              if (localFrame % 8 === 0) {
                statsRef.current.grazeCount++;
                MusicAudio.playGraze();

                let chargeAmount = 2.5;
                if (skills.passive === PassiveCoreType.ABSORBER) {
                  chargeAmount = 6.0;
                }
                statsRef.current.bombCharge = Math.min(100, statsRef.current.bombCharge + chargeAmount);
                statsRef.current.score += 700;
                addFloatingText(playerX.current, playerY.current - 10, "+GRAZE", "#67e8f9");
                spawnExplosion(playerX.current, playerY.current, '#67e8f9', 3, 1, false);
              }
            }
          }
        }

        return true;
      });

      // Update Bomb shockwave boundaries
      if (bombActiveDuration.current > 0) {
        bombActiveDuration.current--;
        bombShockwaveRadius.current += (bounds.current.width * 1.5) / 60; // expand rapidly
      } else {
        bombTriggered.current = false;
      }

      bullets.current = activeBullets.filter((bullet) => {
        // Bomb wipe absorbs and wipes all enemy bullets
        if (bombActiveDuration.current > 0 && bullet.isEnemy) {
          const dx = bullet.x - playerX.current;
          const dy = bullet.y - playerY.current;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bombShockwaveRadius.current) {
            // absorb into visual sparkles
            spawnExplosion(bullet.x, bullet.y, bullet.color, 3, 1, false);
            statsRef.current.score += 20; // scoring bonus for purging bullets!
            return false;
          }
        }

        // Sub Weapon Satellite Shield protection wipes standard tiny incoming enemy bullets
        if (skills.sub === SubWeaponType.SHIELD && bullet.isEnemy && bullet.type !== 'ring') {
          // Calculate satellite 1 and 2 coordinate offsets
          const satRadius = 38;
          const orbitAngle1 = (localFrame * 0.05);
          const orbitAngle2 = (localFrame * 0.05) + Math.PI;

          const sat1x = playerX.current + Math.cos(orbitAngle1) * satRadius;
          const sat1y = playerY.current + Math.sin(orbitAngle1) * satRadius;
          const sat2x = playerX.current + Math.cos(orbitAngle2) * satRadius;
          const sat2y = playerY.current + Math.sin(orbitAngle2) * satRadius;

          const d1x = bullet.x - sat1x;
          const d1y = bullet.y - sat1y;
          const dist1 = Math.sqrt(d1x * d1x + d1y * d1y);

          const d2x = bullet.x - sat2x;
          const d2y = bullet.y - sat2y;
          const dist2 = Math.sqrt(d2x * d2x + d2y * d2y);

          // If close, destroy bullet and trigger small particle
          if (dist1 < 10 || dist2 < 10) {
            spawnExplosion(bullet.x, bullet.y, '#c084fc', 4, 1.2, false);
            statsRef.current.score += 15;
            return false;
          }
        }

        // Sub Weapon: Slow vibration/dilation field on player vessel
        if (skills.sub === SubWeaponType.TIME_DILATION && bullet.isEnemy) {
          const dx = bullet.x - playerX.current;
          const dy = bullet.y - playerY.current;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 75) {
            // Apply heavy braking drag
            if (!bullet.speedMultiplier) {
              bullet.speedMultiplier = 1;
            }
            bullet.speedMultiplier = Math.max(0.35, bullet.speedMultiplier - 0.08); // slow down to 35%
            
            // Visual shift (turn standard orange-ish bullets cool light blue)
            bullet.color = '#38bdf8';
            bullet.glowColor = '#0284c7';
          } else if (bullet.speedMultiplier) {
            // restore speed with delay
            bullet.speedMultiplier = Math.min(1.0, bullet.speedMultiplier + 0.08);
          }
        }

        // Physics movement and age increment of bullet
        if (bullet.isEnemy) {
          bullet.age = (bullet.age !== undefined) ? bullet.age + 1 : 0;

          // Phase 3 Gravitational Black Hole Pull (Option 1 & 2 Fusion Gravity Suction)
          if (boss.current.phase === 3) {
            // Gently attract bullets towards the center vertical axis of the screen for subtle curved warping
            const targetX = bounds.current.width / 2;
            const pullStrength = 0.005; 
            bullet.vx += (targetX - bullet.x) * pullStrength * 0.12;
          }
        }

        // Support custom acceleration
        if (bullet.acceleration && bullet.isEnemy) {
          const mag = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
          if (mag > 0.1) {
            bullet.vx += (bullet.vx / mag) * bullet.acceleration;
            bullet.vy += (bullet.vy / mag) * bullet.acceleration;
          }
        }

        // Support custom angular velocity (for beautiful curved spiral patterns)
        if (bullet.angularVelocity && bullet.isEnemy) {
          const currentVel = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
          let currentAngle = Math.atan2(bullet.vy, bullet.vx);
          currentAngle += bullet.angularVelocity;
          bullet.vx = Math.cos(currentAngle) * currentVel;
          bullet.vy = Math.sin(currentAngle) * currentVel;
        }

        // Phase 2 Expand & Brake Bullets handling (Tempo modulation)
        if (bullet.isEnemy && bullet.type === 'ring' && bullet.maxAge === 999 && bullet.age !== undefined) {
          if (bullet.age > 24 && bullet.age <= 40) {
            bullet.speedMultiplier = Math.max(0.01, (bullet.speedMultiplier || 1.0) - 0.08);
          } else if (bullet.age > 40 && bullet.age <= 55) {
            bullet.speedMultiplier = 0.01;
            bullet.color = '#c084fc';
            bullet.glowColor = '#7c3aed';
          } else if (bullet.age > 55) {
            bullet.speedMultiplier = Math.min(1.8, (bullet.speedMultiplier || 0.0) + 0.15);
            bullet.color = '#ec4899';
            bullet.glowColor = '#f43f5e';
          }
        }

        const spdMult = bullet.speedMultiplier || 1.0;
        bullet.x += bullet.vx * spdMult;
        bullet.y += bullet.vy * spdMult;

        // Curved bullets modify angles gently with sinuous lateral weaving
        if (bullet.type === 'curved' && bullet.isEnemy) {
          const currentVel = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
          const currentAngle = Math.atan2(bullet.vy, bullet.vx);
          // Apply elegant wave weave to side directories
          const uniqueOffset = (bullet.id.charCodeAt(0) || 0) * 10;
          const waveAngle = currentAngle + Math.sin((localFrame + uniqueOffset) * 0.12) * 0.035;
          bullet.vx = Math.cos(waveAngle) * currentVel;
          bullet.vy = Math.sin(waveAngle) * currentVel;
        }

        // Mid-air bullet splitting (fission petals) when bullet reaches maxAge
        if (bullet.isEnemy && bullet.maxAge && bullet.age && bullet.age >= bullet.maxAge) {
          const splits = 6;
          for (let s = 0; s < splits; s++) {
            const splitAngle = (s * (Math.PI * 2 / splits)) + (localFrame * 0.02);
            bullets.current.push({
              id: Math.random().toString(),
              x: bullet.x,
              y: bullet.y,
              vx: Math.cos(splitAngle) * 1.8,
              vy: Math.sin(splitAngle) * 1.8,
              radius: 3,
              color: '#ec4899',
              glowColor: '#db2777',
              isEnemy: true,
              damage: 1,
              type: 'standard',
              age: 0,
            });
          }
          // Visual debris explosion sparks
          for (let i = 0; i < 6; i++) {
            particles.current.push({
              x: bullet.x,
              y: bullet.y,
              vx: (Math.random() * 2.5 - 1.25),
              vy: (Math.random() * 2.5 - 1.25),
              radius: 1.5,
              color: '#f472b6',
              alpha: 1,
              life: 15,
              maxLife: 15,
            });
          }
          return false; // Absorb parent splitting seed
        }

        // --- HIT DETECTION & COLLISION MATRIX ---
        if (bullet.isEnemy) {
          // Distances to player core (extremely strict 3px hitbox) and player ship radius (14px graze)
          const dx = bullet.x - playerX.current;
          const dy = bullet.y - playerY.current;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // 1. Graze system (very near-miss, increases score and charges ultimate bomb!)
          if (dist <= playerShipRadius && dist > playerRadius && !bullet.grazeDone && !statsRef.current.isGameOver) {
            bullet.grazeDone = true;
            statsRef.current.grazeCount++;
            MusicAudio.playGraze();

            // Passive Core check
            let chargeAmount = 2.5;
            if (skills.passive === PassiveCoreType.ABSORBER) {
              chargeAmount = 6.0; // Over double fuel absorption!
            }
            statsRef.current.bombCharge = Math.min(100, statsRef.current.bombCharge + chargeAmount);
            statsRef.current.score += 800; // heavy score multiplier on daring maneuvers!
            
            // Sparkles floaters
            addFloatingText(bullet.x, bullet.y - 10, "+GRAZE", "#67e8f9");
            spawnExplosion(bullet.x, bullet.y, '#67e8f9', 3, 1, false);
          }

          // 2. Main Hitbox collision
          if (dist <= playerRadius && !statsRef.current.isGameOver) {
            if (playerInvulnFrames.current <= 0) {
              // Deduct health
              statsRef.current.playerHp--;
              playerInvulnFrames.current = 80; // 1.3 seconds frames safety period
              MusicAudio.playPlayerHurt();
              spawnExplosion(playerX.current, playerY.current, '#ef4444', 35, 4.5, true);
              addFloatingText(playerX.current, playerY.current - 15, "SHIELD HIT!", "#f87171");

              // Shake Grid indicator
              if (statsRef.current.playerHp <= 0) {
                statsRef.current.isGameOver = true;
                MusicAudio.playDefeat();
                addFloatingText(playerX.current, playerY.current, "COMBAT DEFEAT DETECTED", "#ef4444");
              }
            }
            return false; // delete hitting bullet
          }
        } else {
          // Playable ship friendly bullets heading to hit the Boss core
          const b = boss.current;
          const dx = bullet.x - b.x;
          const dy = bullet.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= b.radius && !statsRef.current.isGameOver && !statsRef.current.isVictory) {
            // Apply damage
            b.hp -= bullet.damage;
            statsRef.current.score += Math.floor(bullet.damage * 4.5);
            
            // Custom item collection passive: Magnet (draws score to cargo)
            if (skills.passive === PassiveCoreType.MAGNET && Math.random() < 0.12) {
              statsRef.current.score += 250;
              addFloatingText(bullet.x, bullet.y, "+MAGNET CORE", "#38bdf8");
            }

            // Hurt indicators
            if (Math.random() > 0.8) {
              MusicAudio.playBossHurt();
              spawnExplosion(bullet.x, bullet.y, bullet.color, 4, 2, false);
            }

            // Phase transition trigger checks
            if (b.hp <= 0) {
              MusicAudio.playPhaseTransition();
              bullets.current = []; // purge screens
              bossLasers.current = []; // purge active lasers
              spawnExplosion(b.x, b.y, '#818cf8', 50, 6, true);

              if (b.phase < 3) {
                b.phase++;
                b.hp = b.phaseMaxHp[b.phase - 1];
                b.maxHp = b.phaseMaxHp[b.phase - 1];
                b.patternTimer = 0;
                addFloatingText(b.x, b.y - 25, `STAGE WARNING: PHASE ${b.phase} INITIATED`, "#ff2e63");
                MusicAudio.setBossPhase(b.phase);
              } else {
                // Game victory!
                statsRef.current.isVictory = true;
                MusicAudio.playVictory();
                addFloatingText(b.x, b.y, "CRITICAL OUTCOME: SYSTEM CLEARED!", "#10b981");
                spawnExplosion(b.x, b.y, '#eab308', 100, 8, true);
                
                // Compare highscore
                if (statsRef.current.score > statsRef.current.highScore) {
                  localStorage.setItem('shmup_highscore', statsRef.current.score.toString());
                  statsRef.current.highScore = statsRef.current.score;
                }
              }
            }

            return false; // delete hitting bullet
          }
        }

        // Screen boundary safety filters
        return (
          bullet.y > -30 &&
          bullet.y < bounds.current.height + 30 &&
          bullet.x > -30 &&
          bullet.x < bounds.current.width + 30
        );
      });

      // 5. Update homing missiles steering angles
      bullets.current.forEach(bullet => {
        if (bullet.type === 'missile' && !bullet.isEnemy) {
          const b = boss.current;
          const targetAngle = Math.atan2(b.y - bullet.y, b.x - bullet.x);
          
          // Interpolate angle steering
          if (bullet.angle !== undefined) {
            let diff = targetAngle - bullet.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            bullet.angle += diff * 0.12; // curve rate
            
            const curSpd = 6.2;
            bullet.vx = Math.cos(bullet.angle) * curSpd;
            bullet.vy = Math.sin(bullet.angle) * curSpd;
          }
        }
      });

      // 6. Update Particle Lifespans
      particles.current = particles.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97; // air resistance decay
        p.life--;
        p.alpha = Math.max(0, p.life / p.maxLife);
        return p.life > 0;
      });

      // 7. Update Float Texts
      floatingTexts.current = floatingTexts.current.filter((t) => {
        t.y -= 0.6; // ascend out
        t.life--;
        t.alpha = Math.max(0, t.life / 45);
        return t.life > 0;
      });

      // Sync React state for render
      setGameState({ ...statsRef.current });
      setBossHpState({
        hp: boss.current.hp,
        maxHp: boss.current.maxHp,
        phase: boss.current.phase,
      });

      // 8. RENDER CANVAS GRAPHICS
      renderCanvas(audioStats);

      animId = requestAnimationFrame(updateGame);
    };

    // CANVAS DRAW ENGINE
    const renderCanvas = (audioStats: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cw = bounds.current.width;
      const ch = bounds.current.height;

      // Dark sci-fi cosmic background clear
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, cw, ch);

      // A. Rhythmic visual neon grids that stretch/shift with the music amplitude!
      const amp = audioStats.currentFreqAmplitude; // 0 to 1
      const gridDensity = 32;
      const stretch = amp * 12; // stretch vertices on beats

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.05)';
      if (boss.current.phase === 2) ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      if (boss.current.phase === 3) ctx.strokeStyle = 'rgba(244, 63, 94, 0.05)';
      ctx.lineWidth = 1;

      // Vertical grids warping slightly outwards from boss center depending on beat kick
      for (let x = 0; x < cw + gridDensity; x += gridDensity) {
        ctx.beginPath();
        for (let y = 0; y < ch; y += 40) {
          const dx = x - cw/2;
          const dist = Math.abs(dx);
          const warpOffset = (dist > 0) ? (dx / dist) * Math.sin(y / ch * Math.PI) * stretch : 0;
          
          if (y === 0) ctx.moveTo(x + warpOffset, y);
          else ctx.lineTo(x + warpOffset, y);
        }
        ctx.stroke();
      }

      // Horizontal grids warping on beat Kick
      for (let y = 0; y < ch; y += gridDensity) {
        ctx.beginPath();
        for (let x = 0; x < cw; x += 40) {
          const dy = y - ch/2;
          const dist = Math.abs(dy);
          const warpOffset = (dist > 0) ? (dy / dist) * Math.sin(x / cw * Math.PI) * stretch : 0;

          if (x === 0) ctx.moveTo(x, y + warpOffset);
          else ctx.lineTo(x, y + warpOffset);
        }
        ctx.stroke();
      }

      // B. Ambient expanding concentric sound waves radiating out from the Boss core
      const bossRadiusPulse = boss.current.radius * boss.current.pulseScale;
      ctx.strokeStyle = `rgba(139, 92, 246, ${Math.max(0, 0.18 - (localFrame % 60) * 0.003)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(boss.current.x, boss.current.y, bossRadiusPulse + (localFrame % 60) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // C. Target warning tracking lasers or sweeping geometric grid on Stage 2 Charging
      if (boss.current.phase === 2) {
        const laserLen = bounds.current.height;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.lineWidth = 1.5 + (amp * 2);
        
        ctx.save();
        ctx.translate(boss.current.x, boss.current.y);
        ctx.rotate(boss.current.laserAngle);
        
        // Quad crosshairs laser swept lines
        const directions = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        directions.forEach(dir => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(dir) * laserLen, Math.sin(dir) * laserLen);
          ctx.stroke();
        });
        ctx.restore();
      }

      // D. Draw Active Purge Bomb Shockwave
      if (bombActiveDuration.current > 0) {
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#d946ef';
        ctx.strokeStyle = `rgba(217, 70, 239, ${bombActiveDuration.current / 60})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(playerX.current, playerY.current, bombShockwaveRadius.current, 0, Math.PI * 2);
        ctx.stroke();

        // draw filling gradient glow
        ctx.fillStyle = `rgba(217, 70, 239, ${0.07 * (bombActiveDuration.current / 60)})`;
        ctx.fill();
        ctx.restore();
      }

      // E. Draw Boss Vessel Outer Shell and Glowing Energy Core
      if (!statsRef.current.isVictory) {
        const b = boss.current;
        ctx.save();
        ctx.shadowBlur = 20;
        
        let bossCoreColor = '#c084fc';
        let bossOuterColor = '#7c3aed';
        if (b.phase === 2) {
          bossCoreColor = '#38bdf8';
          bossOuterColor = '#2563eb';
        } else if (b.phase === 3) {
          bossCoreColor = '#f43f5e';
          bossOuterColor = '#9f1239';
        }
        
        ctx.shadowColor = bossCoreColor;

        // Draw mechanical side orbits / shielding pods
        ctx.fillStyle = bossOuterColor;
        const orbitOffset = Math.sin(localFrame * 0.04) * 22;
        
        // Guard wings
        ctx.beginPath();
        ctx.rect(b.x - 55 - orbitOffset, b.y - 8, 16, 16);
        ctx.rect(b.x + 39 + orbitOffset, b.y - 8, 16, 16);
        ctx.fill();

        // Connector lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x - 55 - orbitOffset, b.y);
        ctx.lineTo(b.x + 39 + orbitOffset, b.y);
        ctx.stroke();

        // Draw main body (complex multi-stage crystal geometric star)
        ctx.fillStyle = bossOuterColor;
        ctx.beginPath();
        const pts = 8;
        const iR = b.radius / 1.7 * b.pulseScale;
        const oR = b.radius * b.pulseScale;
        for (let i = 0; i < pts * 2; i++) {
          const angle = (i * Math.PI / pts) + (localFrame * 0.015);
          const r = i % 2 === 0 ? oR : iR;
          const px = b.x + Math.cos(angle) * r;
          const py = b.y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Concentric bright energy core star
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        const innerPts = 4;
        const inIR = 6;
        const inOR = 15;
        for (let i = 0; i < innerPts * 2; i++) {
          const angle = (i * Math.PI / innerPts) - (localFrame * 0.04);
          const r = i % 2 === 0 ? inOR : inIR;
          ctx.lineTo(b.x + Math.cos(angle) * r, b.y + Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // F. Render Player Ship & Jet Particle Thruster
      if (!statsRef.current.isGameOver) {
        ctx.save();
        const flicker = localFrame % 4 === 0;

        // Blinking indicator if invulnerable
        if (playerInvulnFrames.current <= 0 || !flicker) {
          // Draw sub-weapon satellite models rotating visually
          if (skills.sub === SubWeaponType.SHIELD) {
            const orbitAngle1 = (localFrame * 0.05);
            const orbitAngle2 = (localFrame * 0.05) + Math.PI;
            const radius = 38;

            ctx.fillStyle = '#c084fc';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#a855f7';

            // Drone Satellite 1
            ctx.beginPath();
            const s1x = playerX.current + Math.cos(orbitAngle1) * radius;
            const s1y = playerY.current + Math.sin(orbitAngle1) * radius;
            ctx.arc(s1x, s1y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Drone Satellite 2
            ctx.beginPath();
            const s2x = playerX.current + Math.cos(orbitAngle2) * radius;
            const s2y = playerY.current + Math.sin(orbitAngle2) * radius;
            ctx.arc(s2x, s2y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
          }

          // Slow distortion circle preview
          if (skills.sub === SubWeaponType.TIME_DILATION) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.02)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(playerX.current, playerY.current, 75, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fill();
          }

          // Flame jet booster
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(playerX.current - 4, playerY.current + 6);
          ctx.lineTo(playerX.current, playerY.current + 16 + (Math.sin(localFrame * 0.6) * 4));
          ctx.lineTo(playerX.current + 4, playerY.current + 6);
          ctx.fill();

          // Fighter Jet Wings model
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(playerX.current, playerY.current - 14); // head nose
          ctx.lineTo(playerX.current - 14, playerY.current + 10); // wing outer L
          ctx.lineTo(playerX.current - 4, playerY.current + 6);
          ctx.lineTo(playerX.current + 4, playerY.current + 6);
          ctx.lineTo(playerX.current + 14, playerY.current + 10); // wing outer R
          ctx.closePath();
          ctx.fill();

          // Chrome panel design elements overlay
          ctx.fillStyle = '#93c5fd';
          ctx.beginPath();
          ctx.moveTo(playerX.current, playerY.current - 10);
          ctx.lineTo(playerX.current - 3, playerY.current + 3);
          ctx.lineTo(playerX.current + 3, playerY.current + 3);
          ctx.closePath();
          ctx.fill();

          // G. TRUE HITBOX CYAN CORE (Danmaku games center highlight is tiny and bright!)
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#22d3ee';
          ctx.fillStyle = '#ffffff';
          
          ctx.beginPath();
          ctx.arc(playerX.current, playerY.current, playerRadius, 0, Math.PI * 2);
          ctx.fill();

          // Draw graze radius visual ring (helpful boundary reminder)
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(playerX.current, playerY.current, playerShipRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // F2. Render Boss Lasers
      bossLasers.current.forEach((laser) => {
        ctx.save();
        const ax = laser.x;
        const ay = laser.y;
        const bx = laser.x + Math.cos(laser.angle) * laser.length;
        const by = laser.y + Math.sin(laser.angle) * laser.length;

        if (laser.duration <= laser.warningDuration) {
          // A. Laser Warning Phase
          const remainingPct = 1 - (laser.duration / laser.warningDuration);
          const flash = Math.sin(localFrame * 0.3) * 0.4 + 0.6; // heavy hot pulsating

          // Faint fill warning corridor so player knows width
          ctx.strokeStyle = laser.glowColor;
          ctx.globalAlpha = 0.06 * remainingPct;
          ctx.lineWidth = laser.width;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();

          // High contrast razor-thin dotted guide line
          ctx.strokeStyle = '#ef4444';
          ctx.globalAlpha = 0.5 * flash;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.setLineDash([]); // reset dash patterns
        } else {
          // B. Laser Active High-Energy Phase
          // Crackling dynamic size fluctuation for electric power feeling!
          const crackle = Math.sin(localFrame * 0.5 + laser.duration) * 3;
          const currentWidth = Math.max(4, laser.width + crackle);

          // Phase-out fade before ending
          const fadeFrames = 15;
          let alpha = 1.0;
          if (laser.maxDuration - laser.duration < fadeFrames) {
            alpha = (laser.maxDuration - laser.duration) / fadeFrames;
          }

          ctx.globalAlpha = alpha;
          ctx.lineCap = 'round';

          // Outer glowing aura
          ctx.shadowBlur = 18;
          ctx.shadowColor = laser.glowColor;
          ctx.strokeStyle = laser.glowColor;
          ctx.lineWidth = currentWidth;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();

          // Mid-energy core
          ctx.strokeStyle = laser.color;
          ctx.lineWidth = currentWidth * 0.6;
          ctx.shadowBlur = 0; // turn off shadow blur for faster rendering on lower cores
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();

          // Ultra white super-hot center core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = currentWidth * 0.25;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
        ctx.restore();
      });

      // G. Render All Active Projectiles
      bullets.current.forEach((b) => {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.glowColor;
        ctx.fillStyle = b.color;

        if (b.type === 'laser') {
          // Thick linear streak beam
          ctx.beginPath();
          ctx.rect(b.x - 3, b.y, 6, 24);
          ctx.fill();
        } else if (b.type === 'wave') {
          // Massive expanding crescent arc wave
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 4;
          ctx.shadowBlur = 16;
          ctx.beginPath();
          // crescent sweep path
          ctx.arc(b.x, b.y, b.radius, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        } else if (b.type === 'missile') {
          // Green rocket model with smoke particle tail
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
          
          // spawn small tail sparks
          if (Math.random() > 0.45) {
            particles.current.push({
              x: b.x,
              y: b.y + 6,
              vx: (Math.random() * 0.8 - 0.4),
              vy: 1.5,
              radius: 1.0,
              color: 'rgba(74, 222, 128, 0.4)',
              alpha: 0.8,
              life: 15,
              maxLife: 15,
            });
          }
        } else {
          // Circular glow bullet
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // H. Render Explosions and Sparks
      particles.current.forEach((p) => {
        ctx.save();
        if (p.glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // I. Render Floating Texts Overlay
      floatingTexts.current.forEach((t) => {
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.color;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      });

      // J. Rhythmic visual analyzer block on bottom edge (Synthesizer representation)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      if (boss.current.phase === 3) ctx.fillStyle = 'rgba(244, 63, 94, 0.1)';
      ctx.fillRect(0, ch - 8, cw * amp, 4);

      // Sound label indicator
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = '8px monospace';
      ctx.fillText(`SYNTH CHORD: ${audioStats.chordName} | GRID WARP: ${(amp * 100).toFixed(0)}%`, 14, ch - 16);
    };

    // Begin loop queue
    updateGame();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [skills, controlMode, isPaused]);

  // Touch and Mouse tracking event capture
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mousePosition.current.x = e.clientX - rect.left;
    mousePosition.current.y = e.clientY - rect.top;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.touches.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mousePosition.current.x = e.touches[0].clientX - rect.left;
    mousePosition.current.y = e.touches[0].clientY - rect.top;
  };

  // Convert boss HP to ratio percentage
  const getBossHpRatio = () => {
    return (bossHpState.hp / bossHpState.maxHp) * 100;
  };

  return (
    <div className="flex flex-col xl:flex-row gap-5 p-4 max-w-7xl w-full select-none bg-black/40 font-sans text-gray-200 rounded-2xl border border-white/10 shadow-3xl backdrop-blur-md overflow-hidden">
      
      {/* COLUMN 1: Real-time React Game Control & stats Sidebar */}
      <div className="w-full xl:w-72 flex flex-col gap-4 order-2 xl:order-1">
        
        {/* Module A: Active Pilot Profile */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center bg-white/5 text-cyan-400">
            <Radio className="animate-pulse" size={16} />
          </div>
          <div>
            <div className="text-[9px] text-white/40 font-mono tracking-[0.25em] uppercase">TACTICAL OPERATIVE</div>
            <div className="font-medium text-xs text-white uppercase tracking-wider">SYSTEM LINK OK</div>
            <div className="text-[9px] text-cyan-400/80 font-mono tracking-tight">Intensity level: {gameState.difficulty.toFixed(2)}x</div>
          </div>
        </div>

        {/* Module B: Combat statistics stats display */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="border-b border-white/5 pb-2 flex justify-between items-center">
            <span className="text-[9px] font-mono tracking-[0.2em] text-white/40">COMBAT TELEMETRY</span>
            <span className="text-[8px] font-mono tracking-wider text-cyan-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase">LIVE FEED</span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div>
              <div className="text-[9px] text-white/40 uppercase tracking-widest">SCORE / 目前得分</div>
              <div className="text-xl font-light text-white tracking-tight tabular-nums mt-1">
                {gameState.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-white/40 uppercase tracking-widest">BEST / 历史纪录</div>
              <div className="text-xl font-light text-white/60 tracking-tight tabular-nums mt-1">
                {gameState.highScore.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2.5 border-t border-white/5 text-xs font-mono">
            <div className="flex justify-between items-center text-gray-400">
              <span className="text-[10px] uppercase tracking-wider text-white/60">擦弹计数 GRAZES:</span>
              <span className="text-cyan-400 font-medium text-xs bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {gameState.grazeCount}
              </span>
            </div>

            <div className="flex justify-between items-center text-gray-400">
              <span className="text-[10px] uppercase tracking-wider text-white/60">难度系数 MULTIPLIER:</span>
              <span className="text-purple-400 font-bold">{gameState.difficulty.toFixed(1)}x</span>
            </div>
          </div>
        </div>

        {/* Module C: Skill Combination Visualizer */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 text-xs">
          <div className="text-[9px] font-mono tracking-[0.2em] uppercase text-purple-400 flex items-center gap-1.5">
            <Zap size={11} className="text-purple-400" /> Active System Combinator
          </div>
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="p-2 rounded bg-black/40 border border-white/5 border-l-2 border-l-amber-500 text-amber-200">
              W-CORE: {skills.main === MainWeaponType.SPREAD ? '星弧五路散射' : skills.main === MainWeaponType.LASER ? '聚能微子极光束' : '重力斩弦月空能波'}
            </div>
            <div className="p-2 rounded bg-black/40 border border-white/5 border-l-2 border-l-purple-500 text-purple-200">
              S-POD: {skills.sub === SubWeaponType.MISSILE ? '热动力微型导弹' : skills.sub === SubWeaponType.SHIELD ? '相位共振力场浮游炮' : '时空坍缩阻尼星圈'}
            </div>
            <div className="p-2 rounded bg-black/40 border border-white/5 border-l-2 border-l-cyan-500 text-cyan-200">
              L-CORE: {skills.passive === PassiveCoreType.OVERCHARGE ? '重低音超能速过载' : skills.passive === PassiveCoreType.ABSORBER ? '擦弹裂变炸弹回路' : '极星极点磁引力核'}
            </div>
          </div>
        </div>

        {/* Module D: Active Inputs calibration option */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 block">DECISION CONTROL MODULE</span>
          <div className="flex gap-2">
            <button
              id="mouse-ctrl-btn"
              onClick={() => setControlMode('mouse')}
              className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                controlMode === 'mouse'
                  ? 'bg-white text-black font-semibold'
                  : 'bg-black/40 border border-white/5 text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              鼠标/触控
            </button>
            <button
              id="keyboard-ctrl-btn"
              onClick={() => setControlMode('keyboard')}
              className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                controlMode === 'keyboard'
                  ? 'bg-white text-black font-semibold'
                  : 'bg-black/40 border border-white/5 text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              键盘 WASD
            </button>
          </div>
          
          <div className="text-[10px] text-gray-400 leading-relaxed bg-black/40 border border-white/5 p-2.5 rounded-lg font-mono">
            {controlMode === 'mouse' ? (
              <p>🖲️ 指针移动即刻牵引导航。推荐移动端或追求擦弹走位极致的玩家。</p>
            ) : (
              <p>⌨️ WASD/方向控制。按住 <strong className="text-cyan-400">Shift</strong> 启动微型慢速导航。按 <strong className="text-cyan-400">Space/K</strong> 施放炸弹。</p>
            )}
          </div>
        </div>

        {/* Module E: Exit action button */}
        <button
          id="exit-game-btn"
          onClick={onExit}
          className="w-full mt-auto py-2.5 px-3 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-white/80 text-[10px] font-mono tracking-[0.2em] uppercase rounded-lg transition-all duration-200 cursor-pointer"
        >
          &lt; 返回武器舱配置 (RETREAT)
        </button>
      </div>

      {/* COLUMN 2: Gorgeous Core Gameplay Screen with top Boss HUD */}
      <div className="flex-1 flex flex-col justify-between items-center order-1 xl:order-2">
        {/* Dynamic Boss stage header HP meter */}
        <div className="w-full p-4 rounded-xl bg-white/5 border border-white/10 mb-3 space-y-2.5 relative backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-[10px] font-mono text-red-500 font-bold uppercase tracking-[0.2em]">
                STAGE BOSS: COGNITIVE OVERLORD (多维支配者)
              </span>
            </div>
            <span className="text-[9px] font-mono text-white/40 bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase tracking-wider">
              PHASE {bossHpState.phase} / 3
            </span>
          </div>

          {/* Master HP health progressive bar */}
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px] shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                bossHpState.phase === 1
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  : bossHpState.phase === 2
                  ? 'bg-gradient-to-r from-blue-500 to-pink-500'
                  : 'bg-gradient-to-r from-red-600 to-amber-500'
              }`}
              style={{ width: `${getBossHpRatio()}%` }}
            />
          </div>
          
          <div className="flex justify-between text-[9px] font-mono text-white/40 uppercase tracking-wider">
            <span>CORE INTEGRITY MONITOR:</span>
            <span>{Math.max(0, bossHpState.hp)} / {bossHpState.maxHp} HP</span>
          </div>
        </div>

        {/* Canvas stage board */}
        <div
          ref={containerRef}
          className="relative w-full aspect-[4/5] xl:h-[680px] xl:aspect-[3/4] bg-black border border-white/10 rounded-2xl overflow-hidden focus:outline-none shadow-[0_0_50px_rgba(255,255,255,0.02)] cursor-crosshair"
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            width={600}
            height={800}
            className="w-full h-full block"
          />

          {/* Overlay elements (e.g. Pause, Game Over, Victory states) */}
          {gameState.isGameOver && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-white/5 text-red-500 flex items-center justify-center border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)] mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-2xl font-light text-red-500 tracking-wide uppercase mb-2 font-sans">自机生命值已归零</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-6 leading-relaxed font-sans">
                自机量子核心在密集的高级弹幕阻击下发生严重坍缩，请重新调试武器系统并再次发起挑战。
              </p>
              
              <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 mb-6 font-mono text-[11px] max-w-xs w-full text-left space-y-1.5 shadow-lg">
                <div className="text-[9px] text-white/40 uppercase tracking-widest pb-1 border-b border-white/5">BATTLE OUTCOME / 战局结算</div>
                <div className="flex justify-between"><span>得分 SCORE:</span> <span className="text-white font-medium">{gameState.score}</span></div>
                <div className="flex justify-between"><span>擦弹 GRAZES:</span> <span className="text-cyan-400">{gameState.grazeCount}</span></div>
                <div className="flex justify-between"><span>最高纪录 BEST:</span> <span className="text-white/60">{gameState.highScore}</span></div>
              </div>

              <div className="flex gap-3 w-full max-w-sm">
                <button
                  id="restart-game-over-btn"
                  onClick={handleRestart}
                  className="flex-1 py-3 px-4 font-mono font-medium text-xs tracking-[0.2em] bg-white text-black hover:bg-gray-100 rounded-lg flex items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-all cursor-pointer uppercase"
                >
                  <RotateCcw size={13} />
                  再次校准并重启 (RE-ATTEMPT)
                </button>
                <button
                  id="exit-game-over-btn"
                  onClick={onExit}
                  className="py-3 px-4 text-[10px] font-mono tracking-widest uppercase border border-white/10 bg-black text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                >
                  返回船舱
                </button>
              </div>
            </div>
          )}

          {gameState.isVictory && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-white/5 text-amber-500 flex items-center justify-center border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)] mb-4 animate-pulse">
                <Star size={24} fill="currentColor" />
              </div>
              <h3 className="text-2xl font-serif italic text-amber-400 tracking-wide uppercase mb-2">超限支配者——歼灭达成！</h3>
              <p className="text-xs text-green-300/85 max-w-md mb-6 leading-relaxed font-sans">
                你成功击败了所有三个抗性的阶段BOSS，华丽的动作与精准的节奏走位无懈可击。你已被列入传奇设计师名人堂！
              </p>

              <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 mb-6 font-mono text-[11px] max-w-xs w-full text-left space-y-1.5 shadow-lg">
                <div className="text-[9px] text-white/40 uppercase tracking-widest pb-1 border-b border-white/5">Mastery Report / 主控大师报告</div>
                <div className="flex justify-between"><span>总得分 TOTAL SCORE:</span> <span className="text-white font-medium">{gameState.score}</span></div>
                <div className="flex justify-between"><span>致命微闪 GRAZES:</span> <span className="text-cyan-400 font-bold">{gameState.grazeCount}</span></div>
                <div className="flex justify-between"><span>被动配合 TAG:</span> <span className="text-purple-400 uppercase">{skills.passive}</span></div>
              </div>

              <div className="flex gap-3 w-full max-w-sm">
                <button
                  id="restart-victory-btn"
                  onClick={handleRestart}
                  className="flex-1 py-3 px-4 font-mono font-medium text-xs tracking-[0.2em] bg-white text-black hover:bg-gray-100 rounded-lg flex items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-all cursor-pointer uppercase"
                >
                  <RotateCcw size={13} />
                  无伤重演 (REPLAY)
                </button>
                <button
                  id="exit-victory-btn"
                  onClick={onExit}
                  className="py-3 px-4 text-[10px] font-mono tracking-widest uppercase border border-white/10 bg-black text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                >
                  退出结算
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom player self-status utility HUD display */}
        <div className="w-full mt-3 grid grid-cols-3 gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono backdrop-blur-sm">
          <div className="space-y-1">
            <span className="text-white/40 text-[9px] uppercase tracking-[0.15em] block">
              自机护盾 HP BAR
            </span>
            <div className="flex items-center gap-1.5 pt-1">
              {gameState.playerMaxHp > 10 ? (
                <div className="flex items-center gap-2">
                  <div className="h-[14px] w-[14px] rounded-md border flex items-center justify-center bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    <Shield size={8} className="text-black" />
                  </div>
                  <span className="text-cyan-400 font-bold text-[11px] tracking-wide">{gameState.playerHp} / {gameState.playerMaxHp}</span>
                </div>
              ) : (
                [...Array(gameState.playerMaxHp)].map((_, idx) => {
                  const filled = idx < gameState.playerHp;
                  return (
                    <div
                      key={idx}
                      className={`h-[14px] w-[14px] rounded-md border flex items-center justify-center transition-all duration-300 ${
                        filled
                          ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                          : 'bg-black/40 border-white/10'
                      }`}
                    >
                      {filled && <Shield size={8} className="text-black" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1 text-center">
            <span className="text-white/40 text-[9px] uppercase tracking-[0.15em] block">
              擦弹裂聚 BOMB ENERGY
            </span>
            {/* bomb charging bar */}
            <div className="relative h-[14px] bg-white/5 rounded-md border border-white/10 overflow-hidden p-[1px] mt-1">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded transition-all duration-100"
                style={{ width: `${gameState.bombCharge}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white shadow-sm drop-shadow-md">
                {gameState.bombCharge === 100 ? "READY [K/SPACE]" : `${Math.floor(gameState.bombCharge)}%`}
              </span>
            </div>
          </div>

          {/* bomb clear button */}
          <div className="flex flex-col items-end">
            <span className="text-white/40 text-[9px] uppercase tracking-[0.15em] block w-full text-right">
              紧急超限爆弹 CHARGE
            </span>
            <button
              id="trigger-bomb-btn"
              onClick={triggerBomb}
              className={`py-1 px-3 mt-1 rounded text-[9px] font-mono font-medium transition-all duration-200 w-full flex items-center justify-center gap-1 uppercase ${
                gameState.bombCharge >= 100 || gameState.bombsLeft > 0
                  ? 'bg-white text-black hover:bg-gray-100 shadow-md cursor-pointer'
                  : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
              }`}
            >
              <Zap size={10} fill="currentColor" />
              ULT_SPARK ({gameState.bombsLeft})
            </button>
          </div>
        </div>
      </div>

      {/* Floating global controls header icon toggles */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          id="sound-toggle-btn"
          onClick={toggleMute}
          className="p-2.5 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white backdrop-blur-sm transition-all cursor-pointer"
          title={isMuted ? "开启声音" : "静音"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="animate-pulse text-cyan-400" />}
        </button>
      </div>
    </div>
  );
}
