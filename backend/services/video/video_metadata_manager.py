"""CRUD for videos and video_frames in Supabase. Isolated from document tables."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from supabase import Client, create_client

from config import SUPABASE_URL, SUPABASE_KEY
from models.video import FrameMetadata, VideoMetadata

logger = logging.getLogger(__name__)


class VideoMetadataManager:
    """Manage videos and video_frames tables."""

    def __init__(
        self,
        supabase_url: str = SUPABASE_URL,
        supabase_key: str = SUPABASE_KEY,
    ):
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        self.client: Client = create_client(supabase_url, supabase_key)

    def create_video(
        self,
        video_id: str,
        original_filename: str,
        stored_path: str,
        status: str = "pending",
        file_size_bytes: Optional[int] = None,
    ) -> None:
        self.client.table("videos").insert({
            "video_id": video_id,
            "original_filename": original_filename,
            "stored_path": stored_path,
            "status": status,
            "file_size_bytes": file_size_bytes,
        }).execute()
        logger.info(f"Created video record: {video_id}")

    def update_video_status(
        self, video_id: str, status: str, error_message: Optional[str] = None
    ) -> None:
        payload = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if error_message is not None:
            payload["error_message"] = error_message
        try:
            self.client.table("videos").update(payload).eq("video_id", video_id).execute()
        except Exception as e:
            if error_message is not None:
                payload.pop("error_message", None)
                self.client.table("videos").update(payload).eq("video_id", video_id).execute()
                logger.warning("videos.error_message column may be missing; run migration 004. Error: %s", e)
            else:
                raise
        logger.debug(f"Updated video {video_id} status to {status}")

    def get_video(self, video_id: str) -> Optional[VideoMetadata]:
        r = self.client.table("videos").select("*").eq("video_id", video_id).execute()
        if not r.data or len(r.data) == 0:
            return None
        row = r.data[0]
        return VideoMetadata(
            video_id=row["video_id"],
            original_filename=row["original_filename"],
            stored_path=row["stored_path"],
            status=row["status"],
            file_size_bytes=row.get("file_size_bytes"),
            error_message=row.get("error_message"),
        )

    def insert_frames(self, frames: List[FrameMetadata]) -> None:
        if not frames:
            return
        records = [
            {
                "frame_id": f.frame_id,
                "video_id": f.video_id,
                "timestamp_sec": f.timestamp_sec,
                "frame_path": f.frame_path,
                "caption": f.caption,
            }
            for f in frames
        ]
        self.client.table("video_frames").insert(records).execute()
        logger.info(f"Inserted {len(records)} frame records for video {frames[0].video_id}")

    def get_frame(self, frame_id: str) -> Optional[FrameMetadata]:
        r = self.client.table("video_frames").select("*").eq("frame_id", frame_id).execute()
        if not r.data or len(r.data) == 0:
            return None
        row = r.data[0]
        return FrameMetadata(
            frame_id=row["frame_id"],
            video_id=row["video_id"],
            timestamp_sec=float(row["timestamp_sec"]),
            frame_path=row["frame_path"],
            caption=row.get("caption"),
        )

    def get_video_stored_path(self, video_id: str) -> Optional[str]:
        v = self.get_video(video_id)
        return v.stored_path if v else None

    def list_all_videos(self) -> list:
        """Return all video records ordered by newest first."""
        r = self.client.table("videos").select("*").order("created_at", desc=True).execute()
        return [
            VideoMetadata(
                video_id=row["video_id"],
                original_filename=row["original_filename"],
                stored_path=row["stored_path"],
                status=row["status"],
                file_size_bytes=row.get("file_size_bytes"),
                error_message=row.get("error_message"),
            )
            for row in (r.data or [])
        ]

    def get_frame_count(self, video_id: str) -> int:
        """Return number of frames for a video."""
        r = self.client.table("video_frames").select("frame_id", count="exact").eq("video_id", video_id).execute()
        return r.count or 0

    def get_first_frame_id(self, video_id: str) -> Optional[str]:
        """Return the frame_id of the earliest frame for a video (for thumbnail)."""
        r = (
            self.client.table("video_frames")
            .select("frame_id")
            .eq("video_id", video_id)
            .order("timestamp_sec", desc=False)
            .limit(1)
            .execute()
        )
        if r.data:
            return r.data[0]["frame_id"]
        return None

    def delete_video(self, video_id: str) -> None:
        """Delete video row; DB cascade deletes video_frames and video_frame_embeddings."""
        self.client.table("videos").delete().eq("video_id", video_id).execute()
        logger.info(f"Deleted video record: {video_id}")
