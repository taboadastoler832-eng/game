/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum MainWeaponType {
  SPREAD = 'SPREAD',       // 散弹发射
  LASER = 'LASER',         // 聚焦激光
  WAVE = 'WAVE',           // 波动斩
}

export enum SubWeaponType {
  MISSILE = 'MISSILE',     // 导弹追踪
  SHIELD = 'SHIELD',       // 轨道盾牌
  TIME_DILATION = 'TIME',  // 区域减速
}

export enum PassiveCoreType {
  OVERCHARGE = 'OVERCHARGE', // 律动超载 (射速随BPM上升)
  ABSORBER = 'ABSORBER',     // 擦弹聚能 (Graze积攒大招)
  MAGNET = 'MAGNET',         // 晶体引力 (磁力吸引)
}

export interface PlayerSkills {
  main: MainWeaponType;
  sub: SubWeaponType;
  passive: PassiveCoreType;
}

export interface Position {
  x: number;
  y: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  isEnemy: boolean;
  damage: number;
  type: 'standard' | 'laser' | 'missile' | 'wave' | 'ring' | 'curved';
  angle?: number;
  angularVelocity?: number;
  speedMultiplier?: number;
  acceleration?: number;
  scale?: number;
  grazeDone?: boolean; // Label for player grazing
  age?: number;
  maxAge?: number;
}

export interface BossLaser {
  id: string;
  x: number;
  y: number;
  angle: number;
  angularVelocity: number;
  length: number;
  width: number;
  maxDuration: number;
  warningDuration: number;
  duration: number;
  color: string;
  glowColor: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  glow?: boolean;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
}

export interface Drone {
  angle: number;
  distance: number;
}

export interface Boss {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  phase: number; // 1, 2, 3
  phaseMaxHp: number[];
  stateTime: number;
  patternTimer: number;
  laserAngle: number;
  pulseScale: number;
}

export interface GameState {
  score: number;
  highScore: number;
  grazeCount: number;
  bombCharge: number; // 0 to 100
  bombsLeft: number;
  playerHp: number;
  playerMaxHp: number;
  isGameOver: boolean;
  isVictory: boolean;
  gameTime: number;
  difficulty: number;
}

export interface AudioStats {
  bpm: number;
  beatIndex: number;
  isBeatKick: boolean;
  isBeatSnare: boolean;
  currentFreqAmplitude: number; // 0 to 1 dynamic
  chordName: string;
}
