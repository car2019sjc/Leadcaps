#!/usr/bin/env python3
"""Ativa a rota do Leadcaps no Caddy existente; requer Python 3 e Docker Compose."""
import argparse
import copy
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://leadcaps.synapseia.com.br"
DOMAIN = "api-leadcaps.synapseia.com.br"
MARKER = "# leadcaps-managed-gateway-v1"
BEGIN = "# BEGIN LEADCAPS HTTPS"
END = "# END LEADCAPS HTTPS"


def run(args, capture=False, check=True):
    return subprocess.run(args, cwd=ROOT, text=True, check=check,
                          stdout=subprocess.PIPE if capture else None)


def compose(*args, override=True, capture=False):
    command = ["docker", "compose", "--project-name", "leadcaps", "-f", str(ROOT / "compose.yaml")]
    if override and (ROOT / "compose.override.yaml").exists():
        command += ["-f", str(ROOT / "compose.override.yaml")]
    return run(command + list(args), capture=capture)


def add_origin(text, origin=ORIGIN):
    lines = text.splitlines(keepends=True)
    matches = [i for i, line in enumerate(lines) if line.startswith("ALLOWED_ORIGINS=")]
    if len(matches) != 1:
        raise ValueError("Esperada uma linha ALLOWED_ORIGINS no .env; nada foi alterado.")
    index = matches[0]
    value = lines[index].split("=", 1)[1].strip()
    if value[:1] in ("'", '"') and value[-1:] == value[:1]:
        value = value[1:-1]
    origins = value.split(",") if value else []
    if any(not re.fullmatch(r"https?://[A-Za-z0-9.-]+(?::[0-9]+)?", x) for x in origins):
        raise ValueError("ALLOWED_ORIGINS tem formato inesperado; revise essa linha localmente.")
    if origin not in origins:
        origins.append(origin)
    lines[index] = "ALLOWED_ORIGINS=" + ",".join(origins) + "\n"
    return "".join(lines)


def site_config(text):
    block = (f"{BEGIN}\n{DOMAIN} {{\n"
             "\trequest_body {\n\t\tmax_size 10485760\n\t}\n"
             "\treverse_proxy leadcaps-gateway:8080\n}\n" + END)
    if BEGIN in text or END in text:
        if text.count(BEGIN) != 1 or text.count(END) != 1 or text.index(BEGIN) > text.index(END):
            raise ValueError("Marcadores da rota Leadcaps inconsistentes; nada foi alterado.")
        old = text[text.index(BEGIN):text.index(END) + len(END)]
        if DOMAIN in text.replace(old, ""):
            raise ValueError("Domínio Leadcaps também aparece fora do bloco gerenciado.")
        return text.replace(old, block)
    if DOMAIN in text:
        raise ValueError("O domínio já aparece no Caddyfile fora do bloco gerenciado; revise antes.")
    return text.rstrip() + "\n\n" + block + "\n"


def assert_isolation(before, after):
    # Verifica o resultado real do merge do Compose, sem imprimir variáveis privadas.
    expected = copy.deepcopy(before["services"])
    actual = copy.deepcopy(after["services"])
    gateway = actual.pop("leadcaps-gateway", None)
    expected.pop("leadcaps-gateway", None)
    if not gateway or set(gateway["networks"]) != {"edge", "caddy_proxy"} or gateway.get("ports"):
        raise ValueError("O gateway deve ter somente as redes edge/caddy_proxy e nenhuma porta publicada.")
    expected["api"]["environment"]["ALLOWED_ORIGINS"] = actual["api"]["environment"]["ALLOWED_ORIGINS"]
    if expected != actual:
        raise ValueError("O merge alteraria serviços além do gateway e da origem permitida.")
    if set(actual["db"]["networks"]) != {"database"} or actual["db"].get("ports"):
        raise ValueError("O PostgreSQL precisa permanecer somente na rede database, sem portas públicas.")
    if set(actual["api"]["networks"]) != {"database", "edge"}:
        raise ValueError("A API não deve entrar na rede compartilhada do proxy.")
    for name, network in before["networks"].items():
        if name != "caddy_proxy" and after["networks"].get(name) != network:
            raise ValueError("Uma rede existente do Leadcaps seria alterada.")
    proxy = after["networks"].get("caddy_proxy", {})
    if proxy.get("name") != "synapse-network" or not proxy.get("external"):
        raise ValueError("Rede de proxy inesperada.")
    if before.get("volumes") != after.get("volumes"):
        raise ValueError("Um volume existente do Leadcaps seria alterado.")


def write_in_place(path, data):
    # Mantém o inode: Caddyfile é um bind mount de arquivo único.
    with path.open("wb") as file:
        file.write(data)
        file.flush()
        os.fsync(file.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="aplicar após as verificações")
    parser.add_argument("--caddy-container", default="synapse-caddy")
    parser.add_argument("--caddy-file", type=Path, default=Path("/opt/synapse-drive-webapp/infra/Caddyfile"))
    args = parser.parse_args()
    if not args.apply:
        parser.error("Use --apply para ativar a rota. Leia docs/https-vps.md antes.")
    if os.geteuid() != 0:
        raise ValueError("Execute como root na VPS.")
    if os.environ.get("COMPOSE_FILE") or os.environ.get("COMPOSE_PROFILES"):
        raise ValueError("COMPOSE_FILE/COMPOSE_PROFILES estão definidos; use um terminal sem esses overrides.")
    os.umask(0o077)
    backups = ROOT / "backups"
    backups.mkdir(mode=0o700, exist_ok=True)
    os.chmod(backups, 0o700)
    with (backups / "https-install.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        activate(args, backups)


def activate(args, backups):
    env_path = ROOT / ".env"
    override = ROOT / "compose.override.yaml"
    for name in ("compose.override.yml", "docker-compose.override.yaml", "docker-compose.override.yml"):
        if (ROOT / name).exists():
            raise ValueError(f"Override adicional encontrado: {name}. Revise antes de instalar.")
    old_override = override.read_bytes() if override.exists() else None
    if old_override is not None and not old_override.decode().startswith(MARKER + "\n"):
        raise ValueError("compose.override.yaml já existe e não pertence a este instalador.")
    old_env = env_path.read_bytes()
    old_caddy = args.caddy_file.read_bytes()
    new_env = add_origin(old_env.decode()).encode()
    new_caddy = site_config(old_caddy.decode()).encode()
    info = json.loads(run(["docker", "inspect", args.caddy_container], capture=True).stdout)[0]
    if not info["State"]["Running"] or "synapse-network" not in info["NetworkSettings"]["Networks"]:
        raise ValueError("O Caddy precisa estar ativo na rede synapse-network.")
    if not any(m["Destination"] == "/etc/caddy/Caddyfile" and Path(m["Source"]).resolve() == args.caddy_file.resolve()
               for m in info["Mounts"]):
        raise ValueError("O arquivo informado não corresponde ao bind mount do Caddy.")
    caddy = ["docker", "exec", args.caddy_container]
    adapted = json.loads(run(caddy + ["caddy", "adapt", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"], capture=True).stdout)
    active = json.loads(run(caddy + ["wget", "-q", "-O-", "http://127.0.0.1:2019/config/"], capture=True).stdout)
    if adapted != active:
        raise ValueError("O Caddyfile difere da configuração ativa. Nenhuma alteração foi aplicada.")
    before = json.loads(compose("config", "--format", "json", capture=True).stdout)
    compose("exec", "-T", "api", "node", "-e", "fetch('http://127.0.0.1:8080/health').then(async r=>{if(!r.ok || (await r.json()).status!=='ok')process.exit(1)}).catch(()=>process.exit(1))")
    # Evita conflito com alias de outro projeto antes de criar nosso gateway.
    network = json.loads(run(["docker", "network", "inspect", "synapse-network"], capture=True).stdout)[0]
    for cid in network.get("Containers", {}):
        container = json.loads(run(["docker", "inspect", cid], capture=True).stdout)[0]
        aliases = container["NetworkSettings"]["Networks"]["synapse-network"].get("Aliases") or []
        if "leadcaps-gateway" in aliases and container["Config"]["Labels"].get("com.docker.compose.project") != "leadcaps":
            raise ValueError("O alias leadcaps-gateway já está sendo usado por outro projeto.")
    backup = Path(tempfile.mkdtemp(prefix="https-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-", dir=backups))
    shutil.copy2(env_path, backup / "env.before")
    shutil.copy2(args.caddy_file, backup / "Caddyfile.before")
    if old_override is not None:
        (backup / "compose.override.before.yaml").write_bytes(old_override)
    (backup / "state.json").write_text(json.dumps({"caddy_file": str(args.caddy_file), "caddy_container": args.caddy_container, "override_existed": old_override is not None}, indent=2) + "\n")
    print("Backup privado:", backup, flush=True)
    caddy_written = False
    services_started = False
    try:
        override.write_bytes((ROOT / "deploy/compose.caddy.yaml").read_bytes())
        os.chmod(override, 0o644)  # Template público, sem credenciais; legível pelo operador do Compose.
        write_in_place(env_path, new_env)
        after = json.loads(compose("config", "--format", "json", capture=True).stdout)
        assert_isolation(before, after)
        # Não há migração, build de API nem operação no banco nesta ativação.
        services_started = True
        compose("up", "-d", "--no-deps", "--wait", "--wait-timeout", "150", "api", "leadcaps-gateway")
        health = run(caddy + ["wget", "-q", "-O-", "http://leadcaps-gateway:8080/health"], capture=True).stdout
        if json.loads(health).get("status") != "ok":
            raise ValueError("O Caddy não alcançou a API pelo gateway.")
        api_port = next(p["published"] for p in after["services"]["api"]["ports"] if p["target"] == 8080)
        request = urllib.request.Request(f"http://127.0.0.1:{api_port}/v1/sessions", method="OPTIONS", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.headers.get("Access-Control-Allow-Origin") != ORIGIN:
                raise ValueError("A API ainda não permite a origem do frontend.")
        if args.caddy_file.read_bytes() != old_caddy:
            raise ValueError("O Caddyfile mudou durante a instalação. Repita após revisar a alteração externa.")
        caddy_written = True
        write_in_place(args.caddy_file, new_caddy)
        run(caddy + ["caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"])
        run(caddy + ["caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"])
        print("Rota ativada e conexão interna/CORS verificados. HTTPS público ainda deve ser testado.")
        print(f"Próximo comando: curl --fail --show-error --max-time 20 https://{DOMAIN}/health")
    except BaseException:
        print("Falha na ativação. Tentando restaurar somente os arquivos e serviços envolvidos.", file=sys.stderr)
        try:
            if caddy_written:
                write_in_place(args.caddy_file, old_caddy)
                run(caddy + ["caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"])
            write_in_place(env_path, old_env)
            # Retira apenas o gateway novo, nunca banco, volume ou redes.
            if services_started and old_override is None:
                compose("stop", "leadcaps-gateway")
                compose("rm", "-f", "leadcaps-gateway")
            if old_override is None:
                override.unlink(missing_ok=True)
            else:
                override.write_bytes(old_override)
            if services_started:
                services = ["api"] + (["leadcaps-gateway"] if old_override else [])
                compose("up", "-d", "--no-deps", "--wait", "--wait-timeout", "150", *services)
            print("Configuração anterior restaurada. Backup:", backup, file=sys.stderr)
        except Exception:
            print("A restauração também falhou. Não execute outras alterações; backup:", backup, file=sys.stderr)
        raise


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        # Não imprimir ambientes nem configurações resolvidas com segredos.
        print("Instalação interrompida:", str(error), file=sys.stderr)
        sys.exit(1)
