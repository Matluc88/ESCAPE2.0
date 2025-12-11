from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services.element_service import ElementService
from app.services.room_service import RoomService
from app.schemas.element import ElementCreate, ElementUpdate, ElementResponse, ElementStateUpdate

router = APIRouter(prefix="/elements", tags=["elements"])


@router.get("", response_model=List[ElementResponse])
def get_elements(db: Session = Depends(get_db)):
    service = ElementService(db)
    return service.get_all()


@router.get("/{element_id}", response_model=ElementResponse)
def get_element(element_id: int, db: Session = Depends(get_db)):
    service = ElementService(db)
    element = service.get_by_id(element_id)
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    return element


@router.get("/room/{room_id}", response_model=List[ElementResponse])
def get_elements_by_room(room_id: int, db: Session = Depends(get_db)):
    room_service = RoomService(db)
    room = room_service.get_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    service = ElementService(db)
    return service.get_by_room(room_id)


@router.post("", response_model=ElementResponse, status_code=201)
def create_element(element_data: ElementCreate, db: Session = Depends(get_db)):
    room_service = RoomService(db)
    room = room_service.get_by_id(element_data.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    service = ElementService(db)
    return service.create(element_data)


@router.put("/{element_id}", response_model=ElementResponse)
def update_element(element_id: int, element_data: ElementUpdate, db: Session = Depends(get_db)):
    service = ElementService(db)
    element = service.update(element_id, element_data)
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    return element


@router.patch("/{element_id}/state", response_model=ElementResponse)
def update_element_state(element_id: int, state_data: ElementStateUpdate, db: Session = Depends(get_db)):
    service = ElementService(db)
    element = service.update_state(element_id, state_data)
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    return element


@router.delete("/{element_id}", status_code=204)
def delete_element(element_id: int, db: Session = Depends(get_db)):
    service = ElementService(db)
    if not service.delete(element_id):
        raise HTTPException(status_code=404, detail="Element not found")
