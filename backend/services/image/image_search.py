"""Image semantic search: embed query and search image_embeddings."""
import logging
from typing import List, Tuple

from services.video.video_embedding_engine import VideoEmbeddingEngine
from services.image.image_vector_store import ImageVectorStore

logger = logging.getLogger(__name__)


class ImageSearchService:
    """Search images by natural language query."""

    def __init__(
        self,
        embedding_engine: VideoEmbeddingEngine,
        vector_store: ImageVectorStore,
    ):
        self.embedding_engine = embedding_engine
        self.vector_store = vector_store

    def search(
        self,
        query: str,
        top_k: int = 10,
        match_threshold: float = 0.0,
    ) -> List[Tuple[str, str, float]]:
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")
        embedding = self.embedding_engine.embed_text(query.strip())
        return self.vector_store.search(
            query_embedding=embedding,
            top_k=top_k,
            match_threshold=match_threshold,
        )
