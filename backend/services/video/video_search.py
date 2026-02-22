"""Video semantic search: embed query and search video_frame_embeddings."""
import json
import re
import logging
from typing import List, Tuple, Optional

from services.video.video_embedding_engine import VideoEmbeddingEngine
from services.video.video_vector_store import VideoVectorStore
from services.llm_client import LLMClient, LLMClientError

logger = logging.getLogger(__name__)


class VideoSearchService:
    """Search video frames by natural language query."""

    def __init__(
        self,
        embedding_engine: VideoEmbeddingEngine,
        vector_store: VideoVectorStore,
        llm_client: Optional[LLMClient] = None,
        llm_model: Optional[str] = None,
        rewrite_enabled: bool = True,
        rerank_enabled: bool = True,
        rewrite_count: int = 3,
        rerank_candidates: int = 20,
    ):
        self.embedding_engine = embedding_engine
        self.vector_store = vector_store
        self.llm_client = llm_client
        self.llm_model = llm_model
        self.rewrite_enabled = rewrite_enabled
        self.rerank_enabled = rerank_enabled
        self.rewrite_count = max(0, rewrite_count)
        self.rerank_candidates = max(0, rerank_candidates)

    def search(
        self,
        query: str,
        top_k: int = 10,
        match_threshold: float = 0.0,
    ) -> List[Tuple[str, str, float, str, float]]:
        """
        Return list of (frame_id, video_id, timestamp_sec, frame_path, similarity).
        """
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")
        query = query.strip()
        if not query:
            raise ValueError("Query cannot be empty")

        queries = [query]
        if self.llm_client and self.llm_model and self.rewrite_enabled and self.rewrite_count > 0:
            try:
                rewrites = self._rewrite_query(query, self.rewrite_count)
                queries.extend(rewrites)
                logger.info("Video search rewrites=%d", len(rewrites))
            except LLMClientError as e:
                logger.warning("Video query rewrite failed: %s", e)
            except Exception as e:
                logger.warning("Unexpected rewrite error: %s", e)

        merged = self._search_multi_query(
            queries=queries,
            top_k=top_k,
            match_threshold=match_threshold,
        )

        if self.llm_client and self.llm_model and self.rerank_enabled and len(merged) > 1:
            try:
                merged = self._rerank_results(query, merged, top_k=top_k)
            except LLMClientError as e:
                logger.warning("Video rerank failed: %s", e)
            except Exception as e:
                logger.warning("Unexpected rerank error: %s", e)

        return merged[:top_k]

    def search_by_image(
        self,
        image_path: str,
        top_k: int = 10,
        match_threshold: float = 0.0,
    ) -> List[Tuple[str, str, float, str, float]]:
        return self.search_by_image_with_prompt(
            image_path=image_path,
            prompt=None,
            prompt_weight=0.0,
            top_k=top_k,
            match_threshold=match_threshold,
        )

    def search_by_image_with_prompt(
        self,
        image_path: str,
        prompt: Optional[str],
        prompt_weight: float,
        top_k: int = 10,
        match_threshold: float = 0.0,
    ) -> List[Tuple[str, str, float, str, float]]:
        image_embedding = self.embedding_engine.embed_image(image_path)
        if prompt and prompt.strip():
            text_embedding = self.embedding_engine.embed_text(prompt.strip())
            embedding = self._blend_embeddings(
                image_embedding,
                text_embedding,
                prompt_weight=max(0.0, min(1.0, prompt_weight)),
            )
        else:
            embedding = image_embedding
        return self.vector_store.search(
            query_embedding=embedding,
            top_k=top_k,
            match_threshold=match_threshold,
        )

    def _blend_embeddings(
        self,
        image_embedding: List[float],
        text_embedding: List[float],
        prompt_weight: float,
    ) -> List[float]:
        if len(image_embedding) != len(text_embedding):
            raise ValueError("Image and text embeddings must have same length")
        image_norm = self._normalize(image_embedding)
        text_norm = self._normalize(text_embedding)
        w_text = prompt_weight
        w_img = 1.0 - w_text
        blended = [w_img * i + w_text * t for i, t in zip(image_norm, text_norm)]
        return self._normalize(blended)

    @staticmethod
    def _normalize(vec: List[float]) -> List[float]:
        total = 0.0
        for v in vec:
            total += v * v
        if total <= 0.0:
            return vec
        inv = 1.0 / (total ** 0.5)
        return [v * inv for v in vec]

    def _search_multi_query(
        self,
        queries: List[str],
        top_k: int,
        match_threshold: float,
    ) -> List[Tuple[str, str, float, str, float]]:
        deduped: dict[str, Tuple[str, str, float, str, float]] = {}
        for q in queries:
            embedding = self.embedding_engine.embed_text(q)
            rows = self.vector_store.search(
                query_embedding=embedding,
                top_k=top_k,
                match_threshold=match_threshold,
            )
            for row in rows:
                frame_id = row[0]
                existing = deduped.get(frame_id)
                if not existing or row[4] > existing[4]:
                    deduped[frame_id] = row
        return sorted(deduped.values(), key=lambda r: r[4], reverse=True)

    def _rewrite_query(self, query: str, count: int) -> List[str]:
        prompt = (
            "You are helping improve video semantic search. Rewrite the user query into "
            f"{count} alternative queries that capture the same intent, using synonyms "
            "and more descriptive visual language. Return ONLY a JSON array of strings.\n\n"
            f"Query: {query}\n"
        )
        response = self.llm_client.generate(
            model=self.llm_model,
            prompt=prompt,
            max_tokens=200,
        )
        return self._parse_query_list(response.text, count)

    def _parse_query_list(self, text: str, count: int) -> List[str]:
        candidates: List[str] = []
        try:
            data = json.loads(text)
            if isinstance(data, list):
                candidates = [str(item).strip() for item in data]
        except json.JSONDecodeError:
            candidates = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
        cleaned = []
        seen = set()
        for item in candidates:
            if not item:
                continue
            if item.lower() in seen:
                continue
            seen.add(item.lower())
            cleaned.append(item)
        return cleaned[:count]

    def _rerank_results(
        self,
        query: str,
        results: List[Tuple[str, str, float, str, float]],
        top_k: int,
    ) -> List[Tuple[str, str, float, str, float]]:
        if self.rerank_candidates <= 0:
            return results
        candidates = results[: max(top_k, self.rerank_candidates)]
        prompt_lines = [
            "You are ranking video frame search results for a user query.",
            "Use the query intent and the similarity score as prior evidence.",
            "Return ONLY a JSON array of frame_id strings ordered from best to worst.",
            f"Query: {query}",
            "Candidates:",
        ]
        for idx, (frame_id, video_id, ts, frame_path, sim) in enumerate(candidates, start=1):
            prompt_lines.append(
                f"{idx}. frame_id={frame_id}, video_id={video_id}, "
                f"timestamp_sec={ts:.2f}, similarity={sim:.4f}, frame_path={frame_path}"
            )
        prompt = "\n".join(prompt_lines)
        response = self.llm_client.generate(
            model=self.llm_model,
            prompt=prompt,
            max_tokens=300,
        )
        candidate_ids = [c[0] for c in candidates]
        order = self._parse_rerank_order(response.text, candidate_ids)
        if not order:
            return results
        ordered_ids = [frame_id for frame_id in order if frame_id in candidate_ids]
        remaining_ids = [frame_id for frame_id in candidate_ids if frame_id not in ordered_ids]
        final_ids = ordered_ids + remaining_ids
        by_id = {c[0]: c for c in candidates}
        ranked_candidates = [by_id[frame_id] for frame_id in final_ids if frame_id in by_id]
        final = ranked_candidates + results[len(candidates):]
        return final

    def _parse_rerank_order(self, text: str, candidate_ids: List[str]) -> List[str]:
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return [item for item in data if item in candidate_ids]
        except json.JSONDecodeError:
            match = re.search(r"\[[\s\S]*\]", text)
            if match:
                try:
                    data = json.loads(match.group(0))
                    if isinstance(data, list):
                        return [item for item in data if item in candidate_ids]
                except json.JSONDecodeError:
                    pass
        return []
