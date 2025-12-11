from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GameSessionBase(BaseModel):
    room_id: int
    expected_players: int = 1


class GameSessionCreate(GameSessionBase):
    pass


class GameSessionUpdate(BaseModel):
    end_time: Optional[datetime] = None
    connected_players: Optional[int] = None


class GameSessionResponse(GameSessionBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    connected_players: int

    class Config:
        from_attributes = True
