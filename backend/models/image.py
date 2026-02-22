"""Image semantic search domain models (internal use)."""
from typing import Optional
from pydantic import BaseModel


class ImageMetadata(BaseModel):
    """Metadata for an uploaded image."""
    image_id: str
    original_filename: str
    stored_path: str
    status: str = "pending"  # pending | processing | processed | failed
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None

