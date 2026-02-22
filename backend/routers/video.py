"""Video semantic search API. Isolated from document RAG endpoints."""
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, Header, Form
from fastapi.responses import FileResponse

from config import (
    IMAGE_ALLOWED_EXTENSIONS,
    IMAGE_MAX_SIZE_MB,
    VIDEO_API_KEY,
    VIDEO_IMAGE_MATCH_THRESHOLD,
    VIDEO_IMAGE_TOP_K,
    VIDEO_IMAGE_PROMPT_WEIGHT,
)
from models.api import (
    VideoListItem,
    VideoSearchRequest,
    VideoSearchResponse,
    VideoSearchResultItem,
    VideosListResponse,
    VideoStatusResponse,
    VideoUploadResponse,
)
from services.video.video_metadata_manager import VideoMetadataManager
from services.video.video_processing_job import process_video_pipeline
from services.video.video_search import VideoSearchService
from services.video.video_upload_handler import VideoUploadHandler
from services.video.video_vector_store import VideoVectorStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/videos", tags=["videos"])

# Injected by main.py on startup
_upload_handler: Optional[VideoUploadHandler] = None
_metadata_manager: Optional[VideoMetadataManager] = None
_vector_store: Optional[VideoVectorStore] = None
_search_service: Optional[VideoSearchService] = None
_base_url: Optional[str] = None
_process_video_callable = None  # (video_id: str) -> None


def set_video_services(
    upload_handler: VideoUploadHandler,
    metadata_manager: VideoMetadataManager,
    vector_store: VideoVectorStore,
    search_service: VideoSearchService,
    base_url: str = "",
    process_video_callable=None,
):
    global _upload_handler, _metadata_manager, _vector_store, _search_service, _base_url, _process_video_callable
    _upload_handler = upload_handler
    _metadata_manager = metadata_manager
    _vector_store = vector_store
    _search_service = search_service
    _base_url = base_url.rstrip("/")
    _process_video_callable = process_video_callable


def _require_auth(api_key: Optional[str] = None) -> None:
    if not VIDEO_API_KEY:
        return
    if api_key != VIDEO_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _get_upload_handler() -> VideoUploadHandler:
    if _upload_handler is None:
        raise HTTPException(status_code=503, detail="Video upload service not configured")
    return _upload_handler


def _get_metadata_manager() -> VideoMetadataManager:
    if _metadata_manager is None:
        raise HTTPException(status_code=503, detail="Video metadata service not configured")
    return _metadata_manager


def _get_search_service() -> VideoSearchService:
    if _search_service is None:
        raise HTTPException(status_code=503, detail="Video search service not configured")
    return _search_service


@router.get("/", response_model=VideosListResponse)
async def list_videos(
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    """List all uploaded videos."""
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    base = _base_url or ""
    videos = meta.list_all_videos()
    items = []
    for v in videos:
        frame_count = meta.get_frame_count(v.video_id)
        first_frame_id = meta.get_first_frame_id(v.video_id)
        thumb = ""
        if first_frame_id:
            thumb = f"{base}/videos/frames/{first_frame_id}/thumbnail" if base else f"/videos/frames/{first_frame_id}/thumbnail"
        video_url = f"{base}/videos/{v.video_id}/file" if base else f"/videos/{v.video_id}/file"
        items.append(
            VideoListItem(
                video_id=v.video_id,
                original_filename=v.original_filename,
                status=v.status,
                file_size_bytes=v.file_size_bytes,
                frame_count=frame_count,
                thumbnail_url=thumb,
                video_url=video_url,
            )
        )
    return VideosListResponse(videos=items, total_videos=len(items))


@router.post("/upload", response_model=VideoUploadResponse)
async def video_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    """Upload a video. Returns 202 with video_id; processing runs in background."""
    _require_auth(api_key or x_api_key)
    handler = _get_upload_handler()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    contents = await file.read()
    try:
        video_id = handler.validate_and_save(file.filename, contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if _process_video_callable:
        background_tasks.add_task(_process_video_callable, video_id)
    else:
        raise HTTPException(status_code=503, detail="Video processing not configured")
    return VideoUploadResponse(
        video_id=video_id,
        job_id=video_id,
        message="Video uploaded; processing started.",
        original_filename=file.filename,
    )


@router.get("/{video_id}/status", response_model=VideoStatusResponse)
async def video_status(
    video_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    v = meta.get_video(video_id)
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoStatusResponse(
        video_id=video_id,
        status=v.status,
        progress=None,
        error=getattr(v, "error_message", None),
    )


@router.post("/search", response_model=VideoSearchResponse)
async def video_search(
    body: VideoSearchRequest,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    svc = _get_search_service()
    try:
        rows = svc.search(query=body.query, top_k=body.top_k)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    base = _base_url or ""
    results = []
    for frame_id, vid, ts, frame_path, sim in rows:
        thumb_url = f"{base}/videos/frames/{frame_id}/thumbnail" if base else f"/videos/frames/{frame_id}/thumbnail"
        video_url = f"{base}/videos/{vid}/file" if base else f"/videos/{vid}/file"
        results.append(
            VideoSearchResultItem(
                frame_id=frame_id,
                video_id=vid,
                timestamp_sec=ts,
                frame_path=frame_path,
                thumbnail_url=thumb_url,
                video_url=video_url,
                similarity=round(sim, 4),
            )
        )
    return VideoSearchResponse(results=results)


@router.post("/search-by-image", response_model=VideoSearchResponse)
async def video_search_by_image(
    file: UploadFile = File(...),
    prompt: Optional[str] = Form(default=None),
    top_k: int = VIDEO_IMAGE_TOP_K,
    match_threshold: float = VIDEO_IMAGE_MATCH_THRESHOLD,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    svc = _get_search_service()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in IMAGE_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {IMAGE_ALLOWED_EXTENSIONS}")
    contents = await file.read()
    if len(contents) > IMAGE_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max size: {IMAGE_MAX_SIZE_MB} MB")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        rows = svc.search_by_image_with_prompt(
            image_path=tmp_path,
            prompt=prompt,
            prompt_weight=VIDEO_IMAGE_PROMPT_WEIGHT,
            top_k=top_k,
            match_threshold=match_threshold,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if tmp_path and os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    base = _base_url or ""
    results = []
    for frame_id, vid, ts, frame_path, sim in rows:
        thumb_url = f"{base}/videos/frames/{frame_id}/thumbnail" if base else f"/videos/frames/{frame_id}/thumbnail"
        video_url = f"{base}/videos/{vid}/file" if base else f"/videos/{vid}/file"
        results.append(
            VideoSearchResultItem(
                frame_id=frame_id,
                video_id=vid,
                timestamp_sec=ts,
                frame_path=frame_path,
                thumbnail_url=thumb_url,
                video_url=video_url,
                similarity=round(sim, 4),
            )
        )
    return VideoSearchResponse(results=results)


@router.get("/frames/{frame_id}/thumbnail")
async def frame_thumbnail(
    frame_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    frame = meta.get_frame(frame_id)
    if not frame or not os.path.isfile(frame.frame_path):
        raise HTTPException(status_code=404, detail="Frame not found")
    return FileResponse(
        frame.frame_path,
        media_type="image/jpeg",
    )


@router.get("/{video_id}/file")
async def video_file(
    video_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    handler = _get_upload_handler()
    try:
        path = handler.get_stored_path(video_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Video not found")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Video file not found")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=os.path.basename(path),
    )


@router.delete("/{video_id}")
async def video_delete(
    video_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    v = meta.get_video(video_id)
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    store = VideoVectorStore()
    store.delete_by_video_id(video_id)
    handler = _get_upload_handler()
    handler.delete_video_files_and_record(video_id)
    return {"deleted": True, "video_id": video_id}
