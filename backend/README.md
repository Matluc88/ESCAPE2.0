# Escape House Backend

Backend API completo per il sistema Escape House 3D - Controllo real-time di escape room con ESP32, MQTT, WebSocket e PostgreSQL.

## Architettura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ESCAPE HOUSE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Frontend   │     │   Backend    │     │  PostgreSQL  │                │
│  │   React 3D   │◄───►│   FastAPI    │◄───►│   Database   │                │
│  │  (Browser)   │ WS  │   (Python)   │ SQL │              │                │
│  └──────────────┘     └──────┬───────┘     └──────────────┘                │
│                              │                                              │
│                              │ MQTT                                         │
│                              ▼                                              │
│                       ┌──────────────┐                                      │
│                       │  Mosquitto   │                                      │
│                       │ MQTT Broker  │                                      │
│                       └──────┬───────┘                                      │
│                              │                                              │
│              ┌───────────────┼───────────────┐                              │
│              │               │               │                              │
│              ▼               ▼               ▼                              │
│       ┌──────────┐    ┌──────────┐    ┌──────────┐                         │
│       │  ESP32   │    │  ESP32   │    │  ESP32   │                         │
│       │ Kitchen  │    │ Bedroom  │    │  Gate    │                         │
│       └──────────┘    └──────────┘    └──────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Flusso dei Dati

```
ESP32 Sensor → MQTT Topic → Backend (subscribe) → DB Update → WebSocket Broadcast → Frontend Update
                                                                      ↓
Frontend Action → WebSocket → Backend → MQTT Publish → ESP32 Actuator
```

## Stack Tecnologico

- **Python 3.11** - Linguaggio backend
- **FastAPI** - Framework web async
- **SQLAlchemy** - ORM per database
- **Alembic** - Migrazioni database
- **PostgreSQL 15** - Database relazionale
- **Eclipse Mosquitto** - MQTT Broker
- **aiomqtt** - Client MQTT async per Python
- **Docker & Docker Compose** - Containerizzazione

## Struttura del Progetto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Entry point FastAPI
│   ├── config.py            # Configurazione ambiente
│   ├── database.py          # Connessione database
│   ├── api/                  # Endpoint REST
│   │   ├── __init__.py
│   │   ├── rooms.py
│   │   ├── sessions.py
│   │   ├── elements.py
│   │   └── events.py
│   ├── models/               # Modelli SQLAlchemy
│   │   ├── __init__.py
│   │   ├── room.py
│   │   ├── game_session.py
│   │   ├── element.py
│   │   └── event.py
│   ├── schemas/              # Schemi Pydantic
│   │   ├── __init__.py
│   │   ├── room.py
│   │   ├── game_session.py
│   │   ├── element.py
│   │   ├── event.py
│   │   └── websocket.py
│   ├── services/             # Business logic
│   │   ├── __init__.py
│   │   ├── room_service.py
│   │   ├── session_service.py
│   │   ├── element_service.py
│   │   └── event_service.py
│   ├── mqtt/                 # Handler MQTT
│   │   ├── __init__.py
│   │   └── handler.py
│   └── websocket/            # Handler WebSocket
│       ├── __init__.py
│       └── handler.py
├── alembic/                  # Migrazioni database
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_schema.py
├── mosquitto/
│   └── config/
│       └── mosquitto.conf
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── init-db.sql
├── requirements.txt
├── .env.example
└── README.md
```

## Schema Database

### Tabella: rooms
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| id | INTEGER (PK) | ID univoco |
| name | VARCHAR(100) | Nome stanza (unique) |
| description | TEXT | Descrizione stanza |

### Tabella: game_sessions
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| id | INTEGER (PK) | ID univoco |
| room_id | INTEGER (FK) | Riferimento a rooms |
| start_time | TIMESTAMP | Inizio sessione |
| end_time | TIMESTAMP | Fine sessione (null se attiva) |
| expected_players | INTEGER | Giocatori previsti |
| connected_players | INTEGER | Giocatori connessi |

### Tabella: elements
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| id | INTEGER (PK) | ID univoco |
| room_id | INTEGER (FK) | Riferimento a rooms |
| name | VARCHAR(100) | Nome elemento |
| type | ENUM | Tipo (sensor, actuator, light, etc.) |
| mqtt_topic | VARCHAR(255) | Topic MQTT associato |
| current_state | JSON | Stato corrente |

### Tabella: events
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| id | INTEGER (PK) | ID univoco |
| element_id | INTEGER (FK) | Riferimento a elements |
| session_id | INTEGER (FK) | Riferimento a game_sessions |
| timestamp | TIMESTAMP | Momento dell'evento |
| action | VARCHAR(100) | Azione eseguita |
| value | JSON | Valore associato |

## Variabili d'Ambiente

Copia `.env.example` in `.env` e configura:

```env
# Database
DATABASE_URL=postgresql://escape_user:escape_pass@db:5432/escape_db

# MQTT
MQTT_HOST=mqtt
MQTT_PORT=1883

# WebSocket/API
WS_PORT=3000
API_HOST=0.0.0.0

# Security
JWT_SECRET=your-secret-key-change-in-production

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## API REST Endpoints

### Rooms

#### GET /rooms
Lista tutte le stanze.

**Response:**
```json
[
  {
    "id": 1,
    "name": "kitchen",
    "description": "La cucina della Escape House"
  }
]
```

#### GET /rooms/{id}
Dettaglio singola stanza.

#### POST /rooms
Crea nuova stanza.

**Request:**
```json
{
  "name": "kitchen",
  "description": "La cucina della Escape House"
}
```

### Sessions

#### GET /sessions/active
Ritorna la sessione attiva (se esiste).

**Response:**
```json
{
  "id": 1,
  "room_id": 1,
  "start_time": "2025-12-01T12:00:00Z",
  "end_time": null,
  "expected_players": 4,
  "connected_players": 2
}
```

#### POST /sessions/start
Avvia nuova sessione.

**Request:**
```json
{
  "room_id": 1,
  "expected_players": 4
}
```

#### POST /sessions/end
Termina la sessione attiva.

### Elements

#### GET /elements/room/{room_id}
Lista elementi di una stanza.

**Response:**
```json
[
  {
    "id": 1,
    "room_id": 1,
    "name": "fridge",
    "type": "actuator",
    "mqtt_topic": "escape/kitchen/fridge/state",
    "current_state": {"open": false, "temperature": 4}
  }
]
```

#### PATCH /elements/{id}/state
Aggiorna stato elemento.

**Request:**
```json
{
  "current_state": {"open": true}
}
```

### Events

#### GET /events?sessionId=XXX
Lista eventi filtrati per sessione.

**Response:**
```json
[
  {
    "id": 1,
    "element_id": 1,
    "session_id": 1,
    "timestamp": "2025-12-01T12:05:00Z",
    "action": "open",
    "value": {"triggered_by": "player1"}
  }
]
```

## WebSocket

### Connessione
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

### Formato Messaggi

**Messaggio in ingresso (dal client):**
```json
{
  "type": "action",
  "room": "kitchen",
  "element": "fridge",
  "action": "open",
  "value": true
}
```

**Messaggio in uscita (broadcast):**
```json
{
  "type": "element_update",
  "room": "kitchen",
  "element": "fridge",
  "action": "open",
  "value": true,
  "timestamp": "2025-12-01T12:00:00Z"
}
```

### Tipi di Messaggi
- `element_update` - Aggiornamento stato elemento
- `session_update` - Aggiornamento sessione
- `event` - Nuovo evento registrato
- `ping/pong` - Keep-alive

## Struttura Topic MQTT

```
escape/<room_name>/<element_name>/<action>
```

### Esempi
```
escape/kitchen/fridge/state      # Stato frigo
escape/kitchen/fridge/door       # Sensore porta frigo
escape/kitchen/pot/weight        # Peso pentola
escape/kitchen/oven/state        # Stato forno
escape/livingroom/tv/on          # TV accesa/spenta
escape/greenhouse/light/active   # Luce serra
escape/gate/servo/open           # Servo cancello
escape/gate/ir-sensor/state      # Sensore IR
```

## Installazione e Avvio

### Prerequisiti
- Docker e Docker Compose
- Git

### Avvio Rapido

```bash
# Clona il repository
git clone https://github.com/Matluc88/escape-room-3d.git
cd escape-room-3d/backend

# Copia e configura le variabili d'ambiente
cp .env.example .env

# Avvia tutti i servizi
docker compose up -d

# Verifica lo stato
docker compose ps

# Visualizza i log
docker compose logs -f web
```

### Accesso ai Servizi
- **API Backend**: http://localhost:3000
- **API Docs (Swagger)**: http://localhost:3000/docs
- **MQTT Broker**: localhost:1883
- **MQTT WebSocket**: localhost:9001
- **PostgreSQL**: localhost:5432

## Migrazioni Database

```bash
# Genera nuova migrazione
docker compose exec web alembic revision --autogenerate -m "descrizione"

# Applica migrazioni
docker compose exec web alembic upgrade head

# Rollback ultima migrazione
docker compose exec web alembic downgrade -1

# Visualizza stato migrazioni
docker compose exec web alembic current
```

## Deploy su Render.com

### Configurazione

1. Crea un nuovo "Blueprint" su Render
2. Collega il repository GitHub
3. Render leggerà automaticamente `render.yaml`

### Variabili d'Ambiente su Render
Configura le seguenti variabili nel dashboard Render:
- `DATABASE_URL` - URL del database PostgreSQL
- `MQTT_HOST` - Host del broker MQTT
- `JWT_SECRET` - Chiave segreta per JWT

### Note
- Su Render, i container Docker vengono gestiti automaticamente
- Il database PostgreSQL può essere creato come servizio Render separato
- Per MQTT, considera CloudMQTT o HiveMQ Cloud per ambienti di test

## Deploy su Raspberry Pi

### Prerequisiti
- Raspberry Pi 4 (consigliato 4GB+ RAM)
- Raspberry Pi OS (64-bit)
- Docker e Docker Compose installati

### Installazione Docker su Raspberry Pi

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Aggiungi utente al gruppo docker
sudo usermod -aG docker $USER

# Installa Docker Compose
sudo apt install docker-compose-plugin -y

# Verifica installazione
docker --version
docker compose version
```

### Deploy

```bash
# Clona il repository
git clone https://github.com/Matluc88/escape-room-3d.git
cd escape-room-3d/backend

# Copia e configura le variabili d'ambiente
cp .env.example .env
nano .env  # Modifica le variabili se necessario

# Avvia i servizi
docker compose up -d

# Verifica che tutto funzioni
docker compose ps
curl http://localhost:3000/health
```

### Configurazione Rete Locale
Per accedere al backend da altri dispositivi nella rete locale:

```bash
# Trova l'IP del Raspberry Pi
hostname -I

# Esempio: 192.168.1.100
# Il frontend dovrà usare: VITE_WS_URL=http://192.168.1.100:3000
```

### Backup e Restore Database

**Backup:**
```bash
# Crea backup
docker compose exec db pg_dump -U escape_user escape_db > backup_$(date +%Y%m%d).sql

# Oppure con compressione
docker compose exec db pg_dump -U escape_user escape_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Restore:**
```bash
# Restore da file SQL
cat backup_20251201.sql | docker compose exec -T db psql -U escape_user escape_db

# Restore da file compresso
gunzip -c backup_20251201.sql.gz | docker compose exec -T db psql -U escape_user escape_db
```

### Migrazione da Render a Raspberry Pi

1. **Esporta database da Render:**
```bash
pg_dump -h <render-db-host> -U <user> -d <database> > render_backup.sql
```

2. **Copia sul Raspberry Pi:**
```bash
scp render_backup.sql pi@<raspberry-ip>:~/escape-room-3d/backend/
```

3. **Importa nel database locale:**
```bash
cat render_backup.sql | docker compose exec -T db psql -U escape_user escape_db
```

### Avvio Automatico al Boot

```bash
# Crea servizio systemd
sudo nano /etc/systemd/system/escape-house.service
```

Contenuto del file:
```ini
[Unit]
Description=Escape House Backend
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/pi/escape-room-3d/backend
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
# Abilita il servizio
sudo systemctl enable escape-house.service
sudo systemctl start escape-house.service
```

## Troubleshooting

### Il backend non si connette al database
```bash
# Verifica che il container db sia attivo
docker compose ps

# Controlla i log del database
docker compose logs db

# Verifica la connessione
docker compose exec db psql -U escape_user -d escape_db -c "SELECT 1"
```

### MQTT non riceve messaggi
```bash
# Verifica che Mosquitto sia attivo
docker compose logs mqtt

# Test con mosquitto_sub
docker compose exec mqtt mosquitto_sub -t "escape/#" -v
```

### WebSocket non si connette
```bash
# Verifica i log del backend
docker compose logs web

# Test endpoint health
curl http://localhost:3000/health
```

## Sviluppo Locale

### Senza Docker

```bash
# Crea virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# oppure: venv\Scripts\activate  # Windows

# Installa dipendenze
pip install -r requirements.txt

# Configura variabili d'ambiente
export DATABASE_URL=postgresql://user:pass@localhost:5432/escape
export MQTT_HOST=localhost
export MQTT_PORT=1883

# Avvia il server
uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

### Test API con curl

```bash
# Health check
curl http://localhost:3000/health

# Lista stanze
curl http://localhost:3000/rooms

# Crea stanza
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d '{"name": "test-room", "description": "Test"}'

# Avvia sessione
curl -X POST http://localhost:3000/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"room_id": 1, "expected_players": 2}'
```

## Licenza

ISC

## Autore

Sviluppato da [@Matluc88](https://github.com/Matluc88)
