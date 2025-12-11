from pydantic import BaseModel
from typing import Optional


class RoomBase(BaseModel):
    name: str
    description: Optional[str] = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class RoomResponse(RoomBase):
    id: int

    class Config:
        from_attributes = True
