'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Scroll-reveal: adds .is-visible when element enters viewport
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            observer.unobserve(e.target)
          }
        }),
      { threshold: 0.1 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// ── Decorative mockup components ─────────────────────────

function MacroMockup() {
  return (
    <div
      style={{
        background: 'rgba(13,31,60,0.9)',
        border: '1px solid rgba(38,132,255,0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        minWidth: 280,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 48px rgba(38,132,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(165,173,186,0.9)', textTransform: 'uppercase' }}>Today&apos;s Nutrition</span>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, background: 'rgba(38,132,255,0.15)', color: '#4C9AFF', padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>BULK</span>
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 36, fontWeight: 700, color: '#F5F7FA', letterSpacing: '-0.02em', lineHeight: 1 }}>1,847</div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(165,173,186,0.7)', marginBottom: 14 }}>of 2,184 kcal</div>
      {/* Progress bar */}
      <div style={{ height: 6, background: 'rgba(52,69,99,0.8)', borderRadius: 99, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '84%', background: 'linear-gradient(90deg, #2684FF, #4C9AFF)', borderRadius: 99 }} />
      </div>
      {/* Macros */}
      {[
        { label: 'Protein', val: '132g', pct: 88, color: '#2684FF', status: '✓' },
        { label: 'Carbs',   val: '189g', pct: 71, color: '#4C9AFF', status: '↑' },
        { label: 'Fat',     val: '62g',  pct: 93, color: '#6B9FFF', status: '✓' },
      ].map(({ label, val, pct, color, status }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(165,173,186,0.8)', width: 52 }}>{label}</div>
          <div style={{ flex: 1, height: 4, background: 'rgba(52,69,99,0.7)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: '#F5F7FA', width: 36, textAlign: 'right' }}>{val}</div>
          <div style={{ fontSize: 13, color: color, width: 12 }}>{status}</div>
        </div>
      ))}
      {/* Meal rows */}
      <div style={{ borderTop: '1px solid rgba(52,69,99,0.6)', marginTop: 16, paddingTop: 14 }}>
        {[
          { emoji: '🍗', name: 'Cookhouse Chicken Rice', kcal: '524 kcal', time: '12:30' },
          { emoji: '🥚', name: 'Hard-boiled Eggs × 3', kcal: '210 kcal', time: '07:15' },
        ].map(({ emoji, name, kcal, time }) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(38,132,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: '#D6E0EF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{name}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.6)' }}>{time}</div>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: '#4C9AFF' }}>{kcal}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightMockup() {
  return (
    <div
      style={{
        background: 'rgba(13,31,60,0.9)',
        border: '1px solid rgba(38,132,255,0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        minWidth: 300,
        maxWidth: 340,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 48px rgba(38,132,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #2684FF, #0747A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: '#F5F7FA' }}>AI Coaching Brief</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.6)' }}>Updated 2 hours ago</div>
        </div>
      </div>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(213,225,240,0.85)', lineHeight: 1.65, marginBottom: 16, fontStyle: 'italic' }}>
        &ldquo;Your protein intake has been consistently strong this week. On high-intensity days, consider adding 150–200 kcal from complex carbs 2 hours before PT.&rdquo;
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Protein adherence', val: '94%', color: '#57D9A3' },
          { label: 'Calorie target',    val: 'On track', color: '#57D9A3' },
          { label: 'Recovery score',    val: '↑ Improving', color: '#4C9AFF' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(38,132,255,0.06)', borderRadius: 8 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(165,173,186,0.8)' }}>{label}</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LeaderboardMockup() {
  const wings = [
    { rank: 1, name: 'DIS Wing', pts: 2847, bar: 100, gold: true },
    { rank: 2, name: 'Delta Wing', pts: 2543, bar: 89,  gold: false },
    { rank: 3, name: 'Echo Wing',  pts: 2401, bar: 84,  gold: false },
    { rank: 4, name: 'Charlie Wing',    pts: 1987, bar: 70,  gold: false },
  ]
  const rankColors: Record<number, string> = { 1: '#F59E0B', 2: '#A5ADBA', 3: '#B45309' }
  return (
    <div
      style={{
        background: 'rgba(13,31,60,0.9)',
        border: '1px solid rgba(38,132,255,0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 48px rgba(38,132,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(165,173,186,0.9)', textTransform: 'uppercase' }}>Wing Standings</span>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.5)' }}>LIVE</span>
      </div>
      {wings.map(({ rank, name, pts, bar, gold }) => (
        <div key={rank} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: rankColors[rank] || '#F5F7FA', width: 18 }}>{rank}</div>
            <div style={{ flex: 1, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, color: gold ? '#F5F7FA' : 'rgba(213,225,240,0.75)' }}>{name}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, color: gold ? '#4C9AFF' : 'rgba(165,173,186,0.7)' }}>{pts.toLocaleString()} pts</div>
          </div>
          <div style={{ marginLeft: 30, height: 4, background: 'rgba(52,69,99,0.7)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${bar}%`, background: gold ? 'linear-gradient(90deg, #2684FF, #4C9AFF)' : 'rgba(38,132,255,0.35)', borderRadius: 99, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkoutMockup() {
  return (
    <div
      style={{
        background: 'rgba(13,31,60,0.9)',
        border: '1px solid rgba(38,132,255,0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 48px rgba(38,132,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(165,173,186,0.9)', textTransform: 'uppercase' }}>Workout Log</span>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, background: 'rgba(87,217,163,0.12)', color: '#57D9A3', padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>POLAR SYNCED</span>
      </div>
      {[
        { icon: '🏃', name: '5km Route March', meta: '48 min · 380 kcal · GPS tracked', color: '#57D9A3' },
        { icon: '💪', name: 'SOC Circuit', meta: '35 min · 8 rounds', color: '#4C9AFF' },
        { icon: '🏊', name: 'Combat Swim', meta: '25 min · 220 kcal', color: '#A78BFA' },
      ].map(({ icon, name, meta, color }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(52,69,99,0.4)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(38,132,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, color: '#F5F7FA' }}>{name}</div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.6)' }}>{meta}</div>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
        </div>
      ))}
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────
interface FeatureCardProps {
  number: string
  title: string
  description: string
  tags?: string[]
}
function FeatureCard({ number, title, description, tags }: FeatureCardProps) {
  return (
    <div
      data-reveal
      style={{
        background: 'rgba(13,31,60,0.5)',
        border: '1px solid rgba(38,132,255,0.15)',
        borderRadius: 16,
        padding: '28px 28px',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(38,132,255,0.4)'
        el.style.boxShadow = '0 0 32px rgba(38,132,255,0.1)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(38,132,255,0.15)'
        el.style.boxShadow = 'none'
      }}
    >
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'rgba(38,132,255,0.6)', letterSpacing: '0.06em', marginBottom: 14 }}>{number}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 19, fontWeight: 700, color: '#F5F7FA', letterSpacing: '-0.01em', marginBottom: 10, lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(165,173,186,0.8)', lineHeight: 1.7, marginBottom: tags ? 16 : 0 }}>{description}</div>
      {tags && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <span key={tag} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 500, color: 'rgba(76,154,255,0.8)', background: 'rgba(38,132,255,0.08)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(38,132,255,0.15)' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function LandingPage() {
  useScrollReveal()

  const BG = '#060D1A'
  const BORDER = 'rgba(38,132,255,0.15)'
  const TEXT = '#F5F7FA'
  const TEXT_DIM = 'rgba(165,173,186,0.7)'

  const marqueeItems = [
    'Smart Nutrition', 'AI Coaching', 'Wing Competition', 'Polar Sync',
    'IPPT Prep', 'Progress Charts', 'Cookhouse Meals', 'Body Composition',
    'Smart Nutrition', 'AI Coaching', 'Wing Competition', 'Polar Sync',
    'IPPT Prep', 'Progress Charts', 'Cookhouse Meals', 'Body Composition',
  ]

  return (
    <div style={{ background: BG, color: TEXT, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 64,
        background: 'rgba(6,13,26,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(38,132,255,0.1)',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: TEXT }}>
          INAP<span style={{ color: '#2684FF' }}>·</span>Coach
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 500,
            color: TEXT_DIM, padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
            transition: 'color 0.15s ease',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM as string)}
          >
            Sign in
          </Link>
          <Link href="/signup" style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600,
            color: '#FFFFFF', background: '#0052CC',
            padding: '8px 20px', borderRadius: 8, textDecoration: 'none',
            transition: 'background 0.15s ease',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#003A8C')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0052CC')}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, overflow: 'hidden' }}>

        {/* Tactical grid background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(38,132,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(38,132,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '72px 72px',
        }} />

        {/* Radial glow */}
        <div className="landing-glow-pulse" style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 500, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(38,132,255,0.18) 0%, transparent 70%)',
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at center, transparent 50%, ${BG} 100%)`,
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 900, width: '100%', padding: '0 24px', boxSizing: 'border-box' }}>

          {/* Overline badge */}
          <div className="landing-hero-line-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(38,132,255,0.1)', border: '1px solid rgba(38,132,255,0.25)', borderRadius: 99, padding: '6px 16px', marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, background: '#2684FF', boxShadow: '0 0 8px #2684FF' }} />
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: '#4C9AFF', textTransform: 'uppercase' }}>Built for OCS Cadets</span>
          </div>

          {/* Headline */}
          <h1 className="landing-hero-line-2" style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 'clamp(40px, 7vw, 80px)',
            letterSpacing: '-0.04em', lineHeight: 1.0,
            color: TEXT, marginBottom: 8,
            textAlign: 'center', width: '100%',
          }}>
            YOUR PERFORMANCE
          </h1>
          <h1 className="landing-hero-line-3" style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 'clamp(40px, 7vw, 80px)',
            letterSpacing: '-0.04em', lineHeight: 1.0,
            background: 'linear-gradient(90deg, #2684FF, #6B9FFF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 32,
            textAlign: 'center', width: '100%',
            display: 'block',
          }}>
            COMMAND CENTRE
          </h1>

          {/* Subtitle */}
          <p className="landing-hero-line-4" style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(16px, 2vw, 19px)',
            color: TEXT_DIM, lineHeight: 1.7, maxWidth: 540, margin: '0 auto 40px',
          }}>
            Track nutrition, log workouts, and compete with your wing — with AI coaching fine-tuned for the OCS training environment.
          </p>

          {/* CTAs */}
          <div className="landing-hero-line-5" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 600,
              color: '#FFFFFF', background: '#0052CC',
              padding: '14px 32px', borderRadius: 10, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 0 24px rgba(0,82,204,0.3)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#003A8C'; e.currentTarget.style.boxShadow = '0 0 32px rgba(0,82,204,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0052CC'; e.currentTarget.style.boxShadow = '0 0 24px rgba(0,82,204,0.3)' }}
            >
              Begin mission
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </Link>
            <Link href="/login" style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 500,
              color: TEXT_DIM,
              padding: '14px 32px', borderRadius: 10, textDecoration: 'none',
              border: `1px solid ${BORDER}`,
              transition: 'border-color 0.15s ease, color 0.15s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(38,132,255,0.4)'; e.currentTarget.style.color = TEXT }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM as string }}
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: 0.4,
        }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, letterSpacing: '0.1em', color: TEXT_DIM, textTransform: 'uppercase' }}>Scroll</div>
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, rgba(38,132,255,0.6), transparent)` }} />
        </div>
      </section>

      {/* ── MARQUEE STRIP ─────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, overflow: 'hidden', padding: '14px 0', background: 'rgba(13,31,60,0.3)' }}>
        <div className="landing-marquee" style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
          {marqueeItems.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, paddingRight: 48 }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(76,154,255,0.6)', textTransform: 'uppercase' }}>{item}</span>
              <span style={{ width: 4, height: 4, borderRadius: 99, background: 'rgba(38,132,255,0.4)', flexShrink: 0 }} />
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES GRID ─────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div data-reveal style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 12 }}>What you get</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, maxWidth: 480, lineHeight: 1.1 }}>
            Every tool a cadet needs.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <FeatureCard
            number="01"
            title="Smart Nutrition"
            description="Log cookhouse meals, custom foods, and track macros against your TDEE-calculated daily targets."
            tags={['Cookhouse templates', 'Custom foods', 'Macro tracking']}
          />
          <FeatureCard
            number="02"
            title="Workout Logging"
            description="Log manually or sync automatically from your Polar device. Every SOC, route march, and gym session counted."
            tags={['Polar sync', 'GPS tracking', 'GPX maps']}
          />
          <FeatureCard
            number="03"
            title="AI Coaching"
            description="Gemini-powered daily briefs that analyse your week and deliver personalised coaching suggestions."
            tags={['Gemini 2.0 Flash', '24h refresh', 'Personalised']}
          />
          <FeatureCard
            number="04"
            title="Wing Competition"
            description="Live leaderboard where wings compete on IPPT scores, workouts, and nutrition adherence."
            tags={['Live rankings', 'Wing standings', 'IPPT points']}
          />
        </div>
      </section>

      {/* ── NUTRITION SPOTLIGHT ───────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
          <div data-reveal>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>Nutrition</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
              Fuel built for the cookhouse.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, lineHeight: 1.75, marginBottom: 24 }}>
              Every SAF cookhouse meal is pre-loaded. Log your tray in seconds. Set your goal — bulk, cut, maintain, or IPPT — and we calculate your exact daily targets using your TDEE.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Pre-loaded cookhouse templates',
                'Custom food entry per 100g',
                'Goal-aware macro targets',
                'Meal type detection (Breakfast / Lunch / Dinner)',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 99, background: 'rgba(38,132,255,0.15)', border: '1px solid rgba(38,132,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 99, background: '#2684FF' }} />
                  </div>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(213,225,240,0.8)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div data-reveal data-delay="2" style={{ display: 'flex', justifyContent: 'center' }}>
            <MacroMockup />
          </div>
        </div>
      </section>

      {/* ── AI INSIGHTS SPOTLIGHT ─────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
          <div data-reveal data-delay="2" style={{ display: 'flex', justifyContent: 'center', order: 1 }}>
            <InsightMockup />
          </div>
          <div data-reveal style={{ order: 2 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>AI Coaching</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
              Your personal coach, powered by Gemini.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, lineHeight: 1.75, marginBottom: 24 }}>
              Every 24 hours, our AI analyses your nutrition logs, workout data, sleep patterns, and progress — and delivers a personalised coaching brief, written for cadets.
            </p>
            <div style={{ background: 'rgba(38,132,255,0.06)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(76,154,255,0.8)', marginBottom: 6, fontWeight: 600 }}>Powered by</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: TEXT }}>Gemini 2.0 Flash → Llama 3.3 fallback</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: TEXT_DIM, marginTop: 4 }}>Always on. Always analysing.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WORKOUT SPOTLIGHT ─────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
          <div data-reveal>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>Workouts</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
              Every rep. Every march. Every swim.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, lineHeight: 1.75, marginBottom: 24 }}>
              Log manually or connect your Polar device for automatic sync. GPS tracks are visualised on interactive maps. Every session contributes to your wing&apos;s competition score.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['Polar Flow sync', 'GPS route maps', 'Sets & reps'].map(tag => (
                <span key={tag} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: 'rgba(76,154,255,0.8)', background: 'rgba(38,132,255,0.08)', padding: '4px 12px', borderRadius: 99, border: '1px solid rgba(38,132,255,0.15)' }}>{tag}</span>
              ))}
            </div>
          </div>
          <div data-reveal data-delay="2" style={{ display: 'flex', justifyContent: 'center' }}>
            <WorkoutMockup />
          </div>
        </div>
      </section>

      {/* ── WING COMPETITION SPOTLIGHT ────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 12 }}>Wing Competition</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, maxWidth: 560, margin: '0 auto 16px' }}>
            Your wing&apos;s honour is on the line.
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, maxWidth: 460, margin: '0 auto' }}>
            Points from IPPT scores, workout logs, and nutrition adherence roll up into a live wing leaderboard. Every meal you log matters.
          </p>
        </div>
        <div data-reveal data-delay="2" style={{ maxWidth: 520, margin: '0 auto' }}>
          <LeaderboardMockup />
        </div>
      </section>

      {/* ── CTA SECTION ───────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto 80px' }}>
        <div
          data-reveal
          style={{
            background: 'linear-gradient(135deg, rgba(0,52,204,0.15) 0%, rgba(13,31,60,0.6) 100%)',
            border: `1px solid rgba(38,132,255,0.25)`,
            borderRadius: 24,
            padding: 'clamp(40px, 6vw, 72px)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background glow */}
          <div style={{
            position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
            width: 600, height: 300, pointerEvents: 'none',
            background: 'radial-gradient(ellipse, rgba(38,132,255,0.12) 0%, transparent 70%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>Ready?</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, marginBottom: 16, lineHeight: 1.1 }}>
              Mission starts now.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 16, color: TEXT_DIM, marginBottom: 36, maxWidth: 400, margin: '0 auto 36px' }}>
              Join your wing. Set your targets. Track every meal, every workout, and every step toward peak performance.
            </p>
            <Link href="/signup" style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 600,
              color: '#FFFFFF', background: '#0052CC',
              padding: '16px 40px', borderRadius: 10, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 0 32px rgba(0,82,204,0.4)',
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#003A8C'; e.currentTarget.style.boxShadow = '0 0 48px rgba(0,82,204,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0052CC'; e.currentTarget.style.boxShadow = '0 0 32px rgba(0,82,204,0.4)' }}
            >
              Create your account
              <span style={{ fontSize: 20 }}>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${BORDER}`,
        padding: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: TEXT }}>
          INAP<span style={{ color: '#2684FF' }}>·</span>Coach
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: TEXT_DIM }}>
          Built for DIS Wing 14/26 Innovation Day.
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: TEXT_DIM, textDecoration: 'none' }}>Sign in</Link>
          <Link href="/signup" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#4C9AFF', textDecoration: 'none' }}>Get started</Link>
        </div>
      </footer>
    </div>
  )
}
