/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MainWeaponType, SubWeaponType, PassiveCoreType, PlayerSkills } from '../types';
import { Zap, Shield, Sparkles, Crosshair, HelpCircle, Activity, Play } from 'lucide-react';

interface SkillConfigProps {
  currentSkills: PlayerSkills;
  onConfirm: (skills: PlayerSkills) => void;
}

export default function SkillConfig({ currentSkills, onConfirm }: SkillConfigProps) {
  const [selectedMain, setSelectedMain] = useState<MainWeaponType>(currentSkills.main);
  const [selectedSub, setSelectedSub] = useState<SubWeaponType>(currentSkills.sub);
  const [selectedPassive, setSelectedPassive] = useState<PassiveCoreType>(currentSkills.passive);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Weapon details
  const mainWeapons = [
    {
      type: MainWeaponType.SPREAD,
      name: '星弧散射弹',
      desc: '向前发射扇形五路扩散金橙色星弹，覆盖范围极广，适合压制与扫荡。',
      color: '#e5a93b',
      glow: '#ff8c00',
      stats: { range: 90, power: 55, rate: 75, speed: 65 },
    },
    {
      type: MainWeaponType.LASER,
      name: '聚能微子流',
      desc: '汇聚高纯度天蓝色微粒子束阻击正前方，造成极高的单体贯穿持续伤害。',
      color: '#22d3ee',
      glow: '#06b6d4',
      stats: { range: 25, power: 95, rate: 90, speed: 99 },
    },
    {
      type: MainWeaponType.WAVE,
      name: '重力波动斩',
      desc: '依附律动发射巨大粉紫红弦月空能震荡波，具有一定穿透力且判定范围极大。',
      color: '#f43f5e',
      glow: '#ec4899',
      stats: { range: 60, power: 75, rate: 45, speed: 45 },
    },
  ];

  const subWeapons = [
    {
      type: SubWeaponType.MISSILE,
      name: '追踪质子导弹',
      desc: '周期性射出4枚追踪微型热动力飞弹，自动锁定Boss目标并造成小范围高爆。',
      color: '#4ade80',
      glow: '#22c55e',
      stats: { range: 85, Power: 65, Auto: '极高' },
    },
    {
      type: SubWeaponType.SHIELD,
      name: '相位共振卫星',
      desc: '两个霓虹感力场浮游炮环绕机体，不仅能打击触碰的敌人，还能抵消擦除普通子弹。',
      color: '#a855f7',
      glow: '#c084fc',
      stats: { range: 45, Power: 45, Defense: '极强' },
    },
    {
      type: SubWeaponType.TIME_DILATION,
      name: '时空坍缩微域',
      desc: '在自机周围生成一个淡蓝色阻尼力场，所有飞入其中的Boss子弹速度衰减60%。',
      color: '#38bdf8',
      glow: '#0284c7',
      stats: { range: 50, Control: '极致', Survival: '极高' },
    },
  ];

  const passiveCores = [
    {
      type: PassiveCoreType.OVERCHARGE,
      name: '律动超能过载',
      desc: '射击速度深度契合音乐频率！每当重低音阶（BPM重拍）触发，能量武器射速倍增。',
      badge: '节奏狂热',
    },
    {
      type: PassiveCoreType.ABSORBER,
      name: '擦弹裂变回路',
      desc: '擦弹（自机极近闪避）将获得倍数级别的爆弹能量。瞬间积攒震撼全荧幕的超限炸弹。',
      badge: '绝境求生',
    },
    {
      type: PassiveCoreType.MAGNET,
      name: '极星磁引核心',
      desc: '无阻吸附！将场上掉落的水晶颗粒、生命核心等资源直接抓取，专注于走位。',
      badge: '高效整备',
    },
  ];

  // Bullet preview simulator
  useEffect(() => {
    let animationId: number;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface PreviewBullet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      glowColor: string;
      type: 'dot' | 'laser' | 'wave' | 'missile' | 'shield';
      angle?: number;
    }

    let bullets: PreviewBullet[] = [];
    let frame = 0;
    const targetW = canvas.width;
    const targetH = canvas.height;
    
    // Self ship dummy x, y
    const shipX = targetW / 2;
    const shipY = targetH - 35;

    const gameLoop = () => {
      frame++;
      
      // Clear background
      ctx.fillStyle = '#0a0b12';
      ctx.fillRect(0, 0, targetW, targetH);

      // Draw cyber Grid Background lines in preview
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)';
      ctx.lineWidth = 1;
      const step = 20;
      for (let i = 0; i < targetW; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, targetH);
        ctx.stroke();
      }
      for (let j = 0; j < targetH; j += step) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(targetW, j);
        ctx.stroke();
      }

      // Spawn Player main weapon bullets
      if (frame % 8 === 0) {
        if (selectedMain === MainWeaponType.SPREAD) {
          const angles = [-0.3, -0.15, 0, 0.15, 0.3];
          angles.forEach(ang => {
            bullets.push({
              x: shipX,
              y: shipY - 10,
              vx: Math.sin(ang) * 4,
              vy: -Math.cos(ang) * 4,
              radius: 3,
              color: '#f59e0b',
              glowColor: '#ff8c00',
              type: 'dot'
            });
          });
        } else if (selectedMain === MainWeaponType.LASER) {
          // Draw continuous laser source sparks
          bullets.push({
            x: shipX + (Math.random() * 6 - 3),
            y: shipY - 15,
            vx: 0,
            vy: -8,
            radius: 5,
            color: '#22d3ee',
            glowColor: '#0891b2',
            type: 'laser'
          });
        } else if (selectedMain === MainWeaponType.WAVE) {
          if (frame % 24 === 0) {
            bullets.push({
              x: shipX,
              y: shipY - 10,
              vx: 0,
              vy: -2.3,
              radius: 12,
              color: '#f43f5e',
              glowColor: '#db2777',
              type: 'wave'
            });
          }
        }
      }

      // Spawn Sub-weapon preview
      if (selectedSub === SubWeaponType.MISSILE && frame % 45 === 0) {
        bullets.push({
          x: shipX - 15, y: shipY, vx: -1, vy: -5, radius: 4, color: '#4ade80', glowColor: '#22c55e', type: 'missile'
        });
        bullets.push({
          x: shipX + 15, y: shipY, vx: 1, vy: -5, radius: 4, color: '#4ade80', glowColor: '#22c55e', type: 'missile'
        });
      }

      // Update and draw bullets
      bullets.forEach((b, i) => {
        b.x += b.vx;
        b.y += b.vy;

        // Custom behaviors
        if (b.type === 'missile') {
          // curve inward
          b.vx += (shipX - b.x) * 0.02;
          b.vy -= 0.05;
        }

        // Draw bullet glowing
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.glowColor;
        
        ctx.fillStyle = b.color;
        if (b.type === 'laser') {
          ctx.beginPath();
          ctx.rect(b.x - 3, b.y, 6, 12);
          ctx.fill();
        } else if (b.type === 'wave') {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, Math.PI, 0); // draw semi-circle crescent wave
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Clear shadow for vessel drawing
      ctx.shadowBlur = 0;

      // Draw slow dilation circle preview
      if (selectedSub === SubWeaponType.TIME_DILATION) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(shipX, shipY, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        
        // draw slow text
        ctx.fillStyle = '#38bdf8';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AMB TIME ZONE', shipX, shipY - 50);
      }

      // Draw Orbiting Shield preview
      if (selectedSub === SubWeaponType.SHIELD) {
        const orbitAngle1 = (frame * 0.05);
        const orbitAngle2 = (frame * 0.05) + Math.PI;
        const radius = 24;

        // Satellite 1
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        const s1x = shipX + Math.cos(orbitAngle1) * radius;
        const s1y = shipY + Math.sin(orbitAngle1) * radius;
        ctx.arc(s1x, s1y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Satellite 2
        ctx.beginPath();
        const s2x = shipX + Math.cos(orbitAngle2) * radius;
        const s2y = shipY + Math.sin(orbitAngle2) * radius;
        ctx.arc(s2x, s2y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw connections
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.lineTo(shipX, shipY);
        ctx.lineTo(s2x, s2y);
        ctx.stroke();
      }

      // Out of bounds filter
      bullets = bullets.filter(b => b.y > -20 && b.x > 0 && b.x < targetW);

      // Draw Dummy Fighter Jet Player
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - 12); // nose
      ctx.lineTo(shipX - 10, shipY + 8); // wing left
      ctx.lineTo(shipX - 4, shipY + 5);
      ctx.lineTo(shipX + 4, shipY + 5);
      ctx.lineTo(shipX + 10, shipY + 8); // wing right
      ctx.closePath();
      ctx.fill();

      // Core thruster fire
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(shipX - 3, shipY + 6);
      ctx.lineTo(shipX, shipY + 14 + (Math.sin(frame * 0.4) * 3));
      ctx.lineTo(shipX + 3, shipY + 6);
      ctx.fill();

      // Core energy core dot
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#60a5fa';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(shipX, shipY, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [selectedMain, selectedSub]);

  // Handle finalize selection
  const handleConfirm = () => {
    onConfirm({
      main: selectedMain,
      sub: selectedSub,
      passive: selectedPassive,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-6xl w-full bg-black/40 font-sans rounded-2xl border border-white/10 shadow-3xl backdrop-blur-md transition-all">
      {/* LEFT: Core selectors */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono tracking-[0.25em] px-2 py-0.5 bg-white/5 text-cyan-400 border border-white/5 rounded">V-CONFIG STAGE</span>
            <span className="text-[9px] text-white/40 font-mono tracking-[0.1em]">CORE_CALIBRATION_v1.07</span>
          </div>
          <h2 className="text-2xl font-light tracking-tight text-white flex items-center gap-2 font-sans md:text-3xl">
            高级自机弹幕搭载系统 <span className="text-cyan-400 text-xs font-mono tracking-[0.2em] uppercase block md:inline mt-1 md:mt-0">(CUSTOM BULLET CHASSIS)</span>
          </h2>
          <p className="text-xs text-gray-400 mt-2 font-sans leading-relaxed">
            作为顶尖战机设计师，请自由调配并融合您的“高能主武器”、“自律型防卫副官”和“主控被动核心”，打造属于你专属的打击流派与律动轨迹。
          </p>
        </div>

        {/* 1. 主炮武器配置 */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono font-medium uppercase tracking-[0.15em] text-amber-400 flex items-center gap-1.5">
            <Crosshair size={13} /> 1. 主炮配置 / Main Weapon System
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {mainWeapons.map((w) => {
              const active = selectedMain === w.type;
              return (
                <button
                  key={w.type}
                  id={`main-weapon-btn-${w.type}`}
                  onClick={() => setSelectedMain(w.type)}
                  className={`relative p-3.5 rounded-lg text-left border text-white transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-amber-950/20 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-xs tracking-wide">{w.name}</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: w.color, boxShadow: `0 0 10px ${w.glow}` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{w.desc}</p>
                  
                  {/* Miniature progress stats for main weapons */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-1.5 text-[9px] font-mono text-gray-500">
                    <div>威力 Power: <span className="text-amber-400/90">{w.stats.power}%</span></div>
                    <div>射速 Rate: <span className="text-amber-400/90">{w.stats.rate}%</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. 副官防御模块 */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono font-medium uppercase tracking-[0.15em] text-purple-400 flex items-center gap-1.5">
            <Shield size={13} /> 2. 副官武器模块 / Secondary Protection Pod
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {subWeapons.map((w) => {
              const active = selectedSub === w.type;
              return (
                <button
                  key={w.type}
                  id={`sub-weapon-btn-${w.type}`}
                  onClick={() => setSelectedSub(w.type)}
                  className={`relative p-3.5 rounded-lg text-left border text-white transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-purple-950/20 border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                      : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-xs tracking-wide">{w.name}</span>
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: w.color, boxShadow: `0 0 10px ${w.glow}` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{w.desc}</p>
                  
                  {/* Dynamic tag based on weapon profile */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex gap-2 text-[8px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-purple-400 uppercase">
                      {Object.keys(w.stats)[1]}: {Object.values(w.stats)[1]}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-cyan-400 uppercase">
                      {Object.keys(w.stats)[2] || 'Range'}: {Object.values(w.stats)[2] || 'Co-op'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. 被动主控核心 */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono font-medium uppercase tracking-[0.15em] text-cyan-400 flex items-center gap-1.5">
            <Sparkles size={13} /> 3. 驱动裂变核心 / Integrated System Core
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {passiveCores.map((w) => {
              const active = selectedPassive === w.type;
              return (
                <button
                  key={w.type}
                  id={`passive-core-btn-${w.type}`}
                  onClick={() => setSelectedPassive(w.type)}
                  className={`relative p-3.5 rounded-lg text-left border text-white transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-cyan-950/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                      : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-xs tracking-wide">{w.name}</span>
                    <Activity size={11} className="text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{w.desc}</p>
                  <div className="mt-3 text-[9px] font-mono text-cyan-400/80">
                    特性: <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{w.badge}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* RIGHT: Live 2D simulated preview pane */}
      <div className="w-full lg:w-72 flex flex-col justify-between items-center bg-black/40 p-5 rounded-xl border border-white/10 backdrop-blur-md">
        <div className="w-full text-center mb-4">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-[0.2em] flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> Live Projection Frame
          </span>
          <p className="text-[9px] text-white/30 font-mono mt-1 uppercase tracking-wider">VIRTUAL_SIMULATION_GRAPH_2D</p>
        </div>

        {/* Previews Canvas Rendering */}
        <div className="relative border border-white/15 rounded-lg overflow-hidden w-full max-w-[200px] h-[300px] shadow-[0_0_30px_rgba(255,255,255,0.02)] bg-[#050508]">
          <canvas
            ref={previewCanvasRef}
            width={200}
            height={300}
            className="w-full h-full block"
          />
        </div>

        {/* Selected parameters and finalize */}
        <div className="w-full mt-5 space-y-4">
          <div className="p-3.5 bg-black/50 rounded-lg border border-white/5 text-[10px] font-mono space-y-2">
            <div className="flex justify-between items-center pb-1 border-b border-white/5">
              <span className="text-white/40 uppercase">M-Gun 主力:</span>
              <span className="text-amber-400 font-medium">
                {mainWeapons.find(m => m.type === selectedMain)?.name}
              </span>
            </div>
            <div className="flex justify-between items-center pb-1 border-b border-white/5">
              <span className="text-white/40 uppercase">S-Pod 卫星:</span>
              <span className="text-purple-400 font-medium">
                {subWeapons.find(s => s.type === selectedSub)?.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40 uppercase">Core 被动:</span>
              <span className="text-cyan-400 font-medium">
                {passiveCores.find(s => s.type === selectedPassive)?.name.slice(0, 7)}...
              </span>
            </div>
          </div>

          <button
            id="start-with-combo-btn"
            onClick={handleConfirm}
            className="w-full py-3 px-4 font-mono text-[11px] tracking-[0.25em] uppercase rounded-lg bg-white text-black hover:bg-gray-100 shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play size={12} fill="currentColor" />
            激活并登入战区 (DEPLOY)
          </button>
        </div>
      </div>
    </div>
  );
}
