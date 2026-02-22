"""Background job: embed image and store vector."""
import logging

from services.video.video_embedding_engine import VideoEmbeddingEngine
from services.image.image_metadata_manager import ImageMetadataManager
from services.image.image_vector_store import ImageVectorStore

logger = logging.getLogger(__name__)


def process_image_pipeline(
    image_id: str,
    *,
    metadata_manager: ImageMetadataManager = None,
    embedding_engine: VideoEmbeddingEngine = None,
    vector_store: ImageVectorStore = None,
    get_stored_path_fn=None,
) -> None:
    if not metadata_manager or not embedding_engine or not vector_store or not get_stored_path_fn:
        raise ValueError(
            "process_image_pipeline requires metadata_manager, embedding_engine, vector_store, get_stored_path_fn"
        )

    try:
        metadata_manager.update_image_status(image_id, "processing")
        image_path = get_stored_path_fn(image_id)
        emb = embedding_engine.embed_image(image_path)
        vector_store.add_embeddings(image_ids=[image_id], embeddings=[emb])
        metadata_manager.update_image_status(image_id, "processed")
        logger.info("Processed image %s", image_id)
    except Exception as e:
        logger.exception("Image processing failed for %s: %s", image_id, e)
        try:
            metadata_manager.update_image_status(
                image_id, "failed", error_message=str(e)[:500]
            )
        except Exception:
            pass
        return
