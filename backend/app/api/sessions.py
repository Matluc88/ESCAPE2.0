from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.services.session_service import SessionService
from app.services.room_service import RoomService
from app.schemas.game_session import GameSessionCreate, GameSessionUpdate, GameSessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=List[GameSessionResponse])
def get_sessions(db: Session = Depends(get_db)):
    service = SessionService(db)
    return service.get_all()


@router.get("/active", response_model=Optional[GameSessionResponse])
def get_active_session(db: Session = Depends(get_db)):
    service = SessionService(db)
    session = service.get_active()
    return session


@router.get("/{session_id}", response_model=GameSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    service = SessionService(db)
    session = service.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/start", response_model=GameSessionResponse, status_code=201)
def start_session(session_data: GameSessionCreate, db: Session = Depends(get_db)):
    room_service = RoomService(db)
    room = room_service.get_by_id(session_data.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    session_service = SessionService(db)
    existing = session_service.get_active_by_room(session_data.room_id)
    if existing:
        raise HTTPException(status_code=400, detail="An active session already exists for this room")
    
    return session_service.create(session_data)


@router.post("/end", response_model=GameSessionResponse)
def end_session(db: Session = Depends(get_db)):
    service = SessionService(db)
    active_session = service.get_active()
    if not active_session:
        raise HTTPException(status_code=404, detail="No active session found")
    
    return service.end_session(active_session.id)


@router.post("/{session_id}/end", response_model=GameSessionResponse)
def end_specific_session(session_id: int, db: Session = Depends(get_db)):
    service = SessionService(db)
    session = service.end_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=GameSessionResponse)
def update_session(session_id: int, session_data: GameSessionUpdate, db: Session = Depends(get_db)):
    service = SessionService(db)
    session = service.update(session_id, session_data)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
