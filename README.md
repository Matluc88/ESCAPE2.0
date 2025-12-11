# Escape Room 3D

Un'applicazione web interattiva di Escape Room in 3D costruita con React, Three.js e Vite.

## 🎮 Caratteristiche

- **Interfaccia 3D interattiva** con Three.js e React Three Fiber
- **Multiplayer support** (preparato per WebSocket)
- **Routing dinamico** con React Router
- **State management** con Zustand
- **4 stanze diverse**: Cucina, Soggiorno, Bagno, Camera
- **Oggetti cliccabili** in 3D con feedback visivo

## 🚀 Setup

### Prerequisiti

- Node.js (v16 o superiore)
- npm o yarn

### Installazione

```bash
# Clona il repository
git clone https://github.com/Matluc88/escape-room-3d.git
cd escape-room-3d

# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

## 📁 Struttura del Progetto

```
react-3d-app/
├── public/
│   └── models/          # File .glb per modelli 3D (futuro)
├── src/
│   ├── api/             # Utility per chiamate API
│   ├── components/
│   │   ├── scenes/      # Scene 3D (KitchenScene, ecc.)
│   │   └── UI/          # Componenti UI
│   ├── hooks/           # Custom hooks (useWebSocket)
│   ├── pages/           # Pagine principali (Home, RoomScene, Victory)
│   ├── store/           # Zustand store
│   ├── utils/           # Utility functions (api.js)
│   ├── App.jsx          # Componente principale con routing
│   ├── App.css          # Stili globali
│   └── main.jsx         # Entry point
├── .env.example         # Variabili d'ambiente di esempio
├── package.json
└── vite.config.js
```

## 🎯 Come Giocare

1. **Home Page**: Crea una nuova sessione o unisciti a una esistente
2. **Scegli una stanza**: Cucina, Soggiorno, Bagno, o Camera
3. **Esplora la scena 3D**: Usa il mouse per ruotare la vista (OrbitControls)
4. **Clicca sugli oggetti**: Interagisci con gli oggetti per risolvere enigmi

## 🛠️ Tecnologie Utilizzate

- **React 19** - Framework UI
- **Vite** - Build tool e dev server
- **Three.js** - Rendering 3D
- **@react-three/fiber** - React renderer per Three.js
- **@react-three/drei** - Helper per React Three Fiber
- **React Router** - Routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Socket.io-client** - WebSocket (preparato per multiplayer)
- **Vitest** - Testing framework

## 📝 Script Disponibili

```bash
# Sviluppo
npm run dev          # Avvia dev server

# Build
npm run build        # Build per produzione
npm run preview      # Preview build di produzione

# Testing
npm test             # Esegue test in watch mode
npm run test:run     # Esegue test una volta
npm run test:ui      # Apre UI per i test
```

## 🔧 Configurazione

Copia `.env.example` in `.env` e configura le variabili:

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## 🚧 Roadmap

- [ ] Implementare backend FastAPI
- [ ] Aggiungere WebSocket per multiplayer real-time
- [ ] Creare modelli 3D personalizzati per le stanze
- [ ] Implementare sistema di enigmi e puzzle
- [ ] Aggiungere audio e effetti sonori
- [ ] Implementare sistema di inventario
- [ ] Aggiungere altre stanze (Soggiorno, Bagno, Camera)

## 👥 Contribuire

Questo è un progetto in sviluppo. Pull request e suggerimenti sono benvenuti!

## 📄 Licenza

ISC

## 👨‍💻 Autore

Sviluppato da [@Matluc88](https://github.com/Matluc88)

---

**Nota**: Il backend non è ancora implementato. L'applicazione usa un fallback a "test-123" per le sessioni.
