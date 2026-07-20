/**
 * @file AgentBuilder.jsx
 * @description Visual workflow builder. Users define multi-step automations,
 * save them, and run them on demand. Each step is a typed action block.
 *
 * Supported step types:
 *  research, navigate, click, type, extract, screenshot, generate,
 *  wait, open_tab, scroll, press_key
 */

import React, { useState, useEffect } from 'react';
import { MSG, BRAND } from '../../shared/constants.js';
import { sendToBackground } from '../../shared/utils.js';

// ── Step type definitions ─────────────────────────────────────────────────────

const STEP_TYPES = [
  { type: 'research',    icon: '🔍', label: 'Research Web',   fields: [{ key: 'query', label: 'Query', placeholder: 'Best invoicing tools for small business SA' }] },
  { type: 'navigate',    icon: '🌐', label: 'Go to URL',      fields: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }] },
  { type: 'click',       icon: '👆', label: 'Click Element',  fields: [{ key: 'selector', label: 'CSS Selector', placeholder: '#submit-button or .nav-link' }] },
  { type: 'type',        icon: '⌨️', label: 'Type Text',      fields: [{ key: 'selector', label: 'CSS Selector', placeholder: 'input[name="email"]' }, { key: 'text', label: 'Text to type', placeholder: 'hello@mybusiness.co.za' }] },
  { type: 'extract',     icon: '📋', label: 'Extract Page',   fields: [] },
  { type: 'screenshot',  icon: '📸', label: 'Screenshot',     fields: [] },
  { type: 'generate',    icon: '🧠', label: 'AI Generate',    fields: [{ key: 'prompt', label: 'Prompt (use {{step_0}} to reference previous results)', placeholder: 'Summarise this data: {{step_0}}', multiline: true }] },
  { type: 'open_tab',    icon: '🗂', label: 'Open Tab',       fields: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }] },
  { type: 'scroll',      icon: '↕️', label: 'Scroll Page',    fields: [{ key: 'direction', label: 'Direction (down/up/top/bottom)', placeholder: 'down' }] },
  { type: 'wait',        icon: '⏱', label: 'Wait',           fields: [{ key: 'ms', label: 'Milliseconds', placeholder: '2000' }] },
  { type: 'press_key',   icon: '⌨️', label: 'Press Key',      fields: [{ key: 'key', label: 'Key (e.g. Enter, Tab, Escape)', placeholder: 'Enter' }] },
];

const stepMeta = (type) => STEP_TYPES.find((s) => s.type === type) || STEP_TYPES[0];

const makeStep = (type = 'research') => ({
  id: crypto.randomUUID(),
  type,
  outputKey: '',
  continueOnError: false,
  params: {},
});

const makeWorkflow = () => ({
  id: crypto.randomUUID(),
  name: 'New Workflow',
  description: '',
  steps: [makeStep('research')],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export function AgentBuilder() {
  const [workflows, setWorkflows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState([]);
  const [view, setView] = useState('list');

  useEffect(() => { loadWorkflows(); }, []);

  const loadWorkflows = async () => {
    const result = await sendToBackground({ type: MSG.WORKFLOW_LIST });
    if (result?.workflows) setWorkflows(result.workflows);
  };

  const handleNew = () => {
    const w = makeWorkflow();
    setSelected(w);
    setView('edit');
  };

  const handleEdit = (w) => { setSelected({ ...w }); setView('edit'); };

  const handleSave = async () => {
    const result = await sendToBackground({ type: MSG.WORKFLOW_SAVE, workflow: selected });
    if (result?.workflows) setWorkflows(result.workflows);
    setView('list');
    setSelected(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this workflow?')) return;
    const result = await sendToBackground({ type: MSG.WORKFLOW_DELETE, id });
    if (result?.workflows) setWorkflows(result.workflows);
  };

  const handleRun = async (workflow) => {
    setRunning(true);
    setRunLog([]);
    setView('run');
    setSelected(workflow);

    const listener = (message) => {
      if (message.type === MSG.WORKFLOW_PROGRESS) {
        setRunLog((prev) => [...prev, message.update]);
      } else if (message.type === MSG.WORKFLOW_DONE || message.type === MSG.WORKFLOW_ERROR) {
        setRunning(false);
        setRunLog((prev) => [...prev, {
          status: message.type === MSG.WORKFLOW_DONE ? 'complete' : 'error',
          message: message.type === MSG.WORKFLOW_DONE ? 'Workflow complete.' : `Error: ${message.error}`,
        }]);
        chrome.runtime.onMessage.removeListener(listener);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    try {
      await sendToBackground({ type: MSG.WORKFLOW_RUN, workflow });
    } catch (e) {
      setRunning(false);
      setRunLog((prev) => [...prev, { status: 'error', message: `Failed to start: ${e.message}` }]);
      chrome.runtime.onMessage.removeListener(listener);
    }
  };

  if (view === 'run') {
    return <RunView workflow={selected} log={runLog} running={running} onBack={() => setView('list')} />;
  }

  if (view === 'edit' && selected) {
    return (
      <EditView
        workflow={selected}
        onChange={setSelected}
        onSave={handleSave}
        onCancel={() => { setView('list'); setSelected(null); }}
      />
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.listHeader}>
        <span style={styles.listTitle}>Agent Builder</span>
        <button style={styles.newBtn} onClick={handleNew}>+ New</button>
      </div>

      {workflows.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No workflows yet</p>
          <p style={styles.emptySub}>Build repeatable automations — research, browse, fill forms, extract data.</p>
          <button style={styles.emptyBtn} onClick={handleNew}>Create your first workflow</button>
        </div>
      ) : (
        <div style={styles.list}>
          {workflows.map((w) => (
            <div key={w.id} style={styles.card}>
              <div style={styles.cardLeft}>
                <div style={styles.cardName}>{w.name}</div>
                <div style={styles.cardMeta}>{w.steps.length} step{w.steps.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={styles.cardActions}>
                <button style={{ ...styles.iconBtn, color: 'var(--color-primary)' }} onClick={() => handleRun(w)} title="Run">▶</button>
                <button style={styles.iconBtn} onClick={() => handleEdit(w)} title="Edit">✏️</button>
                <button style={{ ...styles.iconBtn, color: 'var(--color-error)' }} onClick={() => handleDelete(w.id)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditView({ workflow, onChange, onSave, onCancel }) {
  const updateField = (field, value) => onChange({ ...workflow, [field]: value });
  const addStep = (type) => onChange({ ...workflow, steps: [...workflow.steps, makeStep(type)] });
  const removeStep = (idx) => onChange({ ...workflow, steps: workflow.steps.filter((_, i) => i !== idx) });
  const updateStep = (idx, patch) => onChange({ ...workflow, steps: workflow.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) });
  const updateParam = (idx, key, value) => updateStep(idx, { params: { ...workflow.steps[idx].params, [key]: value } });
  const moveStep = (idx, dir) => {
    const steps = [...workflow.steps];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= steps.length) return;
    [steps[idx], steps[swapIdx]] = [steps[swapIdx], steps[idx]];
    onChange({ ...workflow, steps });
  };

  return (
    <div style={styles.root}>
      <div style={styles.editToolbar}>
        <button style={styles.backBtn} onClick={onCancel}>← Back</button>
        <button style={styles.saveBtn} onClick={onSave}>Save</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <input style={styles.nameInput} value={workflow.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Workflow name" />
        <textarea style={styles.descInput} value={workflow.description || ''} onChange={(e) => updateField('description', e.target.value)} placeholder="Description (optional)" rows={2} />
        <div style={styles.stepsLabel}>Steps</div>
        {workflow.steps.map((step, idx) => {
          const meta = stepMeta(step.type);
          return (
            <div key={step.id} style={styles.stepCard}>
              <div style={styles.stepHeader}>
                <span style={styles.stepNum}>{idx + 1}</span>
                <span style={styles.stepIcon}>{meta.icon}</span>
                <select style={styles.stepTypeSelect} value={step.type} onChange={(e) => updateStep(idx, { type: e.target.value, params: {} })}>
                  {STEP_TYPES.map((st) => (<option key={st.type} value={st.type}>{st.label}</option>))}
                </select>
                <div style={styles.stepMoveGroup}>
                  <button style={styles.moveBtn} onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</button>
                  <button style={styles.moveBtn} onClick={() => moveStep(idx, 1)} disabled={idx === workflow.steps.length - 1}>↓</button>
                  <button style={{ ...styles.moveBtn, color: 'var(--color-error)' }} onClick={() => removeStep(idx)}>✕</button>
                </div>
              </div>
              {meta.fields.map((f) => (
                f.multiline ? (
                  <textarea key={f.key} style={styles.paramTextarea} placeholder={`${f.label}: ${f.placeholder}`} value={step.params[f.key] || ''} onChange={(e) => updateParam(idx, f.key, e.target.value)} rows={3} />
                ) : (
                  <input key={f.key} style={styles.paramInput} placeholder={`${f.label}: ${f.placeholder}`} value={step.params[f.key] || ''} onChange={(e) => updateParam(idx, f.key, e.target.value)} />
                )
              ))}
              <input style={{ ...styles.paramInput, borderStyle: 'dashed', fontSize: '11px' }} placeholder="Output key (optional, e.g. research_result)" value={step.outputKey || ''} onChange={(e) => updateStep(idx, { outputKey: e.target.value })} />
            </div>
          );
        })}
        <div style={styles.addStepRow}>
          {STEP_TYPES.slice(0, 6).map((st) => (<button key={st.type} style={styles.addStepBtn} onClick={() => addStep(st.type)}>{st.icon} {st.label}</button>))}
          <button style={styles.addStepBtn} onClick={() => addStep('generate')}>🧠 AI Generate</button>
        </div>
      </div>
    </div>
  );
}

function RunView({ workflow, log, running, onBack }) {
  const statusIcon = (status) => ({ running: '⏳', done: '✅', error: '❌', complete: '🎉' }[status] || '•');
  return (
    <div style={styles.root}>
      <div style={styles.editToolbar}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{workflow?.name}</span>
        {running && <span style={{ fontSize: '11px', color: BRAND.COLOURS.GOLD }}>Running…</span>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {log.map((entry, i) => (
          <div key={i} style={{ ...styles.logEntry, borderColor: entry.status === 'error' ? 'var(--color-error)' : entry.status === 'done' || entry.status === 'complete' ? 'var(--color-primary)' : 'var(--color-border)' }}>
            <span style={styles.logIcon}>{statusIcon(entry.status)}</span>
            <div style={{ flex: 1 }}>
              {entry.step && (<div style={styles.logStepName}>{stepMeta(entry.step.type)?.icon} {stepMeta(entry.step.type)?.label} (step {(entry.index || 0) + 1})</div>)}
              {entry.message && <div style={styles.logMessage}>{entry.message}</div>}
              {entry.result && typeof entry.result === 'string' && (<div style={styles.logResult}>{entry.result.substring(0, 300)}{entry.result.length > 300 ? '…' : ''}</div>)}
            </div>
          </div>
        ))}
        {running && (<div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 0' }}>Working… please wait</div>)}
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  listHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--color-dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  listTitle: { fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'white' },
  newBtn: { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-body)' },
  list: { flex: 1, overflowY: 'auto', padding: '10px' },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '8px' },
  cardLeft: { flex: 1 },
  cardName: { fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' },
  cardMeta: { fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' },
  cardActions: { display: 'flex', gap: '8px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '2px', color: 'var(--color-text-muted)' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '10px', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' },
  emptySub: { fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '240px' },
  emptyBtn: { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 18px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-body)' },
  editToolbar: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--color-dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  backBtn: { background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-body)' },
  saveBtn: { marginLeft: 'auto', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '5px 14px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-body)' },
  nameInput: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, outline: 'none', color: 'var(--color-text)', background: 'var(--color-surface)', marginBottom: '8px' },
  descInput: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: '12px', outline: 'none', color: 'var(--color-text-muted)', background: 'var(--color-surface)', resize: 'none', marginBottom: '12px' },
  stepsLabel: { fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' },
  stepCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' },
  stepHeader: { display: 'flex', alignItems: 'center', gap: '6px' },
  stepNum: { width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepIcon: { fontSize: '14px' },
  stepTypeSelect: { flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: '12px', fontFamily: 'var(--font-body)', color: 'var(--color-text)', background: 'var(--color-surface)', outline: 'none' },
  stepMoveGroup: { display: 'flex', gap: '4px' },
  moveBtn: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', width: '22px', height: '22px', cursor: 'pointer', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  paramInput: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontFamily: 'var(--font-body)', fontSize: '12px', outline: 'none', color: 'var(--color-text)', background: 'var(--color-surface-2)' },
  paramTextarea: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontFamily: 'var(--font-body)', fontSize: '12px', outline: 'none', color: 'var(--color-text)', background: 'var(--color-surface-2)', resize: 'vertical' },
  addStepRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingBottom: '12px' },
  addStepBtn: { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' },
  logEntry: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' },
  logIcon: { fontSize: '16px', flexShrink: 0 },
  logStepName: { fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' },
  logMessage: { fontSize: '12px', color: 'var(--color-text-muted)' },
  logResult: { fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto' },
};
