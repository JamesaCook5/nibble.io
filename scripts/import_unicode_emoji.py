#!/usr/bin/env python3
"""Import fully-qualified Unicode Emoji sequences into the answer bank."""
import json
import re
import urllib.request
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK_PATH = ROOT / 'overclock/answer-full/answer_sets_full.json'
PROMPT_ID = 'emoticon-emoji'
SOURCE_URL = 'https://www.unicode.org/Public/18.0.0/emoji/emoji-test.txt'
CACHE_PATH = Path('/tmp/unicode-emoji-test-18.0.txt')


def norm(value):
    s = unicodedata.normalize('NFKD', str(value)).casefold()
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    s = s.replace('&', ' and ').replace('+', ' plus ').replace('#', ' sharp ').replace('*', ' star ').replace('^', ' pow ')
    s = re.sub(r'\bvs\.?\b', ' v ', s)
    s = re.sub(r'\bversus\b', ' v ', s)
    s = re.sub(r'^\s*the\s+', '', s)
    return ''.join(ch for ch in s if ch.isalnum() or ch == '-')


def symbol_key(value):
    return unicodedata.normalize('NFC', str(value)).strip().replace(' ', '')


def fetch_source():
    req = urllib.request.Request(SOURCE_URL, headers={'User-Agent': 'MegabytleAnswerBankResearch/1.0'})
    data = urllib.request.urlopen(req, timeout=60).read()
    CACHE_PATH.write_bytes(data)
    return data.decode('utf-8')


def main():
    rows = []
    for line in fetch_source().splitlines():
        left, sep, right = line.partition('#')
        if not sep or ';' not in left:
            continue
        codepoints, status = (part.strip() for part in left.split(';', 1))
        if status != 'fully-qualified':
            continue
        match = re.match(r'\S+\s+E([0-9.]+)\s+(.+)$', right.strip())
        if not match:
            continue
        version, name = match.groups()
        emoji = ''.join(chr(int(cp, 16)) for cp in codepoints.split())
        rows.append({'emoji': emoji, 'name': name.strip(), 'version': float(version)})

    bank = json.loads(BANK_PATH.read_text())
    answer_set = bank['prompts'][PROMPT_ID]
    text_owner = {}
    glyph_owner = {}
    for item in answer_set['answers']:
        for value in [item['answer'], *item.get('aliases', [])]:
            n = norm(value)
            if n:
                text_owner.setdefault(n, item)
            sk = symbol_key(value)
            if sk and any(unicodedata.category(ch).startswith(('So', 'Sk')) or ord(ch) >= 0x1F000 for ch in sk):
                glyph_owner.setdefault(sk, item)

    pending = []
    alias_count = 0
    for row in rows:
        owner = glyph_owner.get(symbol_key(row['emoji'])) or text_owner.get(norm(row['name']))
        if owner:
            if symbol_key(row['emoji']) not in {symbol_key(x) for x in owner.get('aliases', [])} and symbol_key(owner['answer']) != symbol_key(row['emoji']):
                owner.setdefault('aliases', []).append(row['emoji'])
                glyph_owner[symbol_key(row['emoji'])] = owner
                alias_count += 1
            if norm(row['name']) not in text_owner:
                owner.setdefault('aliases', []).append(row['name'])
                text_owner[norm(row['name'])] = owner
                alias_count += 1
            if SOURCE_URL not in owner.setdefault('sources', []):
                owner['sources'].append(SOURCE_URL)
            continue
        pending.append(row)

    if not pending:
        print(f'No new emoji; added {alias_count} aliases to existing answers.')
        BANK_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + '\n')
        return

    # Use introduction version only as a rough familiarity proxy: oldest entries are
    # more likely to be familiar; newest entries form the deep-cut slice.
    ordered = sorted(pending, key=lambda r: (r['version'], r['name'].casefold(), r['emoji']))
    n_nibble = round(len(ordered) * 0.16)
    n_kilo = round(len(ordered) * 0.15)
    for i, row in enumerate(ordered):
        tier = 'Nibble' if i < n_nibble else 'Kilobyte' if i >= len(ordered) - n_kilo else 'Byte'
        item = {
            'answer': row['name'].title(),
            'aliases': [row['emoji']],
            'tier': tier,
            'sources': [SOURCE_URL],
            'method': 'Unicode fully-qualified RGI emoji; tier estimated from introduction version as a familiarity proxy',
            'emoji_version': row['version'],
            'scope_note': 'Direct fit: emoji glyph accepted; Unicode description stored as canonical name.'
        }
        answer_set['answers'].append(item)
        text_owner[norm(item['answer'])] = item
        glyph_owner[symbol_key(row['emoji'])] = item

    BANK_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + '\n')
    print(f'Unicode Emoji 18.0: source sequences={len(rows)}, new entries={len(pending)}, aliases added to existing={alias_count}.')
    print(f'Added rarity mix: Nibble={n_nibble}, Byte={len(ordered)-n_nibble-n_kilo}, Kilobyte={n_kilo}.')


if __name__ == '__main__':
    main()
