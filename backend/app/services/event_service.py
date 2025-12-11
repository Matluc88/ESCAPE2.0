from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.event import Event
from app.schemas.event import EventCreate
import logging

logger = logging.getLogger(__name__)


class EventService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Event]:
        return self.db.query(Event).all()

    def get_by_id(self, event_id: int) -> Optional[Event]:
        return self.db.query(Event).filter(Event.id == event_id).first()

    def get_by_session(self, session_id: int) -> List[Event]:
        return self.db.query(Event).filter(Event.session_id == session_id).order_by(Event.timestamp.desc()).all()

    def get_by_element(self, element_id: int) -> List[Event]:
        return self.db.query(Event).filter(Event.element_id == element_id).order_by(Event.timestamp.desc()).all()

    def create(self, event_data: EventCreate) -> Event:
        event = Event(**event_data.model_dump())
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        logger.info(f"Created event: {event.action} for element {event.element_id}")
        return event

    def get_recent(self, limit: int = 100) -> List[Event]:
        return self.db.query(Event).order_by(Event.timestamp.desc()).limit(limit).all()
