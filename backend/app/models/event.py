from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    element_id = Column(Integer, ForeignKey("elements.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String(100), nullable=False)
    value = Column(JSON, default={})

    element = relationship("Element", back_populates="events")
    session = relationship("GameSession", back_populates="events")
