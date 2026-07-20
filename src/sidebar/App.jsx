/**
 * @file App.jsx
 * @description Root application component.
 *
 * Routing order:
 *   1. Loading screen
 *   2. POPIA consent gate
 *   3. Ollama health gate
 *   4. Main app — tabbed: Chat | Research | Agents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { OnboardingPOPIA } from './components/OnboardingPOPIA.jsx';
import { OllamaGate } from './components/OllamaGate.jsx';
import { ChatInterface } from './components/ChatInterface.jsx';
import { ResearchPanel } from './components/ResearchPanel.jsx';
import { AgentBuilder } from './components/AgentBuilder.jsx';
import { MSG, BRAND } from '../shared/constants.js';
import { sendToBackground } from '../shared/utils.js';

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'chat',     label: 'Chat',    icon: '💬' },
  { id: 'research', label: 'Research', icon: '🔍' },
  { id: 'agents',   label: 'Agents',   icon: '⚡' },
];

// ── Root component ───��────────────────────────────────────────────────────────

export default function App() {
  const [appState, setAppState] = useState('loading'); // 'loading'|'popia'|'ollama_down'|'ready'
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');

  useEffect(() => { initialise(); }, []);

  const initialise = useCallback(async () => {
    try {
      const popiStatus = await sendToBackground({ type: MSG.POPIA_GET_STATUS });
      if (!popiStatus?.consented) { setAppState('popia'); return; }

      const health = await sendToBackground({ type: MSG.OLLAMA_HEALTH });
      setOllamaStatus(health);

      if (!health?.online || !health?.hasModel) { setAppState('ollama_down'); return; }

      setAppState('ready');
    } catch (error) {
      console.error('[Infinity AI] App initialisation failed:', error);
      setAppState('ollama_down');
    }
  }, []);

  const handlePopiAccept = useCallback(async () => {
    await sendToBackground({ type: MSG.POPIA_SET_CONSENT, consented: true });
    initialise();
  }, [initialise]);

  const handleOllamaRetry = useCallback(() => {
    setAppState('loading');
    initialise();
  }, [initialise]);

  // ── Gate screens ──────────────────────────────────────────────────────────

  if (appState === 'loading') return <LoadingScreen />;
  if (appState === 'popia')   return <OnboardingPOPIA onAccept={handlePopiAccept} />;
  if (appState === 'ollama_down') return <OllamaGate status={ollamaStatus} onRetry={handleOllamaRetry} />;

  // ── Main app ──────────────────────────────────────────────────────────────

  return (
    <div style={styles.shell}>
      {/* Content area — each tab is mounted but hidden when inactive (preserves state) */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ ...styles.panel, display: activeTab === 'chat'     ? 'flex' : 'none' }}>
          <ChatInterface />
        </div>
        <div style={{ ...styles.panel, display: activeTab === 'research' ? 'flex' : 'none' }}>
          <ResearchPanel />
        </div>
        <div style={{ ...styles.panel, display: activeTab === 'agents'   ? 'flex' : 'none' }}>
          <AgentBuilder />
        </div>
      </div>

      {/* Bottom tab bar */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tabBtn,
              borderTop: activeTab === tab.id
                ? `2px solid ${BRAND.COLOURS.PRIMARY}`
                : '2px solid transparent',
              color: activeTab === tab.id ? BRAND.COLOURS.PRIMARY : 'rgba(255,255,255,0.45)',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: '12px',
      background: 'var(--color-dark)', color: 'white',
    }}>
      <div style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
        Infinity AI
      </div>
      <div style={{
        width: '22px', height: '22px',
        border: '2px solid rgba(255,255,255,0.15)',
        borderTopColor: BRAND.COLOURS.PRIMARY,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Starting up…</p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--color-surface-2)',
  },
  panel: {
    position: 'absolute',
    inset: 0,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    background: 'var(--color-dark)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  tabBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 4px 6px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    gap: '2px',
    transition: 'color 0.15s',
  },
  tabIcon: { fontSize: '16px', lineHeight: 1 },
  tabLabel: { fontSize: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '0.03em' },
};
