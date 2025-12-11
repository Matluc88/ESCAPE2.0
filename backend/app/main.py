import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.api import rooms_router, sessions_router, elements_router, events_router
from app.mqtt.handler import mqtt_handler
from app.websocket.handler import ws_handler, socket_app
from app.services.element_service import ElementService
from app.services.event_service import EventService
from app.services.session_service import SessionService
from app.services.seed_service import seed_database
from app.schemas.event import EventCreate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


async def handle_mqtt_message(data: dict):
    logger.info(f"Processing MQTT message: {data}")
    
    db = SessionLocal()
    try:
        element_service = ElementService(db)
        event_service = EventService(db)
        session_service = SessionService(db)
        
        topic = data.get("raw_topic", "")
        element = element_service.get_by_mqtt_topic(topic)
        
        if element:
            new_state = {"value": data.get("value"), "action": data.get("action")}
            element_service.update_state_by_topic(topic, new_state)
            
            active_session = session_service.get_active()
            session_id = active_session.id if active_session else None
            
            event_data = EventCreate(
                element_id=element.id,
                session_id=session_id,
                action=data.get("action", "update"),
                value={"mqtt_value": data.get("value")}
            )
            event_service.create(event_data)
            
            await ws_handler.broadcast_element_update(
                room=data.get("room", "unknown"),
                element=data.get("element", "unknown"),
                action=data.get("action", "update"),
                value=data.get("value")
            )
            
            logger.info(f"Updated element {element.name} from MQTT")
        else:
            logger.debug(f"No element found for topic: {topic}")
            
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Escape House Backend...")
    
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    logger.info("Database seeding complete")
    
    mqtt_handler.set_message_callback(handle_mqtt_message)
    mqtt_task = asyncio.create_task(mqtt_handler.connect())
    logger.info("MQTT handler started")
    
    yield
    
    logger.info("Shutting down...")
    await mqtt_handler.disconnect()
    mqtt_task.cancel()
    try:
        await mqtt_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutdown complete")


app = FastAPI(
    title="Escape House Backend",
    description="Backend API for Escape House 3D - Real-time escape room control system",
    version="1.0.0",
    lifespan=lifespan
)

origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms_router)
app.include_router(sessions_router)
app.include_router(elements_router)
app.include_router(events_router)


@app.get("/")
def root():
    return {
        "name": "Escape House Backend",
        "version": "1.0.0",
        "status": "running",
        "mqtt_connected": mqtt_handler.connected,
        "websocket_connections": ws_handler.connection_count
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "mqtt": "connected" if mqtt_handler.connected else "disconnected",
        "websocket_clients": ws_handler.connection_count
    }


app.mount("/socket.io", socket_app)


@app.post("/mqtt/publish")
async def publish_mqtt(topic: str, payload: str):
    success = await mqtt_handler.publish(topic, payload)
    return {"success": success, "topic": topic}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.ws_port,
        reload=True
    )
