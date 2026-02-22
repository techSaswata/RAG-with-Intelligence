"""Vector store for video frame embeddings. Separate table from document_chunks."""
import logging
from typing import List, Tuple

from supabase import Client, create_client

from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)


class VideoVectorStore:
    """Store and search video frame embeddings in video_frame_embeddings table."""

    def __init__(
        self,
        supabase_url: str = SUPABASE_URL,
        supabase_key: str = SUPABASE_KEY,
    ):
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
        self.client: Client = create_client(supabase_url, supabase_key)

    def add_embeddings(
        self,
        frame_ids: List[str],
        video_ids: List[str],
        embeddings: List[List[float]],
    ) -> None:
        if not (frame_ids and video_ids and embeddings):
            raise ValueError("frame_ids, video_ids, and embeddings must be non-empty")
        if len(frame_ids) != len(video_ids) or len(frame_ids) != len(embeddings):
            raise ValueError("frame_ids, video_ids, and embeddings must have same length")
        records = [
            {"frame_id": fid, "video_id": vid, "embedding": emb}
            for fid, vid, emb in zip(frame_ids, video_ids, embeddings)
        ]
        self.client.table("video_frame_embeddings").insert(records).execute()
        logger.info(f"Inserted {len(records)} video frame embeddings")

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        match_threshold: float = 0.0,
    ) -> List[Tuple[str, str, float, str, float]]:
        """
        Return list of (frame_id, video_id, timestamp_sec, frame_path, similarity).
        """
        r = self.client.rpc(
            "match_video_frames",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": top_k,
            },
        ).execute()
        out = []
        for row in (r.data or []):
            out.append((
                row["frame_id"],
                row["video_id"],
                float(row["timestamp_sec"]),
                row["frame_path"],
                float(row["similarity"]),
            ))
        return out

    def delete_by_video_id(self, video_id: str) -> None:
        """Remove all embeddings for a video (e.g. before or after cascade)."""
        self.client.table("video_frame_embeddings").delete().eq("video_id", video_id).execute()
        logger.info(f"Deleted embeddings for video {video_id}")
