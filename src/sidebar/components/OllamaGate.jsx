/**
 * @file OllamaGate.jsx
 * @description Setup guide shown when Ollama is not running or model is missing.
 * Gives exact terminal commands — no ambiguity.
 */

import React from 'react';

export function OllamaGate({ status, onRetry }) {
  const isOffline = !status?.online;
  const modelMissing = status?.online && !status?.hasModel;
  const isCloud = status?.provider && status.provider !== 'ollama';

  return (
    <div style={styles.container}>
      <div style={styles.icon}>{isOffline ? '⚠️' : '📦'}</div>
      <h2 style={styles.title}>
        {isCloud ? 'Inference Backend Unavailable' : isOffline ? 'Ollama Not Running' : 'Model Not Found'}
      </h2>
      <p style={styles.desc}>
        {isCloud
          ? 'The hosted inference backend is not reachable yet. Check your server and provider credentials.'
          : isOffline
            ? 'Infinity Browser AI uses Ollama to run AI locally on your device. Ollama is not running right now.'
            : 'Ollama is running but the required model is not installed.'}
      </p>
      <div style={styles.steps}>
        {isOffline && (
          <>
            <Step number={1} title="Open your terminal and run:">
              <Code>ollama serve</Code>
            </Step>
            <Step number={2} title="If Ollama is not installed, download it first:">
              <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Download Ollama from ollama.ai ₒ
              </a>
            </Step>
          </>
        )}
        {(isOffline || modelMissing) && (
          <Step number={isOffline ? 3 : 1} title="Pull the required model (8GB RAM optimised):">
            <Code>ollama pull llama3.2:3b</Code>
            <Code>ollama pull nomic-embed-text</Code>
          </Step>
        )}
        <Step number={isOffline ? 4 : 2} title="Then click retry:">
          <button style={styles.retryButton} onClick={onRetry}>Retry Connection</button>
        </Step>
      </div>
      <p style={styles.footer}>All processing stays on your device. Nothing is sent to external servers.</p>
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div style={styles.step}>
      <div style={styles.stepHeader}>
        <span style={styles.stepNumber}>{number}</span>
        <span style={styles.stepTitle}>{title}</span>
      </div>
      <div style={styles.stepContent}>{children}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <div style={styles.code}><code style={styles.codeText}>{children}</code></div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: '16px', height: '100%', overflowY: 'auto', background: 'var(--color-dark)', color: 'white' },
  icon: { fontSize: '40px' },
  title: { fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, textAlign: 'center' },
  desc: { fontSize: '13px', color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 1.6, maxWidth: '280px' },
  steps: { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' },
  step: { background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' },
  stepHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  stepNumber: { background: 'var(--color-primary)', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  stepTitle: { fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' },
  stepContent: { display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '32px' },
  code: { background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' },
  codeText: { fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: '12px', color: '#7DD3FC' },
  link: { color: 'var(--color-secondary)', fontSize: '13px' },
  retryButton: { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontFamily: 'var(--font-heading)', fontWeight: 600, cursor: 'pointer', width: '100%' },
  footer: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingBottom: '8px' },
};
