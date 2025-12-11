from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.services.event_service import EventService
from app.services.element_service import ElementService
from app.services.session_service import SessionService
from app.schemas.event import EventCreate, EventResponse

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=List[EventResponse])
def get_events(
    session_id: Optional[int] = Query(None, alias="sessionId"),
    element_id: Optional[int] = Query(None, alias="elementId"),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    service = EventService(db)
    
    if session_id:
        return service.get_by_session(session_id)
    elif element_id:
        return service.get_by_element(element_id)
    else:
        return service.get_recent(limit)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    service = EventService(db)
    event = service.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("", response_model=EventResponse, status_code=201)
def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    element_service = ElementService(db)
    element = element_service.get_by_id(event_data.element_id)
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    
    if event_data.session_id:
        session_service = SessionService(db)
        session = session_service.get_by_id(event_data.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    
    service = EventService(db)
    return service.create(event_data)
