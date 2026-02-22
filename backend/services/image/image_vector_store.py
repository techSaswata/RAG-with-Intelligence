"""Vector store for image embeddings. Separate table from video embeddings."""
import logging
from typing import List, Tuple

from supabase import Client, create_client

from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)


class ImageVectorStore:
    """Store and search image embeddings in image_embeddings table."""

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
        image_ids: List[str],
        embeddings: List[List[float]],
    ) -> None:
        if not (image_ids and embeddings):
            raise ValueError("image_ids and embeddings must be non-empty")
        if len(image_ids) != len(embeddings):
            raise ValueError("image_ids and embeddings must have same length")
        records = [
            {"image_id": img_id, "embedding": emb}
            for img_id, emb in zip(image_ids, embeddings)
        ]
        self.client.table("image_embeddings").insert(records).execute()
        logger.info("Inserted %d image embeddings", len(records))

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        match_threshold: float = 0.0,
    ) -> List[Tuple[str, str, float]]:
        """
        Return list of (image_id, stored_path, similarity).
        """
        r = self.client.rpc(
            "match_images",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": top_k,
            },
        ).execute()
        out = []
        for row in (r.data or []):
            out.append((
                row["image_id"],
                row["stored_path"],
                float(row["similarity"]),
            ))
        return out

    def delete_by_image_id(self, image_id: str) -> None:
        self.client.table("image_embeddings").delete().eq("image_id", image_id).execute()
        logger.info("Deleted embeddings for image %s", image_id)
