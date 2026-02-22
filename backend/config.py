"""Configuration management for ClearPath RAG Chatbot."""
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

# Model Configuration
EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"
SIMPLE_MODEL = "llama-3.1-8b-instant"
COMPLEX_MODEL = "llama-3.3-70b-versatile"

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

# Video embedding: Local mode (model path or HF id for image+text, e.g. CLIP)
VIDEO_LOCAL_EMBEDDING_MODEL = os.getenv("VIDEO_LOCAL_EMBEDDING_MODEL", "sentence-transformers/clip-ViT-B-32")
# Video embedding: Server mode uses HUGGINGFACE_API_KEY + HF inference image model
VIDEO_SERVER_EMBEDDING_MODEL = os.getenv("VIDEO_SERVER_EMBEDDING_MODEL", "sentence-transformers/clip-ViT-B-32")

# Optional: require API key for video endpoints (set VIDEO_API_KEY to enable)
VIDEO_API_KEY = os.getenv("VIDEO_API_KEY", "")

# Logging Configuration
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
