from pydantic import BaseModel
from typing import Optional, Any, Dict
from app.models.element import ElementType


class ElementBase(BaseModel):
    name: str
    type: ElementType
    mqtt_topic: Optional[str] = None
    current_state: Dict[str, Any] = {}


class ElementCreate(ElementBase):
    room_id: int


class ElementUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ElementType] = None
    mqtt_topic: Optional[str] = None
    current_state: Optional[Dict[str, Any]] = None


class ElementStateUpdate(BaseModel):
    current_state: Dict[str, Any]


class ElementResponse(ElementBase):
    id: int
    room_id: int

    class Config:
        from_attributes = True
