from sqlalchemy import Column, Integer, String, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ElementType(str, enum.Enum):
    sensor = "sensor"
    actuator = "actuator"
    logic = "logic"
    switch = "switch"
    servo = "servo"
    light = "light"
    relay = "relay"
    door = "door"
    lock = "lock"
    display = "display"
    speaker = "speaker"
    rfid = "rfid"
    keypad = "keypad"
    button = "button"
    led = "led"
    motor = "motor"


class Element(Base):
    __tablename__ = "elements"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(Enum(ElementType), nullable=False)
    mqtt_topic = Column(String(255), nullable=True)
    current_state = Column(JSON, default={})

    room = relationship("Room", back_populates="elements")
    events = relationship("Event", back_populates="element", cascade="all, delete-orphan")
