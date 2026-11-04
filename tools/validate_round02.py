#!/usr/bin/env python3
"""Offline checks for exported Round 2 artifacts, source bindings and isolation."""
import argparse,hashlib,json,subprocess,sys
from pathlib import Path
sys.dont_write_bytecode=True
import jsonschema
from publish_guard import leaks
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'content/search';BASE=Path('/workspace/experiments/falsification-search/runs')
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--portable',action='store_true',help='Validate only published artifacts; private source and Unix boundary checks require the lab.');args=ap.parse_args()
 d=read(OUT/'experiment.json');jsonschema.validate(d,read(ROOT/'schema/round02-search.schema.json'))
 assert len({r['run_id'] for r in d['rows']})==288
 for arm,fn,fp,cov in [('random',1,7,44),('ce',2,10,43),('thompson',0,7,48)]:
  rr=[r for r in d['rows'] if r['arm']==arm];assert sorted(r['slot'] for r in rr)==list(range(1,97));assert (sum(r['F_FN'] for r in rr),sum(r['F_FP'] for r in rr),len({r['cell'] for r in rr}))==(fn,fp,cov)
 for r in d['rows']:
  assert r['Y']==[int(r['counts'][f.split('.')[1]]>0) for f in d['fields']]
  assert r['F_FN']==int(r['counts']['answer_FN']>0) and r['F_FP']==int(r['counts']['answer_FP']>0)
 for c in d['selected']:
  p=OUT/'runs'/c['id'];b=read(p/'bundle.json');jsonschema.validate(b,read(ROOT/'schema/round02-run.schema.json'));r=next(r for r in d['rows'] if r['run_id']==c['id'])
  assert b['properties']['Y']==r['Y'] and b['properties']['counts']==r['counts']
  assert b['source_video_sha256']==r['video_sha256'] and b['proxy_sha256']==sha(p/'video.mp4')
  assert len(b['tracking']['frames'])==b['video']['nb_frames']
  assert len(b['appearance'])==r['gemma_calls'] and (b['agent']['calls'] if b['agent'] else 0)==r['nemotron_calls']
  for o in b['appearance']:
   for m in o['media']:
    assert 0<=m['frame']<b['video']['nb_frames'];assert (p/m['full']).is_file()
    for crop in m['crops']:assert (p/crop['path']).is_file()
  for t in b['ground_truth']['targets']:assert all(0<=box[0]<b['video']['nb_frames'] for box in t['boxes'])
 assert not read(OUT/'runs/f2-r023-ce-2/bundle.json')['agent']
 assert read(OUT/'runs/f2-r001-random-3/bundle.json')['properties']['Y']==[0]*22
 hist=read(OUT/'history.json');assert len(hist)==72
 for h in hist:
  if h['arm']=='random':assert h['before']==h['after']
  if h['arm']=='ce':assert all(abs(sum(axis)-1)<1e-9 for event in h['after']['weights'].values() for axis in event)
  if h['arm']=='thompson':assert sum(h['after']['n'])==h['batch']*4
 manifest=read(OUT/'publication-manifest.json')
 for a in manifest['assets']:
  p=(OUT/a['file']).resolve();assert p.is_relative_to(OUT.resolve());assert sha(p)==a['sha256'] and p.stat().st_size==a['bytes']
 if not args.portable:
  for s in manifest['sources']:
   p=BASE/s['source'] if 'source' in s else BASE/s['campaign']/'items'/s['run']/'oracle.json'
   assert sha(p)==s['sha256'],'source changed since export'
 for p in OUT.rglob('*.json'):assert not leaks(p.read_text()),(p,leaks(p.read_text()))
 if not args.portable:
  protected=[ROOT/'.git',ROOT/'bundles',ROOT/'content',ROOT/'app/public',ROOT/'app/dist']
  subprocess.run(['bash','/workspace/video-agent/sandbox/agent_user.sh','--check',*map(str,protected)],check=True)
 print('Round 2 PASS: schemas, 288 Y vectors, event totals, four replays, media, 72 states, asset hashes and leak guard.' + (' Private source/boundary checks skipped in portable mode.' if args.portable else ' Source hashes and absolute-path boundary checks passed.'))
if __name__=='__main__':main()
