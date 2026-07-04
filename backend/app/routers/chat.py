from fastapi import APIRouter

from ..llm import humanize
from ..schemas import ChatRequest, ChatResponse
from ..snapshot import build_snapshot

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> dict:
    snapshot = build_snapshot()
    reply = await humanize(request.message, snapshot)
    return {"reply": reply}
