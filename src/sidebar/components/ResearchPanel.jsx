/**
 * @file ResearchPanel.jsx
 * @description UI for the autonomous web research feature.
 * User types a query, the AI opens tabs, reads them, and delivers a synthesized summary.
 */

import React, { useState, useRef } from 'react';
import { MSG, BRAND } from '../../shared/constants.js';
import { sendToBackground } from '../../shared/utils.js';

export function ResearchPanel() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleStart = async () => {
    const q = query.trim();
    if (!q || status === 'running') return;

    setStatus('running');
    setProgress([]);
    setResult(null);
    setError(null);

    // Listen for progress updates streamed from background
    const listener = (message) => {
      if (message.type === MSG.RESEARCH_PROGRESS) {
        setProgress((prev) => [...prev, message.update]);
      } else if (message.type === MSG.RESEARCH_DONE) {
        setResult(message.result);
        setStatus('done');
        chrome.runtime.onMessage.removeListener(listener);
      } else if (message.type === MSG.RESEARCH_ERROR) {
        setError(message.error);
        setStatus('error');
        chrome.runtime.onMessage.removeListener(listener);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    try {
      await sendToBackground({ type: MSG.RESEARCH_START, query: q });
    } catch (e) {
      setError(e.message);
      setStatus('error');
      chrome.runtime.onMessage.removeListener(listener);
    }
  };

  const handleAbort = async () => {
    await sendToBackground({ type: MSG.RESEARCH_ABORT });
    setStatus('error');
    setError('Research cancelled.');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStart(); }
  };

  // ── Stage icons ──────────────────────────────────────────────────────────────

  const stageIcon = {
    searching: '🔍',
    planning: '🗂',
    browsing: '🌐',
    synthesizing: '🧠',
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Research Agent</span>
        <span style={styles.headerSub}>Opens tabs · reads pages · summarises locally</span>
      </div>

      {/* Query input */}
      <div style={styles.inputRow}>
        <textarea
          ref={inputRef}
          style={styles.textarea}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Best accounting software for small businesses in South Africa"
          rows={2}
          disabled={status === 'running'}
        />
        {status === 'running' ? (
          <button style={{ ...styles.btn, background: 'var(--color-error)' }} onClick={handleAbort}>
            Stop
          </button>
        ) : (
          <button
            style={{ ...styles.btn, opacity: query.trim() ? 1 : 0.4 }}
            onClick={handleStart}
            disabled={!query.trim()}
          >
            ↗
          </button>
        )}
      </div>

      {/* Progress log */}
      {progress.length > 0 && (
        <div style={styles.progressBox}>
          {progress.map((p, i) => (
            <div key={i} style={styles.progressItem}>
              <span style={styles.stageIcon}>{stageIcon[p.stage] || '•'}</span>
              <span>{p.message}</span>
            </div>
          ))}
          {status === 'running' && <div style={styles.spinner}>Thinking…</div>}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={styles.result}>
          <div style={styles.resultBody}>
            {result.summary.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < result.summary.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
          {result.sources?.length > 0 && (
            <div style={styles.sources}>
              <strong>Sources:</strong>
              {result.sources.map((s, i) => (
                <div key={i} style={styles.source}>
                  <a
                    href={s}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--color-primary)', fontSize: '11px', wordBreak: 'break-all' }}
                  >
                    {s}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {/* Empty state */}
      {!result && !error && status === null && (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>Research anything</p>
          <div style={styles.suggestions}>
            {[
              'Competitors for my courier business in Johannesburg',
              'Tax requirements for a new Pty Ltd in South Africa',
              'Best free CRM tools for a 5-person sales team',
              'How to set up a WhatsApp Business API account',
            ].map((s, i) => (
              <button key={i} style={styles.suggestion} onClick={() => setQuery(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: {
    padding: '12px 14px 8px',
    background: 'var(--color-dark)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  headerTitle: { fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'white', display: 'block' },
  headerSub: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'block' },
  inputRow: { display: 'flex', gap: '8px', padding: '10px 12px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexShrink: 0, alignItems: 'flex-end' },
  textarea: {
    flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'none',
    outline: 'none', color: 'var(--color-text)', background: 'var(--color-surface)',
    lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto',
  },
  btn: {
    background: 'var(--color-primary)', color: 'white', border: 'none',
    borderRadius: 'var(--radius-md)', width: '36px', height: '36px', fontSize: '16px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  progressBox: {
    background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0,
  },
  progressItem: { display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--color-text-muted)', alignItems: 'flex-start' },
  stageIcon: { fontSize: '14px', flexShrink: 0 },
  spinner: { fontSize: '11px', color: BRAND.COLOURS.PRIMARY, marginTop: '4px', fontStyle: 'italic' },
  result: { flex: 1, overflowY: 'auto', padding: '14px' },
  resultBody: { fontSize: '13px', lineHeight: 1.7, color: 'var(--color-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  sources: { marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' },
  source: { marginTop: '4px' },
  errorBox: { margin: '12px', padding: '10px 12px', background: 'rgba(224,60,49,0.1)', border: '1px solid rgba(224,60,49,0.2)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-error)' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '14px' },
  emptyTitle: { fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', textAlign: 'center' },
  suggestions: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' },
  suggestion: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    padding: '8px 12px', fontSize: '12px', color: 'var(--color-text-muted)', cursor: 'pointer',
    textAlign: 'left', fontFamily: 'var(--font-body)',
  },
};
