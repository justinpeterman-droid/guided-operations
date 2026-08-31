import argparse
import json
import re
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KEY = REPOSITORY_ROOT / "docs" / "quality" / "answer-key-draft.md"
rx_num = re.compile(r"NUMBER[:\s]*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d)", re.IGNORECASE)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Verify answer-key citations against an extracted corpus.",
    )
    parser.add_argument(
        "corpus",
        type=Path,
        help="Corpus root containing extracted chunks.json files.",
    )
    parser.add_argument("--key", type=Path, default=DEFAULT_KEY)
    args = parser.parse_args()
    if not args.key.is_file():
        parser.error(f"answer key does not exist: {args.key}")
    if not args.corpus.is_dir():
        parser.error(f"corpus root does not exist: {args.corpus}")
    return args


args = parse_args()

corpus = {}
for path in args.corpus.rglob("chunks.json"):
    with path.open(encoding="utf-8") as handle:
        cs = json.load(handle)
    if not cs:
        continue
    whole = " ".join(c.get("content", "") for c in cs)
    m = rx_num.search(whole)
    if not m:
        continue
    k = re.sub(r"\s+", "", m.group(1)).upper()
    corpus.setdefault(k, {})
    for c in cs:
        p = str(c.get("printed_page_start"))
        corpus[k][p] = corpus[k].get(p, "") + " " + (c.get("content") or "")


def norm(s):
    for a, b in [
        ("\u2019", "'"),
        ("\u2018", "'"),
        ("\u201c", '"'),
        ("\u201d", '"'),
        ("\u2013", "-"),
        ("\u2014", "-"),
        ("\ufffd", ""),
    ]:
        s = s.replace(a, b)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s.lower()).split())


_SUPPORT_STOP_WORDS = {
    "and",
    "are",
    "does",
    "for",
    "from",
    "have",
    "into",
    "that",
    "the",
    "their",
    "then",
    "this",
    "with",
    "yes",
    "you",
    "your",
}


def expected_answer_is_supported(expected, policy_text):
    expected_terms = {
        term.rstrip("s")
        for term in norm(expected).split()
        if len(term) >= 3 and term not in _SUPPORT_STOP_WORDS
    }
    policy_terms = {term.rstrip("s") for term in norm(policy_text).split()}
    return bool(expected_terms) and expected_terms <= policy_terms


md = args.key.read_text(encoding="utf-8")
blocks = md.split("\n### ")

good = []
issues = []
refuse = 0
for b in blocks[1:]:
    qid = b.split(" ")[0].strip()
    if " - REFUSE" in b.split("\n")[0]:
        refuse += 1
        continue
    cm = re.search(
        r"\*\*Citation:\*\*\s*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d),\s*pages?\s*([\d,\s and]+)",
        b,
    )
    qm = (
        re.search(r"^> (.+?)(?:\n\n|\Z)", b[b.find("> ") :], re.DOTALL | re.MULTILINE)
        if "> " in b
        else None
    )
    em = re.search(
        r"\*\*Expected answer:\*\*\s*(.+?)(?=\n\n\*\*Citation:)",
        b,
        re.DOTALL,
    )
    if not cm or not qm or not em:
        issues.append((qid, "could not parse expected answer, citation, or quote", ""))
        continue
    pol = re.sub(r"\s+", "", cm.group(1)).upper()
    cited = re.findall(r"\d+", cm.group(2))
    raw = re.sub(r"^>\s?", "", qm.group(1), flags=re.MULTILINE).replace("\n", " ")
    frags = [norm(x) for x in raw.split("...") if len(norm(x)) > 20]
    if not frags:
        issues.append((qid, "quote too short to verify", ""))
        continue
    pages = corpus.get(pol, {})
    if not pages:
        issues.append((qid, "POLICY NOT IN CORPUS", pol))
        continue
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
        issues.append((qid, "QUOTE NOT IN POLICY", pol + " :: " + missing[0]))
        continue
    if not set(cited) & set(where):
        issues.append(
            (
                qid,
                "WRONG PAGE - cited {}, actually {}".format(
                    ",".join(cited), ",".join(sorted(set(where)))
                ),
                pol,
            )
        )
        continue
    cited_policy_text = " ".join(pages.get(page, "") for page in cited)
    if not expected_answer_is_supported(em.group(1), cited_policy_text):
        issues.append((qid, "EXPECTED ANSWER NEEDS OWNER REVIEW", pol))
        continue
    good.append(qid)

print("verified against source :", len(good))
print("refusal questions       :", refuse)
print("issues                  :", len(issues))
print()
for qid, why, extra in issues:
    print(f"  {qid:<5} {why:<46} {extra}")
