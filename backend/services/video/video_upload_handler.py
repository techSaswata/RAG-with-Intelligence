"""Validate, sanitize, and store uploaded video; create DB record. Does not process frames."""
import logging
import os
import re
import shutil
import uuid
from pathlib import Path

from config import (
    VIDEO_ALLOWED_EXTENSIONS,
    VIDEO_MAX_SIZE_MB,
    VIDEO_STORAGE_PATH,
)
from services.video.video_metadata_manager import VideoMetadataManager

logger = logging.getLogger(__name__)

# Safe filename: alphanumeric, dash, underscore, dot for extension
SAFE_FILENAME_PATTERN = re.compile(r"[^a-zA-Z0-9._-]")


def sanitize_filename(filename: str) -> str:
    """Remove path segments and dangerous characters."""
    base = os.path.basename(filename).strip()
    if not base:
        return f"video_{uuid.uuid4().hex[:8]}"
    base = SAFE_FILENAME_PATTERN.sub("_", base)
    # Ensure we keep a valid extension if present
    ext = Path(base).suffix.lower()
    if ext not in VIDEO_ALLOWED_EXTENSIONS:
        base = base + ".mp4"  # default extension for display; actual type validated separately
    return base[:200]  # cap length


class VideoUploadHandler:
    """Handle video upload: validation, storage, metadata."""

    def __init__(
        self,
        storage_path: str = VIDEO_STORAGE_PATH,
        max_size_mb: int = VIDEO_MAX_SIZE_MB,
        metadata_manager: VideoMetadataManager = None,
    ):
        self.storage_path = Path(storage_path)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.metadata_manager = metadata_manager or VideoMetadataManager()

    def validate_and_save(self, filename: str, contents: bytes) -> str:
        """
        Validate file type and size, sanitize filename, save to storage, create DB record.
        Returns video_id.
        Raises ValueError for validation errors.
        """
        ext = Path(filename).suffix.lower()
        if ext not in VIDEO_ALLOWED_EXTENSIONS:
            raise ValueError(f"Invalid file type. Allowed: {VIDEO_ALLOWED_EXTENSIONS}")

        if len(contents) > self.max_size_bytes:
            raise ValueError(
                f"File too large. Max size: {self.max_size_bytes // (1024*1024)} MB"
            )

        safe_name = sanitize_filename(filename)
        # Keep original extension for the saved file
        orig_ext = Path(filename).suffix.lower()
        if orig_ext in VIDEO_ALLOWED_EXTENSIONS:
            if not safe_name.lower().endswith(orig_ext):
                safe_name = Path(safe_name).stem + orig_ext

        video_id = str(uuid.uuid4())
        video_dir = self.storage_path / video_id
        video_dir.mkdir(parents=True, exist_ok=True)
        stored_path = video_dir / safe_name
        # Resolve to avoid path traversal
        stored_path = stored_path.resolve()
        if not str(stored_path).startswith(str(self.storage_path.resolve())):
            raise ValueError("Path traversal detected")
        with open(stored_path, "wb") as f:
            f.write(contents)
        self.metadata_manager.create_video(
            video_id=video_id,
            original_filename=filename,
            stored_path=str(stored_path),
            status="pending",
            file_size_bytes=len(contents),
        )
        logger.info(f"Saved video {video_id} to {stored_path}")
        return video_id

    def get_stored_path(self, video_id: str) -> str:
        path = self.metadata_manager.get_video_stored_path(video_id)
        if not path:
            raise FileNotFoundError(f"Video not found: {video_id}")
        return path

    def delete_video_files_and_record(self, video_id: str) -> None:
        """Remove video directory and DB record. Caller must remove embeddings/frames if needed."""
        v = self.metadata_manager.get_video(video_id)
        if not v:
            return
        stored = Path(v.stored_path)
        if stored.is_file():
            try:
                stored.unlink()
            except OSError as e:
                logger.warning(f"Could not delete video file {stored}: {e}")
        video_dir = stored.parent
        if video_dir.is_dir():
            try:
                shutil.rmtree(video_dir, ignore_errors=True)
            except OSError as e:
                logger.warning(f"Could not delete video dir {video_dir}: {e}")
        self.metadata_manager.delete_video(video_id)
