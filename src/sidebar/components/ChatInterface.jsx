/**
 * @file ChatInterface.jsx
 * @description The main chat UI. Handles companion selection, message display,
 * input, streaming responses, and action triggers.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MSG, BRAND } from '../../shared/constants.js';
import { sendToBackground, debounce } from '../../shared/utils.js';

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChatInterface() {
  const [companions, setCompanions] = useState([]);
  const [activeCompanion, setActiveCompanion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamBufferRef = useRef('');

  useEffect(() => {
    loadCompanions();
  }, []);

  useEffect(() => {
    const listener = (message) => {
      if (message.type === MSG.STREAM_CHUNK) {
        streamBufferRef.current += message.token;
        setStreamingContent(streamBufferRef.current);
      } else if (message.type === MSG.STREAM_DONE) {
        const finalText = streamBufferRef.current;
        streamBufferRef.current = '';
        setStreamingContent('');
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: finalText, id: Date.now() },
        ]);
        if (activeCompanion) loadHistory(activeCompanion.id);
      } else if (message.type === MSG.STREAM_ERROR) {
        streamBufferRef.current = '';
        setStreamingContent('');
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: 'error', content: message.error || 'An error occurred.', id: Date.now() },
        ]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [activeCompanion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const loadCompanions = async () => {
    const result = await sendToBackground({ type: MSG.COMPANION_GET_ALL });
    if (result?.companions) {
      setCompanions(result.companions);
      const active = result.companions.find((c) => c.id === result.activeId);
      if (active) {
        setActiveCompanion(active);
        loadHistory(active.id);
      }
    }
  };

  const loadHistory = async (companionId) => {
    const result = await sendToBackground({ type: MSG.MEMORY_GET, companionId });
    if (result?.history) {
      setMessages(result.history.map((m, i) => ({ ...m, id: m.timestamp || i })));
    }
  };

  const handleSelectCompanion = async (companion) => {
    await sendToBackground({ type: MSG.COMPANION_SET_ACTIVE, id: companion.id });
    setActiveCompanion(companion);
    setShowCompanionPicker(false);
    loadHistory(companion.id);
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !activeCompanion) return;
    setInput('');
    setIsStreaming(true);
    streamBufferRef.current = '';
    setMessages((prev) => [...prev, { role: 'user', content: text, id: Date.now() }]);
    await sendToBackground({ type: MSG.CHAT_SEND, companionId: activeCompanion.id, userMessage: text });
  }, [input, isStreaming, activeCompanion]);

  const handleAbort = async () => {
    await sendToBackground({ type: MSG.CHAT_ABORT });
    streamBufferRef.current = '';
    setStreamingContent('');
    setIsStreaming(false);
  };

  const handleClearChat = async () => {
    if (!activeCompanion) return;
    await sendToBackground({ type: MSG.MEMORY_CLEAR, companionId: activeCompanion.id });
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.companionButton} onClick={() => setShowCompanionPicker((s) => !s)} title="Switch companion">
          <span style={{ ...styles.companionDot, background: activeCompanion?.color || BRAND.COLOURS.PRIMARY }} />
          <span style={styles.companionName}>{activeCompanion?.name || 'Infinity AI'}</span>
          <span style={styles.companionRole}>{activeCompanion?.role || ''}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '10px' }}>▼</span>
        </button>
        <button style={styles.clearButton} onClick={handleClearChat} title="Clear conversation">Clear</button>
      </div>

      {showCompanionPicker && (
        <div style={styles.companionPicker}>
          {companions.map((c) => (
            <button key={c.id} style={{ ...styles.companionOption, background: c.id === activeCompanion?.id ? 'rgba(27,122,74,0.1)' : 'transparent' }} onClick={() => handleSelectCompanion(c)}>
              <span style={{ ...styles.companionDot, background: c.color }} />
              <div><div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div><div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.role}</div></div>
            </button>
          ))}
        </div>
      )}

      <div style={styles.messages}>
        {messages.length === 0 && <EmptyState companionName={activeCompanion?.name} />}
        {messages.map((msg) => <Message key={msg.id} message={msg} />)}
        {isStreaming && <Message message={{ role: 'assistant', content: streamingContent || '', isStreaming: true }} />}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <textarea ref={inputRef} style={styles.textarea} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Ask ${activeCompanion?.name || 'Infinity AI'} anything…g} rows={1} disabled={isStreaming} aria-label="Message input" />
        {isStreaming ? (
          <button style={{ ...styles.sendButton, background: 'var(--color-error)' }} onClick={handleAbort}>Stop</button>
        ) : (
          <button style={{ ...styles.sendButton, opacity: input.trim() ? 1 : 0.4, cursor: input.trim() ? 'pointer' : 'default' }} onClick={handleSend} disabled={!input.trim()} aria-label="Send message">↑</button>
        )}
      </div>

      <div style={styles.footer}><span>Powered by Ollama — processing locally on your device</span></div>
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  return (
    <div style={{ ...styles.messageWrapper, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ ...styles.messageBubble, background: isUser ? 'var(--color-primary)' : isError ? 'rgba(224,60,49,0.1)' : 'var(--color-surface)', color: isUser ? 'white' : isError ? 'var(--color-error)' : 'var(--color-text)', border: isUser ? 'none' : `1px solid ${isError ? 'rgba(224,60,49,0.2)' : 'var(--color-border)'}`, alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: isUser ? '82%' : '92%' }}>
        {message.content.split('\n').map((line, i) => (<React.Fragment key={i}>{line}{i < message.content.split('\n').length - 1 && <br />}</React.Fragment>))}
        {message.isStreaming && <span style={styles.cursor} aria-hidden="true">▊</span>}
      </div>
    </div>
  );
}

function EmptyState({ companionName }) {
  const suggestions = ['Summarise this page for me', 'What are the key points here?', 'Draft a professional email reply', 'Extract all phone numbers on this page'];
  return (
    <div style={styles.emptyState}>
      <p style={styles.emptyTitle}>Hi, I'm {companionName || 'Infinity AI'}</p>
      <p style={styles.emptySubtitle}>I can read this page and help you work with it. Try:</p>
      <div style={styles.suggestions}>
        {suggestions.map((s, i) => <div key={i} style={styles.suggestion}>{s}</div>)}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-surface-2)' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--color-dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  companionButton: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer', flex: 1, color: 'white', fontFamily: 'var(--font-body)' },
  companionDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  companionName: { fontWeight: 600, fontSize: '13px', color: 'white' },
  companionRole: { fontSize: '11px', color: 'rgba(255,255,255,0.5)' },
  clearButton: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', padding: '4px 6px', fontFamily: 'var(--font-body)' },
  companionPicker: { background: 'var(--color-dark)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 },
  companionOption: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', color: 'white', fontFamily: 'var(--font-body)', textAlign: 'left', transition: 'background 0.15s' },
  messages: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  messageWrapper: { display: 'flex', width: '100%' },
  messageBubble: { padding: '10px 13px', borderRadius: 'var(--radius-md)', fontSize: '13px', lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', boxShadow: 'var(--shadow-sm)' },
  cursor: { display: 'inline-block', animation: 'blink 1s step-end infinite', marginLeft: '1px' },
  inputArea: { display: 'flex', gap: '8px', padding: '10px 12px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', alignItems: 'flex-end', flexShrink: 0 },
  textarea: { flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'none', outline: 'none', color: 'var(--color-text)', background: 'var(--color-surface)', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto', transition: 'border-color 0.15s' },
  sendButton: { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', width: '36px', height: '36px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s, opacity 0.15s' },
  footer: { padding: '5px 12px', fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', textAlign: 'center', flexShrink: 0 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '20px', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' },
  emptySubtitle: { fontSize: '13px', color: 'var(--color-text-muted)' },
  suggestions: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '4px' },
  suggestion: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '12px', color: 'var(--color-text-muted)', cursor: 'default', textAlign: 'left' },
};
