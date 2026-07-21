import React from 'react';

export function LaunchShell({ title, subtitle, children, accent = '#7c3aed' }) {
  return (
    <div style={styles.shell}>
      <div style={{ ...styles.hero, borderColor: `${accent}33` }}>
        <div style={styles.badge}>Launch Mode</div>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>
      <div style={styles.content}>{children}</div>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '12px',
    padding: '14px',
    background: 'radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 40%), linear-gradient(135deg, #07111f 0%, #0c1727 100%)',
    color: '#f8fafc',
  },
  hero: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
  },
  badge: {
    display: 'inline-flex',
    padding: '5px 8px',
    borderRadius: '999px',
    fontSize: '10px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    background: 'rgba(124,58,237,0.2)',
    color: '#c4b5fd',
    marginBottom: '8px',
  },
  title: { margin: 0, fontSize: '18px', fontWeight: 700 },
  subtitle: { margin: '6px 0 0', color: 'rgba(248,250,252,0.7)', fontSize: '12px' },
  content: { flex: 1, overflow: 'auto', borderRadius: '18px', background: 'rgba(15,23,42,0.78)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px' },
};
