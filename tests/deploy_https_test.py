import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("enable_https", Path(__file__).resolve().parents[1] / "deploy/enable_https.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeploymentGuards(unittest.TestCase):
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
