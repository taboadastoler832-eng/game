/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MainWeaponType, SubWeaponType, PassiveCoreType, PlayerSkills } from './types';
import SkillConfig from './components/SkillConfig';
import GameCanvas from './components/GameCanvas';
import { Sparkles, Music, Star, Volume2, Gamepad2, Settings, Crosshair, ThumbsUp } from 'lucide-react';
import { MusicAudio } from './audio';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'config' | 'playing'>('menu');
  const [skills, setSkills] = useState<PlayerSkills>({
    main: MainWeaponType.SPREAD,
    sub: SubWeaponType.MISSILE,
    passive: PassiveCoreType.OVERCHARGE,
  });

  // Background particles on main menu
  const [starCount, setStarCount] = useState<number[]>([]);

  useEffect(() => {
    // Generate static array of stars offsets
    const stars = Array.from({ length: 40 }).map(() => Math.random() * 100);
    setStarCount(stars);
  }, []);

  const handleStartConfig = () => {
    // Enable audio contexts on first click interaction
    MusicAudio.init();
    MusicAudio.resume();
    setScreen('config');
  };

  const handleConfirmSkills = (selectedSkills: PlayerSkills) => {
    setSkills(selectedSkills);
    setScreen('playing');
  };

  const handleExitGame = () => {
    setScreen('config');
  };

  return (
    <div className="min-h-screen bg-[#050508] text-gray-200 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden selection:bg-cyan-500 selection:text-slate-900">
      
      {/* Glow Backdrops */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Astro dot grid layout texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:20px_20px]" />

      {/* Moving Ambient cosmic stars overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {starCount.map((left, idx) => (
          <div
            key={idx}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              top: `${(idx * 2.5) % 100}%`,
              left: `${left}%`,
              width: idx % 3 === 0 ? '1px' : '2px',
              height: idx % 3 === 0 ? '1px' : '2px',
              animationDuration: `${2 + (idx % 4)}s`,
              boxShadow: idx % 4 === 0 ? '0 0 10px rgba(6, 182, 212, 0.4)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Decorative vertical cyan energy grids */}
      <div className="absolute inset-y-0 left-10 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-10 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none" />

      {/* SCREEN 1: Epic cosmic sci-fi main menu */}
      {screen === 'menu' && (
        <div className="max-w-4xl w-full flex flex-col items-center text-center p-8 md:p-12 bg-black/40 border border-white/10 rounded-2xl shadow-3xl backdrop-blur-md relative z-10 animate-fade-in">
          
          {/* Futuristic designer header indicator */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[9px] font-mono tracking-[0.3em] uppercase px-3 py-1 bg-white/5 text-cyan-400 border border-white/5 rounded-full flex items-center gap-1.5 shadow-sm">
              <Star size={10} className="animate-spin text-cyan-400" /> TOP-LEVEL ARTISTIC DESIGN
            </span>
            <span className="text-[9px] text-white/40 font-mono tracking-[0.1em]">ARCADE_V1.10_PREMIUM</span>
          </div>

          {/* Super title */}
          <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white pb-2 font-sans">
            <span className="font-serif italic font-normal tracking-wide bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent block mb-1">节奏弹幕幻想</span>
            <span className="text-xl md:text-2xl font-semibold tracking-[0.25em] bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono block mt-2">RHYTHMIC DANMAKU SYMPHONY</span>
          </h1>

          <p className="max-w-xl text-xs md:text-sm text-gray-400 mt-6 leading-relaxed font-sans">
            融合顶尖“律动音光”视觉特效、多阶段史诗级Boss战力以及自由组合的高级子弹技能系统。
            自机的枪林弹雨与Boss吐纳出的星弧散射将在Procedural电子音乐的鼓槌节奏下进行完美呼吸变奏。
          </p>

          {/* Game Core showcase highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl mt-10">
            <div className="p-5 rounded-r-xl bg-white/5 border-l-2 border-l-cyan-500 border-y border-r border-white/5 text-left space-y-2 hover:bg-white/10 transition-all duration-200">
              <div className="flex items-center gap-2 text-cyan-400 font-medium text-xs tracking-widest uppercase font-sans">
                <Music size={14} /> 律动音光同步
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                游戏内建纯代码 procedural 音频合成器，背景乐的每一次低音重击（Kick Beat）都会令游戏背景网格及Boss弹幕速度扩张变形。
              </p>
            </div>

            <div className="p-5 rounded-r-xl bg-white/5 border-l-2 border-l-purple-500 border-y border-r border-white/5 text-left space-y-2 hover:bg-white/10 transition-all duration-200">
              <div className="flex items-center gap-2 text-purple-400 font-medium text-xs tracking-widest uppercase font-sans">
                <Sparkles size={14} /> 多组合弹幕技能
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                自由组合散射金星、微粒子穿透极光、空能波动重斩，搭载自律飞弹或减速力场。擦弹即可积攒横扫群星的终极超载爆弹。
              </p>
            </div>

            <div className="p-5 rounded-r-xl bg-white/5 border-l-2 border-l-pink-500 border-y border-r border-white/5 text-left space-y-2 hover:bg-white/10 transition-all duration-200">
              <div className="flex items-center gap-2 text-pink-400 font-medium text-xs tracking-widest uppercase font-sans">
                <Crosshair size={14} /> 3阶段史诗Boss战
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                直面多阶段超位体Boss！经历“星云旋律”的迷幻螺旋、“几何禁区”的光束横扫以及最终阶段“宇宙坍缩”的重力曲线引力阵风。
              </p>
            </div>
          </div>

          {/* Guide play tips */}
          <div className="mt-8 p-4 bg-black/60 rounded-xl border border-white/10 text-xs text-cyan-300 max-w-lg flex items-center justify-center gap-2 font-mono">
            <Volume2 size={13} className="text-cyan-400 animate-pulse shrink-0" />
            <div className="text-left text-[11px] text-gray-300 leading-normal">
              <strong className="font-semibold text-white uppercase tracking-wider">Sound Prompt:</strong> 请开启设备声音！ProceduralSynth 电子乐将大幅度加强闪闪发光的视觉沉浸感。
            </div>
          </div>

          <button
            id="enter-skills-config-btn"
            onClick={handleStartConfig}
            className="mt-10 px-8 py-3.5 bg-black/40 border border-white/10 hover:border-cyan-400/80 text-white text-xs tracking-[0.2em] font-normal uppercase rounded-lg active:scale-95 transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-xl shadow-black/80 hover:shadow-cyan-950/20"
          >
            <Gamepad2 size={14} />
            开始调试核心自机 (CALIBRATE VESSEL)
          </button>
        </div>
      )}

      {/* SCREEN 2: Custom Weapon components config selector */}
      {screen === 'config' && (
        <div className="w-full flex justify-center z-10 animate-fade-in">
          <SkillConfig currentSkills={skills} onConfirm={handleConfirmSkills} />
        </div>
      )}

      {/* SCREEN 3: Master full gameplay canvas space */}
      {screen === 'playing' && (
        <div className="w-full flex justify-center z-10 animate-fade-in">
          <GameCanvas skills={skills} onExit={handleExitGame} />
        </div>
      )}

      {/* Human designer footer element */}
      <footer className="mt-8 md:mt-12 text-center text-[9px] font-mono tracking-[0.15em] text-white/30 select-none z-10 uppercase">
        <p>RHYTHM DANMAKU ARCADE © 2026. PROCEDURAL WAVE SYNTHESIS LOGIC.</p>
        <p className="mt-1 flex items-center justify-center gap-1.5">
          <ThumbsUp size={8} /> DESIGNED FOR SUPREME VISUAL EXPERIENCE & ACCURATE HITBOX PLAYABILITY
        </p>
      </footer>
    </div>
  );
}
