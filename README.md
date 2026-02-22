# Vault — Intelligent RAG Pipeline

Multi-modal retrieval-augmented generation system. Three parallel search pipelines — **documents** (PDF), **videos** (frame-level), **images** — backed by Supabase pgvector, Groq LLMs, and CLIP embeddings.

---

## Architecture

```
                          ┌──────────────────────────┐
                          │     Next.js Frontend     │
                          │  localhost:3000 (Vercel) │
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │    FastAPI Gateway       │
                          │  localhost:8000 (Docker) │
                          └────────────┬─────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼──────────┐  ┌──────────▼──────────┐  ┌──────────▼─────────┐
    │   Document RAG     │  │  Video Search       │  │  Image Search      │
    │   768-d mpnet-v2   │  │  512-d CLIP ViT-B32 │  │  512-d CLIP ViT-B32│
    │   Groq LLM 8B/70B  │  │  LLM Rewrite+Rerank │  │  Text→Image        │
    └─────────┬──────────┘  └──────────┬──────────┘  └──────────┬─────────┘
              │                        │                        │
              └────────────────────────┼────────────────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │  Supabase PostgreSQL     │
                          │  pgvector + HNSW indexes │
                          └──────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| LLM | Groq API | Llama 3.1 8B (simple) / Llama 3.3 70B (complex) |
| Text Embeddings | HuggingFace Inference API | `all-mpnet-base-v2` → 768-d vectors |
| Visual Embeddings | CLIP `ViT-B-32` | Shared backbone for images + videos → 512-d vectors |
| Vector DB | Supabase pgvector | HNSW cosine similarity indexes |
| Backend | FastAPI + Uvicorn | REST + SSE streaming |
| Frontend | Next.js 14 + React 18 | App Router, Tailwind CSS, react-markdown |
| PDF Parser | PyMuPDF | Text + font-size extraction |
| Frame Extraction | OpenCV | 1 fps JPEG capture |
| Token Counting | tiktoken (`o200k_base`) | Llama 3 tokenizer |

---

## Pipeline Parameters

| Parameter | Value |
|-----------|-------|
| Chunk Size | 300 tokens |
| Chunk Overlap | 50 tokens |
| Text Embed Dim | 768 |
| CLIP Embed Dim | 512 |
| Frame Interval | 1.0s |
| Max PDF Size | 50 MB |
| Max Video Size | 500 MB |
| Max Image Size | 50 MB |
| Retrieval top_k | 10 (filtered to 5) |
| Relevance Threshold | 0.15 |
| Dynamic K-Cutoff | 0.5× top score |
| LLM Temperature | 0.7 |
| LLM Max Tokens | 500 |
| Conversation History | 3 turns |
| LLM Rewrite Count | 3 variants |
| LLM Rerank Pool | top-20 candidates |
| Image Prompt Weight | 0.3 blend |

---

## Project Structure

```
.
├── backend/
│   ├── main.py                          # FastAPI app, all core endpoints
│   ├── config.py                        # Environment variable loader
│   ├── logger.py                        # JSON structured logging
│   ├── Dockerfile                       # Python 3.10-slim container
│   ├── requirements.txt                 # Python dependencies
│   │
│   ├── models/
│   │   ├── api.py                       # Pydantic request/response schemas
│   │   ├── chunk.py                     # Chunk, ScoredChunk dataclasses
│   │   ├── conversation.py              # Turn, Conversation dataclasses
│   │   ├── document.py                  # Page, Document dataclasses
│   │   ├── video.py                     # VideoMetadata, FrameMetadata
│   │   └── image.py                     # ImageMetadata
│   │
│   ├── services/
│   │   ├── llm_client.py               # Groq API wrapper (generate + stream)
│   │   ├── model_router.py             # Query classifier (simple/complex)
│   │   ├── output_evaluator.py         # Response quality flags
│   │   ├── retrieval_engine.py         # Embed query → search → filter
│   │   ├── vector_store.py             # Supabase pgvector (768-d)
│   │   ├── embedding_model.py          # HuggingFace Inference API
│   │   ├── chunking_engine.py          # Token-aware text splitter
│   │   ├── document_loader.py          # PDF → Document
│   │   ├── conversation_manager.py     # Multi-turn history (Supabase)
│   │   ├── routing_logger.py           # JSONL decision logger
│   │   │
│   │   ├── video/
│   │   │   ├── video_upload_handler.py     # Validate + save video files
│   │   │   ├── video_metadata_manager.py   # CRUD: videos, video_frames tables
│   │   │   ├── video_vector_store.py       # pgvector (512-d CLIP)
│   │   │   ├── video_embedding_engine.py   # CLIP embed (local or server)
│   │   │   ├── video_search.py             # Search + LLM rewrite/rerank
│   │   │   ├── video_processing_job.py     # Background pipeline
│   │   │   └── frame_extractor.py          # OpenCV frame capture
│   │   │
│   │   └── image/
│   │       ├── image_upload_handler.py     # Validate + save image files
│   │       ├── image_metadata_manager.py   # CRUD: images table
│   │       ├── image_vector_store.py       # pgvector (512-d CLIP)
│   │       ├── image_search.py             # Text → CLIP → cosine search
│   │       └── image_processing_job.py     # Background pipeline
│   │
│   ├── routers/
│   │   ├── video.py                     # /videos/* endpoints
│   │   └── image.py                     # /images/* endpoints
│   │
│   ├── migrations/
│   │   ├── 001_create_chunks_table.sql
│   │   ├── 002_create_conversations_tables.sql
│   │   ├── 003_create_video_tables.sql
│   │   ├── 004_add_video_error_message.sql
│   │   └── 005_create_image_tables.sql
│   │
│   └── logs/
│       └── routing_decisions.jsonl      # Query routing audit log
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout (Inter font, dark mode)
│   │   ├── globals.css                  # Animations, scroll reveals, overlays
│   │   ├── page.tsx                     # Landing page (architecture docs)
│   │   ├── ask/page.tsx                 # Chat UI (streaming + telemetry)
│   │   ├── upload/page.tsx              # PDF upload + processing overlay
│   │   ├── docs/page.tsx                # Document management + delete
│   │   ├── images/page.tsx              # Image upload/search/manage
│   │   └── videos/page.tsx              # Video upload/search/manage
│   │
│   ├── components/
│   │   ├── image/
│   │   │   ├── ImageUpload.tsx          # Drag-drop image uploader
│   │   │   ├── ImageSearchTab.tsx       # Text → image search
│   │   │   ├── ImageResultGrid.tsx      # Thumbnail grid + similarity %
│   │   │   └── ImageViewerModal.tsx     # Full-size lightbox
│   │   │
│   │   └── video/
│   │       ├── VideoUpload.tsx          # Drag-drop video uploader + overlay
│   │       ├── VideoSearchTab.tsx       # Text → frame search
│   │       ├── VideoImageSearchTab.tsx  # Image → frame search
│   │       ├── FrameResultGrid.tsx      # Frame grid + timestamp badges
│   │       └── VideoPlayerWithSeek.tsx  # Modal player with auto-seek
│   │
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── .env.local.example
│
└── .env                                 # Root env vars (backend)
```

---

## Database Schema

8 tables across 3 pipelines. All vector columns use HNSW indexes with `vector_cosine_ops`.

### Document RAG

```sql
-- 001_create_chunks_table.sql
CREATE TABLE document_chunks (
  id              BIGSERIAL PRIMARY KEY,
  chunk_id        TEXT UNIQUE NOT NULL,        -- "{filename}_{page}_{index}"
  text            TEXT NOT NULL,
  document_name   TEXT NOT NULL,
  page_number     INTEGER NOT NULL,
  token_count     INTEGER DEFAULT 0,
  context_header  TEXT,                         -- injected from font-size analysis
  embedding       vector(768),                  -- all-mpnet-base-v2
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX idx_embedding_hnsw ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- RPC function called by vector_store.py
CREATE FUNCTION match_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int
) RETURNS TABLE (
  chunk_id text, text text, document_name text,
  page_number int, token_count int, context_header text,
  similarity float
);
```

### Conversations

```sql
-- 002_create_conversations_tables.sql
CREATE TABLE conversations (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE turns (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),
  query           TEXT NOT NULL,
  response        TEXT NOT NULL,
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);
```

### Video Search

```sql
-- 003_create_video_tables.sql + 004_add_video_error_message.sql
CREATE TABLE videos (
  id                BIGSERIAL PRIMARY KEY,
  video_id          TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  stored_path       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|processed|failed
  file_size_bytes   BIGINT,
  error_message     TEXT,                              -- added in migration 004
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_frames (
  id             BIGSERIAL PRIMARY KEY,
  frame_id       TEXT UNIQUE NOT NULL,
  video_id       TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  timestamp_sec  NUMERIC(10,2) NOT NULL,
  frame_path     TEXT NOT NULL,
  caption        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_frame_embeddings (
  id         BIGSERIAL PRIMARY KEY,
  frame_id   TEXT NOT NULL REFERENCES video_frames(frame_id) ON DELETE CASCADE,
  video_id   TEXT NOT NULL,
  embedding  vector(512),              -- CLIP ViT-B-32
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_frame_embeddings_hnsw ON video_frame_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE FUNCTION match_video_frames(
  query_embedding vector(512),
  match_threshold float,
  match_count int
) RETURNS TABLE (
  frame_id text, video_id text, timestamp_sec numeric,
  frame_path text, similarity float
);
```

### Image Search

```sql
-- 005_create_image_tables.sql
CREATE TABLE images (
  id                BIGSERIAL PRIMARY KEY,
  image_id          TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  stored_path       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  file_size_bytes   BIGINT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE image_embeddings (
  id         BIGSERIAL PRIMARY KEY,
  image_id   TEXT NOT NULL REFERENCES images(image_id) ON DELETE CASCADE,
  embedding  vector(512),              -- CLIP ViT-B-32
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_image_embeddings_hnsw ON image_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE FUNCTION match_images(
  query_embedding vector(512),
  match_threshold float,
  match_count int
) RETURNS TABLE (
  image_id text, stored_path text, similarity float
);
```

---

## API Endpoints

### Document RAG

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/health` | Detailed health |
| `GET` | `/wake` | Cold-start probe (returns timestamp) |
| `POST` | `/query` | RAG query → JSON response |
| `POST` | `/query/stream` | RAG query → SSE token stream |
| `POST` | `/upload` | Ingest PDF(s) → chunk → embed → store |
| `GET` | `/documents` | List all documents + chunk counts |
| `DELETE` | `/documents/{name}` | Delete document + all chunks |

### Video Search

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/videos/` | List all videos + frame counts + thumbnails |
| `POST` | `/videos/upload` | Upload video → 202 + background processing |
| `GET` | `/videos/{id}/status` | Poll processing status |
| `POST` | `/videos/search` | Text → CLIP → frame similarity search |
| `POST` | `/videos/search-by-image` | Image + optional text → frame search |
| `GET` | `/videos/frames/{id}/thumbnail` | Serve frame JPEG |
| `GET` | `/videos/{id}/file` | Stream video file |
| `DELETE` | `/videos/{id}` | Delete video + frames + embeddings |

### Image Search

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/images/` | List all images + thumbnails |
| `POST` | `/images/upload` | Upload image → 202 + background processing |
| `GET` | `/images/{id}/status` | Poll processing status |
| `POST` | `/images/search` | Text → CLIP → image similarity search |
| `GET` | `/images/{id}/file` | Serve image file |
| `DELETE` | `/images/{id}` | Delete image + embedding |

---

## Pipelines

### 1. Document Ingestion

```
PDF Upload
  │
  ▼
PyMuPDF text extraction (per-page)
  │
  ▼
Font-size analysis → header injection (H1 >18pt, H2 >14pt, H3 >12pt)
  │
  ▼
Token-aware recursive chunking (300 tokens, 50 overlap)
  │
  ▼
HuggingFace Inference API → all-mpnet-base-v2 → 768-d embeddings (batch=10)
  │
  ▼
Supabase pgvector upsert → HNSW indexed
```

### 2. RAG Query

```
User question
  │
  ├── ModelRouter: classify simple/complex (5-rule decision tree + OOD filter)
  │     ├── OOD → skip retrieval (greetings, meta-questions)
  │     ├── Complex keywords → Llama 3.3 70B
  │     ├── >15 words → 70B
  │     ├── Multiple "?" → 70B
  │     ├── Comparison words → 70B
  │     └── Default → Llama 3.1 8B
  │
  ├── ConversationManager: load last 3 turns
  │
  ├── RetrievalEngine:
  │     ├── Embed query → 768-d
  │     ├── pgvector search (top_k=10)
  │     ├── Filter < 0.15 relevance
  │     └── Dynamic K-cutoff (≥50% of top score)
  │
  ├── Prompt assembly: system persona + context chunks + history + query
  │
  ├── Token counting (tiktoken o200k_base)
  │
  ├── Groq LLM generation (temp=0.7, max_tokens=500)
  │     ├── JSON mode: single response
  │     └── SSE mode: token-by-token stream
  │
  ├── OutputEvaluator: flag quality issues
  │     ├── no_context — answered without source material
  │     ├── refusal — LLM declined to answer
  │     ├── unverified_feature — mentioned items not in chunks
  │     └── pricing_uncertainty — hedging on pricing data
  │
  └── RoutingLogger: append to JSONL audit log
```

### 3. Video Ingestion

```
Video upload (.mp4/.mov/.mkv, max 500 MB)
  │
  ▼
OpenCV frame extraction @ 1 fps → JPEG
  │
  ▼
CLIP ViT-B-32 embedding per frame → 512-d
  │
  ▼
Supabase pgvector insert → HNSW indexed
  │
  ▼
Status: pending → processing → processed|failed
```

### 4. Video Search

```
Text query
  │
  ├── LLM Query Rewriting (Llama 3.3 70B via Groq)
  │     └── Generate 3 query variants for broader recall
  │
  ├── CLIP text embedding → 512-d (original + 3 rewrites)
  │
  ├── pgvector similarity search per variant → merge results
  │
  ├── LLM Result Reranking
  │     └── Score top-20 candidates → return best top_k
  │
  └── Return: frame_id, video_id, timestamp_sec, thumbnail_url, similarity

Image-to-Video search:
  ├── CLIP image embedding → 512-d
  ├── Optional text prompt → CLIP text embedding
  ├── Blend: (1 - 0.3) × image_emb + 0.3 × text_emb
  └── pgvector search with blended embedding
```

### 5. Image Ingestion + Search

```
Image upload (JPG/PNG/WEBP, max 50 MB)
  │
  ▼
CLIP ViT-B-32 embedding → 512-d
  │
  ▼
Supabase pgvector insert → HNSW indexed

Search: text query → CLIP text embedding → cosine similarity → top_k results
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase project with pgvector extension enabled

### 1. Database

Run migrations in order against your Supabase SQL editor:

```bash
backend/migrations/001_create_chunks_table.sql
backend/migrations/002_create_conversations_tables.sql
backend/migrations/003_create_video_tables.sql
backend/migrations/004_add_video_error_message.sql
backend/migrations/005_create_image_tables.sql
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp ../.env.example ../.env
# Edit .env with your keys
```

**Required environment variables:**

```env
GROQ_API_KEY=gsk_...
HUGGINGFACE_API_KEY=hf_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...
PORT=8000
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Optional (video/image auth):**

```env
VIDEO_API_KEY=your-secret
IMAGE_API_KEY=your-secret
```

**Start server:**

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Run backend only (one-liner):**

```bash
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Or both backend and frontend:**

```bash
./run.sh
```

### 3. Frontend

```bash
cd frontend

npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local
```

**Frontend env vars:**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_VIDEO_API_KEY=your-secret
# NEXT_PUBLIC_IMAGE_API_KEY=your-secret
```

**Start dev server:**

```bash
npm run dev
# → http://localhost:3000
```

**Production build:**

```bash
npm run build && npm start
```

---

## Frontend Pages

| Route | Purpose | Tabs |
|-------|---------|------|
| `/` | Landing page — architecture docs, pipeline diagrams, tech stack | — |
| `/ask` | Chat UI — streaming responses, response telemetry sidebar, source citations | — |
| `/upload` | PDF ingestion — drag-drop, 6-step processing overlay animation | — |
| `/docs` | Document management — list all indexed docs, stats bar, delete with confirmation | — |
| `/images` | Image pipeline | Upload, Search, View Uploaded |
| `/videos` | Video pipeline | Upload, Search, Image Search, View Uploaded |

### Chat Features (`/ask`)

- **SSE streaming** — token-by-token response rendering
- **Markdown rendering** — `react-markdown` with `@tailwindcss/typography`
- **Response telemetry** — model used, classification, token counts, latency, evaluator flags
- **Source citations** — document name, page number, relevance score
- **Multi-turn** — conversation history persisted in localStorage + Supabase
- **Cold-start detection** — `/wake` probe with loading indicator

### Upload Features (`/upload`)

- **Processing overlay** — 6-step animated pipeline visualization
- **Steps:** Upload → Extract text → Inject headers → Chunk → Embed → Store
- **Per-step indicators** — number → active pulse → checkmark
- **Elapsed timer** — real-time processing duration

### Media Management (`/images`, `/videos`)

- **Grid card layout** — responsive thumbnail grid with visual previews
- **Click to preview** — lightbox (images) / video player with auto-seek (videos)
- **Status badges** — Indexed (green), Processing (amber pulse), Failed (red), Pending (gray)
- **Stats bar** — total count, indexed count, frame count (videos), vector dimension
- **Delete with confirmation** — modal with item name and impact description
- **Refresh** — manual re-fetch button

---

## Query Classification — Decision Tree

```
Input: user question string

Step 0: OOD Filter
  └── Match: "hi", "hello", "thanks", "who are you", "help" (as core intent)
  └── Result: simple + skip_retrieval=true

Step 1: Complex Keywords
  └── Match: "explain", "compare", "analyze", "difference", "relationship"
  └── Result: complex → Llama 3.3 70B

Step 2: Query Length
  └── Condition: word_count > 15
  └── Result: complex → 70B

Step 3: Multiple Questions
  └── Condition: question_mark_count > 1
  └── Result: complex → 70B

Step 4: Comparison Words
  └── Match: "versus", "vs", "better", "worse", "compared to"
  └── Result: complex → 70B

Step 5: Default
  └── Result: simple → Llama 3.1 8B
```

---

## Output Evaluator — Quality Flags

| Flag | Trigger |
|------|---------|
| `no_context` | 0 chunks retrieved AND response is not a refusal |
| `refusal` | LLM used refusal phrases ("I don't have", "not mentioned", "cannot find") without contrast words |
| `unverified_feature` | Response contains ≥3 proper nouns not found in source chunks |
| `pricing_uncertainty` | Response discusses pricing with hedging language ("may", "might", "approximately") |

---

## Routing Logger — JSONL Schema

Each query appends one JSON line to `logs/routing_decisions.jsonl`:

```json
{
  "timestamp": "2026-02-22T10:30:00Z",
  "query": "How does authentication work?",
  "classification": "complex",
  "model_used": "llama-3.3-70b-versatile",
  "rule_triggered": "complex_keyword",
  "complexity_score": {
    "word_count": 5,
    "complex_keyword_count": 1,
    "question_mark_count": 1,
    "comparison_word_count": 0
  },
  "tokens_input": 1200,
  "tokens_output": 350,
  "system_prompt_tokens": 800,
  "context_tokens": 400,
  "latency_ms": 2100,
  "chunks_retrieved": 4,
  "evaluator_flags": []
}
```

---

## Dependencies

### Backend (Python)

```
fastapi                    # API framework
uvicorn[standard]          # ASGI server
python-dotenv              # Env var loading
pymupdf                    # PDF text extraction
groq                       # Groq LLM API client
supabase                   # Supabase Python client
httpx                      # HTTP client for embeddings
tiktoken                   # Token counting (o200k_base)
transformers               # HuggingFace model utils
pydantic                   # Data validation
python-multipart           # File upload handling
huggingface-hub            # HF API client
opencv-python-headless     # Video frame extraction
sentence-transformers      # CLIP local embeddings
pillow                     # Image processing
pytest / pytest-asyncio    # Testing
hypothesis                 # Property-based testing
```

### Frontend (Node.js)

```
next@14.1.0                # React framework (App Router)
react@18.2.0               # UI library
react-markdown@10.1.0      # Markdown rendering
typescript@5.3.3           # Type safety
tailwindcss@3.4.1          # Utility CSS
@tailwindcss/typography    # Prose styles for markdown
postcss + autoprefixer     # CSS processing
```

---

## Deployment

### Backend — Docker / Render

```dockerfile
FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend — Vercel

```bash
# vercel.json is preconfigured
# Set NEXT_PUBLIC_API_URL to your backend URL
vercel deploy
```

### Environment Variables Summary

| Variable | Required | Default | Used By |
|----------|----------|---------|---------|
| `GROQ_API_KEY` | Yes | — | Backend (LLM) |
| `HUGGINGFACE_API_KEY` | Yes | — | Backend (embeddings) |
| `SUPABASE_URL` | Yes | — | Backend (database) |
| `SUPABASE_KEY` | Yes | — | Backend (database) |
| `PORT` | No | `8000` | Backend |
| `LOG_LEVEL` | No | `INFO` | Backend |
| `CORS_ORIGINS` | No | `localhost:3000,3001` | Backend |
| `VIDEO_API_KEY` | No | — | Backend (auth) |
| `IMAGE_API_KEY` | No | — | Backend (auth) |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Frontend |
| `NEXT_PUBLIC_VIDEO_API_KEY` | No | — | Frontend |
| `NEXT_PUBLIC_IMAGE_API_KEY` | No | — | Frontend |
