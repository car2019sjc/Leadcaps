import copy
import contextlib
import importlib.util
import io
import json
import os
import sys
from pathlib import Path
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("enable_https", Path(__file__).resolve().parents[1] / "deploy/enable_https.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
config_spec = importlib.util.spec_from_file_location("configure_anthropic", Path(__file__).resolve().parents[1] / "deploy/configure_anthropic.py")
config = importlib.util.module_from_spec(config_spec)
config_spec.loader.exec_module(config)
serp_spec = importlib.util.spec_from_file_location('configure_serpapi', Path(__file__).resolve().parents[1] / 'deploy/configure_serpapi.py')
serp = importlib.util.module_from_spec(serp_spec)
with mock.patch.dict(sys.modules, {'configure_anthropic': config}):
    serp_spec.loader.exec_module(serp)


class DeploymentGuards(unittest.TestCase):
    def test_serpapi_private_payload_rejects_extra_fields_and_invalid_keys(self):
        key = 'fictitious-serpapi-key-1234567890'
        self.assertEqual(serp.read_key(io.StringIO(json.dumps({'key': key}))), key)
        for value in ({'key': key, 'model': 'unexpected'}, {'key': 123}, {'key': 'short'}, [], {'key': 'a' * 201}):
            with self.subTest(value=value):
                with self.assertRaises(config.ConfigurationError):
                    serp.read_key(io.StringIO(json.dumps(value)))

    def test_serpapi_configuration_preserves_existing_secrets_without_logging(self):
        key = 'fictitious-serpapi-key-1234567890'
        original = b'POSTGRES_PASSWORD=fictitious-db-secret\nANTHROPIC_API_KEY=fictitious-anthropic-secret\nAPI_PORT=8310\n'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / '.env'
            path.write_bytes(original)
            output = io.StringIO()
            with mock.patch.object(serp, 'ROOT', root), mock.patch.object(serp.os, 'geteuid', return_value=0), \
                 mock.patch.object(serp.sys, 'stdin', io.StringIO(json.dumps({'key': key}))), \
                 mock.patch.object(serp, 'check_account', return_value=250) as account, contextlib.redirect_stdout(output):
                serp.main()
            account.assert_called_once_with(key)
            self.assertTrue(path.read_bytes().startswith(original))
            self.assertIn('SERPAPI_API_KEY=' + key + '\n', path.read_text())
            self.assertIn('SEARCH_MONTHLY_LIMIT=200\n', path.read_text())
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            backups = list((root / 'backups').glob('*/env.before'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), original)
            for secret in (key, 'fictitious-db-secret', 'fictitious-anthropic-secret'):
                self.assertNotIn(secret, output.getvalue())

    def test_serpapi_account_failure_preserves_configuration(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            original = b'POSTGRES_PASSWORD=fictitious-password\n'
            (root / '.env').write_bytes(original)
            with mock.patch.object(serp, 'ROOT', root), mock.patch.object(serp.os, 'geteuid', return_value=0), \
                 mock.patch.object(serp.sys, 'stdin', io.StringIO(json.dumps({'key': 'fictitious-serpapi-key-1234567890'}))), \
                 mock.patch.object(serp, 'check_account', side_effect=config.ConfigurationError('Conta inválida')):
                with self.assertRaises(config.ConfigurationError):
                    serp.main()
            self.assertEqual((root / '.env').read_bytes(), original)
            self.assertFalse((root / 'backups').exists())

    def test_private_payload_validates_credentials_and_rejects_unexpected_input(self):
        valid = {"key": "fictitious-windows-key-1234567890", "model": "claude-test", "workspace": ""}
        self.assertEqual(config.read_private_payload(io.StringIO(json.dumps(valid))), (valid['key'], '', 'claude-test'))
        invalid = ["not-json", json.dumps([]), json.dumps({**valid, "unexpected": "value"}),
                   json.dumps({**valid, "key": 123}), json.dumps({**valid, "key": "bad\nkey"}),
                   json.dumps({**valid, "workspace": "invalid"}), json.dumps({**valid, "model": "bad model"}), ' ' * 4097]
        for text in invalid:
            with self.subTest(text=text[:20]):
                with self.assertRaises(config.ConfigurationError):
                    config.read_private_payload(io.StringIO(text))

    def test_private_stdin_saves_with_backup_without_logging_secrets(self):
        key = "fictitious-windows-key-1234567890"
        original = b"POSTGRES_PASSWORD=fictitious-database-password\nALLOWED_ORIGINS=https://example.com\nAPI_PORT=8310\n"
        old_mask = os.umask(0o077)
        try:
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                env_path = root / '.env'
                env_path.write_bytes(original)
                source = io.StringIO(json.dumps({"key": key, "model": "claude-test"}))
                output = io.StringIO()
                with mock.patch.object(config, 'ROOT', root), mock.patch.object(config.os, 'geteuid', return_value=0), \
                     mock.patch.object(config.sys, 'stdin', source), \
                     mock.patch.object(config, 'available_models', return_value=[{"id": "claude-test"}]) as models, \
                     mock.patch.object(config.getpass, 'getpass', side_effect=AssertionError('No interactive key prompt')), \
                     contextlib.redirect_stdout(output):
                    config.main(from_stdin=True)
                models.assert_called_once_with(key, '')
                saved = env_path.read_text()
                self.assertTrue(saved.startswith(original.decode()))
                self.assertIn('ANTHROPIC_MODEL=claude-test\n', saved)
                self.assertEqual(env_path.stat().st_mode & 0o777, 0o600)
                backups = list((root / 'backups').glob('*/env.before'))
                self.assertEqual(len(backups), 1)
                self.assertEqual(backups[0].read_bytes(), original)
                self.assertNotIn(key, output.getvalue())
                self.assertNotIn('fictitious-database-password', output.getvalue())
        finally:
            os.umask(old_mask)

    def test_unavailable_private_model_does_not_write_env_or_backup(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            original = b"POSTGRES_PASSWORD=fictitious-password\n"
            (root / '.env').write_bytes(original)
            source = io.StringIO(json.dumps({"key": "fictitious-windows-key-1234567890", "model": "unavailable-model"}))
            with mock.patch.object(config, 'ROOT', root), mock.patch.object(config.os, 'geteuid', return_value=0), \
                 mock.patch.object(config.sys, 'stdin', source), \
                 mock.patch.object(config, 'available_models', return_value=[{"id": "other-model"}]):
                with self.assertRaises(config.ConfigurationError):
                    config.main(from_stdin=True)
            self.assertEqual((root / '.env').read_bytes(), original)
            self.assertFalse((root / 'backups').exists())

    def test_private_stdin_rejects_a_remote_terminal(self):
        source = mock.Mock()
        source.isatty.return_value = True
        with mock.patch.object(config.os, 'geteuid', return_value=0), mock.patch.object(config.sys, 'stdin', source):
            with self.assertRaises(config.ConfigurationError):
                config.main(from_stdin=True)
        source.read.assert_not_called()

    def test_anthropic_model_accepts_number_name_and_id(self):
        models = [
            {"id": "claude-sonnet-test", "display_name": "Claude Sonnet Test"},
            {"id": "claude-haiku-test", "display_name": "Claude Haiku Test"}
        ]
        for choice in ("1", "Claude Sonnet Test", "claude-sonnet-test", "  CLAUDE   SONNET TEST  "):
            with self.subTest(choice=choice):
                self.assertEqual(config.choose_model(models, lambda _: choice), "claude-sonnet-test")
        self.assertEqual(config.choose_model(models, lambda _: "2"), "claude-haiku-test")

    def test_anthropic_invalid_model_retries_without_requesting_key(self):
        models = [{"id": "claude-test", "display_name": "Claude Test"}]
        choices = iter(("unknown", "0", "99", "", "Claude Test"))
        messages = []
        selected = config.choose_model(models, lambda _: next(choices), messages.append)
        self.assertEqual(selected, "claude-test")
        self.assertEqual(len(messages), 4)

    def test_anthropic_model_can_be_cancelled(self):
        with self.assertRaises(KeyboardInterrupt):
            config.choose_model([{"id": "claude-test"}], lambda _: "cancelar")

    def test_anthropic_configuration_preserves_database_and_proxy_settings(self):
        source = "POSTGRES_PASSWORD=private-value\nALLOWED_ORIGINS=https://example.com\nAPI_PORT=8310\n"
        result = config.replace_values(source, {"ANTHROPIC_API_KEY": "fictitious-key", "ANTHROPIC_MODEL": "model-test"})
        self.assertTrue(result.startswith(source))
        self.assertEqual(result.count("ANTHROPIC_API_KEY="), 1)
        replaced = config.replace_values(result, {"ANTHROPIC_API_KEY": "another-fictitious-key"})
        self.assertIn("ANTHROPIC_API_KEY=another-fictitious-key\n", replaced)
        self.assertNotIn("ANTHROPIC_API_KEY=fictitious-key\n", replaced)

    def test_duplicate_anthropic_configuration_is_not_rewritten(self):
        with self.assertRaises(ValueError):
            config.replace_values("ANTHROPIC_API_KEY=one\nANTHROPIC_API_KEY=two\n", {"ANTHROPIC_API_KEY": "new"})

    def test_origin_preserves_password_and_existing_origins(self):
        source = "POSTGRES_PASSWORD=private-value\nALLOWED_ORIGINS=http://127.0.0.1:8000\nAPI_PORT=8310\n"
        result = deploy.add_origin(source)
        self.assertIn("POSTGRES_PASSWORD=private-value\n", result)
        self.assertIn("http://127.0.0.1:8000," + deploy.ORIGIN, result)
        self.assertEqual(result, deploy.add_origin(result))

    def test_origin_rejects_ambiguous_env(self):
        for source in ("POSTGRES_PASSWORD=x\n", "ALLOWED_ORIGINS=x\n", "ALLOWED_ORIGINS=https://a.test\nALLOWED_ORIGINS=https://b.test\n"):
            with self.assertRaises(ValueError):
                deploy.add_origin(source)

    def test_site_preserves_existing_sites_and_is_idempotent(self):
        original = "{\n email admin@example.com\n}\n\nold.example.com {\n reverse_proxy old-api:3000\n}\n"
        new = deploy.site_config(original)
        self.assertTrue(new.startswith(original))
        self.assertEqual(new, deploy.site_config(new))
        self.assertEqual(new.count(deploy.DOMAIN), 1)

    def test_unmanaged_site_and_broken_markers_are_not_overwritten(self):
        for text in (deploy.DOMAIN + " { respond existing }", deploy.BEGIN, deploy.END + "\n" + deploy.BEGIN):
            with self.assertRaises(ValueError):
                deploy.site_config(text)

    def test_write_preserves_bind_mount_inode(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "Caddyfile"
            path.write_bytes(b"old")
            inode = path.stat().st_ino
            deploy.write_in_place(path, b"new")
            self.assertEqual(path.stat().st_ino, inode)
            self.assertEqual(path.read_bytes(), b"new")

    def test_merge_rejects_database_and_api_exposure(self):
        before = {"services": {
            "db": {"networks": {"database": None}},
            "api": {"networks": {"database": None, "edge": None}, "environment": {"ALLOWED_ORIGINS": "https://old.test"}}
        }, "networks": {"database": {"internal": True}, "edge": {}}, "volumes": {"postgres_data": {}}}
        after = copy.deepcopy(before)
        after["services"]["api"]["environment"]["ALLOWED_ORIGINS"] = deploy.ORIGIN
        after["services"]["leadcaps-gateway"] = {"networks": {"edge": None, "caddy_proxy": None}}
        after["networks"]["caddy_proxy"] = {"name": "synapse-network", "external": True}
        deploy.assert_isolation(before, after)
        for service, field, value in (("db", "ports", [5432]), ("api", "networks", {"database": None, "edge": None, "caddy_proxy": None}), ("leadcaps-gateway", "ports", [8080])):
            broken = copy.deepcopy(after)
            broken["services"][service][field] = value
            with self.assertRaises(ValueError):
                deploy.assert_isolation(before, broken)


if __name__ == "__main__":
    unittest.main()
