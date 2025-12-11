from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class WebSocketMessage(BaseModel):
    room: str
    element: str
    action: str
    value: Any
    timestamp: datetime = None

    def __init__(self, **data):
        if data.get("timestamp") is None:
            data["timestamp"] = datetime.utcnow()
        super().__init__(**data)
