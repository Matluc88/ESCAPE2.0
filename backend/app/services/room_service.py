from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.room import Room
from app.schemas.room import RoomCreate, RoomUpdate
import logging

logger = logging.getLogger(__name__)


class RoomService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Room]:
        return self.db.query(Room).all()

    def get_by_id(self, room_id: int) -> Optional[Room]:
        return self.db.query(Room).filter(Room.id == room_id).first()

    def get_by_name(self, name: str) -> Optional[Room]:
        return self.db.query(Room).filter(Room.name == name).first()

    def create(self, room_data: RoomCreate) -> Room:
        room = Room(**room_data.model_dump())
        self.db.add(room)
        self.db.commit()
        self.db.refresh(room)
        logger.info(f"Created room: {room.name}")
        return room

    def update(self, room_id: int, room_data: RoomUpdate) -> Optional[Room]:
        room = self.get_by_id(room_id)
        if not room:
            return None
        
        update_data = room_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(room, field, value)
        
        self.db.commit()
        self.db.refresh(room)
        logger.info(f"Updated room: {room.name}")
        return room

    def delete(self, room_id: int) -> bool:
        room = self.get_by_id(room_id)
        if not room:
            return False
        
        self.db.delete(room)
        self.db.commit()
        logger.info(f"Deleted room: {room_id}")
        return True
