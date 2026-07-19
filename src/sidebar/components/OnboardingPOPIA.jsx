/**
 * @file OnboardingPOPIA.jsx
 * @description POPIA consent screen — shown once, blocks all functionality until accepted.
 * Required by law. Non-negotiable. Logs consent timestamp to background.
 */

import React, { useState } from 'react';
import { POPIA, BRAND } from '../../shared/constants.js';

export function OnboardingPOPIA({ onAccept }) {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = () => {
    if (!accepted) return;
    onAccept();
  };

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.logo}>Vela</div>
        <p style={styles.tagline}>{BRAND.TAGLINE}</p>
      </div>

      {/* ── Welcome ── */}
      <div style={styles.body}>
        <h2 style={styles.title}>Welcome to Vela</h2>
        <p style={styles.subtitle}>
          Africa's first AI browser companion. Before we begin, we need your permission
          to process certain data as required by the{' '}
          <strong>Protection of Personal Information Act (POPIA)</strong>.
        </p>

        {/* ── What We Process ── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>What Vela processes:</h3>
          <ul style={styles.list}>
            {POPIA.DATA_CATEGORIES.map((item, i) => (
              <li key={i} style={styles.listItem}>
                <span style={styles.bullet}>•</span> {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Local Processing Note ── */}
        <div style={{ ...styles.card, background: 'rgba(27, 122, 74, 0.08)', borderColor: 'var(--color-primary)' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 500 }}>
            All AI processing happens locally on your device via Ollama.
            No data is sent to external AI servers.
          </p>
        </div>

        {/* ── Expandable Rights ── */}
        <button
          style={styles.expandButton}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          Your rights under POPIA {expanded ? '▲' : '▼'}
        </button>

        {expanded && (
          <div style={styles.card}>
            <ul style={styles.list}>
              {POPIA.USER_RIGHTS.map((right, i) => (
                <li key={i} style={styles.listItem}>
                  <span style={styles.bullet}>✓</span> {right}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Information Officer: {POPIA.INFORMATION_OFFICER_EMAIL}<br />
              Data retained for: {POPIA.RETENTION_DAYS} days<br />
              Regulator:{' '}
              <a
                href={POPIA.REGULATOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)' }}
              >
                {POPIA.REGULATOR}
              </a>
            </p>
          </div>
        )}

        {/* ── Consent Checkbox ── */}
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={styles.checkbox}
          />
          <span>
            I consent to Vela processing my data for:{' '}
            <em>{POPIA.DATA_PURPOSE}</em>
          </span>
        </label>

        {/* ── CTA ── */}
        <button
          style={{
            ...styles.ctaButton,
            opacity: accepted ? 1 : 0.5,
            cursor: accepted ? 'pointer' : 'not-allowed',
          }}
          onClick={handleSubmit}
          disabled={!accepted}
          aria-disabled={!accepted}
        >
          Accept and Start Using Vela
        </button>

        <p style={styles.footer}>
          By continuing you confirm you have read and understood our data practices.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--color-dark)',
    overflowY: 'auto',
  },
  header: {
    background: 'var(--color-primary)',
    padding: '20px 16px',
    textAlign: 'center',
  },
  logo: {
    fontFamily: 'var(--font-heading)',
    fontSize: '28px',
    fontWeight: 700,
    color: 'white',
    letterSpacing: '-0.5px',
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '12px',
    marginTop: '4px',
  },
  body: {
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    color: 'white',
  },
  title: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.6,
  },
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
  },
  cardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '8px',
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  listItem: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.75)',
    display: 'flex',
    gap: '8px',
    lineHeight: 1.4,
  },
  bullet: {
    color: 'var(--color-primary)',
    flexShrink: 0,
    marginTop: '1px',
  },
  expandButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '4px 0',
    fontFamily: 'var(--font-body)',
    textDecoration: 'underline',
  },
  checkboxLabel: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer',
    lineHeight: 1.5,
  },
  checkbox: {
    marginTop: '2px',
    accentColor: 'var(--color-primary)',
    width: '16px',
    height: '16px',
    flexShrink: 0,
    cursor: 'pointer',
  },
  ctaButton: {
    background: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    fontSize: '15px',
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    width: '100%',
  },
  footer: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 1.5,
    paddingBottom: '8px',
  },
};
