"""
Tests for backend.services package exports.
TDD: Write tests first, then fix the implementation.
"""

import unittest


class TestServicesExports(unittest.TestCase):
    """Test that backend.services package properly exports its contents."""

    def test_can_import_export_service_from_package(self):
        """Should be able to import ExportService directly from backend.services."""
        from backend.services import ExportService
        self.assertIsNotNone(ExportService)
        self.assertEqual(ExportService.__name__, 'ExportService')

    def test_can_import_safe_export_html_parser(self):
        """Should be able to import SafeExportHTMLParser directly."""
        from backend.services import SafeExportHTMLParser
        self.assertIsNotNone(SafeExportHTMLParser)
        self.assertEqual(SafeExportHTMLParser.__name__, 'SafeExportHTMLParser')

    def test_package_has_all_exports(self):
        """Package __all__ should contain exported symbols."""
        import backend.services
        self.assertTrue(hasattr(backend.services, '__all__'))
        self.assertIn('ExportService', backend.services.__all__)
        self.assertIn('SafeExportHTMLParser', backend.services.__all__)


if __name__ == '__main__':
    unittest.main()
