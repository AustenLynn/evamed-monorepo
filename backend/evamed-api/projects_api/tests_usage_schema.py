"""Fresh migrations and retained 0085 receipt compatibility."""
from uuid import uuid4
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from projects_api import models


class UsageReceiptSchemaTests(TestCase):
    def test_fresh_migration_created_exact_receipt_schema(self):
        with connection.cursor() as cursor:
            columns = connection.introspection.get_table_description(cursor, models.UsageSaveReceipt._meta.db_table)
            constraints = connection.introspection.get_constraints(cursor, models.UsageSaveReceipt._meta.db_table)
        self.assertEqual({column.name for column in columns}, {'id', 'project_id', 'operation_id', 'request_hash'})
        self.assertEqual(constraints['usage_project_operation_unique']['columns'], ['project_id', 'operation_id'])
        self.assertTrue(constraints['usage_project_operation_unique']['unique'])

    def test_already_applied_0085_has_empty_plan_and_preserves_receipts(self):
        owner = models.UserPlatform.objects.create(email='receipt@example.com', name='Receipt')
        project = models.Project.objects.create(name_project='Retained', user_platform_id=owner)
        receipt = models.UsageSaveReceipt.objects.create(project=project, operation_id=uuid4(), request_hash='a' * 64)
        executor = MigrationExecutor(connection)
        target = [('projects_api', '0085_usagesavereceipt')]
        self.assertIn(target[0], executor.loader.applied_migrations)
        self.assertEqual(executor.migration_plan(target), [])
        with CaptureQueriesContext(connection) as queries:
            executor.migrate(target)
        self.assertFalse(any('CREATE TABLE' in query['sql'].upper() for query in queries))
        receipt.refresh_from_db()
        self.assertEqual(receipt.request_hash, 'a' * 64)
