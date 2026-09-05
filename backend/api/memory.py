"""
Memory API

Explicit store/search access to the Memory Engine, for cases outside normal
chat flow — e.g. importing memories, an admin/debug view, or a future
"tell me something about yourself" onboarding flow that stores facts
directly rather than waiting for the heuristic extractor to catch them
mid-conversation.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.db import get_db
from memory import memory_service
from utils.schemas import MemoryOut, MemorySearchResponse, MemoryStoreRequest

router = APIRouter(prefix="/memory", tags=["memory"])


@router.post("/store", response_model=MemoryOut)
def store_memory(payload: MemoryStoreRequest, db: Session = Depends(get_db)):
    memory = memory_service.store_memory(
        db,
        user_id=payload.user_id,
        content=payload.content,
        layer=payload.layer,
        category=payload.category,
        importance_score=payload.importance_score,
    )
    return MemoryOut(
        memory_id=memory.id,
        content=memory.content,
        layer=memory.layer,
        category=memory.category,
        importance_score=memory.importance_score,
        created_at=memory.created_at.isoformat() if memory.created_at else None,
    )


@router.get("/search", response_model=MemorySearchResponse)
def search_memory(
    user_id: str = Query(...),
    query: str = Query(...),
    top_k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    results = memory_service.search_memory(db, user_id=user_id, query=query, top_k=top_k)
    return MemorySearchResponse(results=[MemoryOut(**r) for r in results])
