from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services.room_service import RoomService
from app.schemas.room import RoomCreate, RoomUpdate, RoomResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=List[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    service = RoomService(db)
    return service.get_all()


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: int, db: Session = Depends(get_db)):
    service = RoomService(db)
    room = service.get_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post("", response_model=RoomResponse, status_code=201)
def create_room(room_data: RoomCreate, db: Session = Depends(get_db)):
    service = RoomService(db)
    existing = service.get_by_name(room_data.name)
    if existing:
        raise HTTPException(status_code=400, detail="Room with this name already exists")
    return service.create(room_data)


@router.put("/{room_id}", response_model=RoomResponse)
def update_room(room_id: int, room_data: RoomUpdate, db: Session = Depends(get_db)):
    service = RoomService(db)
    room = service.update(room_id, room_data)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    service = RoomService(db)
    if not service.delete(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
