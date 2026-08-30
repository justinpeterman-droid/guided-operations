import json, glob, re

KEY = r'C:\Users\justi\OneDrive\Documents\New project\guided-operations\docs\quality\answer-key-draft.md'
root = r'C:\Users\justi\GuidedOperationsWork\real-corpus-v3'
rx_num = re.compile(r'NUMBER[:\s]*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d)', re.I)

corpus = {}
for f in glob.glob(root + r'\**\chunks.json', recursive=True):
    cs = json.load(open(f, encoding='utf-8'))
    if not cs:
        continue
    whole = ' '.join(c.get('content', '') for c in cs)
    m = rx_num.search(whole)
    if not m:
        continue
    k = re.sub(r'\s+', '', m.group(1)).upper()
    corpus.setdefault(k, {})
    for c in cs:
        p = str(c.get('printed_page_start'))
        corpus[k][p] = corpus[k].get(p, '') + ' ' + (c.get('content') or '')

def norm(s):
    for a, b in [('\u2019',"'"),('\u2018',"'"),('\u201c','"'),('\u201d','"'),
                 ('\u2013','-'),('\u2014','-'),('\ufffd','')]:
        s = s.replace(a, b)
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', s.lower()).split())

md = open(KEY, encoding='utf-8').read()
blocks = md.split('\n### ')

good = []
issues = []
refuse = 0
for b in blocks[1:]:
    qid = b.split(' ')[0].strip()
    if ' - REFUSE' in b.split('\n')[0]:
        refuse += 1
        continue
    cm = re.search(r'\*\*Citation:\*\*\s*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d),\s*pages?\s*([\d,\s and]+)', b)
    qm = re.search(r'^> (.+?)(?:\n\n|\Z)', b[b.find('> '):], re.S | re.M) if '> ' in b else None
    if not cm or not qm:
        issues.append((qid, 'could not parse citation or quote', '')); continue
    pol = re.sub(r'\s+', '', cm.group(1)).upper()
    cited = re.findall(r'\d+', cm.group(2))
    raw = re.sub(r'^>\s?', '', qm.group(1), flags=re.M).replace('\n', ' ')
    frags = [norm(x) for x in raw.split('...') if len(norm(x)) > 20]
    if not frags:
        issues.append((qid, 'quote too short to verify', '')); continue
    pages = corpus.get(pol, {})
    if not pages:
        issues.append((qid, 'POLICY NOT IN CORPUS', pol)); continue
    allpages = {p: norm(t) for p, t in pages.items()}
    where = []
    missing = []
    for fr in frags:
        hits = sorted(p for p, t in allpages.items() if fr in t)
        if hits:
            where.extend(hits)
        else:
            missing.append(fr[:50])
    if missing:
        issues.append((qid, 'QUOTE NOT IN POLICY', pol + ' :: ' + missing[0])); continue
    if not set(cited) & set(where):
        issues.append((qid, 'WRONG PAGE - cited %s, actually %s' % (','.join(cited), ','.join(sorted(set(where)))), pol))
        continue
    good.append(qid)

print('verified against source :', len(good))
print('refusal questions       :', refuse)
print('issues                  :', len(issues))
print()
for qid, why, extra in issues:
    print('  %-5s %-46s %s' % (qid, why, extra))
