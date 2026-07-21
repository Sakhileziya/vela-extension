import React, { useEffect, useState } from 'react';
import { BRAND, DEFAULT_SETTINGS, MODEL_PROVIDERS } from '../../shared/constants.js';

export function SettingsPanel({ settings, onSave }) {
  const [form, setForm] = useState(settings || DEFAULT_SETTINGS);

  useEffect(() => {
    setForm(settings || DEFAULT_SETTINGS);
  }, [settings]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => onSave?.(form);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.title}>Inference Settings</div>
        <div style={styles.subtitle}>Run locally with Ollama or connect to a hosted cloud proxy.</div>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Provider Mode</label>
        <select style={styles.select} value={form.provider} onChange={(e) => update('provider', e.target.value)}>
          <option value={MODEL_PROVIDERS.OLLAMA}>Local Ollama</option>
          <option value={MODEL_PROVIDERS.CLOUD}>Cloud / Hosted Proxy</option>
        </select>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Backend URL</label>
        <input style={styles.input} value={form.backendUrl || ''} onChange={(e) => update('backendUrl', e.target.value)} placeholder="http://localhost:3000" />
        <div style={styles.helper}>For a cloud proxy, point this at your own backend such as the included Node server.</div>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Model Provider</label>
        <select style={styles.select} value={form.apiProvider || 'groq'} onChange={(e) => update('apiProvider', e.target.value)}>
          <option value="groq">Groq</option>
          <option value="openai">OpenAI-compatible API</option>
          <option value="together">Together AI</option>
        </select>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Chat Model</label>
        <input style={styles.input} value={form.model || ''} onChange={(e) => update('model', e.target.value)} placeholder="llama3.2:3b" />
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Embedding Model</label>
        <input style={styles.input} value={form.embedModel || ''} onChange={(e) => update('embedModel', e.target.value)} placeholder="nomic-embed-text" />
      </div>

      <button style={styles.saveButton} onClick={handleSave}>Save Settings</button>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', height: '100%', overflowY: 'auto', background: 'var(--color-dark)', color: 'white' },
  header: { display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '4px' },
  title: { fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700 },
  subtitle: { fontSize: '12px', color: 'rgba(255,255,255,0.6)' },
  card: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.25)', color: 'white' },
  select: { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.25)', color: 'white' },
  helper: { fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 },
  saveButton: { background: BRAND.COLOURS.PRIMARY, color: 'white', border: 'none', borderRadius: '10px', padding: '12px 14px', fontWeight: 700, cursor: 'pointer' },
};
