import React, { useState, useEffect, useRef } from 'react';

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
  move() { this.playTone(350, 'sine', 0.08, 0.05); }
  collect() {
    if (!this.ctx) return;
    this.playTone(700, 'triangle', 0.1, 0.1);
    setTimeout(() => this.playTone(1100, 'triangle', 0.15, 0.1), 50);
  }
  powerup() {
    if (!this.ctx) return;
    this.playTone(500, 'sawtooth', 0.1, 0.12);
    setTimeout(() => this.playTone(1000, 'sawtooth', 0.2, 0.12), 80);
  }
  crash() {
    if (!this.ctx) return;
    this.playTone(120, 'sawtooth', 0.4, 0.3);
    this.playTone(50, 'square', 0.5, 0.35);
  }
}

const audio = new SoundController();

export default function App() {
  const canvasRef = useRef(null);

  const [gameState, setGameState] = useState('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => localStorage.getItem('cyberdash_hi') || 0);
  const [multiplier, setMultiplier] = useState(1);
  const [shieldTime, setShieldTime] = useState(0);
  const [hyperTime, setHyperTime] = useState(0);

  const stateRef = useRef({
    lane: 1,
    playerX: 0,
    speed: 7,
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
      speed: 7,
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
    for (let i = 0; i < 25; i++) {
      stateRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        color,
        life: 1,
        decay: Math.random() * 0.04 + 0.02
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
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const getLaneX = (lIndex, W) => {
      const roadWidth = Math.min(W * 0.6, 500);
      const laneWidth = roadWidth / 3;
      const startX = (W - roadWidth) / 2;
      return startX + lIndex * laneWidth + laneWidth / 2;
    };

    const loop = () => {
      const state = stateRef.current;
      if (!state.gameActive) return;

      const W = canvas.width;
      const H = canvas.height;

      const targetX = getLaneX(state.lane, W);
      state.playerX += (targetX - state.playerX) * 0.25;

      let currentSpeed = state.speed;
      if (state.hyperTime > 0) {
        state.hyperTime--;
        currentSpeed *= 2.2;
        state.score += 3;
      } else {
        state.score += 1;
      }

      state.speed += 0.0015;
      if (state.shieldTime > 0) state.shieldTime--;

      setScore(state.score);
      setMultiplier(state.multiplier);
      setShieldTime(state.shieldTime);
      setHyperTime(state.hyperTime);

      state.roadOffset = (state.roadOffset + currentSpeed) % 50;

      state.spawnTimer++;
      if (state.spawnTimer % Math.max(18, Math.floor(55 - state.speed * 2.5)) === 0) {
        const laneIdx = Math.floor(Math.random() * 3);
        const rand = Math.random();
        let type = 'obstacle';
        if (rand > 0.55) type = 'orb';
        if (rand > 0.90) type = 'shield';
        if (rand > 0.95) type = 'hyper';
        state.objects.push({ lane: laneIdx, y: -60, type });
      }

      for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        obj.y += currentSpeed;
        const objX = getLaneX(obj.lane, W);
        const playerY = H - 140;

        if (Math.abs(obj.y - playerY) < 40 && obj.lane === state.lane) {
          if (obj.type === 'obstacle') {
            if (state.hyperTime > 0) {
              createExplosion(objX, obj.y, '#f43f5e');
              state.objects.splice(i, 1);
              continue;
            } else if (state.shieldTime > 0) {
              state.shieldTime = 0;
              createExplosion(objX, obj.y, '#38bdf8');
              audio.powerup();
              state.objects.splice(i, 1);
              continue;
            } else {
              createExplosion(state.playerX, H - 140, '#f43f5e');
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
            createExplosion(objX, obj.y, '#facc15');
            state.objects.splice(i, 1);
            continue;
          } else if (obj.type === 'shield') {
            audio.powerup();
            state.shieldTime = 300;
            createExplosion(objX, obj.y, '#38bdf8');
            state.objects.splice(i, 1);
            continue;
          } else if (obj.type === 'hyper') {
            audio.powerup();
            state.hyperTime = 220;
            createExplosion(objX, obj.y, '#f43f5e');
            state.objects.splice(i, 1);
            continue;
          }
        }

        if (obj.y > H + 60) {
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

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Road
      const roadWidthTop = W * 0.15;
      const roadWidthBottom = Math.min(W * 0.6, 500);
      const roadLeftTop = (W - roadWidthTop) / 2;
      const roadRightTop = roadLeftTop + roadWidthTop;
      const roadLeftBottom = (W - roadWidthBottom) / 2;
      const roadRightBottom = roadLeftBottom + roadWidthBottom;

      const roadGrad = ctx.createLinearGradient(0, 0, 0, H);
      roadGrad.addColorStop(0, '#111827');
      roadGrad.addColorStop(1, '#030712');
      ctx.fillStyle = roadGrad;
      ctx.beginPath();
      ctx.moveTo(roadLeftTop, 0);
      ctx.lineTo(roadRightTop, 0);
      ctx.lineTo(roadRightBottom, H);
      ctx.lineTo(roadLeftBottom, H);
      ctx.closePath();
      ctx.fill();

      // Neon road edges
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(roadLeftTop, 0);
      ctx.lineTo(roadLeftBottom, H);
      ctx.moveTo(roadRightTop, 0);
      ctx.lineTo(roadRightBottom, H);
      ctx.stroke();

      // Grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      for (let y = state.roadOffset; y < H; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Objects
      state.objects.forEach(obj => {
        const x = getLaneX(obj.lane, W);
        ctx.shadowBlur = 25;
        if (obj.type === 'obstacle') {
          ctx.fillStyle = '#f43f5e';
          ctx.shadowColor = '#f43f5e';
          ctx.fillRect(x - 25, obj.y - 18, 50, 36);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 25, obj.y - 18, 50, 36);
        } else if (obj.type === 'orb') {
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = '#facc15';
          ctx.beginPath();
          ctx.arc(x, obj.y, 14, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'shield') {
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#38bdf8';
          ctx.beginPath();
          ctx.arc(x, obj.y, 16, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'hyper') {
          ctx.fillStyle = '#ec4899';
          ctx.shadowColor = '#ec4899';
          ctx.beginPath();
          ctx.arc(x, obj.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Particles
      state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Player Ship
      const pY = H - 140;
      ctx.save();
      ctx.translate(state.playerX, pY);
      ctx.shadowColor = state.hyperTime > 0 ? '#ec4899' : '#38bdf8';
      ctx.shadowBlur = state.hyperTime > 0 ? 35 : 25;
      ctx.fillStyle = state.hyperTime > 0 ? '#ec4899' : '#38bdf8';

      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(24, 24);
      ctx.lineTo(0, 12);
      ctx.lineTo(-24, 24);
      ctx.closePath();
      ctx.fill();

      if (state.shieldTime > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#030712',
      color: '#ffffff',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', zIndex: 1 }} />

      {/* HUD Score Header */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '12px',
          padding: '10px 20px',
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', tracking: '1px' }}>Score</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#38bdf8', textShadow: '0 0 10px #38bdf8' }}>{score}</div>
        </div>

        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(244, 63, 94, 0.4)',
          borderRadius: '12px',
          padding: '10px 20px',
          textAlign: 'right',
          boxShadow: '0 0 15px rgba(244, 63, 94, 0.3)'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>High Score</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#f43f5e', textShadow: '0 0 10px #f43f5e' }}>{highScore}</div>
        </div>
      </div>

      {/* Multiplier & Power Bars */}
      <div style={{ position: 'absolute', top: '100px', left: '20px', zIndex: 10, fontSize: '22px', fontWeight: 'bold', color: '#facc15', textShadow: '0 0 10px #facc15' }}>
        {multiplier}x MULTIPLIER
      </div>

      <div style={{ position: 'absolute', top: '100px', right: '20px', width: '160px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '4px' }}>SHIELD</div>
          <div style={{ height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ height: '100%', backgroundColor: '#38bdf8', width: `${(shieldTime / 300) * 100}%`, transition: 'width 0.1s linear' }}></div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ec4899', marginBottom: '4px' }}>HYPERDRIVE</div>
          <div style={{ height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(236,72,153,0.3)' }}>
            <div style={{ height: '100%', backgroundColor: '#ec4899', width: `${(hyperTime / 220) * 100}%`, transition: 'width 0.1s linear' }}></div>
          </div>
        </div>
      </div>

      {/* Mobile Controls */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justify: 'space-between',
        zIndex: 10
      }}>
        <button onClick={moveLeft} style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '2px solid #38bdf8',
          color: '#38bdf8',
          fontSize: '28px',
          cursor: 'pointer',
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)'
        }}>◄</button>

        <button onClick={moveRight} style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '2px solid #38bdf8',
          color: '#38bdf8',
          fontSize: '28px',
          cursor: 'pointer',
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)'
        }}>►</button>
      </div>

      {/* Start Overlay Modal */}
      {gameState === 'START' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(3, 7, 18, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 50,
          textAlign: 'center',
          padding: '20px'
        }}>
          <h1 style={{
            fontSize: '52px',
            fontWeight: '900',
            background: 'linear-gradient(90deg, #38bdf8, #ec4899, #facc15)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 15px 0',
            letterSpacing: '2px',
            filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.5))'
          }}>CYBER DASH</h1>
          <p style={{ color: '#cbd5e1', maxWidth: '380px', fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
            Dodge neon barriers, collect golden cyber orbs, and activate hyperdrive upgrades along the highway!
          </p>
          <button onClick={startGame} style={{
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '16px 45px',
            background: 'linear-gradient(90deg, #38bdf8, #2563eb)',
            color: '#030712',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            boxShadow: '0 0 25px rgba(56, 189, 248, 0.7)',
            transition: 'transform 0.2s'
          }}>
            START GAME
          </button>
          <div style={{ marginTop: '25px', color: '#64748b', fontSize: '13px' }}>
            Controls: Use <span style={{ color: '#38bdf8' }}>◄ ►</span> or <span style={{ color: '#38bdf8' }}>A / D</span> keys
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState === 'GAMEOVER' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(3, 7, 18, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 50,
          textAlign: 'center',
          padding: '20px'
        }}>
          <h1 style={{
            fontSize: '52px',
            fontWeight: '900',
            color: '#f43f5e',
            textShadow: '0 0 25px #f43f5e',
            margin: '0 0 15px 0'
          }}>SYSTEM CRASH</h1>
          <p style={{ color: '#ffffff', fontSize: '22px', marginBottom: '30px' }}>
            Final Score: <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{score}</span>
          </p>
          <button onClick={startGame} style={{
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '16px 45px',
            background: 'linear-gradient(90deg, #38bdf8, #2563eb)',
            color: '#030712',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            boxShadow: '0 0 25px rgba(56, 189, 248, 0.7)'
          }}>
            REBOOT SYSTEM
          </button>
        </div>
      )}
    </div>
  );
}