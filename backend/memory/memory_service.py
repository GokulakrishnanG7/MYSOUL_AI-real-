"""
Memory Engine V2

Three layers, exactly as specified:

  SHORT TERM   -> not stored here. It's just the last N `messages` rows for a
                  conversation (see api/chat.py), so it's always fresh and
                  needs no extra infrastructure.

  LONG TERM    -> `memories` table, layer="long_term". Preferences, goals,
                  stories, life events. Semantically searchable via FAISS.

  IMPORTANT    -> `memories` table, layer="important". Only high-value facts
                  (birthdays, interviews, exams, achievements, family events).
                  Auto-promoted from long_term when importance_score is high,
                  or explicitly tagged by the extractor / API caller.

Vector search: sentence-transformers/all-MiniLM-L6-v2 embeddings in a single
FAISS IndexFlatIP (cosine similarity via L2-normalized vectors), wrapped in
an IndexIDMap so each vector's ID = MemoryEmbedding.faiss_index_position.
FAISS holds vectors ONLY; `memory_embeddings` is the source of truth for the
text, so a corrupted/rebuilt index never loses data — it can be rebuilt from
the DB (see `rebuild_index_from_db`).

Because FAISS has no native per-user metadata filtering, search overfetches
(top_k * OVERFETCH) globally, then filters candidates down to the requesting
user_id via the SQL join, then truncates to top_k. Fine at MVP scale; if you
outgrow it, the natural next step is one FAISS index per user or a real
vector DB (pgvector/Milvus) with metadata filtering built in.
"""
from __future__ import annotations

import os
import re
import threading
from datetime import datetime, timedelta
from functools import lru_cache

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from config import get_settings
from database.models import Memory, MemoryEmbedding

settings = get_settings()

OVERFETCH = 5
EMBED_DIM = 384  # all-MiniLM-L6-v2 output size


# ── Embedding model singleton ───────────────────────────────────────────
class _EmbeddingModel:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.model = SentenceTransformer(settings.embedding_model_name)

    @classmethod
    def get(cls) -> "_EmbeddingModel":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def embed(self, texts: list[str]) -> np.ndarray:
        vecs = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return vecs.astype("float32")


@lru_cache
def get_embedding_model() -> _EmbeddingModel:
    return _EmbeddingModel.get()


# ── FAISS index singleton (with disk persistence) ───────────────────────
class _VectorIndex:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self._index_lock = threading.Lock()
        os.makedirs(os.path.dirname(settings.faiss_index_path) or ".", exist_ok=True)
        path = settings.faiss_index_path
        if os.path.exists(path):
            self.index = faiss.read_index(path)
        else:
            base = faiss.IndexFlatIP(EMBED_DIM)
            self.index = faiss.IndexIDMap2(base)
        self._next_id = int(self.index.ntotal and self._max_id() + 1 or 0)

    def _max_id(self) -> int:
        # IndexIDMap2 doesn't expose ids directly in a cheap way across versions;
        # callers track next_id via the DB (MemoryEmbedding.faiss_index_position)
        # instead, so this is only a best-effort fallback at cold start.
        return self.index.ntotal - 1

    @classmethod
    def get(cls) -> "_VectorIndex":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def add(self, vec_id: int, vector: np.ndarray):
        with self._index_lock:
            self.index.add_with_ids(vector.reshape(1, -1), np.array([vec_id], dtype="int64"))
            self._save()

    def search(self, query_vec: np.ndarray, k: int) -> list[tuple[int, float]]:
        with self._index_lock:
            if self.index.ntotal == 0:
                return []
            k = min(k, self.index.ntotal)
            scores, ids = self.index.search(query_vec.reshape(1, -1), k)
        return [(int(i), float(s)) for i, s in zip(ids[0], scores[0]) if i != -1]

    def _save(self):
        faiss.write_index(self.index, settings.faiss_index_path)

    def rebuild(self, id_vector_pairs: list[tuple[int, np.ndarray]]):
        with self._index_lock:
            base = faiss.IndexFlatIP(EMBED_DIM)
            self.index = faiss.IndexIDMap2(base)
            if id_vector_pairs:
                ids = np.array([p[0] for p in id_vector_pairs], dtype="int64")
                vecs = np.stack([p[1] for p in id_vector_pairs]).astype("float32")
                self.index.add_with_ids(vecs, ids)
            self._save()


@lru_cache
def get_vector_index() -> _VectorIndex:
    return _VectorIndex.get()


# ── Public API ────────────────────────────────────────────────────────────
def store_memory(
    db: Session,
    *,
    user_id: str,
    content: str,
    layer: str = "long_term",
    category: str | None = None,
    importance_score: float = 0.5,
    source_message_id: str | None = None,
    expires_at: datetime | None = None,
) -> Memory:
    """Persists a memory row AND its embedding into FAISS, atomically enough for MVP."""
    if importance_score >= 0.8:
        layer = "important"

    memory = Memory(
        user_id=user_id,
        layer=layer,
        category=category,
        content=content,
        importance_score=importance_score,
        source_message_id=source_message_id,
        expires_at=expires_at,
    )
    db.add(memory)
    db.flush()  # get memory.id without committing yet

    embedder = get_embedding_model()
    vector = embedder.embed([content])[0]

    # position = current row count of memory_embeddings acts as a stable, ever-increasing id
    next_position = (db.query(MemoryEmbedding).count()) or 0
    embedding_row = MemoryEmbedding(
        user_id=user_id,
        memory_id=memory.id,
        faiss_index_position=next_position,
        text=content,
    )
    db.add(embedding_row)
    db.commit()
    db.refresh(memory)

    get_vector_index().add(next_position, vector)
    return memory


def search_memory(db: Session, *, user_id: str, query: str, top_k: int | None = None) -> list[dict]:
    """Semantic search over a user's long_term + important memories."""
    top_k = top_k or settings.memory_top_k
    embedder = get_embedding_model()
    query_vec = embedder.embed([query])[0]

    candidates = get_vector_index().search(query_vec, top_k * OVERFETCH)
    if not candidates:
        return []

    ids = [c[0] for c in candidates]
    score_by_id = dict(candidates)

    rows = (
        db.query(MemoryEmbedding, Memory)
        .join(Memory, Memory.id == MemoryEmbedding.memory_id)
        .filter(MemoryEmbedding.faiss_index_position.in_(ids))
        .filter(MemoryEmbedding.user_id == user_id)
        .all()
    )

    results = []
    for emb_row, mem_row in rows:
        results.append({
            "memory_id": mem_row.id,
            "content": mem_row.content,
            "layer": mem_row.layer,
            "category": mem_row.category,
            "importance_score": mem_row.importance_score,
            "score": score_by_id.get(emb_row.faiss_index_position, 0.0),
            "created_at": mem_row.created_at.isoformat() if mem_row.created_at else None,
        })
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:top_k]


def get_memory_snippets_for_prompt(db: Session, *, user_id: str, query: str, top_k: int = 5) -> list[str]:
    """Convenience wrapper for personality_engine.build_system_prompt(memory_snippets=...)."""
    hits = search_memory(db, user_id=user_id, query=query, top_k=top_k)
    return [h["content"] for h in hits]


def rebuild_index_from_db(db: Session):
    """Disaster-recovery: rebuild the FAISS index entirely from memory_embeddings text."""
    embedder = get_embedding_model()
    rows = db.query(MemoryEmbedding).order_by(MemoryEmbedding.faiss_index_position).all()
    if not rows:
        get_vector_index().rebuild([])
        return
    vectors = embedder.embed([r.text for r in rows])
    pairs = [(r.faiss_index_position, vectors[i]) for i, r in enumerate(rows)]
    get_vector_index().rebuild(pairs)


# ── Lightweight extraction heuristics (v1 — refine with real usage data) ──
_IMPORTANT_PATTERNS = {
    "birthday": re.compile(r"\bbirthday\b", re.I),
    "exam": re.compile(r"\b(exam|test|final(s)?)\b", re.I),
    "interview": re.compile(r"\binterview\b", re.I),
    "presentation": re.compile(r"\b(presentation|pitch|demo day)\b", re.I),
    "achievement": re.compile(r"\b(got the job|passed|promoted|graduated|won)\b", re.I),
    "family_event": re.compile(r"\b(wedding|anniversary|funeral|reunion)\b", re.I),
}

_PREFERENCE_PATTERNS = re.compile(
    r"\bi (love|really like|hate|can'?t stand|prefer|enjoy)\b", re.I,
)
_GOAL_PATTERNS = re.compile(
    r"\b(my goal is|i'?m trying to|i want to|working on|planning to)\b", re.I,
)


def extract_candidate_memory(text: str) -> dict | None:
    """
    Cheap heuristic extraction run on every user message (in addition to the
    LLM itself, which is the primary "understanding" layer — this is a
    fast-path safety net so important facts get stored even in a short reply
    the model might not elaborate on).

    Returns None, or {"content", "category", "importance_score"}.
    """
    if not text or len(text.strip()) < 8:
        return None

    for category, pattern in _IMPORTANT_PATTERNS.items():
        if pattern.search(text):
            return {"content": text.strip(), "category": category, "importance_score": 0.85}

    if _GOAL_PATTERNS.search(text):
        return {"content": text.strip(), "category": "goal", "importance_score": 0.6}

    if _PREFERENCE_PATTERNS.search(text):
        return {"content": text.strip(), "category": "preference", "importance_score": 0.55}

    return None
