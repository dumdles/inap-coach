'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Scroll-reveal: adds .is-visible when element enters viewport
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal], [data-reveal-card]')
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

// Fires once when an element enters the viewport — used to trigger mockup animations
function useInViewOnce(ref: React.RefObject<HTMLDivElement | null>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return visible
}

// ── Decorative mockup components ─────────────────────────

function MacroMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInViewOnce(ref)

  return (
    <div
      ref={ref}
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
      <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 36, fontWeight: 700, color: '#F5F7FA', letterSpacing: '-0.02em', lineHeight: 1 }}>1,847</div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(165,173,186,0.7)', marginBottom: 14 }}>of 2,184 kcal</div>
      {/* Main calorie bar — fills on enter */}
      <div style={{ height: 6, background: 'rgba(52,69,99,0.8)', borderRadius: 99, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: visible ? '84%' : '0%',
          background: 'linear-gradient(90deg, #2684FF, #4C9AFF)',
          borderRadius: 99,
          transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s',
        }} />
      </div>
      {/* Macro rows — fade in + bar fill, staggered */}
      {[
        { label: 'Protein', val: '132g', pct: 88, color: '#2684FF', status: '✓', d: 0.35 },
        { label: 'Carbs',   val: '189g', pct: 71, color: '#4C9AFF', status: '↑', d: 0.5 },
        { label: 'Fat',     val: '62g',  pct: 93, color: '#6B9FFF', status: '✓', d: 0.65 },
      ].map(({ label, val, pct, color, status, d }) => (
        <div
          key={label}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateX(-8px)',
            transition: `opacity 0.4s ease ${d}s, transform 0.4s ease ${d}s`,
          }}
        >
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(165,173,186,0.8)', width: 52 }}>{label}</div>
          <div style={{ flex: 1, height: 4, background: 'rgba(52,69,99,0.7)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: visible ? `${pct}%` : '0%',
              background: color, borderRadius: 99,
              transition: `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${d}s`,
            }} />
          </div>
          <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 600, color: '#F5F7FA', width: 36, textAlign: 'right' }}>{val}</div>
          <div style={{ fontSize: 13, color, width: 12 }}>{status}</div>
        </div>
      ))}
      {/* Meal rows — slide up, staggered */}
      <div style={{ borderTop: '1px solid rgba(52,69,99,0.6)', marginTop: 16, paddingTop: 14 }}>
        {[
          { emoji: '🍗', name: 'Cookhouse Chicken Rice', kcal: '524 kcal', time: '12:30', d: 0.85 },
          { emoji: '🥚', name: 'Hard-boiled Eggs × 3',   kcal: '210 kcal', time: '07:15', d: 1.0 },
        ].map(({ emoji, name, kcal, time, d }) => (
          <div
            key={name}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(6px)',
              transition: `opacity 0.4s ease ${d}s, transform 0.4s ease ${d}s`,
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(38,132,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: '#D6E0EF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{name}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.6)' }}>{time}</div>
            </div>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 600, color: '#4C9AFF' }}>{kcal}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInViewOnce(ref)

  return (
    <div
      ref={ref}
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
          <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 600, color: '#F5F7FA' }}>AI Coaching Brief</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.6)' }}>Updated 2 hours ago</div>
        </div>
      </div>
      {/* Brief text — fades in */}
      <p style={{
        fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(213,225,240,0.85)', lineHeight: 1.65, marginBottom: 16, fontStyle: 'italic',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease 0.2s',
      }}>
        &ldquo;Your protein intake has been consistently strong this week. On high-intensity days, consider adding 150–200 kcal from complex carbs 2 hours before PT.&rdquo;
      </p>
      {/* Stat rows — slide in from right, staggered */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Protein adherence', val: '94%',         color: '#57D9A3', d: 0.35 },
          { label: 'Calorie target',    val: 'On track',    color: '#57D9A3', d: 0.5 },
          { label: 'Recovery score',    val: '↑ Improving', color: '#4C9AFF', d: 0.65 },
        ].map(({ label, val, color, d }) => (
          <div
            key={label}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px', background: 'rgba(38,132,255,0.06)', borderRadius: 8,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateX(12px)',
              transition: `opacity 0.4s ease ${d}s, transform 0.4s ease ${d}s`,
            }}
          >
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(165,173,186,0.8)' }}>{label}</span>
            <span style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 12, fontWeight: 600, color }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LeaderboardMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInViewOnce(ref)

  const wings = [
    { rank: 1, name: 'DIS Wing',     pts: 2847, bar: 100, gold: true,  d: 0.15 },
    { rank: 2, name: 'Delta Wing',   pts: 2543, bar: 89,  gold: false, d: 0.3 },
    { rank: 3, name: 'Echo Wing',    pts: 2401, bar: 84,  gold: false, d: 0.45 },
    { rank: 4, name: 'Charlie Wing', pts: 1987, bar: 70,  gold: false, d: 0.6 },
  ]
  const rankColors: Record<number, string> = { 1: '#F59E0B', 2: '#A5ADBA', 3: '#B45309' }

  return (
    <div
      ref={ref}
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
      {/* Wing rows — fade up staggered; bars fill on enter */}
      {wings.map(({ rank, name, pts, bar, gold, d }) => (
        <div
          key={rank}
          style={{
            marginBottom: 14,
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(8px)',
            transition: `opacity 0.4s ease ${d}s, transform 0.4s ease ${d}s`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 15, fontWeight: 700, color: rankColors[rank] || '#F5F7FA', width: 18 }}>{rank}</div>
            <div style={{ flex: 1, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, color: gold ? '#F5F7FA' : 'rgba(213,225,240,0.75)' }}>{name}</div>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 600, color: gold ? '#4C9AFF' : 'rgba(165,173,186,0.7)' }}>{pts.toLocaleString()} pts</div>
          </div>
          <div style={{ marginLeft: 30, height: 4, background: 'rgba(52,69,99,0.7)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: visible ? `${bar}%` : '0%',
              background: gold ? 'linear-gradient(90deg, #2684FF, #4C9AFF)' : 'rgba(38,132,255,0.35)',
              borderRadius: 99,
              transition: `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${d + 0.1}s`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkoutMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInViewOnce(ref)

  return (
    <div
      ref={ref}
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
      {/* Workout rows — slide up, staggered */}
      {[
        { icon: '🏃', name: '5km Route March', meta: '48 min · 380 kcal · GPS tracked', color: '#57D9A3', d: 0.2 },
        { icon: '💪', name: 'SOC Circuit',     meta: '35 min · 8 rounds',              color: '#4C9AFF', d: 0.38 },
        { icon: '🏊', name: 'Combat Swim',     meta: '25 min · 220 kcal',              color: '#A78BFA', d: 0.56 },
      ].map(({ icon, name, meta, color, d }) => (
        <div
          key={name}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderBottom: '1px solid rgba(52,69,99,0.4)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(10px)',
            transition: `opacity 0.45s ease ${d}s, transform 0.45s ease ${d}s`,
          }}
        >
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

// ── Terminal typewriter hero headline ─────────────────────
const HERO_TEXT = 'Your performance command centre'
const GRADIENT_START = 17 // 'Your performance ' → 17 chars

function HeroHeadline() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Small pause before typing begins so the container animation settles first
    const start = setTimeout(() => {
      const iv = setInterval(() => {
        setCount(c => {
          if (c >= HERO_TEXT.length) { clearInterval(iv); return c }
          return c + 1
        })
      }, 48)
      return () => clearInterval(iv)
    }, 700)
    return () => clearTimeout(start)
  }, [])

  const typed    = HERO_TEXT.slice(0, count)
  const normal   = typed.slice(0, GRADIENT_START)
  const gradient = count > GRADIENT_START ? typed.slice(GRADIENT_START) : ''

  return (
    <h1
      className="landing-hero-typewriter"
      style={{
        fontFamily: 'Satoshi, sans-serif',
        fontWeight: 800,
        fontSize: 'clamp(38px, 6.5vw, 76px)',
        letterSpacing: '-0.04em',
        lineHeight: 1.05,
        color: '#F5F7FA',
        marginBottom: 32,
        textAlign: 'center',
        // Reserve vertical space so the layout doesn't jump as text grows
        minHeight: '1.15em',
      }}
    >
      {/* Terminal prompt character — steady, not blinking */}
      <span style={{ color: '#2684FF', fontWeight: 700, marginRight: 12, userSelect: 'none' }}>{'>'}</span>
      {normal}
      {gradient && (
        <span style={{
          background: 'linear-gradient(90deg, #2684FF, #6B9FFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {gradient}
        </span>
      )}
      {/* Block cursor — blinks the whole time */}
      <span className="terminal-cursor" />
    </h1>
  )
}

// ── Service-oriented coaching mockup ─────────────────────
type Service = 'Army' | 'Navy' | 'Air Force' | 'DIS'

const SERVICE_DATA: Record<Service, {
  accent: string
  icon: string
  tagline: string
  brief: string
  metrics: { label: string; val: string; accent: string }[]
  tags: string[]
}> = {
  Army: {
    accent: '#36B37E',
    icon: '⚔️',
    tagline: 'High load · Route marches · Field exercises',
    brief: '"Route march tomorrow — prioritise complex carbs tonight. Your VO₂ max is trending +4% over 3 weeks. Push your 2.4 km pace target to 10:30 next session."',
    metrics: [
      { label: 'Field camp in', val: '12d',  accent: '#FFAB00' },
      { label: 'SOC pass rate', val: '87%',  accent: '#36B37E' },
      { label: 'Route march',   val: '22 km', accent: '#4C9AFF' },
    ],
    tags: ['Load-bearing Endurance', 'SOC Circuit Prep', 'Field Ration Planning'],
  },
  Navy: {
    accent: '#2684FF',
    icon: '⚓',
    tagline: 'Moderate load · Combat swim · Naval drills',
    brief: '"Combat swim assessment in 5 days. Add 200 kcal on training days — you\'re under-fuelling. Core strength is the critical gap; target 3 dedicated sessions this week."',
    metrics: [
      { label: 'Swim assess in', val: '5d',   accent: '#FF5630' },
      { label: 'Swim score',     val: 'B+',   accent: '#36B37E' },
      { label: 'Core sessions',  val: '3/wk', accent: '#4C9AFF' },
    ],
    tags: ['Combat Swim Prep', 'Core Endurance', 'Naval PT Standards'],
  },
  'Air Force': {
    accent: '#A78BFA',
    icon: '✈️',
    tagline: 'Precision load · Aviation fitness · G-force prep',
    brief: '"Aviation medicine check next week. Maintain hydration above 2.5 L daily — altitude sensitivity increases at low body fat. Sleep consistency is excellent; keep it."',
    metrics: [
      { label: 'Av-med in', val: '7d',   accent: '#FFAB00' },
      { label: 'Hydration', val: '91%',  accent: '#36B37E' },
      { label: 'Sleep avg', val: '7.2h', accent: '#4C9AFF' },
    ],
    tags: ['Aviation Fitness Standards', 'Hydration Management', 'Precision PT'],
  },
  DIS: {
    accent: '#FFAB00',
    icon: '🔍',
    tagline: 'Moderate load · Intelligence ops · Analytical training',
    brief: '"Analytical peak week ahead. Sustain protein for cognitive performance — your brain rebuilds on amino acids. Recovery quality directly links to your assessment scores."',
    metrics: [
      { label: 'Assessment in',  val: '9d',   accent: '#FFAB00' },
      { label: 'Cognitive load', val: 'Peak', accent: '#FF5630' },
      { label: 'Recovery',       val: '78%',  accent: '#36B37E' },
    ],
    tags: ['Cognitive Recovery', 'Stress-load Nutrition', 'Moderate Intensity PT'],
  },
}

function ServiceMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInViewOnce(ref)
  const [selected, setSelected] = useState<Service>('Army')
  const [fading, setFading] = useState(false)

  const handleSelect = (svc: Service) => {
    if (svc === selected) return
    setFading(true)
    setTimeout(() => { setSelected(svc); setFading(false) }, 180)
  }

  const svc = SERVICE_DATA[selected]

  return (
    <div
      ref={ref}
      style={{
        background: 'rgba(13,31,60,0.9)',
        border: '1px solid rgba(38,132,255,0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        minWidth: 300,
        maxWidth: 420,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 48px rgba(38,132,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Service selector tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {(Object.keys(SERVICE_DATA) as Service[]).map(s => {
          const isActive = selected === s
          const a = SERVICE_DATA[s].accent
          return (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                border: `1px solid ${isActive ? a + '70' : 'rgba(52,69,99,0.7)'}`,
                background: isActive ? a + '18' : 'transparent',
                color: isActive ? a : 'rgba(165,173,186,0.6)',
                transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 12 }}>{SERVICE_DATA[s].icon}</span>
              {s}
            </button>
          )
        })}
      </div>

      {/* Animated content area */}
      <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}>
        {/* Service header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          padding: '10px 14px',
          background: svc.accent + '14',
          border: `1px solid ${svc.accent}35`,
          borderRadius: 10,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.4s ease 0.15s',
        }}>
          <span style={{ fontSize: 22 }}>{svc.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 700, color: svc.accent }}>{selected} Service</div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(165,173,186,0.65)' }}>{svc.tagline}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, background: svc.accent, boxShadow: `0 0 6px ${svc.accent}` }} />
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(165,173,186,0.5)', letterSpacing: '0.06em' }}>LIVE AI BRIEF</span>
          </div>
        </div>

        {/* AI brief quote */}
        <p style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(213,225,240,0.85)',
          lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.25s',
        }}>
          {svc.brief}
        </p>

        {/* Metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {svc.metrics.map((m, i) => (
            <div
              key={m.label}
              style={{
                padding: '10px 12px',
                background: 'rgba(38,132,255,0.06)',
                border: '1px solid rgba(38,132,255,0.1)',
                borderRadius: 10,
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(6px)',
                transition: `opacity 0.4s ease ${0.35 + i * 0.1}s, transform 0.4s ease ${0.35 + i * 0.1}s`,
              }}
            >
              <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 16, fontWeight: 700, color: m.accent, lineHeight: 1 }}>{m.val}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(165,173,186,0.6)', marginTop: 4, lineHeight: 1.3 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Focus tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {svc.tags.map((tag, i) => (
            <span
              key={tag}
              style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 500,
                color: svc.accent + 'CC',
                background: svc.accent + '18',
                padding: '3px 10px', borderRadius: 99,
                border: `1px solid ${svc.accent}35`,
                opacity: visible ? 1 : 0,
                transition: `opacity 0.35s ease ${0.55 + i * 0.08}s`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────
interface FeatureCardProps {
  number: string
  title: string
  description: string
  tags?: string[]
  delay?: number
}
function FeatureCard({ number, title, description, tags, delay }: FeatureCardProps) {
  return (
    <div
      data-reveal
      {...(delay !== undefined ? { 'data-delay': String(delay) } : {})}
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
      <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 700, color: 'rgba(38,132,255,0.6)', letterSpacing: '0.06em', marginBottom: 14 }}>{number}</div>
      <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 19, fontWeight: 700, color: '#F5F7FA', letterSpacing: '-0.01em', marginBottom: 10, lineHeight: 1.3 }}>{title}</div>
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

  // Paint the overscroll area (rubber-band on macOS / pull-to-refresh on mobile)
  // the same dark colour as the page so white never bleeds through.
  useEffect(() => {
    const bg = '#060D1A'
    document.documentElement.style.background = bg
    document.body.style.background = bg
    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
    }
  }, [])

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
        <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: TEXT }}>
          FitRep
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

          {/* Headline — typewriter with terminal cursor */}
          <HeroHeadline />

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
              <span style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(76,154,255,0.6)', textTransform: 'uppercase' }}>{item}</span>
              <span style={{ width: 4, height: 4, borderRadius: 99, background: 'rgba(38,132,255,0.4)', flexShrink: 0 }} />
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES GRID ─────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div data-reveal style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 12 }}>What you get</div>
          <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, maxWidth: 480, lineHeight: 1.1 }}>
            Every tool a cadet needs.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <FeatureCard
            number="01" delay={0}
            title="Smart Nutrition"
            description="Log cookhouse meals, custom foods, and track macros against your TDEE-calculated daily targets."
            tags={['Cookhouse templates', 'Custom foods', 'Macro tracking']}
          />
          <FeatureCard
            number="02" delay={2}
            title="Workout Logging"
            description="Log manually or sync automatically from your Polar device. Every SOC, route march, and gym session counted."
            tags={['Polar sync', 'GPS tracking', 'GPX maps']}
          />
          <FeatureCard
            number="03" delay={4}
            title="AI Coaching"
            description="Gemini-powered daily briefs that analyse your week and deliver personalised coaching suggestions."
            tags={['Gemini 2.0 Flash', '24h refresh', 'Personalised']}
          />
          <FeatureCard
            number="04" delay={6}
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
            <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
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
              ].map((item, i) => (
                <div key={item} data-reveal data-delay={String(i + 2)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 99, background: 'rgba(38,132,255,0.15)', border: '1px solid rgba(38,132,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 99, background: '#2684FF' }} />
                  </div>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(213,225,240,0.8)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div data-reveal-card data-delay="3" style={{ display: 'flex', justifyContent: 'center' }}>
            <MacroMockup />
          </div>
        </div>
      </section>

      {/* ── AI INSIGHTS SPOTLIGHT ─────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
          <div data-reveal-card data-delay="3" style={{ display: 'flex', justifyContent: 'center', order: 1 }}>
            <InsightMockup />
          </div>
          <div data-reveal style={{ order: 2 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>AI Coaching</div>
            <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
              Your personal coach, powered by Gemini.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, lineHeight: 1.75, marginBottom: 24 }}>
              Every 24 hours, our AI analyses your nutrition logs, workout data, sleep patterns, and progress — and delivers a personalised coaching brief, written for cadets.
            </p>
            <div style={{ background: 'rgba(38,132,255,0.06)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(76,154,255,0.8)', marginBottom: 6, fontWeight: 600 }}>Powered by</div>
              <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 16, fontWeight: 700, color: TEXT }}>Gemini 2.0 Flash → Llama 3.3 fallback</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: TEXT_DIM, marginTop: 4 }}>Always on. Always analysing.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICE COACHING SPOTLIGHT ────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
          <div data-reveal>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>Service-Oriented Coaching</div>
            <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
              Trained for your service.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, lineHeight: 1.75, marginBottom: 24 }}>
              Army, Navy, Air Force, DIS — each service runs a different training curriculum. FitRep knows the difference, and tailors every coaching insight, macro target, and recovery recommendation to your specific training load.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '⚔️', label: 'Army', desc: 'High-volume field training, route marches, and strength emphasis' },
                { icon: '⚓', label: 'Navy', desc: 'Swim fitness, VO₂ endurance, and maritime operational drills' },
                { icon: '✈️', label: 'Air Force', desc: 'Aerobic base building, precision conditioning, and HIIT cycles' },
                { icon: '🔍', label: 'DIS / MIDS', desc: 'Balanced conditioning with cognitive-performance nutrition focus' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 16, marginTop: 1 }}>{icon}</span>
                  <div>
                    <span style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 14, fontWeight: 700, color: TEXT }}>{label}</span>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: TEXT_DIM, marginLeft: 8 }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div data-reveal-card data-delay="3" style={{ display: 'flex', justifyContent: 'center' }}>
            <ServiceMockup />
          </div>
        </div>
      </section>

      {/* ── WORKOUT SPOTLIGHT ─────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
          <div data-reveal>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>Workouts</div>
            <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, marginBottom: 20 }}>
              Every rep. Every march. Every swim.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, lineHeight: 1.75, marginBottom: 24 }}>
              Log manually or connect your Polar device for automatic sync. GPS tracks are visualised on interactive maps. Every session contributes to your wing&apos;s competition score.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['Polar Flow sync', 'GPS route maps', 'Sets & reps'].map((tag, i) => (
                <span key={tag} data-reveal data-delay={String(i + 2)} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: 'rgba(76,154,255,0.8)', background: 'rgba(38,132,255,0.08)', padding: '4px 12px', borderRadius: 99, border: '1px solid rgba(38,132,255,0.15)' }}>{tag}</span>
              ))}
            </div>
          </div>
          <div data-reveal-card data-delay="3" style={{ display: 'flex', justifyContent: 'center' }}>
            <WorkoutMockup />
          </div>
        </div>
      </section>

      {/* ── WING COMPETITION SPOTLIGHT ────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(76,154,255,0.7)', textTransform: 'uppercase', marginBottom: 12 }}>Wing Competition</div>
          <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1, maxWidth: 560, margin: '0 auto 16px' }}>
            Your wing&apos;s honour is on the line.
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: TEXT_DIM, maxWidth: 460, margin: '0 auto' }}>
            Points from IPPT scores, workout logs, and nutrition adherence roll up into a live wing leaderboard. Every meal you log matters.
          </p>
        </div>
        <div data-reveal-card data-delay="2" style={{ maxWidth: 520, margin: '0 auto' }}>
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
            <h2 style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', color: TEXT, marginBottom: 16, lineHeight: 1.1 }}>
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
        <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 16, fontWeight: 800, color: TEXT }}>
          FitRep
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
