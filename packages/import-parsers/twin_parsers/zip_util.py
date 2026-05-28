"""Extração segura de ZIP para exportações oficiais."""

import io
import zipfile
from pathlib import PurePosixPath

MAX_FILES = 500
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = frozenset({
    ".txt",
    ".json",
    ".csv",
    ".eml",
    ".html",
})


def _safe_path(name: str) -> bool:
    path = PurePosixPath(name.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts:
        return False
    return True


def extract_zip_entries(data: bytes) -> list[tuple[str, bytes]]:
    """Extrai ficheiros de um ZIP com limites de segurança."""
    out: list[tuple[str, bytes]] = []
    total_size = 0

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = [i for i in zf.infolist() if not i.is_dir()][:MAX_FILES]
        for info in infos:
            if not _safe_path(info.filename):
                continue
            suffix = PurePosixPath(info.filename).suffix.lower()
            if suffix not in ALLOWED_EXTENSIONS:
                continue
            if info.file_size > 20 * 1024 * 1024:
                continue
            total_size += info.file_size
            if total_size > MAX_UNCOMPRESSED_BYTES:
                break
            try:
                content = zf.read(info.filename)
            except (zipfile.BadZipFile, RuntimeError):
                continue
            out.append((info.filename.replace("\\", "/"), content))

    return out
