"""Configuration management for Intelligent RAG."""
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Server Configuration
PORT = int(os.getenv("PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# CORS Configuration
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:3000,http://localhost:3001"
).split(",")
CORS_ALLOW_ORIGIN_REGEX = os.getenv("CORS_ALLOW_ORIGIN_REGEX", r"https://.*\.vercel\.app")

# Model Configuration
EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"
SIMPLE_MODEL = "llama-3.1-8b-instant"
COMPLEX_MODEL = "llama-3.3-70b-versatile"

# Video search LLM configuration (Groq)
VIDEO_LLM_MODEL = os.getenv("VIDEO_LLM_MODEL", "llama-3.3-70b-versatile")
VIDEO_LLM_REWRITE_ENABLED = os.getenv("VIDEO_LLM_REWRITE_ENABLED", "true").lower() in {"1", "true", "yes"}
VIDEO_LLM_RERANK_ENABLED = os.getenv("VIDEO_LLM_RERANK_ENABLED", "true").lower() in {"1", "true", "yes"}
VIDEO_LLM_REWRITE_COUNT = int(os.getenv("VIDEO_LLM_REWRITE_COUNT", "3"))
VIDEO_LLM_RERANK_CANDIDATES = int(os.getenv("VIDEO_LLM_RERANK_CANDIDATES", "20"))

# Chunking Configuration
CHUNK_SIZE = 300  # tokens
CHUNK_OVERLAP = 50  # tokens
MAX_CHUNKS = 5

# Retrieval Configuration
RELEVANCE_THRESHOLD = 0.3
DYNAMIC_K_CUTOFF = 0.8  # Only include chunks within 80% of top score

# --- Video Semantic Search (isolated from document RAG) ---
VIDEO_MODE = os.getenv("VIDEO_MODE", "server").lower()  # "local" | "server"
VIDEO_STORAGE_PATH = os.getenv("VIDEO_STORAGE_PATH", os.path.join(os.getcwd(), "video_storage"))
VIDEO_MAX_SIZE_MB = int(os.getenv("VIDEO_MAX_SIZE_MB", "500"))
VIDEO_FRAME_INTERVAL_SEC = float(os.getenv("VIDEO_FRAME_INTERVAL_SEC", "1.0"))
VIDEO_EMBEDDING_DIM = int(os.getenv("VIDEO_EMBEDDING_DIM", "512"))
VIDEO_ALLOWED_EXTENSIONS = (".mp4", ".mov", ".mkv")
VIDEO_IMAGE_MATCH_THRESHOLD = float(os.getenv("VIDEO_IMAGE_MATCH_THRESHOLD", "0.5"))
VIDEO_IMAGE_TOP_K = int(os.getenv("VIDEO_IMAGE_TOP_K", "10"))
VIDEO_IMAGE_PROMPT_WEIGHT = float(os.getenv("VIDEO_IMAGE_PROMPT_WEIGHT", "0.3"))

# Video embedding: Local mode (model path or HF id for image+text, e.g. CLIP)
VIDEO_LOCAL_EMBEDDING_MODEL = os.getenv("VIDEO_LOCAL_EMBEDDING_MODEL", "sentence-transformers/clip-ViT-B-32")
# Video embedding: Server mode uses HUGGINGFACE_API_KEY + HF inference image model
VIDEO_SERVER_EMBEDDING_MODEL = os.getenv("VIDEO_SERVER_EMBEDDING_MODEL", "sentence-transformers/clip-ViT-B-32")
# If server embedding fails, optionally fall back to local model
VIDEO_SERVER_FALLBACK_TO_LOCAL = os.getenv("VIDEO_SERVER_FALLBACK_TO_LOCAL", "true").lower() in {"1", "true", "yes"}

# Optional: require API key for video endpoints (set VIDEO_API_KEY to enable)
VIDEO_API_KEY = os.getenv("VIDEO_API_KEY", "")

# --- Image Semantic Search (separate from video) ---
IMAGE_MODE = os.getenv("IMAGE_MODE", VIDEO_MODE).lower()
IMAGE_STORAGE_PATH = os.getenv("IMAGE_STORAGE_PATH", os.path.join(os.getcwd(), "image_storage"))
IMAGE_MAX_SIZE_MB = int(os.getenv("IMAGE_MAX_SIZE_MB", "50"))
IMAGE_EMBEDDING_DIM = int(os.getenv("IMAGE_EMBEDDING_DIM", str(VIDEO_EMBEDDING_DIM)))
IMAGE_ALLOWED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
IMAGE_LOCAL_EMBEDDING_MODEL = os.getenv("IMAGE_LOCAL_EMBEDDING_MODEL", VIDEO_LOCAL_EMBEDDING_MODEL)
IMAGE_SERVER_EMBEDDING_MODEL = os.getenv("IMAGE_SERVER_EMBEDDING_MODEL", VIDEO_SERVER_EMBEDDING_MODEL)
IMAGE_SERVER_FALLBACK_TO_LOCAL = os.getenv("IMAGE_SERVER_FALLBACK_TO_LOCAL", "true").lower() in {"1", "true", "yes"}
IMAGE_API_KEY = os.getenv("IMAGE_API_KEY", "")

# Logging Configuration
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
