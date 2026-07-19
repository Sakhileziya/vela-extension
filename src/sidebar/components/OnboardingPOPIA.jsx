/**
 * @file OnboardingPOPIA.jsx
 * @description POPIA consent screen — shown once, blocks all functionality until accepted.
 * Required by law. Non-negotiable.
 */

import React, { useState } from 'react';
import { POPIA_CONFIG, BRAND } from '../../shared/constants.js';

export function OnboardingPOPIA({ onAccept }) {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>Infinity AI</div>
        <p style={styles.tagline}>{BRAND.TAGLINE}</p>
      </div>
      <div style={styles.body}>
        <h2 style={styles.title}>Welcome to Infinity AI</h2>
        <p style={styles.subtitle}>
          Africa's first AI browser companion. Before we begin, we need your permission
          to process certain data as required by the{' '}
          <strong>Protection of Personal Information Act (POPIA)</strong>.
        </p>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>What Infinity AI processes:</h3>
          <ul style={styles.list}>
            <li style={styles.listItem}><span style={styles.bullet}>•</span> Browsing context (page titles, URLs, page content)</li>
            <li style={styles.listItem}><span style={styles.bullet}>•</span> Conversation history (stored locally)</li>
            <li style={styles.listItem}><span style={styles.bullet}>•</span> Memory embeddings (local only)</li>
          </ul>
        </div>
        <div style={{ ...styles.card, background: 'rgba(27, 122, 74, 0.08)', borderColor: 'var(--color-primary)' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 500 }}>
            All AI processing happens locally on your device via Ollama. No data is sent to external AI servers.
          </p>
        </div>
        <label style={styles.checkboxLabel}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={styles.checkbox} />
          <span>I consent to Infinity AI processing my data for AI-powered browsing assistance.</span>
        </label>
        <button
          style={{ ...styles.ctaButton, opacity: accepted ? 1 : 0.5, cursor: accepted ? 'pointer' : 'not-allowed' }}
          onClick={() => accepted && onAccept()}
          disabled={!accepted}
        >
          Accept and Start Using Infinity AI
        </button>
        <p style={styles.footer}>By continuing you confirm you have read and understood our data practices.</p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-dark)', overflowY: 'auto' },
  header: { background: 'var(--color-primary)', padding: '20px 16px', textAlign: 'center' },
  logo: { fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: 'white' },
  tagline: { color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '4px' },
  body: { padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px', color: 'white' },
  title: { fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700 },
  subtitle: { fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 },
  card: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '14px' },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '8px' },
  list: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' },
  listItem: { fontSize: '13px', color: 'rgba(255,255,255,0.75)', display: 'flex', gap: '8px', lineHeight: 1.4 },
  bullet: { color: 'var(--color-primary)' },
  checkboxLabel: { display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', lineHeight: 1.5 },
  checkbox: { accentColor: 'var(--color-primary)', width: '16px', height: '16px', flexShrink: 0 },
  ctaButton: { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '15px', fontFamily: 'var(--font-heading)', fontWeight: 600, cursor: 'pointer', width: '100%' },
  footer: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingBottom: '8px' },
};
