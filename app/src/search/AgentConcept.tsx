import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { asset } from '../data';
import type { Detail } from './types';
import RecordedVideoPlayer from './RecordedVideoPlayer';
import './concept.css';

interface Illustration {
  run_id: string; frame: number; fps: number; width: number; height: number; image: string;
  boxes: {bbox: number[]; vehicle: string | null; candidate: boolean}[];
}
type IconKind = 'query' | 'camera' | 'boxes' | 'group' | 'rule' | 'agent' | 'inspect' | 'shield' | 'answer';
function Icon({kind}: {kind: IconKind}) {
  const paths: Record<IconKind, ReactNode> = {
    query: <><path d="M4 3h16v13H9l-5 5z"/><path d="M8 7h8M8 11h6"/></>,
    camera: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></>,
    boxes: <><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><rect x="7" y="8" width="10" height="8" rx="2"/><path d="M9 8V6h6v2M9 16v2M15 16v2"/></>,
    group: <><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><rect x="16" y="9" width="6" height="6" rx="1"/><path d="m8 6 8 6-8 6"/></>,
    rule: <><path d="M5 5h14M5 12h6M5 19h14M16 9l3 3-3 3"/><circle cx="12" cy="5" r="2"/><circle cx="9" cy="19" r="2"/></>,
    agent: <><rect x="4" y="6" width="16" height="14" rx="4"/><path d="M12 2v4M8 15h8"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/></>,
    inspect: <><rect x="2" y="3" width="14" height="13" rx="2"/><path d="M5 7h8M5 11h4"/><circle cx="16" cy="15" r="5"/><path d="m20 19 3 3"/></>,
    shield: <><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5z"/><path d="m8 11 3 3 5-6"/></>,
    answer: <><path d="M5 3h11l4 4v14H5zM16 3v5h4M8 12h9M8 16h6"/></>,
  };
  return <svg className="concept-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
let saved: Promise<Illustration> | null = null;
function loadIllustration() {
  return saved ??= fetch(asset('content/search/illustration.json')).then(r => {
    if (!r.ok || !r.headers.get('content-type')?.includes('json')) throw Error('Illustration unavailable');
    return r.json() as Promise<Illustration>;
  });
}
let savedExample: Promise<Detail> | null = null;
function loadExample() {
  return savedExample ??= fetch(asset('content/search/runs/f2-r001-random-3/bundle.json')).then(r => {
    if (!r.ok || !r.headers.get('content-type')?.includes('json')) throw Error('Recorded video unavailable');
    return r.json() as Promise<Detail>;
  });
}
export default function AgentConcept() {
  const [shot, setShot] = useState<Illustration | null>(null);
  const [failed, setFailed] = useState(false);
  const title = useId();
  const [example, setExample] = useState<Detail | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => { let active = true; loadExample().then(b => {if (active) setExample(b);}).catch(() => {if (active) setVideoFailed(true);}); return () => {active = false;}; }, []);
  useEffect(() => { let active = true; loadIllustration().then(s => {if (active) setShot(s);}).catch(() => {if (active) setFailed(true);}); return () => {active = false;}; }, []);
  return <figure className="agent-concept" aria-labelledby={title}>
    <header className="concept-heading"><div><p className="eyebrow">Meet the system under test</p><h2 id={title}>A Verifiable Video Agent for Spatio-temporal UAV Reasoning</h2></div></header>
    <div className="concept-layout">
      <div className="concept-scene">
        <p className="concept-inputs-label">Inputs</p>
        <div className="concept-query"><Icon kind="query"/><div><strong>User query:</strong><p>Are any vehicles moving against the major traffic? How many, what colors, and when happened?</p><small>Illustrative wording; the replay retains the original measured query.</small></div></div>
        <div className="concept-scene-label"><Icon kind="camera"/><b>A simulator-generated video</b></div>
        {example ? <RecordedVideoPlayer b={example} compact/> : <div className="concept-photo-pending">{videoFailed?'Recorded video unavailable. Open the replay below.':'Loading recorded video…'}</div>}
        <a className="concept-replay" href="#/search/run/f2-r001-random-3">Inspect the full recorded run ↗</a>
      </div>
      <div className="concept-workflow" role="group" aria-label="Verifiable video agent system">
        <div className="concept-system-boundary-label"><Icon kind="agent"/><strong>Verifiable Video Agent System</strong><span className="concept-version">V5.3</span></div>
        <div className="concept-program">
          <p className="concept-lane-label">System 1: Program-guided decisions</p>
          <div className="concept-program-steps">
            <div><Icon kind="boxes"/><strong>Detect &amp; track</strong><small>YOLO26s + ByteTrack</small></div>
            <span className="concept-arrow" aria-hidden="true">→</span>
            <div><Icon kind="group"/><strong>Group vehicles</strong><small>Join track fragments</small></div>
            <span className="concept-arrow" aria-hidden="true">→</span>
            <div><Icon kind="rule"/><strong>Apply traffic rules</strong><small>Symbolic motion checks</small></div>
          </div>
        </div>
        <div className="concept-look"><Icon kind="inspect"/><span>Gemma (VLM) provides more details</span></div>
        <div className="concept-fork"><span className="concept-condition">↓ If a case needs more evidence</span><span className="concept-direct">Otherwise → assemble answer</span></div>
        <div className="concept-investigation">
          <p className="concept-lane-label concept-system-two">System 2: Agentic reasoning</p>
          <div className="concept-agent"><Icon kind="agent"/><strong>Investigation agent</strong><small>Pi coding harness + Nemotron (LLM)</small><span>Choose what to inspect</span></div>
          <div className="concept-active-loop"><span aria-hidden="true">⇄</span><small>Ask · observe · decide</small></div>
          <div className="concept-inspect"><Icon kind="inspect"/><strong>Actively inspect video</strong><small>Selected frames / crops<br/>Compare sightings with Gemma</small></div>
          <p>Request a targeted look when useful. Return a supported finding or leave the case unresolved.</p>
        </div>
        <div className="concept-verifier"><Icon kind="shield"/><div><strong>Runtime Verifier</strong><span>Checks tool operations, sources, schemas and resources, plus host answer structure.</span></div></div>
        <div className="concept-output">
          <div className="concept-answer"><Icon kind="answer"/><strong>Assemble the final answer</strong></div>
          <figure className="concept-output-preview">
            <p className="concept-output-label">Example output</p>
        {shot ? <div className="concept-photo"><img src={asset(`content/search/${shot.image}`)} width={shot.width} height={shot.height} alt="Recorded traffic frame with a purple car selected by the program as moving against nearby flow"/>
          <svg viewBox={`0 0 ${shot.width} ${shot.height}`} aria-label="Actual detector boxes; amber marks the program-selected wrong-way vehicle" role="img">
            {shot.boxes.map((b,i) => <g key={i} className={b.candidate?'concept-box-target':'concept-box'}>
              <rect x={b.bbox[0]} y={b.bbox[1]} width={b.bbox[2]-b.bbox[0]} height={b.bbox[3]-b.bbox[1]}/>
              {b.candidate && <text x={b.bbox[0]} y={Math.max(24,b.bbox[1]-12)}>{b.vehicle} · wrong-way candidate</text>}
            </g>)}
          </svg>
        </div> : <div className="concept-photo-pending">{failed?'Recorded frame unavailable. Open the replay below.':'Loading recorded frame…'}</div>}
            <figcaption>System-selected candidate · frame {shot?.frame ?? 155} · {((shot?.frame ?? 155)/(shot?.fps ?? 10)).toFixed(1)} s. Recorded boxes, no ground-truth overlay.</figcaption>
          </figure>
        </div>
      </div>
    </div>
    <figcaption>A program-first path with a conditional investigation loop. Runtime checks enforce execution constraints; traffic correctness is assessed separately by the Property Evaluator.</figcaption>
  </figure>;
}
