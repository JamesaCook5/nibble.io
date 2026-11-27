#!/usr/bin/env python3
"""Expand Pokémon answers with the public PokeAPI entity/form list."""
import json, re, urllib.request, unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/'answer-pilot/answer_sets.json'
URL='https://pokeapi.co/api/v2/pokemon?limit=2000'
def norm(s):
 s=unicodedata.normalize('NFKD',str(s)).casefold()
 s=''.join(c for c in s if unicodedata.category(c)!='Mn')
 s=s.replace('&',' and ').replace('+',' plus ').replace('#',' sharp ').replace('*',' star ')
 s=re.sub(r'[^\w-]+','',s)
 return s
req=urllib.request.Request(URL,headers={'User-Agent':'MegabytleAnswerBankResearch/1.0'})
data=json.load(urllib.request.urlopen(req,timeout=45))
bank=json.loads(PATH.read_text()); aset=bank['prompts']['pokmon']
owner={norm(x):a for a in aset['answers'] for x in [a['answer'],*a.get('aliases',[])] if norm(x)}
added=[]
for row in data['results']:
 slug=row['name']; display=' '.join(w.capitalize() for w in slug.split('-'))
 if norm(display) in owner or norm(slug) in owner: continue
 # Keep forms as their own answer only where PokeAPI exposes a distinct named entity.
 item={'answer':display,'aliases':[slug], 'tier':'Byte', 'sources':[URL],
       'method':'PokeAPI named Pokémon/form record',
       'scope_note':'Broad form interpretation: distinct named Pokémon forms count as Pokémon; base species remain separate entries.'}
 aset['answers'].append(item); added.append(display)
 for value in [display,slug]: owner[norm(value)]=item
PATH.write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n')
print(f'PokeAPI entries={len(data["results"])}; new named forms={len(added)}; total={len(aset["answers"])}')
