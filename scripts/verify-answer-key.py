import argparse
import json
import re
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KEY = REPOSITORY_ROOT / "docs" / "quality" / "answer-key-draft.md"
DEFAULT_CORPUS_ROOT = REPOSITORY_ROOT / "real-corpus-v3"
POLICY_NUMBER = re.compile(
    r"NUMBER[:\s]*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d)", re.IGNORECASE
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify answer-key citations against extracted corpus chunks."
    )
    parser.add_argument(
        "--answer-key",
        type=Path,
        default=DEFAULT_KEY,
        help="answer-key Markdown path (defaults to the repository draft)",
    )
    parser.add_argument(
        "--corpus-root",
        type=Path,
        default=DEFAULT_CORPUS_ROOT,
        help="directory containing extracted chunks.json files",
    )
    args = parser.parse_args()
    if not args.answer_key.is_file():
        parser.error(f"answer key does not exist: {args.answer_key}")
    if not args.corpus_root.is_dir():
        parser.error(f"corpus root does not exist: {args.corpus_root}")
    return args


def normalize(value: str) -> str:
    for before, after in [
        ("\u2019", "'"),
        ("\u2018", "'"),
        ("\u201c", '"'),
        ("\u201d", '"'),
        ("\u2013", "-"),
        ("\u2014", "-"),
        ("\ufffd", ""),
    ]:
        value = value.replace(before, after)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def load_corpus(root: Path) -> dict[str, dict[str, str]]:
    corpus: dict[str, dict[str, str]] = {}
    for chunks_path in root.rglob("chunks.json"):
        with chunks_path.open(encoding="utf-8") as chunks_file:
            chunks = json.load(chunks_file)
        if not chunks:
            continue
        whole = " ".join(chunk.get("content", "") for chunk in chunks)
        match = POLICY_NUMBER.search(whole)
        if not match:
            continue
        policy = re.sub(r"\s+", "", match.group(1)).upper()
        pages = corpus.setdefault(policy, {})
        for chunk in chunks:
            page = str(chunk.get("printed_page_start"))
            pages[page] = pages.get(page, "") + " " + (chunk.get("content") or "")
    return corpus


def verify(answer_key: Path, corpus_root: Path) -> None:
    corpus = load_corpus(corpus_root)
    markdown = answer_key.read_text(encoding="utf-8")
    blocks = markdown.split("\n### ")

    good: list[str] = []
    issues: list[tuple[str, str, str]] = []
    refuse = 0
    for block in blocks[1:]:
        question_id = block.split(" ")[0].strip()
        if " - REFUSE" in block.split("\n")[0]:
            refuse += 1
            continue
        citation_match = re.search(
            r"\*\*Citation:\*\*\s*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d),\s*pages?\s*([\d,\s and]+)",
            block,
        )
        quote_match = (
            re.search(r"^> (.+?)(?:\n\n|\Z)", block[block.find("> ") :], re.S | re.M)
            if "> " in block
            else None
        )
        expected_match = re.search(
            r"\*\*Expected answer:\*\*\s*(.+?)(?:\n\n\*\*Citation:\*\*)",
            block,
            re.S,
        )
        if not citation_match or not quote_match or not expected_match:
            issues.append((question_id, "could not parse citation, quote, or answer", ""))
            continue
        policy = re.sub(r"\s+", "", citation_match.group(1)).upper()
        cited_pages = re.findall(r"\d+", citation_match.group(2))
        raw_quote = re.sub(
            r"^>\s?", "", quote_match.group(1), flags=re.MULTILINE
        ).replace("\n", " ")
        quote_fragments = [
            normalize(fragment)
            for fragment in raw_quote.split("...")
            if len(normalize(fragment)) > 20
        ]
        if not quote_fragments:
            issues.append((question_id, "quote too short to verify", ""))
            continue
        pages = corpus.get(policy, {})
        if not pages:
            issues.append((question_id, "POLICY NOT IN CORPUS", policy))
            continue
        normalized_pages = {page: normalize(text) for page, text in pages.items()}
        found_on: list[str] = []
        missing: list[str] = []
        for fragment in quote_fragments:
            hits = sorted(
                page for page, text in normalized_pages.items() if fragment in text
            )
            if hits:
                found_on.extend(hits)
            else:
                missing.append(fragment[:50])
        if missing:
            issues.append(
                (question_id, "QUOTE NOT IN POLICY", f"{policy} :: {missing[0]}")
            )
            continue
        if not set(cited_pages) & set(found_on):
            issues.append(
                (
                    question_id,
                    "WRONG PAGE - cited %s, actually %s"
                    % (",".join(cited_pages), ",".join(sorted(set(found_on)))),
                    policy,
                )
            )
            continue

        cited_text = " ".join(
            normalized_pages[page]
            for page in cited_pages
            if page in normalized_pages
        )
        expected_answer = normalize(expected_match.group(1).replace("\n", " "))
        if not expected_answer or expected_answer not in cited_text:
            issues.append(
                (question_id, "EXPECTED ANSWER NEEDS OWNER REVIEW", policy)
            )
            continue
        good.append(question_id)

    print("verified against source :", len(good))
    print("refusal questions       :", refuse)
    print("issues                  :", len(issues))
    print()
    for question_id, reason, extra in issues:
        print("  %-5s %-46s %s" % (question_id, reason, extra))


if __name__ == "__main__":
    arguments = parse_args()
    verify(arguments.answer_key.resolve(), arguments.corpus_root.resolve())
