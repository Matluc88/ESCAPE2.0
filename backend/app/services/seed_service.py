import logging
from sqlalchemy.orm import Session
from app.models.room import Room
from app.models.element import Element, ElementType

logger = logging.getLogger(__name__)


def seed_database(db: Session):
    existing_rooms = db.query(Room).count()
    if existing_rooms > 0:
        logger.info(f"Database already seeded with {existing_rooms} rooms, skipping...")
        return
    
    logger.info("Seeding database with initial data...")
    
    rooms_data = [
        {"name": "kitchen", "description": "La cucina della Escape House - contiene frigo, forno, cassetti e altri elementi interattivi"},
        {"name": "livingroom", "description": "Il soggiorno - TV, divano, libreria e puzzle nascosti"},
        {"name": "bathroom", "description": "Il bagno - specchio, lavandino, doccia con enigmi"},
        {"name": "bedroom", "description": "La camera da letto - letto, armadio, comodino con segreti"},
        {"name": "greenhouse", "description": "La serra - piante, luci, sensori di temperatura"},
        {"name": "gate", "description": "Il cancello d'ingresso - servo motore, sensore IR, serratura"},
    ]
    
    rooms = {}
    for room_data in rooms_data:
        room = Room(**room_data)
        db.add(room)
        db.flush()
        rooms[room_data["name"]] = room
    
    elements_data = [
        {"room": "kitchen", "name": "fridge", "type": ElementType.actuator, "mqtt_topic": "escape/kitchen/fridge/state", "current_state": {"open": False, "temperature": 4}},
        {"room": "kitchen", "name": "fridge-door", "type": ElementType.sensor, "mqtt_topic": "escape/kitchen/fridge/door", "current_state": {"open": False}},
        {"room": "kitchen", "name": "oven", "type": ElementType.actuator, "mqtt_topic": "escape/kitchen/oven/state", "current_state": {"on": False, "temperature": 0}},
        {"room": "kitchen", "name": "drawer", "type": ElementType.actuator, "mqtt_topic": "escape/kitchen/drawer/state", "current_state": {"open": False}},
        {"room": "kitchen", "name": "gas-valve", "type": ElementType.switch, "mqtt_topic": "escape/kitchen/gas-valve/state", "current_state": {"open": False}},
        {"room": "kitchen", "name": "window", "type": ElementType.actuator, "mqtt_topic": "escape/kitchen/window/state", "current_state": {"open": False}},
        {"room": "kitchen", "name": "pot-weight", "type": ElementType.sensor, "mqtt_topic": "escape/kitchen/pot/weight", "current_state": {"weight": 0}},
        {"room": "kitchen", "name": "kitchen-light", "type": ElementType.light, "mqtt_topic": "escape/kitchen/light/state", "current_state": {"on": True, "brightness": 100}},
        
        {"room": "livingroom", "name": "tv", "type": ElementType.actuator, "mqtt_topic": "escape/livingroom/tv/state", "current_state": {"on": False, "channel": 1}},
        {"room": "livingroom", "name": "bookshelf", "type": ElementType.sensor, "mqtt_topic": "escape/livingroom/bookshelf/state", "current_state": {"secret_found": False}},
        {"room": "livingroom", "name": "sofa-cushion", "type": ElementType.sensor, "mqtt_topic": "escape/livingroom/sofa/cushion", "current_state": {"pressed": False}},
        {"room": "livingroom", "name": "livingroom-light", "type": ElementType.light, "mqtt_topic": "escape/livingroom/light/state", "current_state": {"on": True, "brightness": 100}},
        
        {"room": "bathroom", "name": "mirror", "type": ElementType.display, "mqtt_topic": "escape/bathroom/mirror/state", "current_state": {"message": ""}},
        {"room": "bathroom", "name": "sink", "type": ElementType.sensor, "mqtt_topic": "escape/bathroom/sink/state", "current_state": {"water_running": False}},
        {"room": "bathroom", "name": "shower", "type": ElementType.actuator, "mqtt_topic": "escape/bathroom/shower/state", "current_state": {"on": False}},
        {"room": "bathroom", "name": "bathroom-light", "type": ElementType.light, "mqtt_topic": "escape/bathroom/light/state", "current_state": {"on": True, "brightness": 100}},
        
        {"room": "bedroom", "name": "wardrobe", "type": ElementType.actuator, "mqtt_topic": "escape/bedroom/wardrobe/state", "current_state": {"open": False, "locked": True}},
        {"room": "bedroom", "name": "nightstand", "type": ElementType.sensor, "mqtt_topic": "escape/bedroom/nightstand/drawer", "current_state": {"open": False}},
        {"room": "bedroom", "name": "bed", "type": ElementType.sensor, "mqtt_topic": "escape/bedroom/bed/state", "current_state": {"occupied": False}},
        {"room": "bedroom", "name": "bedroom-light", "type": ElementType.light, "mqtt_topic": "escape/bedroom/light/state", "current_state": {"on": True, "brightness": 100}},
        
        {"room": "greenhouse", "name": "greenhouse-light", "type": ElementType.light, "mqtt_topic": "escape/greenhouse/light/active", "current_state": {"on": False, "brightness": 0}},
        {"room": "greenhouse", "name": "temperature-sensor", "type": ElementType.sensor, "mqtt_topic": "escape/greenhouse/temperature/value", "current_state": {"temperature": 22, "humidity": 60}},
        {"room": "greenhouse", "name": "water-pump", "type": ElementType.actuator, "mqtt_topic": "escape/greenhouse/pump/state", "current_state": {"on": False}},
        
        {"room": "gate", "name": "gate-servo", "type": ElementType.servo, "mqtt_topic": "escape/gate/servo/open", "current_state": {"position": 0, "open": False}},
        {"room": "gate", "name": "ir-sensor", "type": ElementType.sensor, "mqtt_topic": "escape/gate/ir-sensor/state", "current_state": {"detected": False}},
        {"room": "gate", "name": "gate-lock", "type": ElementType.lock, "mqtt_topic": "escape/gate/lock/state", "current_state": {"locked": True}},
        {"room": "gate", "name": "keypad", "type": ElementType.keypad, "mqtt_topic": "escape/gate/keypad/input", "current_state": {"code": "", "attempts": 0}},
    ]
    
    for elem_data in elements_data:
        room_name = elem_data.pop("room")
        room = rooms[room_name]
        element = Element(room_id=room.id, **elem_data)
        db.add(element)
    
    db.commit()
    logger.info(f"Database seeded with {len(rooms_data)} rooms and {len(elements_data)} elements")
