#!/usr/bin/env python3
"""Round 2 local-review export. Sources read-only; no inference or deployment.

Requires root-owned mode-700 content and a passing tested-agent-user boundary
check BEFORE reading private results. New media scope is four named recordings;
no raw requests, worker commands, credentials, provider errors or raw TRACE.
"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
sys.dont_write_bytecode=True
from export_common import export_tracking,export_vehicles,jl
from export_v53_run import observations,agent_steps,cases_of,final_snapshot
from publish_guard import leaks
ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/workspace/experiments/falsification-search/runs')
PARENT=BASE/'round02-gap-speed-weather-20261025T223642Z-01'
EXT=BASE/'round02-gap-speed-weather-96-20261026T022639Z-01'
OUT=ROOT/'content/search'
SELECTED={
'f2-r002-thompson-4':('Overcount with an investigation','Pi investigated appearance, but three vehicles were reported for two targets. The evaluator flags a split counting unit, not a wrong identity decision.'),
'f2-r023-ce-2':('Overcount without Pi','No investigation was started. Both the traffic rule and the final answer have a recorded false positive.'),
'f2-r002-random-2':('A missed wrong-way vehicle','At 2.05 m/s and gap 24 m, a target is missed. Inspect the recorded layers rather than assuming the model caused the miss.'),
'f2-r001-random-3':('A clean recorded outcome','Both targets are reported and all 22 recorded outcome bits are zero. One observation in a fixed scene is not a general guarantee.')}
WEATHERS=['ClearNoon','ClearSunset','HardRainNoon','HardRainSunset'];BINS=['S1_2to7','S2_7to12','S3_12to17','S4_17to22']
CELLS=[f'weather={w}__speed={b}__gap={g}' for w in WEATHERS for b in BINS for g in [12,18,24]]
SOURCES=[]
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bind(p):
 rel=p.relative_to(BASE).parts
 # Identify private label inputs by campaign/run and role, never their private filename.
 if p.name=='oracle.json':SOURCES.append({'campaign':rel[0],'run':rel[2],'role':'simulator ground truth','sha256':sha(p)})
 else:SOURCES.append({'source':str(p.relative_to(BASE)),'sha256':sha(p)})
def write(p,d):
 b=json.dumps(d,ensure_ascii=False,separators=(',',':'));assert not leaks(b),leaks(b)
 p.parent.mkdir(parents=True,exist_ok=True,mode=0o700);p.write_text(b+'\n');p.chmod(0o600)
def folder(rid):
 fs=[p/'items'/rid for p in [PARENT,EXT] if (p/'items'/rid/'result.json').is_file()];assert len(fs)==1,rid
 return fs[0]
def detail(r):
 rid=r['run_id'];p=folder(rid);s=p/'sut';dest=OUT/'runs'/rid;dest.mkdir(parents=True,exist_ok=True,mode=0o700)
 events=jl(s/'gateway-events.jsonl');run=read(s/'run.json');verdict=read(p/'verdict.json');pe=read(p/'property-eval-v2.json')
 for q in [s/'gateway-events.jsonl',s/'tracking.jsonl',s/'run.json',p/'property-eval-v2.json',p/'verdict.json',p/'oracle.json']:bind(q)
 if (s/'pi-events.jsonl').exists():bind(s/'pi-events.jsonl')
 snap=final_snapshot(events);tracking,video,extra=export_tracking(s,snap);groups=export_vehicles(snap,extra['v_refs'],extra['attached'])
 obs=observations(s,events,dest,{t['alias']:t['vehicle'] for t in tracking['tracks']});agent=agent_steps(s,events,obs)
 req={e['observation_ref']:e for e in events if e['kind']=='visual_request'}
 for o in obs:
  e=req[o['observation_ref']];o['request_args']={k:v for k,v in e['args'].items() if k in ('intent','start_frame','end_frame','track_ref','track_refs','question','query')}
  for m in e['media']:
   src=(s/m['path']).resolve();assert src.is_relative_to((s/'media').resolve());assert sha(src)==m['sha256'];bind(src)
 fin=next(e['answer'] for e in events if e['kind']=='host_final_answer')
 answer={'status':fin['status'],'submission':{k:fin['submission'].get(k) for k in ['decision','reported_count','colors','count_complete','uncertainty']},'targets':[{k:t.get(k) for k in ['vehicle_ref','member_track_refs','color_description','source_frame_intervals']} for t in fin['targets']]}
 oracle=read(p/'oracle.json');assert oracle['video_sha256']==r['video_sha256']==run['video_sha256']
 gt={'expected_count':oracle['wrong_way_count'],'targets':[{'id':t['object_id'],'color':t['color_name'],'boxes':[[f['frame'],*f['bbox_xyxy']] for f in t['eligible_frames'] if 'bbox_xyxy' in f]} for t in oracle['targets']]}
 src=p/'forge/video.mp4';assert sha(src)==r['video_sha256'];bind(src);proxy=dest/'video.mp4'
 if not proxy.exists():subprocess.run(['ffmpeg','-v','error','-i',str(src),'-an','-c:v','libx264','-crf','28','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(proxy)],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,width,height,r_frame_rate','-of','json',str(proxy)]))['streams'][0]
 assert int(probe['nb_frames'])==video['nb_frames'];assert probe['width']==video['width'] and probe['height']==video['height'];a,b=map(float,probe['r_frame_rate'].split('/'));assert a/b==video['fps']
 conf=next(e for e in events if e['kind']=='configuration');title,note=SELECTED[rid]
 d={'schema_version':1,'id':rid,'title':title,'note':note,'query':next(e['user_query'] for e in events if e['kind']=='query_input'),'source_video_sha256':r['video_sha256'],'proxy_sha256':sha(proxy),'video':video,'tracking':tracking,**groups,'appearance':obs,'agent':agent,'cases':cases_of(events),'answer':answer,'ground_truth':gt,'properties':{k:pe[k] for k in ['fields','Y','counts','info_fields']},'checks':{'runtime_final':run['terminal_reason'],'posthoc':verdict['v5_status'],'posthoc_issues':verdict['issues'],'traffic_truth_checked':verdict['traffic_truth_checked']},'configuration':{'gemma_temperature':conf['visual_config']['temperature'],'thinking':False,'tools':conf['surface']['descriptions']},'wall_sec':round(run['wall_sec'],3)}
 assert len(obs)==r['gemma_calls'];assert (agent['calls'] if agent else 0)==r['nemotron_calls'];write(dest/'bundle.json',d)
 return {'id':rid,'title':title,'note':note}
def main():
 os.umask(0o077)
 assert os.geteuid()==0 and (ROOT/'content').stat().st_uid==0 and (ROOT/'content').stat().st_mode&0o777==0o700,'private content boundary required'
 subprocess.run(['bash','/workspace/video-agent/sandbox/agent_user.sh','--check',str(ROOT/'content')],check=True)
 OUT.mkdir(parents=True,exist_ok=True,mode=0o700)
 source=EXT/'reports/runs-combined.json';bind(source);allrows=read(source);rows=[r for r in allrows if r['gate']=='search'];assert len(rows)==288 and len({r['run_id'] for r in rows})==288
 keys=['run_id','arm','slot','round','weather','speed_bin','speed','speed_realized','gap','cell','F_FN','F_FP','counts','Y','pi_triggered','nemotron_calls','gemma_calls','t_sut_s','picked_by','video_sha256'];public=[{k:r[k] for k in keys} for r in rows];arms=[]
 for arm,fn,fp,cov in [('random',1,7,44),('ce',2,10,43),('thompson',0,7,48)]:
  rr=[r for r in rows if r['arm']==arm];assert len(rr)==96 and sum(r['F_FN'] for r in rr)==fn and sum(r['F_FP'] for r in rr)==fp and len({r['cell'] for r in rr})==cov
  arms.append({'arm':arm,'n':96,'FN':fn,'FP':fp,'coverage':cov,'pi':sum(r['pi_triggered'] for r in rr),'nemotron':sum(r['nemotron_calls'] for r in rr),'gemma':sum(r['gemma_calls'] for r in rr)})
 assert sum(r['F_FP'] and not r['pi_triggered'] for r in rows)==3
 selected=[detail(next(r for r in rows if r['run_id']==rid)) for rid in SELECTED];hist=[]
 for arm in ['random','ce','thompson']:
  for batch in range(1,25):
   name=f'r{batch:03d}-{arm}.json';c=PARENT if arm!='thompson' and batch<=16 else EXT;p=c/'plans'/name;q=c/'sampler-states'/name;before=read(p)['before'];after=read(q);bind(p);bind(q);allowed=['weights'] if arm!='thompson' else ['n','k']
   hist.append({'arm':arm,'batch':batch,'before':{k:before[k] for k in allowed},'after':{k:after[k] for k in allowed}})
 manifest=read(EXT/'manifest.json');bind(EXT/'manifest.json');bind(PARENT/'manifest.json');query=read(OUT/'runs'/next(iter(SELECTED))/'bundle.json')['query'];assert hashlib.sha256(query.encode()).hexdigest()==manifest['query_sha256'];candidates=read(EXT/'candidates.json');bind(EXT/'candidates.json')
 write(OUT/'experiment.json',{'schema_version':1,'round':2,'query':query,'fields':rows[0]['Y_fields'],'arms':arms,'rows':public,'selected':selected,'weathers':WEATHERS,'bins':BINS,'cells':CELLS,'candidates':candidates['union'],'versions':rows[0]['versions'],'study_commit':manifest['experiment_commit'],'smoke_n':len(allrows)-len(rows)})
 write(OUT/'history.json',hist)
 assets=[{'file':str(p.relative_to(OUT)),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='publication-manifest.json']
 write(OUT/'publication-manifest.json',{'schema_version':1,'sources':SOURCES,'assets':assets,'media_scope':list(SELECTED),'scope':'Protected local review; no deployment. Video proxies preserve frame count and timing.'})
 subprocess.run(['bash','/workspace/video-agent/sandbox/agent_user.sh','--check',str(OUT)],check=True)
 print(f'Exported {len(rows)} summaries, {len(selected)} detailed replays, {len(hist)} saved states.')
if __name__=='__main__':main()
