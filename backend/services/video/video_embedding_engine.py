"""Video frame embedding: abstract interface + Local (on-disk model) vs Server (API)."""
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


class VideoEmbeddingEngine(ABC):
    """Abstract engine: embed images and text into same vector space (e.g. CLIP)."""

    @abstractmethod
    def embed_image(self, image_path: str) -> List[float]:
        """Return embedding vector for image at path."""
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Return embedding vector for text (for query)."""
        pass

    @abstractmethod
    def dimension(self) -> int:
        """Return embedding dimension."""
        pass


class LocalVideoEmbeddingEngine(VideoEmbeddingEngine):
    """Load CLIP (or similar) from disk; embed image and text locally."""

    def __init__(self, model_name: str = "sentence-transformers/clip-ViT-B-32"):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise RuntimeError(
                "sentence-transformers is required for local video embeddings. "
                "Install with: pip install sentence-transformers"
            )
        self._model = SentenceTransformer(model_name)
        self._dim = self._model.get_sentence_embedding_dimension()
        if self._dim is None:
            # CLIP and some multimodal models don't set it; ViT-B-32 is 512-d
            self._dim = 512
            logger.debug(f"Model did not report dimension; using default {self._dim} for CLIP ViT-B-32")
        logger.info(f"Initialized LocalVideoEmbeddingEngine with {model_name}, dim={self._dim}")

    def embed_image(self, image_path: str) -> List[float]:
        try:
            from PIL import Image
        except ImportError:
            raise RuntimeError(
                "Pillow is required for local video embeddings. Install with: pip install pillow"
            )
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            return self._model.encode(img, convert_to_numpy=True).tolist()

    def embed_text(self, text: str) -> List[float]:
        return self._model.encode(text, convert_to_numpy=True).tolist()

    def dimension(self) -> int:
        return self._dim


class ServerVideoEmbeddingEngine(VideoEmbeddingEngine):
    """Use Hugging Face Inference API for image and text embeddings (CLIP)."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "sentence-transformers/clip-ViT-B-32",
        dimension: int = 512,
        timeout: float = 60.0,
    ):
        import httpx
        self._api_key = api_key
        self._model_name = model_name
        self._dim = dimension
        self._timeout = timeout
        self._base = "https://api-inference.huggingface.co"
        self._client = httpx.Client(timeout=timeout)
        logger.info(f"Initialized ServerVideoEmbeddingEngine with {model_name}, dim={dimension}")

    def embed_image(self, image_path: str) -> List[float]:
        path = Path(image_path)
        if not path.is_file():
            raise FileNotFoundError(f"Image not found: {image_path}")
        with open(path, "rb") as f:
            data = f.read()
        url = f"{self._base}/models/{self._model_name}"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        # HF inference accepts raw image bytes with Content-Type
        r = self._client.post(
            url,
            content=data,
            headers={**headers, "Content-Type": "image/jpeg"},
        )
        r.raise_for_status()
        out = r.json()
        if isinstance(out, list) and len(out) > 0:
            return out[0] if isinstance(out[0], list) else out
        if isinstance(out, dict) and "embedding" in out:
            return out["embedding"]
        raise RuntimeError(f"Unexpected API response shape: {type(out)}")

    def embed_text(self, text: str) -> List[float]:
        url = f"{self._base}/models/{self._model_name}"
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        r = self._client.post(url, json={"inputs": text}, headers=headers)
        r.raise_for_status()
        out = r.json()
        if isinstance(out, list) and len(out) > 0:
            return out[0] if isinstance(out[0], list) else out
        if isinstance(out, dict) and "embedding" in out:
            return out["embedding"]
        raise RuntimeError(f"Unexpected API response shape: {type(out)}")

    def dimension(self) -> int:
        return self._dim


class FallbackVideoEmbeddingEngine(VideoEmbeddingEngine):
    """Try primary engine; fall back to a secondary engine on retryable failures."""

    def __init__(self, primary: VideoEmbeddingEngine, fallback: VideoEmbeddingEngine):
        self._primary = primary
        self._fallback = fallback

    def embed_image(self, image_path: str) -> List[float]:
        try:
            return self._primary.embed_image(image_path)
        except Exception as e:
            if _should_fallback(e):
                logger.warning("Primary video image embedding failed; falling back to local engine: %s", e)
                return self._fallback.embed_image(image_path)
            raise

    def embed_text(self, text: str) -> List[float]:
        try:
            return self._primary.embed_text(text)
        except Exception as e:
            if _should_fallback(e):
                logger.warning("Primary video text embedding failed; falling back to local engine: %s", e)
                return self._fallback.embed_text(text)
            raise

    def dimension(self) -> int:
        return self._primary.dimension()


def _should_fallback(error: Exception) -> bool:
    try:
        import httpx
    except ImportError:
        return False
    if isinstance(error, httpx.HTTPStatusError):
        status = error.response.status_code
        return status in {404, 410, 503}
    return False


def get_video_embedding_engine(mode: str, **kwargs) -> VideoEmbeddingEngine:
    """Factory: return Local or Server engine based on VIDEO_MODE."""
    mode = (mode or "server").lower()
    if mode == "local":
        model = kwargs.get("local_model") or "sentence-transformers/clip-ViT-B-32"
        return LocalVideoEmbeddingEngine(model_name=model)
    if mode == "server":
        api_key = kwargs.get("api_key") or ""
        if not api_key:
            raise ValueError("Server mode requires HUGGINGFACE_API_KEY (or api_key) for video embeddings")
        server_engine = ServerVideoEmbeddingEngine(
            api_key=api_key,
            model_name=kwargs.get("server_model") or "sentence-transformers/clip-ViT-B-32",
            dimension=kwargs.get("dimension", 512),
            timeout=kwargs.get("timeout", 60.0),
        )
        if kwargs.get("fallback_to_local", True):
            try:
                local_model = kwargs.get("local_model") or "sentence-transformers/clip-ViT-B-32"
                local_engine = LocalVideoEmbeddingEngine(model_name=local_model)
                return FallbackVideoEmbeddingEngine(server_engine, local_engine)
            except Exception as e:
                logger.warning("Local fallback disabled (init failed): %s", e)
        return server_engine
    raise ValueError(f"Unknown VIDEO_MODE: {mode}. Use 'local' or 'server'.")
