"""Background job: extract frames, embed, store. Run async (e.g. FastAPI BackgroundTasks)."""
import logging
import os
from pathlib import Path

from services.video.frame_extractor import FrameExtractor
from services.video.video_embedding_engine import VideoEmbeddingEngine
from services.video.video_metadata_manager import VideoMetadataManager
from services.video.video_vector_store import VideoVectorStore

logger = logging.getLogger(__name__)


def process_video_pipeline(
    video_id: str,
    *,
    frame_interval_sec: float = 1.0,
    metadata_manager: VideoMetadataManager = None,
    embedding_engine: VideoEmbeddingEngine = None,
    vector_store: VideoVectorStore = None,
    get_stored_path_fn=None,
) -> None:
    """
    Run full pipeline for one video: extract frames, embed, insert into vector store.
    Uses injected services; call from app with app-scoped instances.
    """
    if not metadata_manager or not embedding_engine or not vector_store or not get_stored_path_fn:
        raise ValueError("process_video_pipeline requires metadata_manager, embedding_engine, vector_store, get_stored_path_fn")

    try:
        metadata_manager.update_video_status(video_id, "processing")
        video_path = get_stored_path_fn(video_id)
        video_dir = Path(video_path).parent
        frames_dir = video_dir / "frames"
        os.makedirs(frames_dir, exist_ok=True)

        extractor = FrameExtractor(frame_interval_sec=frame_interval_sec)
        frames = extractor.extract_frames(
            video_path=video_path,
            output_dir=str(frames_dir),
            video_id=video_id,
        )
        if not frames:
            metadata_manager.update_video_status(video_id, "processed")
            logger.warning(f"No frames extracted from video {video_id}")
            return

        metadata_manager.insert_frames(frames)

        frame_ids = [f.frame_id for f in frames]
        video_ids = [f.video_id for f in frames]
        embeddings = []
        for f in frames:
            emb = embedding_engine.embed_image(f.frame_path)
            embeddings.append(emb)
        vector_store.add_embeddings(frame_ids=frame_ids, video_ids=video_ids, embeddings=embeddings)
        metadata_manager.update_video_status(video_id, "processed")
        logger.info(f"Processed video {video_id}: {len(frames)} frames embedded")
    except Exception as e:
        logger.exception(f"Video processing failed for {video_id}: {e}")
        try:
            metadata_manager.update_video_status(
                video_id, "failed", error_message=str(e)[:500]
            )
        except Exception:
            pass
        raise
