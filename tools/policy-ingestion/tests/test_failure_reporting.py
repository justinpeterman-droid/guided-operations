import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from guided_policy_ingestion.pipeline import BatchSummary, _safe_pipeline_reason


class SafePipelineReasonTests(unittest.TestCase):
    """A failure the operator cannot name is a failure they cannot fix."""

    def test_an_os_error_reports_errno_and_never_the_path(self):
        error = FileNotFoundError(2, "No such file or directory")
        error.filename = r"D:\Policy\ADC Policies\BMU Policies\BMU 1.03.0 Roles.pdf"
        reason = _safe_pipeline_reason(error)
        self.assertIn("FileNotFoundError", reason)
        self.assertIn("errno 2", reason)
        self.assertNotIn("D:\\", reason)
        self.assertNotIn("Roles", reason)

    def test_a_value_error_keeps_its_message(self):
        reason = _safe_pipeline_reason(ValueError("Unknown collection"))
        self.assertEqual(reason, "ValueError: Unknown collection")

    def test_only_the_first_line_is_used(self):
        reason = _safe_pipeline_reason(ValueError("first line\nsecond line"))
        self.assertNotIn("second line", reason)

    def test_a_long_message_is_bounded(self):
        reason = _safe_pipeline_reason(ValueError("x" * 500))
        self.assertLessEqual(len(reason), 230)

    def test_an_empty_message_does_not_leave_a_dangling_colon(self):
        self.assertEqual(_safe_pipeline_reason(ValueError("")), "ValueError")


class BatchSummaryFailureTests(unittest.TestCase):
    def test_identical_reasons_are_counted_rather_than_repeated(self):
        summary = BatchSummary()
        summary.note_failure("ImportErrorSafe: not registered")
        summary.note_failure("ImportErrorSafe: not registered")
        summary.note_failure("ValueError: bad collection")
        self.assertEqual(
            summary.failure_reasons,
            {"ImportErrorSafe: not registered": 2, "ValueError: bad collection": 1},
        )

    def test_a_clean_run_reports_no_reasons(self):
        self.assertEqual(BatchSummary().failure_reasons, {})


if __name__ == "__main__":
    unittest.main()
