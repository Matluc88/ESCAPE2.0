from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class GameSession(Base):
    __tablename__ = "game_sessions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    expected_players = Column(Integer, default=1)
    connected_players = Column(Integer, default=0)

    room = relationship("Room", back_populates="game_sessions")
    events = relationship("Event", back_populates="session", cascade="all, delete-orphan")
