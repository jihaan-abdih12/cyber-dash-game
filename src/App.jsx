import React, { useState, useEffect, useRef } from 'react';

// Web Audio API Sound Controller
class SoundController {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  move() { this.playTone(300, 'sine', 0.08, 0.05); }
  collect() {
    if (!this.ctx) return;
    this.playTone(600, 'triangle', 0.1, 0.08);
    setTimeout(() => this.playTone(900, 'triangle', 0.15, 0.08), 50);
  }
  powerup() {
    if (!this.ctx) return;
    this.playTone(400, 'sawtooth', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'sawtooth', 0.2, 0.1), 80);
  }
  crash() {
    if (!this.ctx) return;
    this.playTone(100, 'sawtooth', 0.4, 0.2);
    this.playTone(60, 'square', 0.5, 0.25);
  }
}

const audio = new SoundController();

export default function App() {
  const canvasRef = useRef(null);

  const [gameState, setGameState] = useState('START'); // 'START', 'PLAYING', 'GAMEOVER'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => localStorage.getItem('cyberdash_hi') || 0);
  const [multiplier, setMultiplier] = useState(1);
  const [shieldTime, setShieldTime] = useState(0);
  const [hyperTime, setHyperTime] = useState(0);

  const stateRef = useRef({
    lane: 1,
    playerX: 0,
    speed: 6,
    score: 0,
    multiplier: 1,
    consecutiveOrbs: 0,
    shieldTime: 0,
    hyperTime: 0,
    objects: [],
    particles: [],
    roadOffset: 0,
    spawnTimer: 0,
    gameActive: false,
  });

  const moveLeft = () => {
    if (!stateRef.current.gameActive) return;
    if (stateRef.current.lane > 0) {
      stateRef.current.lane--;
      audio.move();
    }
  };

  const moveRight = () => {
    if (!stateRef.current.gameActive) return;
    if (stateRef.current.lane < 2) {
      stateRef.current.lane++;
      audio.move();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startGame = () => {
    audio.init();
    stateRef.current = {
      lane: 1,
      playerX: 0,
      speed: 6,
      score: 0,
      multiplier: 1,
      consecutiveOrbs: 0,
      shieldTime: 0,
      hyperTime: 0,
      objects: [],
      particles: [],
      roadOffset: 0,
      spawnTimer: 0,
      gameActive: true,
    };
    setScore(0);
    setMultiplier(1);
    setShieldTime(0);
    setHyperTime(0);
    setGameState('PLAYING');
  };

  const createExplosion = (x, y, color) => {
    for (let i = 0; i < 20; i++) {
      stateRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color,
        life: 1,
        decay: Math.random() * 0.05 + 0.02
      });
    }
  };

  const handleGameOver = () => {
    stateRef.current.gameActive = false;
    audio.crash();
    const finalScore = stateRef.current.score;
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('cyberdash_hi', finalScore);
    }
    setGameState('GAMEOVER');
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      if (canvas.clientWidth && canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const getLaneX = (lIndex, W) => {
      const roadWidth = W * 0.7;
      const laneWidth = roadWidth / 3;
      const startX = (W - roadWidth) / 2;
      return startX + lIndex * laneWidth + laneWidth / 2;
    };

    const loop = () => {
      const state = stateRef.current;
      if (!state.gameActive) return;

      const W = canvas.width || 800;
      const H = canvas.height || 900;

      const targetX = getLaneX(state.lane, W);
      state.playerX += (targetX - state.playerX) * 0.2;

      let currentSpeed = state.speed;
      if (state.hyperTime > 0) {
        state.hyperTime--;
        currentSpeed *= 2;
        state.score += 2;
      } else {
        state.score += 1;
      }

      state.speed += 0.001;
      if (state.shieldTime > 0) state.shieldTime--;

      setScore(state.score);
      setMultiplier(state.multiplier);
      setShieldTime(state.shieldTime);
      setHyperTime(state.hyperTime);

      state.roadOffset = (state.roadOffset + currentSpeed) % 40;

      state.spawnTimer++;
      if (state.spawnTimer % Math.max(20, Math.floor(60 - state.speed * 3)) === 0) {
        const laneIdx = Math.floor(Math.random() * 3);
        const rand = Math.random();
        let type = 'obstacle';
        if (rand > 0.6) type = 'orb';
        if (rand > 0.92) type = 'shield';
        if (rand > 0.96) type = 'hyper';
        state.objects.push({ lane: laneIdx, y: -50, type });
      }

      for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        obj.y += currentSpeed;
        const objX = getLaneX(obj.lane, W);
        const playerY = H - 120;

        if (Math.abs(obj.y - playerY) < 35 && obj.lane === state.lane) {
          if (obj.type === 'obstacle') {
            if (state.hyperTime > 0) {
              createExplosion(objX, obj.y, '#ff007f');
              state.objects.splice(i, 1);
              continue;
            } else if (state.shieldTime > 0) {
              state.shieldTime = 0;
              createExplosion(objX, obj.y, '#00f3ff');
              audio.powerup();
              state.objects.splice(i, 1);
              continue;
            } else {
              createExplosion(state.playerX, H - 120, '#ff007f');
              handleGameOver();
              return;
            }
          } else if (obj.type === 'orb') {
            audio.collect();
            state.consecutiveOrbs++;
            if (state.consecutiveOrbs % 5 === 0 && state.multiplier < 8) {
              state.multiplier *= 2;
            }
            state.score += 50 * state.multiplier;
            createExplosion(objX, obj.y, '#ffe600');
            state.objects.splice(i, 1);
            continue;
          } else if (obj.type === 'shield') {
            audio.powerup();
            state.shieldTime = 300;
            createExplosion(objX, obj.y, '#00f3ff');
            state.objects.splice(i, 1);
            continue;
          } else if (obj.type === 'hyper') {
            audio.powerup();
            state.hyperTime = 200;
            createExplosion(objX, obj.y, '#ff007f');
            state.objects.splice(i, 1);
            continue;
          }
        }

        if (obj.y > H + 50) {
          if (obj.type === 'orb') state.consecutiveOrbs = 0;
          state.objects.splice(i, 1);
        }
      }

      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      ctx.fillStyle = '#08090f';
      ctx.fillRect(0, 0, W, H);

      const roadWidthTop = W * 0.2;
      const roadWidthBottom = W * 0.8;
      const roadLeftTop = (W - roadWidthTop) / 2;
      const roadRightTop = roadLeftTop + roadWidthTop;
      const roadLeftBottom = (W - roadWidthBottom) / 2;
      const roadRightBottom = roadLeftBottom + roadWidthBottom;

      ctx.fillStyle = '#0d0f1a';
      ctx.beginPath();
      ctx.moveTo(roadLeftTop, 0);
      ctx.lineTo(roadRightTop, 0);
      ctx.lineTo(roadRightBottom, H);
      ctx.lineTo(roadLeftBottom, H);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f3ff';
      ctx.beginPath();
      ctx.moveTo(roadLeftTop, 0);
      ctx.lineTo(roadLeftBottom, H);
      ctx.moveTo(roadRightTop, 0);
      ctx.lineTo(roadRightBottom, H);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let y = state.roadOffset; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      state.objects.forEach(obj => {
        const x = getLaneX(obj.lane, W);
        if (obj.type === 'obstacle') {
          ctx.fillStyle = '#ff007f';
          ctx.shadowColor = '#ff007f';
          ctx.shadowBlur = 20;
          ctx.fillRect(x - 20, obj.y - 15, 40, 30);
        } else if (obj.type === 'orb') {
          ctx.fillStyle = '#ffe600';
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(x, obj.y, 12, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'shield') {
          ctx.fillStyle = '#00f3ff';
          ctx.shadowColor = '#00f3ff';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(x, obj.y, 14, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'hyper') {
          ctx.fillStyle = '#ff007f';
          ctx.shadowColor = '#ff007f';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(x, obj.y, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      const pY = H - 120;
      ctx.save();
      ctx.translate(state.playerX, pY);
      ctx.shadowColor = state.hyperTime > 0 ? '#ff007f' : '#00f3ff';
      ctx.shadowBlur = state.hyperTime > 0 ? 30 : 20;
      ctx.fillStyle = state.hyperTime > 0 ? '#ff007f' : '#00f3ff';

      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(20, 20);
      ctx.lineTo(0, 10);
      ctx.lineTo(-20, 20);
      ctx.closePath();
      ctx.fill();

      if (state.shieldTime > 0) {
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [gameState]);

  return (
    <div className="w-screen h-screen bg-[#08090f] text-white select-none overflow-hidden flex justify-center items-center font-['Rajdhani']">
      <div className="relative w-[800px] h-[900px] max-w-full max-h-full bg-[radial-gradient(circle_at_center,#141729_0%,#08090f_100%)] shadow-[0_0_50px_rgba(0,243,255,0.15)] flex flex-col overflow-hidden">
        
        {/* HUD */}
        <div className="absolute top-5 left-5 right-5 flex justify-between items-start pointer-events-none z-10">
          <div className="bg-[#10121b]/75 backdrop-blur-md border border-[#00f3ff]/20 rounded-xl px-5 py-3 shadow-lg">
            <div className="text-xs text-slate-400 tracking-widest uppercase">Score</div>
            <div className="font-['Orbitron'] text-2xl font-bold text-[#00f3ff] drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">{score}</div>
          </div>
          <div className="bg-[#10121b]/75 backdrop-blur-md border border-[#00f3ff]/20 rounded-xl px-5 py-3 shadow-lg text-right">
            <div className="text-xs text-slate-400 tracking-widest uppercase">High Score</div>
            <div className="font-['Orbitron'] text-2xl font-bold text-[#ff007f] drop-shadow-[0_0_10px_rgba(255,0,127,0.5)]">{highScore}</div>
          </div>
        </div>

        <div className="absolute top-24 left-5 font-['Orbitron'] text-xl font-black text-[#ffe600] drop-shadow-[0_0_10px_rgba(255,230,0,0.6)] z-10">{multiplier}x</div>

        <div className="absolute top-24 right-5 w-36 flex flex-col gap-2 z-10">
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-[#00f3ff]">Shield</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#00f3ff] shadow-[0_0_8px_#00f3ff] transition-all duration-100" style={{ width: `${(shieldTime / 300) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-[#ff007f]">Hyperdrive</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff007f] shadow-[0_0_8px_#ff007f] transition-all duration-100" style={{ width: `${(hyperTime / 200) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Canvas Wrapper */}
        <div className="relative flex-1 w-full h-full">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        </div>

        {/* Mobile controls */}
        <div className="absolute bottom-5 left-0 right-0 flex justify-between px-5 md:hidden z-10 pointer-events-none">
          <button onClick={moveLeft} className="w-16 h-16 rounded-full bg-white/10 border border-[#00f3ff]/20 backdrop-blur-md text-[#00f3ff] text-2xl flex items-center justify-center pointer-events-auto active:scale-95">◄</button>
          <button onClick={moveRight} className="w-16 h-16 rounded-full bg-white/10 border border-[#00f3ff]/20 backdrop-blur-md text-[#00f3ff] text-2xl flex items-center justify-center pointer-events-auto active:scale-95">►</button>
        </div>

        {gameState === 'START' && (
          <div className="absolute inset-0 bg-[#08090f]/85 backdrop-blur-lg flex flex-col justify-center items-center z-20 gap-5 p-6 text-center">
            <h1 className="font-['Orbitron'] text-4xl md:text-5xl font-black bg-gradient-to-r from-[#00f3ff] to-[#ff007f] bg-clip-text text-transparent tracking-widest drop-shadow-[0_0_30px_rgba(0,243,255,0.3)]">CYBER DASH</h1>
            <p className="text-slate-400 text-sm md:text-base max-w-xs leading-relaxed">Dodge high-energy grid barriers and harvest cyber orbs along the neon highway!</p>
            <button onClick={startGame} className="font-['Orbitron'] text-lg font-bold px-10 py-4 bg-gradient-to-r from-[#00f3ff] to-[#00a8ff] text-[#08090f] rounded-full shadow-[0_0_25px_rgba(0,243,255,0.4)] hover:scale-105 hover:shadow-[0_0_35px_rgba(0,243,255,0.7)] transition-all cursor-pointer">LAUNCH</button>
            <div className="text-slate-500 text-xs flex gap-2 items-center">
              <span>Use <kbd className="bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">◄</kbd> <kbd className="bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">►</kbd> or <kbd className="bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">A</kbd> <kbd className="bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">D</kbd></span>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-[#08090f]/85 backdrop-blur-lg flex flex-col justify-center items-center z-20 gap-5 p-6 text-center">
            <h1 className="font-['Orbitron'] text-4xl md:text-5xl font-black bg-gradient-to-r from-[#ff007f] to-red-500 bg-clip-text text-transparent tracking-widest drop-shadow-[0_0_30px_rgba(255,0,127,0.3)]">SYSTEM CRASH</h1>
            <p className="text-slate-300 text-lg">Final Score: <span className="text-[#00f3ff] font-bold">{score}</span></p>
            <button onClick={startGame} className="font-['Orbitron'] text-lg font-bold px-10 py-4 bg-gradient-to-r from-[#00f3ff] to-[#00a8ff] text-[#08090f] rounded-full shadow-[0_0_25px_rgba(0,243,255,0.4)] hover:scale-105 hover:shadow-[0_0_35px_rgba(0,243,255,0.7)] transition-all cursor-pointer">REBOOT</button>
          </div>
        )}

      </div>
    </div>
  );
}