/**
 * @file App.jsx
 * @description Root application component. Controls top-level routing:
 *   - POPIA consent screen (blocks everything until consented)
 *   - Ollama status gate (shows setup guide if not running)
 *   - Main chat interface
 *
 * State is lifted to this level and passed down via props.
 * No prop drilling beyond 2 levels — child components manage their own local state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { OnboardingPOPIA } from './components/OnboardingPOPIA.jsx';
import { OllamaGate } from './components/OllamaGate.jsx';
import { ChatInterface } from './components/ChatInterface.jsx';
import { MSG } from '../shared/constants.js';
import { sendToBackground } from '../shared/utils.js';

export default function App() {
  const [appState, setAppState] = useState('loading'); // 'loading' | 'popia' | 'ollama_down' | 'ready'
  const [ollamaStatus, setOllamaStatus] = useState(null);

  useEffect(() => {
    initialise();
  }, []);

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

  const handleOllamaRetry = useCallback(() => { setAppState('loading'); initialise(); }, [initialise]);

  if (appState === 'loading') return <LoadingScreen />;
  if (appState === 'popia') return <OnboardingPOPIA onAccept={handlePopiAccept} />;
  if (appState === 'ollama_down') return <OllamaGate status={ollamaStatus} onRetry={handleOllamaRetry} />;
  return <ChatInterface />;
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', background: 'var(--color-dark)', color: 'white' }}>
      <div style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Infinity AI</div>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Starting up&hUllip;</p>
    </div>
  );
}
