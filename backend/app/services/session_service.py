from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.models.game_session import GameSession
from app.schemas.game_session import GameSessionCreate, GameSessionUpdate
import logging

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[GameSession]:
        return self.db.query(GameSession).all()

    def get_by_id(self, session_id: int) -> Optional[GameSession]:
        return self.db.query(GameSession).filter(GameSession.id == session_id).first()

    def get_active(self) -> Optional[GameSession]:
        return self.db.query(GameSession).filter(GameSession.end_time == None).first()

    def get_active_by_room(self, room_id: int) -> Optional[GameSession]:
        return self.db.query(GameSession).filter(
            GameSession.room_id == room_id,
            GameSession.end_time == None
        ).first()

    def create(self, session_data: GameSessionCreate) -> GameSession:
        session = GameSession(**session_data.model_dump())
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        logger.info(f"Created game session: {session.id} for room {session.room_id}")
        return session

    def update(self, session_id: int, session_data: GameSessionUpdate) -> Optional[GameSession]:
        session = self.get_by_id(session_id)
        if not session:
            return None
        
        update_data = session_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(session, field, value)
        
        self.db.commit()
        self.db.refresh(session)
        logger.info(f"Updated game session: {session.id}")
        return session

    def end_session(self, session_id: int) -> Optional[GameSession]:
        session = self.get_by_id(session_id)
        if not session:
            return None
        
        session.end_time = datetime.utcnow()
        self.db.commit()
        self.db.refresh(session)
        logger.info(f"Ended game session: {session.id}")
        return session

    def increment_players(self, session_id: int) -> Optional[GameSession]:
        session = self.get_by_id(session_id)
        if not session:
            return None
        
        session.connected_players += 1
        self.db.commit()
        self.db.refresh(session)
        return session

    def decrement_players(self, session_id: int) -> Optional[GameSession]:
        session = self.get_by_id(session_id)
        if not session:
            return None
        
        if session.connected_players > 0:
            session.connected_players -= 1
            self.db.commit()
            self.db.refresh(session)
        return session
