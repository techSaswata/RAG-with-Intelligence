"""Validate, sanitize, and store uploaded image; create DB record."""
import io
import logging
import os
import re
import shutil
import uuid
from pathlib import Path

from PIL import Image

from config import (
    IMAGE_ALLOWED_EXTENSIONS,
    IMAGE_MAX_SIZE_MB,
    IMAGE_STORAGE_PATH,
)
from services.image.image_metadata_manager import ImageMetadataManager

logger = logging.getLogger(__name__)

SAFE_FILENAME_PATTERN = re.compile(r"[^a-zA-Z0-9._-]")


def sanitize_filename(filename: str) -> str:
    base = os.path.basename(filename).strip()
    if not base:
        return f"image_{uuid.uuid4().hex[:8]}"
    base = SAFE_FILENAME_PATTERN.sub("_", base)
    ext = Path(base).suffix.lower()
    if ext not in IMAGE_ALLOWED_EXTENSIONS:
        base = base + ".jpg"
    return base[:200]


class ImageUploadHandler:
    """Handle image upload: validation, storage, metadata."""

    def __init__(
        self,
        storage_path: str = IMAGE_STORAGE_PATH,
        max_size_mb: int = IMAGE_MAX_SIZE_MB,
        metadata_manager: ImageMetadataManager = None,
    ):
        self.storage_path = Path(storage_path)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.metadata_manager = metadata_manager or ImageMetadataManager()

    def validate_and_save(self, filename: str, contents: bytes) -> str:
        ext = Path(filename).suffix.lower()
        if ext not in IMAGE_ALLOWED_EXTENSIONS:
            raise ValueError(f"Invalid file type. Allowed: {IMAGE_ALLOWED_EXTENSIONS}")

        if len(contents) > self.max_size_bytes:
            raise ValueError(
                f"File too large. Max size: {self.max_size_bytes // (1024*1024)} MB"
            )

        try:
            img = Image.open(io.BytesIO(contents))
            img.verify()
        except Exception as e:
            raise ValueError(f"Invalid image file: {e}")

        safe_name = sanitize_filename(filename)
        orig_ext = Path(filename).suffix.lower()
        if orig_ext in IMAGE_ALLOWED_EXTENSIONS:
            if not safe_name.lower().endswith(orig_ext):
                safe_name = Path(safe_name).stem + orig_ext

        image_id = str(uuid.uuid4())
        image_dir = self.storage_path / image_id
        image_dir.mkdir(parents=True, exist_ok=True)
        stored_path = image_dir / safe_name
        stored_path = stored_path.resolve()
        if not str(stored_path).startswith(str(self.storage_path.resolve())):
            raise ValueError("Path traversal detected")
        with open(stored_path, "wb") as f:
            f.write(contents)

        self.metadata_manager.create_image(
            image_id=image_id,
            original_filename=filename,
            stored_path=str(stored_path),
            status="pending",
            file_size_bytes=len(contents),
        )
        logger.info("Saved image %s to %s", image_id, stored_path)
        return image_id

    def get_stored_path(self, image_id: str) -> str:
        path = self.metadata_manager.get_image_stored_path(image_id)
        if not path:
            raise FileNotFoundError(f"Image not found: {image_id}")
        return path

    def delete_image_files_and_record(self, image_id: str) -> None:
        img = self.metadata_manager.get_image(image_id)
        if not img:
            return
        stored = Path(img.stored_path)
        if stored.is_file():
            try:
                stored.unlink()
            except OSError as e:
                logger.warning("Could not delete image file %s: %s", stored, e)
        img_dir = stored.parent
        if img_dir.is_dir():
            try:
                shutil.rmtree(img_dir, ignore_errors=True)
            except OSError as e:
                logger.warning("Could not delete image dir %s: %s", img_dir, e)
        self.metadata_manager.delete_image(image_id)
