"""CRUD for images table in Supabase. Isolated from video tables."""
import logging
from datetime import datetime, timezone
from typing import Optional

from supabase import Client, create_client

from config import SUPABASE_URL, SUPABASE_KEY
from models.image import ImageMetadata

logger = logging.getLogger(__name__)


class ImageMetadataManager:
    """Manage images table."""

    def __init__(
        self,
        supabase_url: str = SUPABASE_URL,
        supabase_key: str = SUPABASE_KEY,
    ):
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        self.client: Client = create_client(supabase_url, supabase_key)

    def create_image(
        self,
        image_id: str,
        original_filename: str,
        stored_path: str,
        status: str = "pending",
        file_size_bytes: Optional[int] = None,
    ) -> None:
        self.client.table("images").insert({
            "image_id": image_id,
            "original_filename": original_filename,
            "stored_path": stored_path,
            "status": status,
            "file_size_bytes": file_size_bytes,
        }).execute()
        logger.info("Created image record: %s", image_id)

    def update_image_status(
        self,
        image_id: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> None:
        payload = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if error_message is not None:
            payload["error_message"] = error_message
        self.client.table("images").update(payload).eq("image_id", image_id).execute()
        logger.debug("Updated image %s status to %s", image_id, status)

    def get_image(self, image_id: str) -> Optional[ImageMetadata]:
        r = self.client.table("images").select("*").eq("image_id", image_id).execute()
        if not r.data:
            return None
        row = r.data[0]
        return ImageMetadata(
            image_id=row["image_id"],
            original_filename=row["original_filename"],
            stored_path=row["stored_path"],
            status=row["status"],
            file_size_bytes=row.get("file_size_bytes"),
            error_message=row.get("error_message"),
        )

    def get_image_stored_path(self, image_id: str) -> Optional[str]:
        img = self.get_image(image_id)
        return img.stored_path if img else None

    def list_all_images(self) -> list:
        """Return all image records ordered by newest first."""
        r = self.client.table("images").select("*").order("created_at", desc=True).execute()
        return [
            ImageMetadata(
                image_id=row["image_id"],
                original_filename=row["original_filename"],
                stored_path=row["stored_path"],
                status=row["status"],
                file_size_bytes=row.get("file_size_bytes"),
                error_message=row.get("error_message"),
            )
            for row in (r.data or [])
        ]

    def delete_image(self, image_id: str) -> None:
        self.client.table("images").delete().eq("image_id", image_id).execute()
        logger.info("Deleted image record: %s", image_id)
