from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KEY_PATH = REPOSITORY_ROOT / "docs" / "quality" / "answer-key-draft.md"
POLICY_NUMBER_PATTERN = re.compile(
    r"NUMBER[:\s]*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d)",
    re.IGNORECASE,
)
CITATION_PATTERN = re.compile(
    r"\*\*Citation:\*\*\s*((?:BMU|NCU|SD)[\s\-]?[\d.]*\d),"
    r"\s*pages?\s*([\d,\s and]+)",
)
OWNER_REVIEW_PATTERN = re.compile(
    r"\*\*Owner review:\*\*\s*(KEEP|FIX|CUT|PENDING)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class AnswerKeyQuestion:
    question_id: str
    heading: str
    block: str
    is_refusal: bool
    owner_review: str


@dataclass(frozen=True)
class VerificationIssue:
    question_id: str
    reason: str
    detail: str = ""


@dataclass(frozen=True)
class VerificationSummary:
    source_verified: tuple[str, ...]
    owner_approved: tuple[str, ...]
    refusals: int
    issues: tuple[VerificationIssue, ...]

    @property
    def answer_review_pending(self) -> int:
        return sum(
            issue.reason == "ANSWER REQUIRES OWNER REVIEW"
            for issue in self.issues
        )


def normalize(value: str) -> str:
    for original, replacement in (
        ("\u2019", "'"),
        ("\u2018", "'"),
        ("\u201c", '"'),
        ("\u201d", '"'),
        ("\u2013", "-"),
        ("\u2014", "-"),
        ("\ufffd", ""),
    ):
        value = value.replace(original, replacement)
    return " ".join(
        re.sub(r"[^a-z0-9]+", " ", value.lower()).split()
    )


def canonical_policy_number(value: str) -> str:
    return re.sub(r"\s+", "", value).upper()


def _canonical_printed_page(value: object) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return str(value) if value >= 0 else None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped.isdigit():
            return None
        try:
            return str(int(stripped))
        except ValueError:
            return None
    return None


def load_corpus(corpus_root: Path) -> dict[str, dict[str, str]]:
    if not corpus_root.is_dir():
        raise ValueError("The corpus root must be an existing directory")

    corpus: dict[str, dict[str, str]] = {}
    for chunks_path in sorted(corpus_root.rglob("chunks.json")):
        with chunks_path.open(encoding="utf-8") as handle:
            chunks = json.load(handle)
        if not isinstance(chunks, list) or not chunks:
            continue
        whole = " ".join(
            str(chunk.get("content", ""))
            for chunk in chunks
            if isinstance(chunk, dict)
        )
        match = POLICY_NUMBER_PATTERN.search(whole)
        if not match:
            continue
        policy_number = canonical_policy_number(match.group(1))
        pages = corpus.setdefault(policy_number, {})
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            page = _canonical_printed_page(chunk.get("printed_page_start"))
            if page is None:
                continue
            pages[page] = (
                pages.get(page, "") + " " + str(chunk.get("content") or "")
            )
    return corpus


def parse_answer_key(markdown: str) -> tuple[AnswerKeyQuestion, ...]:
    questions: list[AnswerKeyQuestion] = []
    for block in markdown.split("\n### ")[1:]:
        heading = block.split("\n", 1)[0].strip()
        question_id = heading.split(" ", 1)[0].strip()
        if not heading or not question_id:
            raise ValueError("Answer key question heading has no identifier")
        review_match = OWNER_REVIEW_PATTERN.search(block)
        questions.append(
            AnswerKeyQuestion(
                question_id=question_id,
                heading=heading,
                block=block,
                is_refusal=" - REFUSE" in heading,
                owner_review=(
                    review_match.group(1).upper()
                    if review_match
                    else "PENDING"
                ),
            )
        )
    if not questions:
        raise ValueError("Answer key contains no question headings")
    return tuple(questions)


def _quoted_fragments(block: str) -> list[str]:
    quote_start = block.find("> ")
    if quote_start < 0:
        return []
    quote_match = re.search(
        r"^> (.+?)(?:\n\n|\Z)",
        block[quote_start:],
        re.DOTALL | re.MULTILINE,
    )
    if not quote_match:
        return []
    raw = re.sub(
        r"^>\s?",
        "",
        quote_match.group(1),
        flags=re.MULTILINE,
    ).replace("\n", " ")
    return [
        normalized
        for fragment in raw.split("...")
        if len(normalized := normalize(fragment)) > 20
    ]


def verify_answer_key(
    questions: Iterable[AnswerKeyQuestion],
    corpus: dict[str, dict[str, str]],
) -> VerificationSummary:
    source_verified: list[str] = []
    owner_approved: list[str] = []
    issues: list[VerificationIssue] = []
    refusals = 0

    for question in questions:
        if question.is_refusal:
            refusals += 1
            continue

        citation_match = CITATION_PATTERN.search(question.block)
        fragments = _quoted_fragments(question.block)
        if not citation_match or not fragments:
            issues.append(
                VerificationIssue(
                    question.question_id,
                    "COULD NOT PARSE CITATION OR QUOTE",
                )
            )
            continue

        policy_number = canonical_policy_number(citation_match.group(1))
        cited_pages = {
            page
            for raw_page in re.findall(r"\d+", citation_match.group(2))
            if (page := _canonical_printed_page(raw_page)) is not None
        }
        pages = corpus.get(policy_number, {})
        if not pages:
            issues.append(
                VerificationIssue(
                    question.question_id,
                    "POLICY NOT IN CORPUS",
                    policy_number,
                )
            )
            continue

        normalized_pages = {
            page: normalize(text) for page, text in pages.items()
        }
        quote_pages: set[str] = set()
        missing_fragment: str | None = None
        wrong_page_fragment: str | None = None
        for fragment in fragments:
            hits = {
                page
                for page, text in normalized_pages.items()
                if fragment in text
            }
            if not hits:
                missing_fragment = fragment[:50]
                break
            quote_pages.update(hits)
            if (
                wrong_page_fragment is None
                and not cited_pages.intersection(hits)
            ):
                wrong_page_fragment = fragment[:50]

        if missing_fragment:
            issues.append(
                VerificationIssue(
                    question.question_id,
                    "QUOTE NOT IN POLICY",
                    f"{policy_number} :: {missing_fragment}",
                )
            )
            continue
        if wrong_page_fragment:
            issues.append(
                VerificationIssue(
                    question.question_id,
                    "WRONG PAGE",
                    (
                        f"cited {','.join(sorted(cited_pages))}; "
                        f"quote found {','.join(sorted(quote_pages))}; "
                        f"unsupported fragment {wrong_page_fragment}; "
                        f"{policy_number}"
                    ),
                )
            )
            continue

        source_verified.append(question.question_id)
        if question.owner_review == "KEEP":
            owner_approved.append(question.question_id)
        else:
            issues.append(
                VerificationIssue(
                    question.question_id,
                    "ANSWER REQUIRES OWNER REVIEW",
                    question.owner_review,
                )
            )

    return VerificationSummary(
        source_verified=tuple(source_verified),
        owner_approved=tuple(owner_approved),
        refusals=refusals,
        issues=tuple(issues),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Verify answer-key quotes/pages and separately report human "
            "approval of the expected answer claims"
        )
    )
    parser.add_argument(
        "--corpus-root",
        type=Path,
        required=True,
        help="Private extracted corpus root containing chunks.json files",
    )
    parser.add_argument(
        "--key",
        type=Path,
        default=DEFAULT_KEY_PATH,
        help="Answer-key Markdown file (defaults to the repository draft)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.key.is_file():
        print("The answer-key path must be an existing file")
        return 2

    try:
        corpus = load_corpus(args.corpus_root)
        questions = parse_answer_key(args.key.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as error:
        print(f"Verification input could not be read: {type(error).__name__}")
        return 2

    summary = verify_answer_key(questions, corpus)
    print("source quote/page verified:", len(summary.source_verified))
    print("owner-approved answers     :", len(summary.owner_approved))
    print("answer review pending      :", summary.answer_review_pending)
    print("refusal questions          :", summary.refusals)
    print("issues                     :", len(summary.issues))
    print()
    for issue in summary.issues:
        print(
            "  %-5s %-34s %s"
            % (issue.question_id, issue.reason, issue.detail)
        )

    # A mechanically verified quote is not ground truth. Keep the command red
    # until every non-refusal answer is both source-verified and explicitly
    # approved by its owner-review marker.
    return 1 if summary.issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
