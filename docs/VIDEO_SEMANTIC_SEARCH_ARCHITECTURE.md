# Video Semantic Search — Architecture Plan (STEP 14 Deliverable)

This document is the **approval-ready design** for adding a Video Semantic Search system to the existing RAG website. No existing document RAG logic is modified. Implementation begins only after this plan is approved.

---

## 1. Full Architecture Plan

### 1.1 High-Level Overview

- **Existing**: Document RAG (PDF → chunks → text embeddings → `document_chunks` → query → LLM). Unchanged.
- **New**: Video pipeline (video upload → frames → frame embeddings → `video_frame_embeddings` → video search → return frames + timestamps). Fully isolated.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXISTING (unchanged)                                 │
│  PDF Upload → DocumentLoader → ChunkingEngine → EmbeddingModel (text)              │
│       → VectorStore(document_chunks) → RetrievalEngine → /query, /query/stream    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NEW VIDEO PIPELINE                                   │
│  Video Upload → Frame Extractor → (optional Caption) → Frame Embedding Engine     │
│       → VideoVectorStore(video_frame_embeddings) → Video Search API               │
│  Search: /videos/search → query embedding → video_frame_embeddings → frames       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Operating Modes (Critical)

| Concern              | Mode A — Local                    | Mode B — Server                         |
|----------------------|-----------------------------------|----------------------------------------|
| **Flag**             | `VIDEO_MODE=local`                | `VIDEO_MODE=server` (default)          |
| **Frame embeddings** | Local model (e.g. CLIP/SentenceTransformers image) loaded from disk | External API (e.g. Hugging Face image embedding / vision API) |
| **Optional caption** | Local vision model or none        | External vision/LLM API or none        |
| **LLM**              | Not used for video search; if captioning: local LLM | Not used for search; if captioning: API |
| **Vector DB**        | Same Supabase; separate table     | Same Supabase; separate table          |
| **Local model load** | Yes (on startup or lazy)           | No                                      |

- **Single config switch**: `VIDEO_MODE` in `config.py` (or env). All video-specific services (frame embedding, optional captioning) resolve implementation via this flag — no duplicated business logic.
- **Document pipeline**: Ignores `VIDEO_MODE`; continues to use existing `EmbeddingModel` (HF text API) and `VectorStore(document_chunks)`.

### 1.3 Backend Module Layout (New Only)

```
backend/
  config.py                    # ADD: video-related env vars and VIDEO_MODE
  main.py                       # ADD: minimal router include + startup wiring for video services only

  services/
    # ---- NEW (video only) ----
    video/
      __init__.py
      frame_extractor.py        # Extract frames from video (ffmpeg/opencv), save images, emit metadata
      video_embedding_engine.py # Abstract interface + Local vs Server implementations for frame embeddings
      video_metadata_manager.py # CRUD for videos + frames metadata (DB or file-based index)
      video_vector_store.py    # Supabase table video_frame_embeddings; search by embedding
      video_search.py          # Query → embed query (text) → search video_vector_store → return frames
      video_upload_handler.py  # Validate, sanitize, store video file; enqueue or trigger processing
      video_processing_job.py  # Async job: extract frames → embed → store (uses frame_extractor + engine + vector_store)

  models/
    api.py                      # ADD: Pydantic models for video upload/search/delete responses only
    video.py                    # NEW: VideoMetadata, FrameMetadata, VideoSearchResult, etc.

  migrations/
    003_create_video_tables.sql # NEW: videos, video_frames, video_frame_embeddings (see schema below)
```

- **Reuse**: Config loading pattern, Supabase client pattern, logging pattern. **Do not** reuse `DocumentLoader`, `ChunkingEngine`, or the document `VectorStore`/`RetrievalEngine` for video.

### 1.4 Frontend Layout (New Only)

```
frontend/app/
  layout.tsx                    # Optional: add shared nav link "Videos" (minimal change: one link)
  page.tsx                      # Optional: add "Videos" to hero/CTA links (minimal)

  ask/page.tsx                  # UNCHANGED
  upload/page.tsx               # UNCHANGED

  videos/
    page.tsx                    # Videos hub: tabs [Upload | Search] (or two separate routes)
    upload/
      page.tsx                  # Video Upload page (drag-drop, progress, processing status)
    search/
      page.tsx                  # Video Search page (query input, Frame Result Grid, Video Player with seek)
  components/
    video/
      VideoUpload.tsx           # Drag-drop, validation, progress, status
      VideoSearchTab.tsx        # Search input + results container
      FrameResultGrid.tsx       # Grid of thumbnails; click → open player at timestamp
      VideoPlayerWithSeek.tsx   # <video> + seekTo(timestamp), source from API
```

- Documents: **Ask** + **Upload** (existing). Videos: **Videos** (Upload + Search). Separate tabs or routes so document UI logic is untouched.

---

## 2. Data Flow Description

### 2.1 Video Upload and Processing

1. **Client** (Video Upload page) sends `POST /videos/upload` with multipart video file(s). Request must include auth (e.g. `Authorization: Bearer <token>`); 401 if missing.
2. **Backend** (`video_upload_handler`):
   - Validates file type (allowlist: `.mp4`, `.mov`, `.mkv`).
   - Validates file size (e.g. `VIDEO_MAX_SIZE_MB`, default 500 MB).
   - Sanitizes filename (remove path segments, dangerous chars).
   - Stores file under configurable root (e.g. `VIDEO_STORAGE_PATH`); path structure e.g. `{root}/{video_id}/{sanitized_filename}`. Generates `video_id` (UUID).
   - Persists minimal metadata (e.g. `videos` table: `video_id`, `original_filename`, `stored_path`, `status: "pending"`, `created_at`).
   - Enqueues or spawns **background job** (see §7) and returns `202 Accepted` with `job_id` and `video_id`.
3. **Background job** (async):
   - **Frame extraction** (frame_extractor): FPS or interval from config (e.g. `VIDEO_FRAME_INTERVAL_SEC=1` → 1 frame/sec). Saves frames under e.g. `{VIDEO_STORAGE_PATH}/{video_id}/frames/{timestamp_sec}.jpg`. Writes rows to `video_frames` (video_id, timestamp_sec, frame_path).
   - **Optional caption**: If enabled and mode supports it, generate caption per frame (local or API); store in `video_frames.caption`.
   - **Embedding**: For each frame, produce embedding via `video_embedding_engine` (local or server). Insert into `video_frame_embeddings` (frame_id, embedding, metadata).
   - On success: set `videos.status = "processed"`. On failure: set `videos.status = "failed"`, log error.
4. **Client** can poll `GET /videos/{video_id}/status` (or SSE) to show processing status; when `processed`, show success.

### 2.2 Video Search

1. **Client** (Video Search tab) sends `POST /videos/search` with body `{ "query": "Show the moment when the rocket launches" }`. Auth required.
2. **Backend** (`video_search`):
   - Embeds **text query** using the same embedding surface used for frames in the chosen mode (for Server: same API that embeds “image + optional text”; for Local: same local model that can embed text for retrieval). So we need a **unified embedding interface** that can embed either image or text (CLIP-style) in both modes.
   - Calls `video_vector_store.search(query_embedding, top_k)`.
   - RPC/query runs on `video_frame_embeddings` only; returns frame_id, similarity, and joined metadata (video_id, timestamp_sec, frame_path, video_path).
   - Builds response: list of `{ thumbnail_url, timestamp_sec, video_id, video_url_or_path, frame_path }`. Thumbnail_url can be a backend route that serves the frame image (e.g. `GET /videos/frames/{frame_id}/thumbnail`) to avoid exposing filesystem paths.
3. **Client** displays results in **Frame Result Grid**. On frame click: open **Video Player**, set `src` to video URL (e.g. `GET /videos/{video_id}/file` or stream), then `video.currentTime = timestamp_sec` (seek to time).

### 2.3 Video Deletion and Cleanup

1. **Client** calls `DELETE /videos/{video_id}` (auth required).
2. **Backend**: Delete from `video_frame_embeddings` (by video_id), then `video_frames`, then `videos`. Delete files: frame images under `{video_id}/frames/`, then video file. Optional: storage usage tracking (e.g. aggregate stored bytes per video in DB or on-demand scan).
3. **Optional frame cleanup**: Config (e.g. `VIDEO_RETENTION_DAYS` or keep all). If implemented later, a scheduled job can remove frames/videos older than retention; not in initial scope.

---

## 3. Database Schema Updates

All new objects; no changes to `document_chunks`, `conversations`, or `turns`.

### 3.1 New Migration: `003_create_video_tables.sql`

```sql
-- Videos: one row per uploaded video
CREATE TABLE IF NOT EXISTS videos (
    id BIGSERIAL PRIMARY KEY,
    video_id TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | processed | failed
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- Frames: one row per extracted frame
CREATE TABLE IF NOT EXISTS video_frames (
    id BIGSERIAL PRIMARY KEY,
    frame_id TEXT UNIQUE NOT NULL,
    video_id TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    timestamp_sec NUMERIC(10,2) NOT NULL,
    frame_path TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_frames_video_id ON video_frames(video_id);

-- Vector embeddings for frames (separate from document_chunks)
-- Embedding dimension depends on mode: e.g. 512 for CLIP or 768 if reusing a 768-d model; make configurable.
CREATE TABLE IF NOT EXISTS video_frame_embeddings (
    id BIGSERIAL PRIMARY KEY,
    frame_id TEXT NOT NULL REFERENCES video_frames(frame_id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    embedding vector(512),  -- or 768; must match video_embedding_engine output dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_frame_embeddings_video_id ON video_frame_embeddings(video_id);
CREATE INDEX IF NOT EXISTS idx_video_frame_embeddings_hnsw ON video_frame_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- RPC for similarity search (same pattern as match_chunks)
CREATE OR REPLACE FUNCTION match_video_frames(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    frame_id text,
    video_id text,
    timestamp_sec numeric,
    frame_path text,
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        vfe.frame_id,
        vfe.video_id,
        vf.timestamp_sec,
        vf.frame_path,
        1 - (vfe.embedding <=> query_embedding) AS similarity
    FROM video_frame_embeddings vfe
    JOIN video_frames vf ON vf.frame_id = vfe.frame_id
    WHERE 1 - (vfe.embedding <=> query_embedding) > match_threshold
    ORDER BY vfe.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

- **Note**: Dimension `512` is a placeholder; final value must match the chosen video embedding model in both modes (e.g. CLIP 512, or 768 if reusing a 768-d model). Config should define `VIDEO_EMBEDDING_DIM`.

---

## 4. New API Endpoints

Base path prefix: `/videos`. All return JSON unless noted. All (except health-style) **require authentication** once auth is implemented; until then, can be protected by a simple API key or left open for dev as per your choice.

| Method | Endpoint | Purpose |
|--------|----------|--------|
| POST   | `/videos/upload` | Upload video(s). Body: multipart `file` (or `files`). Response: `202` with `video_id`, `job_id`, `message`. |
| GET    | `/videos/{video_id}/status` | Get processing status. Response: `{ video_id, status, progress?, error? }`. |
| POST   | `/videos/search` | Body: `{ "query": string, "top_k": number? }`. Response: `{ results: [{ frame_id, video_id, timestamp_sec, frame_path, thumbnail_url, similarity }] }`. |
| GET    | `/videos/frames/{frame_id}/thumbnail` | Serve frame image (or redirect). Used by frontend for grid. |
| GET    | `/videos/{video_id}/file` | Serve video file for player (stream or redirect). |
| DELETE | `/videos/{video_id}` | Delete video, frames, embeddings, and files (cascade). Response: `204` or `200 { deleted: true }`. |
| GET    | `/videos/storage` | Optional. Return storage usage stats (e.g. total bytes, per-video). |

- **Document endpoints** (`/`, `/health`, `/wake`, `/query`, `/query/stream`, `/upload`) remain unchanged; no new routes under existing paths.

---

## 5. Frontend Component Tree

- **Root**: `layout.tsx` (optional: add "Videos" link in nav if a shared nav exists; else each page links as today).
- **Videos area**:
  - `videos/page.tsx`: Layout with two sub-views: **Upload** and **Search** (tabs or sidebar). Renders:
    - `VideoUpload` (when Upload tab active): file input, drag-drop, list of uploads with progress and status; calls `POST /videos/upload`, then polls `GET /videos/{video_id}/status`.
    - `VideoSearchTab` (when Search tab active): search input, submit → `POST /videos/search`, then:
      - `FrameResultGrid`: grid of thumbnails (each from `GET /videos/frames/{frame_id}/thumbnail`). On click: set selected result and open player at `timestamp_sec`.
      - `VideoPlayerWithSeek`: `<video src={videoUrl} />`; `videoUrl` from selected result (e.g. `/videos/{video_id}/file`); expose `seekTo(seconds)` and call it when user clicks a frame (e.g. `currentTime = timestamp_sec`).

```
layout.tsx
  └── (optional) Nav: Home | Ask | Upload | Videos

videos/page.tsx
  ├── Tabs: [ Upload | Search ]
  ├── Upload tab:
  │     └── VideoUpload
  │           ├── Dropzone + file list
  │           └── Per-file: progress, status (pending → processing → processed/error)
  └── Search tab:
        └── VideoSearchTab
              ├── Query input + Search button
              ├── FrameResultGrid
              │     └── For each result: thumbnail, timestamp label; onClick → select + seek
              └── VideoPlayerWithSeek
                    └── <video> + seekTo(seconds)
```

- **Ask** and **Upload** (documents) component trees unchanged.

---

## 6. Mode Switching Logic Design

- **Config** (`config.py`):
  - `VIDEO_MODE = os.getenv("VIDEO_MODE", "server").lower()  # "local" | "server"`.
  - `VIDEO_EMBEDDING_DIM = int(os.getenv("VIDEO_EMBEDDING_DIM", "512"))`.
  - Local-only: `VIDEO_LOCAL_EMBEDDING_MODEL` (e.g. path or HF model id for image+text).
  - Server-only: `VIDEO_EMBEDDING_API_URL` or reuse `HUGGINGFACE_API_KEY` + model id for image embedding.

- **Video embedding engine** (`video_embedding_engine.py`):
  - Abstract base (or protocol): `embed_image(image_path_or_bytes) -> List[float]`, `embed_text(text: str) -> List[float]` (for query). Same dimension for both.
  - **Local implementation**: Load model (e.g. CLIP or sentence-transformers image model) from disk; `embed_image` and `embed_text` use that model. Used when `VIDEO_MODE == "local"`.
  - **Server implementation**: Call external API (e.g. HF inference image embedding, or vision model that returns vector). Used when `VIDEO_MODE == "server"`.
  - Factory: `get_video_embedding_engine(config) -> VideoEmbeddingEngine` returns the correct implementation. No duplication of “search flow”; only the embedding source differs.

- **Startup** (`main.py`): When video routes are mounted, initialize `VideoEmbeddingEngine` (and optionally caption service) from `VIDEO_MODE`. Document services do not depend on `VIDEO_MODE`.

- **Future hybrid**: A single “query embedding” interface (e.g. `embed_for_retrieval(text)`) can later be implemented to produce one vector that is used to search both `document_chunks` and `video_frame_embeddings` (e.g. same 768-d space if we unify dimensions). Not implemented now; only ensure video embedding module has a clear interface so a future `HybridRetriever` can call it.

---

## 7. Background Processing Flow

- **Option A — FastAPI BackgroundTasks**: In `POST /videos/upload`, after persisting video and metadata, call `background_tasks.add_task(video_processing_job.run, video_id)`. Worker runs in the same process; no extra infra. Suitable for moderate load.
- **Option B — Separate worker process**: A small script (e.g. `run_video_worker.py`) polls a “jobs” table (e.g. `video_jobs`: video_id, status, created_at) or a queue (Redis/SQS). Upload endpoint inserts a job; worker picks it up, runs frame extraction + embedding + vector insert, then marks job done. Use if you need to scale or avoid blocking the API process.

**Recommended for minimal change**: **Option A** (BackgroundTasks). Flow:

1. `POST /videos/upload` validates file, saves to disk, inserts `videos` row (status `pending`), returns `202` with `video_id`.
2. `background_tasks.add_task(process_video_pipeline, video_id)`.
3. `process_video_pipeline(video_id)`:
   - Set status `processing`.
   - Run frame extractor → write `video_frames` rows and frame images.
   - For each frame: get embedding from `VideoEmbeddingEngine`, insert `video_frame_embeddings`.
   - Set status `processed` (or `failed` on exception).
4. Client polls `GET /videos/{video_id}/status` until `processed` or `failed`.

No changes to existing request handlers; new logic lives only in video router and `video_processing_job`.

---

## 8. Dependency List

### 8.1 Backend (Python)

- **Existing**: fastapi, uvicorn, python-dotenv, pymupdf, groq, supabase, httpx, tiktoken, transformers, pydantic, python-multipart, huggingface-hub, etc. (unchanged).
- **New** (to add to `requirements.txt`):
  - **Frame extraction**: `opencv-python-headless` or `ffmpeg-python` (and ensure `ffmpeg` binary available in deployment). Prefer one: e.g. `opencv-python-headless` for Python-only frame read, or subprocess `ffmpeg` for robustness.
  - **Image embedding (Local mode)**: `sentence-transformers` (already present) and/or `transformers`, `torch` if using CLIP locally. Or use a lightweight image model that outputs fixed-dim vector.
  - **Image embedding (Server mode)**: `httpx` (already present) for calling Hugging Face (or other) image embedding API.
  - **Optional**: `Pillow` for image loading/resizing before embedding.

### 8.2 Frontend

- No new npm dependencies required: use existing Next.js, `fetch`, and HTML5 `<video>` with `currentTime` for seek. Optional: a lightweight modal or panel library for the player if desired.

### 8.3 Infrastructure

- **Storage**: Configurable directory (`VIDEO_STORAGE_PATH`). No S3 required initially; same pattern as current doc upload temp dir but persistent and under a dedicated root.
- **Auth**: To be added for video endpoints (e.g. API key header or JWT). No new dependency if using simple header check; else add `python-jose` or similar if JWT is required.

---

## 9. Security (Aligned with Existing Patterns)

- **File type**: Allowlist extensions: `.mp4`, `.mov`, `.mkv` (no executable or script).
- **File size**: Enforce `VIDEO_MAX_SIZE_MB` (e.g. 500).
- **Path traversal**: Sanitize filename: no `..`, no absolute paths, no control chars; store under server-controlled `VIDEO_STORAGE_PATH` and join with `os.path.normpath` and check prefix.
- **Filenames**: Normalize to safe characters (e.g. alphanumeric, dash, underscore); keep extension from allowlist.
- **Auth**: All video endpoints require auth (middleware or dependency); document endpoints unchanged. Follow same error response style (e.g. 401 JSON).
- **Serving files**: Frame and video serving routes resolve path from DB by `frame_id`/`video_id` only; never user-supplied path.

---

## 10. Testing Requirements (Summary)

- **Unit tests**:
  - Frame extractor: given a short test video, expect N frames at configured interval; check output paths and metadata.
  - Embedding engine (mock or small model): `embed_image` and `embed_text` return correct dimension; idempotent.
  - Video vector store: insert frames, search by query embedding, get expected frame ordering.
  - Search correctness: known query → known frame in top_k.
- **Integration test**: Upload video → wait for processed (or mock job) → search with query → get at least one result; parse response and assert thumbnail_url and timestamp_sec present. Optional: call frame thumbnail URL and video URL and assert 200.

---

## 11. Future-Proofing (Hybrid Search)

- **Interface**: Define a retrieval interface that returns “items” (document chunks or video frames) with a common score and a type tag. Document retrieval and video retrieval each implement this interface. A future `HybridRetriever` can:
  - Embed query once (or twice if dimensions differ: one for text, one for video) and call both retrievers, then merge and re-rank. Not implemented now.
- **Schema**: Keeping `video_frame_embeddings` separate from `document_chunks` allows different dimensions and models; a later view or adapter can unify if needed.

---

## 12. Deliverable Checklist

| Item | Status |
|------|--------|
| 1. Full architecture plan | §1 |
| 2. Data flow description | §2 |
| 3. Database schema updates | §3 |
| 4. New API endpoints | §4 |
| 5. Frontend component tree | §5 |
| 6. Mode switching logic design | §6 |
| 7. Background processing flow | §7 |
| 8. Dependency list | §8 |

Security, testing, and future-proofing are summarized in §9–11.

---

**Next step**: Upon your approval of this document, implementation will proceed in this order: config and migrations → backend video modules and endpoints → background job → frontend components and pages → tests. Existing document RAG and upload will not be modified.
