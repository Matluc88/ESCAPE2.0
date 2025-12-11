from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime


class EventBase(BaseModel):
    element_id: int
    session_id: Optional[int] = None
    action: str
    value: Dict[str, Any] = {}


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
