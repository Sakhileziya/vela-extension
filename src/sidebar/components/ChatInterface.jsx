/**
 * @file ChatInterface.jsx
 * @description Main chat UI. Handles message rendering, streaming responses,
 * companion switching, and connection to the background service worker.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MSG, BRAND, OLLAMA } from '../../shared/constants.js';
import { sendToBackground, formatTimestamp } from '../../shared/utils.js';

export function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [companions, setCompanions] = useState([]);
  const [activeCompanion, setActiveCompanion] = useState(null);
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadCompanions();
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCompanions = async () => {
    const result = await sendToBackground({ type: MSG.GET_COMPANIONS });
    if (result?.companions) {
      setCompanions(result.companions);
      const preferred = result.companions.find((c) => c.id === result.activeId) || result.companions[0] || null;
      setActiveCompanion(preferred);
    }
  };

  const loadHistory = async () => {
    const result = await sendToBackground({ type: MSG.GET_HISTORY, companionId: activeCompanion?.id });
    const history = result?.messages || result?.history || [];
    if (Array.isArray(history)) setMessages(history);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantMsg = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await sendToBackground({
        type: MSG.CHAT,
        userMessage: text,
        companionId: activeCompanion?.id,
        tabId: tab?.id,
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Connection error. Make sure Ollama is running.',
          timestamp: Date.now(),
          isError: true,
        };
        return updated;
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = (message) => {
      if (message.type === MSG.STREAM_CHUNK) {
        const chunk = message.chunk || message.token || '';
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.isStreaming) {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      } else if (message.type === MSG.STREAM_DONE || message.type === MSG.STREAM_END) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.isStreaming) {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });
        setIsLoading(false);
      } else if (message.type === MSG.STREAM_ERROR) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: message.error || 'Something went wrong.',
            timestamp: Date.now(),
            isError: true,
          };
          return updated;
        });
        setIsLoading(false);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    await sendToBackground({ type: MSG.CLEAR_HISTORY });
    setMessages([]);
  };

  return (
    <div style={styles.root}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <button
          style={styles.companionButton}
          onClick={() => setShowCompanionPicker((v) => !v)}
          title="Switch companion"
        >
          <span style={{ ...styles.companionDot, background: activeCompanion?.color || BRAND.COLOURS.GREEN }} />
          <span style={styles.companionName}>{activeCompanion?.name || 'Infinity AI'}</span>
          <span style={styles.companionRole}>{activeCompanion?.role || 'Assistant'}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '10px' }}>▼</span>
        </button>
        <button style={styles.clearButton} onClick={handleClearChat} title="Clear conversation">
          Clear
        </button>
      </div>

      {/* ── Companion Picker ── */}
      {showCompanionPicker && (
        <div style={styles.companionPicker}>
          {companions.map((c) => (
            <button
              key={c.id}
              style={{ ...styles.companionOption, background: activeCompanion?.id === c.id ? 'rgba(255,255,255,0.08)' : 'transparent' }}
              onClick={() => { setActiveCompanion(c); setShowCompanionPicker(false); }}
            >
              <span style={{ ...styles.companionDot, background: c.color }} />
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── Messages ── */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>∞</div>
            <p style={styles.emptyTitle}>Infinity AI</p>
            <p style={styles.emptySubtitle}>Ask me anything. I read this page, browse the web, and run entirely on your device.</p>
          </div>
        )}
        {messages.map((message, idx) => (
          <Message key={idx} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={styles.inputArea}>
        <textarea
          ref={inputRef}
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isLoading}
        />
        <button
          style={{ ...styles.sendButton, opacity: isLoading || !input.trim() ? 0.4 : 1 }}
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div style={{ ...styles.messageWrapper, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        ...styles.messageBubble,
        background: isUser ? 'var(--color-primary)' : isError ? 'rgba(224,60,49,0.1)' : 'var(--color-surface)',
        color: isUser ? 'white' : isError ? 'var(--color-error)' : 'var(--color-text)',
        border: isUser ? 'none' : (isError ? '1px solid rgba(224,60,49,0.2)' : '1px solid var(--color-border)'),
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: isUser ? '82%' : '92%',
      }}>
        {message.content.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
        {message.isStreaming && <span style={styles.cursor} aria-hidden="true">▊</span>}
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--color-dark)' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--color-dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  companionButton: { display: 'flex', alignItems: 'center', gap: '6px', flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer', color: 'white', fontFamily: 'var(--font-body)', fontSize: '12px', textAlign: 'left' },
  companionDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  companionName: { fontWeight: 600, fontSize: '12px' },
  companionRole: { fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginLeft: '4px' },
  clearButton: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '11px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)', flexShrink: 0 },
  companionPicker: { background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 },
  companionOption: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'var(--font-body)', width: '100%', textAlign: 'left' },
  messages: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px', gap: '10px' },
  emptyIcon: { fontSize: '36px', color: 'var(--color-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700 },
  emptyTitle: { fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' },
  emptySubtitle: { fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '240px' },
  messageWrapper: { display: 'flex', width: '100%' },
  messageBubble: { padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '13px', lineHeight: 1.6, wordBreak: 'break-word', fontFamily: 'var(--font-body)' },
  cursor: { display: 'inline-block', animation: 'blink 1s step-end infinite', marginLeft: '2px' },
  inputArea: { display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--color-dark)', flexShrink: 0 },
  input: { flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', fontFamily: 'var(--font-body)', color: 'var(--color-text)', resize: 'none', outline: 'none', lineHeight: 1.5 },
  sendButton: { width: '36px', height: '36px', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' },
};