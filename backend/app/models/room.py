from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    elements = relationship("Element", back_populates="room", cascade="all, delete-orphan")
    game_sessions = relationship("GameSession", back_populates="room", cascade="all, delete-orphan")
