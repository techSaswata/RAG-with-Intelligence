"""Video semantic search domain models (internal use)."""
from typing import Optional
from pydantic import BaseModel, Field


class VideoMetadata(BaseModel):
    """Metadata for an uploaded video."""
    video_id: str
    original_filename: str
    stored_path: str
    status: str = "pending"  # pending | processing | processed | failed
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None


class FrameMetadata(BaseModel):
    """Metadata for an extracted frame."""
    frame_id: str
    video_id: str
    timestamp_sec: float
    frame_path: str
    caption: Optional[str] = None


class VideoSearchResult(BaseModel):
    """Single frame result from video search."""
    frame_id: str
    video_id: str
    timestamp_sec: float
    frame_path: str
    similarity: float
    thumbnail_url: Optional[str] = None  # Set by API layer (e.g. /videos/frames/{id}/thumbnail)
