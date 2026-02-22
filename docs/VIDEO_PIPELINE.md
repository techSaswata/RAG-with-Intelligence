# Video semantic search – pipeline

End-to-end flow from upload to “processed” and where it can fail.

---

## 1. Upload (HTTP)

- **Endpoint:** `POST /videos/upload`
- **Steps:**
  1. Validate file type (`.mp4`, `.mov`, `.mkv`) and size (≤ `VIDEO_MAX_SIZE_MB`).
  2. Sanitize filename and save file under `VIDEO_STORAGE_PATH/{video_id}/{filename}`.
  3. Insert one row in **`videos`** with `status = 'pending'`.
  4. Enqueue a **background task** with `video_id` and return `video_id` to the client.

- **Failure here:** 400 (bad type/size/filename) or 503 (video services not configured). No row in DB on 400.

---

## 2. Background task (same process)

The task runs in the FastAPI worker after the response is sent. It calls:

`process_video_pipeline(video_id, metadata_manager, embedding_engine, vector_store, get_stored_path_fn)`

---

## 3. Step A – Status → processing

- **Code:** `metadata_manager.update_video_status(video_id, "processing")`
- **DB:** `videos.status` set to `'processing'`.
- **Failure:** Supabase/network error (rare).

---

## 4. Step B – Frame extraction

- **Code:** `FrameExtractor(frame_interval_sec).extract_frames(video_path, frames_dir, video_id)`
- **Behavior:**
  - Opens the video with **OpenCV** (`cv2.VideoCapture`).
  - Reads frames at an interval (e.g. 1 frame per second from `VIDEO_FRAME_INTERVAL_SEC`).
  - Writes each selected frame as a **JPEG** under `{video_dir}/frames/{frame_id}.jpg`.
  - Returns a list of **FrameMetadata** (frame_id, video_id, timestamp_sec, frame_path).

- **Failures:**
  - File not found / path wrong.
  - OpenCV can’t open the file (codec, corrupt file, or missing `opencv-python-headless`).
  - No frames (e.g. 0-length or unreadable stream) → pipeline marks video as `processed` with 0 frames and exits.

---

## 5. Step C – Insert frame metadata

- **Code:** `metadata_manager.insert_frames(frames)`
- **DB:** Inserts rows into **`video_frames`** (frame_id, video_id, timestamp_sec, frame_path, caption).
- **Failures:**
  - Supabase error.
  - **Migration 003 not applied** → table or columns missing.
  - Constraint violation (e.g. duplicate frame_id, FK).

---

## 6. Step D – Embed each frame

- **Code:** For each frame, `embedding_engine.embed_image(frame_path)` → list of floats (e.g. 512-d).
- **Local mode:** `sentence-transformers` CLIP model loads the image (needs **Pillow**) and runs the vision encoder on CPU.
- **Server mode:** Sends image to Hugging Face Inference API (can return 410 Gone for deprecated models).

- **Failures:**
  - **Pillow missing** → “PIL library not found”.
  - **Wrong embedding length** vs DB `vector(512)` → fails later in Step E.
  - **CLIP / model error** (OOM, corrupt image, API down).
  - **File not found** for a frame path (e.g. path wrong on another machine).

---

## 7. Step E – Insert embeddings

- **Code:** `vector_store.add_embeddings(frame_ids, video_ids, embeddings)`
- **DB:** Inserts rows into **`video_frame_embeddings`** (frame_id, video_id, embedding).

- **Failures:**
  - **Embedding dimension mismatch:** table expects `vector(512)`; if the model returns a different size, Supabase/Postgres will error.
  - **Migration 003 not applied** → table or RPC missing.
  - **FK violation** if `video_frames` or `videos` row is missing.
  - Supabase/network error.

---

## 8. Step F – Status → processed

- **Code:** `metadata_manager.update_video_status(video_id, "processed")`
- **DB:** `videos.status` set to `'processed'`.
- If any step B–E raises, the pipeline catches the exception, sets `videos.status` to **`'failed'`** (and optionally an error message), then re-raises (so the task is marked failed and you see a traceback in the backend log).

---

## 9. Frontend

- **Upload:** `POST /videos/upload` → gets `video_id`.
- **Polling:** `GET /videos/{video_id}/status` → returns `{ status, error? }`.
- When `status === 'processed'` → show success; when `status === 'failed'` → show “Processing failed” and, if we return it, `error` (reason).

---

## Summary diagram

```
POST /videos/upload
  → validate & save file
  → insert videos (pending)
  → BackgroundTasks.add_task(run_video_job, video_id)
  → return 200 + video_id

run_video_job(video_id):
  → process_video_pipeline(...)
      1. update status = 'processing'
      2. extract frames (OpenCV) → write JPGs
      3. insert video_frames
      4. for each frame: embed_image() → 512-d vector
      5. insert video_frame_embeddings
      6. update status = 'processed'
     on exception:
       → update status = 'failed' (+ error message if we store it)
       → re-raise (traceback in terminal)
```

---

## What to check when it “still fails”

1. **Backend terminal** – Full traceback shows which step failed (extract, insert_frames, embed_image, add_embeddings).
2. **Migration 003** – Run `003_create_video_tables.sql` in Supabase so `videos`, `video_frames`, `video_frame_embeddings` and `match_video_frames` exist.
3. **Embedding dimension** – Local CLIP ViT-B-32 must output 512-d; DB is `vector(512)`. If the model returns another size, Step E will fail.
4. **Pillow** – Required for local image loading; install with `pip install pillow`.
5. **Storage path** – `VIDEO_STORAGE_PATH` must be writable; frame paths are stored in DB, so serving thumbnails later must reach that path (same machine or shared storage).

**Error message:** If processing fails, the backend now stores the exception message in `videos.error_message` (migration 004) and returns it in `GET /videos/{video_id}/status` as `error`. The UI shows it under the failed file. If migration 004 is not applied, status still becomes `failed` but the UI will show a generic "Processing failed".
