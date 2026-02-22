"""Image semantic search API. Isolated from video endpoints."""
import logging
import os
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, Header
from fastapi.responses import FileResponse

from config import IMAGE_API_KEY
from models.api import (
    ImageListItem,
    ImageSearchRequest,
    ImageSearchResponse,
    ImageSearchResultItem,
    ImagesListResponse,
    ImageStatusResponse,
    ImageUploadResponse,
)
from services.image.image_metadata_manager import ImageMetadataManager
from services.image.image_processing_job import process_image_pipeline
from services.image.image_search import ImageSearchService
from services.image.image_upload_handler import ImageUploadHandler
from services.image.image_vector_store import ImageVectorStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["images"])

_upload_handler: Optional[ImageUploadHandler] = None
_metadata_manager: Optional[ImageMetadataManager] = None
_vector_store: Optional[ImageVectorStore] = None
_search_service: Optional[ImageSearchService] = None
_base_url: Optional[str] = None
_process_image_callable = None  # (image_id: str) -> None


def set_image_services(
    upload_handler: ImageUploadHandler,
    metadata_manager: ImageMetadataManager,
    vector_store: ImageVectorStore,
    search_service: ImageSearchService,
    base_url: str = "",
    process_image_callable=None,
):
    global _upload_handler, _metadata_manager, _vector_store, _search_service, _base_url, _process_image_callable
    _upload_handler = upload_handler
    _metadata_manager = metadata_manager
    _vector_store = vector_store
    _search_service = search_service
    _base_url = base_url.rstrip("/")
    _process_image_callable = process_image_callable


def _require_auth(api_key: Optional[str] = None) -> None:
    if not IMAGE_API_KEY:
        return
    if api_key != IMAGE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _get_upload_handler() -> ImageUploadHandler:
    if _upload_handler is None:
        raise HTTPException(status_code=503, detail="Image upload service not configured")
    return _upload_handler


def _get_metadata_manager() -> ImageMetadataManager:
    if _metadata_manager is None:
        raise HTTPException(status_code=503, detail="Image metadata service not configured")
    return _metadata_manager


def _get_search_service() -> ImageSearchService:
    if _search_service is None:
        raise HTTPException(status_code=503, detail="Image search service not configured")
    return _search_service


@router.get("/", response_model=ImagesListResponse)
async def list_images(
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    """List all uploaded images."""
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    images = meta.list_all_images()
    items = [
        ImageListItem(
            image_id=img.image_id,
            original_filename=img.original_filename,
            status=img.status,
            file_size_bytes=img.file_size_bytes,
        )
        for img in images
    ]
    return ImagesListResponse(images=items, total_images=len(items))


@router.post("/upload", response_model=ImageUploadResponse)
async def image_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    """Upload an image. Returns 202 with image_id; processing runs in background."""
    _require_auth(api_key or x_api_key)
    handler = _get_upload_handler()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    contents = await file.read()
    try:
        image_id = handler.validate_and_save(file.filename, contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if _process_image_callable:
        background_tasks.add_task(_process_image_callable, image_id)
    else:
        raise HTTPException(status_code=503, detail="Image processing not configured")
    return ImageUploadResponse(
        image_id=image_id,
        job_id=image_id,
        message="Image uploaded; processing started.",
        original_filename=file.filename,
    )


@router.get("/{image_id}/status", response_model=ImageStatusResponse)
async def image_status(
    image_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    img = meta.get_image(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    return ImageStatusResponse(
        image_id=image_id,
        status=img.status,
        error=getattr(img, "error_message", None),
    )


@router.post("/search", response_model=ImageSearchResponse)
async def image_search(
    body: ImageSearchRequest,
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
    for image_id, image_path, sim in rows:
        image_url = f"{base}/images/{image_id}/file" if base else f"/images/{image_id}/file"
        thumb_url = image_url
        results.append(
            ImageSearchResultItem(
                image_id=image_id,
                image_path=image_path,
                thumbnail_url=thumb_url,
                image_url=image_url,
                similarity=round(sim, 4),
            )
        )
    return ImageSearchResponse(results=results)


@router.get("/{image_id}/file")
async def image_file(
    image_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    handler = _get_upload_handler()
    try:
        path = handler.get_stored_path(image_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image not found")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(path, filename=os.path.basename(path))


@router.delete("/{image_id}")
async def image_delete(
    image_id: str,
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = None,
):
    _require_auth(api_key or x_api_key)
    meta = _get_metadata_manager()
    img = meta.get_image(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    store = ImageVectorStore()
    store.delete_by_image_id(image_id)
    handler = _get_upload_handler()
    handler.delete_image_files_and_record(image_id)
    return {"deleted": True, "image_id": image_id}
