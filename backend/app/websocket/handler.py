import asyncio
import logging
from typing import Dict, Any, Set
from datetime import datetime
import socketio

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

socket_app = socketio.ASGIApp(sio)

active_sessions: Dict[str, Set[str]] = {}
player_info: Dict[str, Dict[str, Any]] = {}


@sio.event
async def connect(sid, environ):
    logger.info(f"Socket.IO client connected: {sid}")


@sio.event
async def disconnect(sid):
    logger.info(f"Socket.IO client disconnected: {sid}")
    if sid in player_info:
        info = player_info[sid]
        session_id = info.get('sessionId')
        room = info.get('room')
        player_name = info.get('playerName')
        
        if session_id and session_id in active_sessions:
            active_sessions[session_id].discard(sid)
            
            await sio.emit('playerLeft', {
                'playerName': player_name,
                'room': room
            }, room=session_id)
        
        del player_info[sid]


@sio.event
async def joinSession(sid, data):
    session_id = data.get('sessionId')
    room = data.get('room')
    player_name = data.get('playerName', 'Guest')
    
    logger.info(f"Player {player_name} joining session {session_id} in room {room}")
    
    player_info[sid] = {
        'sessionId': session_id,
        'room': room,
        'playerName': player_name
    }
    
    if session_id not in active_sessions:
        active_sessions[session_id] = set()
    active_sessions[session_id].add(sid)
    
    await sio.enter_room(sid, session_id)
    await sio.enter_room(sid, f"{session_id}:{room}")
    
    await sio.emit('playerJoined', {
        'playerName': player_name,
        'room': room
    }, room=session_id, skip_sid=sid)
    
    initial_state = {
        'objectStates': {
            'forno': 'off',
            'frigo': 'off',
            'cassetto': 'chiuso',
            'valvola_gas': 'chiusa',
            'finestra': 'chiusa'
        },
        'completed': [],
        'currentPuzzle': None
    }
    
    await sio.emit('sessionState', initial_state, to=sid)


@sio.event
async def playerAction(sid, data):
    session_id = data.get('sessionId')
    room = data.get('room')
    player_name = data.get('playerName', 'Guest')
    action = data.get('action')
    target = data.get('target')
    
    logger.info(f"Player {player_name} action: {action} on {target} in {room}")
    
    new_state = 'on' if action == 'on' else ('aperto' if action == 'open' else ('off' if action == 'off' else 'chiuso'))
    
    await sio.emit('actionSuccess', {
        'message': f'{target} {action}',
        'sessionState': {
            'objectStates': {
                target: new_state
            }
        }
    }, to=sid)
    
    await sio.emit('globalStateUpdate', {
        'objectStates': {
            target: new_state
        },
        'updatedBy': player_name,
        'room': room
    }, room=session_id, skip_sid=sid)


async def broadcast_element_update(room_name: str, element: str, action: str, value: Any):
    message = {
        'type': 'element_update',
        'room': room_name,
        'element': element,
        'action': action,
        'value': value,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    await sio.emit('globalNotification', {
        'message': f'{element} in {room_name}: {action}'
    })
    await sio.emit('globalStateUpdate', message)


async def broadcast_to_session(session_id: str, event: str, data: Dict[str, Any]):
    await sio.emit(event, data, room=session_id)


async def send_notification(session_id: str, message: str):
    await sio.emit('globalNotification', {'message': message}, room=session_id)


class WebSocketHandler:
    def __init__(self):
        self.sio = sio
        self.socket_app = socket_app

    async def broadcast_element_update(self, room_name: str, element: str, action: str, value: Any):
        await broadcast_element_update(room_name, element, action, value)

    async def broadcast_to_session(self, session_id: str, event: str, data: Dict[str, Any]):
        await broadcast_to_session(session_id, event, data)

    async def send_notification(self, session_id: str, message: str):
        await send_notification(session_id, message)

    @property
    def connection_count(self) -> int:
        return len(player_info)


ws_handler = WebSocketHandler()
