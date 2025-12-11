from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.models.element import Element
from app.schemas.element import ElementCreate, ElementUpdate, ElementStateUpdate
import logging

logger = logging.getLogger(__name__)


class ElementService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Element]:
        return self.db.query(Element).all()

    def get_by_id(self, element_id: int) -> Optional[Element]:
        return self.db.query(Element).filter(Element.id == element_id).first()

    def get_by_room(self, room_id: int) -> List[Element]:
        return self.db.query(Element).filter(Element.room_id == room_id).all()

    def get_by_mqtt_topic(self, topic: str) -> Optional[Element]:
        return self.db.query(Element).filter(Element.mqtt_topic == topic).first()

    def create(self, element_data: ElementCreate) -> Element:
        element = Element(**element_data.model_dump())
        self.db.add(element)
        self.db.commit()
        self.db.refresh(element)
        logger.info(f"Created element: {element.name} in room {element.room_id}")
        return element

    def update(self, element_id: int, element_data: ElementUpdate) -> Optional[Element]:
        element = self.get_by_id(element_id)
        if not element:
            return None
        
        update_data = element_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(element, field, value)
        
        self.db.commit()
        self.db.refresh(element)
        logger.info(f"Updated element: {element.name}")
        return element

    def update_state(self, element_id: int, state_data: ElementStateUpdate) -> Optional[Element]:
        element = self.get_by_id(element_id)
        if not element:
            return None
        
        element.current_state = state_data.current_state
        self.db.commit()
        self.db.refresh(element)
        logger.info(f"Updated state for element: {element.name}")
        return element

    def update_state_by_topic(self, topic: str, state: Dict[str, Any]) -> Optional[Element]:
        element = self.get_by_mqtt_topic(topic)
        if not element:
            return None
        
        element.current_state = {**element.current_state, **state}
        self.db.commit()
        self.db.refresh(element)
        logger.info(f"Updated state for element via MQTT: {element.name}")
        return element

    def delete(self, element_id: int) -> bool:
        element = self.get_by_id(element_id)
        if not element:
            return False
        
        self.db.delete(element)
        self.db.commit()
        logger.info(f"Deleted element: {element_id}")
        return True
