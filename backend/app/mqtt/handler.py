import asyncio
import json
import logging
from typing import Callable, Optional, Dict, Any
from aiomqtt import Client, MqttError
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class MQTTHandler:
    def __init__(self):
        self.client: Optional[Client] = None
        self.connected = False
        self.message_callback: Optional[Callable] = None
        self._reconnect_interval = 5
        self._running = False

    async def connect(self):
        self._running = True
        while self._running:
            try:
                async with Client(
                    hostname=settings.mqtt_host,
                    port=settings.mqtt_port,
                    identifier="escape-backend"
                ) as client:
                    self.client = client
                    self.connected = True
                    logger.info(f"Connected to MQTT broker at {settings.mqtt_host}:{settings.mqtt_port}")
                    
                    await client.subscribe("escape/#")
                    logger.info("Subscribed to escape/# topics")
                    
                    async for message in client.messages:
                        await self._handle_message(message)
                        
            except MqttError as e:
                self.connected = False
                logger.error(f"MQTT connection error: {e}")
                if self._running:
                    logger.info(f"Reconnecting in {self._reconnect_interval} seconds...")
                    await asyncio.sleep(self._reconnect_interval)
            except Exception as e:
                self.connected = False
                logger.error(f"Unexpected MQTT error: {e}")
                if self._running:
                    await asyncio.sleep(self._reconnect_interval)

    async def disconnect(self):
        self._running = False
        self.connected = False
        logger.info("MQTT handler disconnected")

    async def _handle_message(self, message):
        try:
            topic = str(message.topic)
            payload = message.payload.decode("utf-8")
            
            logger.debug(f"MQTT message received: {topic} -> {payload}")
            
            parsed_data = self._parse_topic(topic)
            
            try:
                value = json.loads(payload)
            except json.JSONDecodeError:
                value = payload
            
            parsed_data["value"] = value
            parsed_data["raw_topic"] = topic
            
            if self.message_callback:
                await self.message_callback(parsed_data)
                
        except Exception as e:
            logger.error(f"Error handling MQTT message: {e}")

    def _parse_topic(self, topic: str) -> Dict[str, Any]:
        parts = topic.split("/")
        result = {
            "room": None,
            "element": None,
            "action": None
        }
        
        if len(parts) >= 2:
            result["room"] = parts[1]
        if len(parts) >= 3:
            result["element"] = parts[2]
        if len(parts) >= 4:
            result["action"] = parts[3]
            
        return result

    async def publish(self, topic: str, payload: Any, retain: bool = False):
        if not self.client or not self.connected:
            logger.warning("Cannot publish: MQTT not connected")
            return False
            
        try:
            if isinstance(payload, dict):
                payload = json.dumps(payload)
            elif not isinstance(payload, str):
                payload = str(payload)
                
            await self.client.publish(topic, payload, retain=retain)
            logger.debug(f"Published to {topic}: {payload}")
            return True
        except Exception as e:
            logger.error(f"Error publishing to MQTT: {e}")
            return False

    def set_message_callback(self, callback: Callable):
        self.message_callback = callback


mqtt_handler = MQTTHandler()
