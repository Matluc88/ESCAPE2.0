# MQTT Test Guide - ESP32 Fridge Light

Questa guida spiega come utilizzare il test automatico MQTT per verificare il funzionamento dell'ESP32 che controlla la luce del frigo nell'Escape Room.

## 📋 Prerequisiti

1. **ESP32 attivo su Wokwi**: Il simulatore ESP32 deve essere in esecuzione su Wokwi
2. **Connessione MQTT**: L'ESP32 deve essere connesso al broker MQTT (broker.hivemq.com)
3. **Node.js**: Installato sul sistema (v16 o superiore)
4. **Dipendenze**: Eseguire `npm install` nella directory del progetto

## 🚀 Come Eseguire il Test

### Metodo 1: Esecuzione Diretta

```bash
node test-mqtt-fridge.js
```

### Metodo 2: Esecuzione come Script npm

Aggiungi al `package.json` nella sezione `scripts`:

```json
"test:mqtt": "node test-mqtt-fridge.js"
```

Poi esegui:

```bash
npm run test:mqtt
```

## 🧪 Cosa Fa il Test

Il test esegue automaticamente la seguente sequenza:

1. **Connessione al Broker MQTT**
   - Broker: `broker.hivemq.com:1883`
   - Connessione anonima (nessuna autenticazione richiesta)

2. **Sottoscrizione al Topic di Stato**
   - Topic: `home/cucina/frigo/stato`
   - Riceve le risposte dall'ESP32

3. **Esecuzione Test Sequenziali**
   - **Test 1**: Invia `ON` → Aspetta risposta `ACCESO`
   - **Test 2**: Invia `OFF` → Aspetta risposta `SPENTO`
   - **Test 3**: Invia `ON` → Aspetta risposta `ACCESO`
   - **Test 4**: Invia `OFF` → Aspetta risposta `SPENTO`

4. **Report Finale**
   - Mostra risultati di ogni test
   - Calcola tasso di successo
   - Indica tempo di risposta per ogni comando

## 📊 Output del Test

### Esempio di Output Positivo

```
🚀 Starting MQTT Test Suite for ESP32 Fridge Light

🔌 Connecting to MQTT broker: mqtt://broker.hivemq.com:1883
✅ Connected to MQTT broker

📡 Subscribing to status topic: home/cucina/frigo/stato
✅ Subscribed to status topic

============================================================
🧪 TEST 1: Sending "ON" - Expecting "ACCESO"
============================================================
📤 Sending command: "ON" to topic: home/cucina/frigo/comando
📥 Received response: "ACCESO" (234ms)
✅ TEST 1 PASSED: Response matches expected value

============================================================
🧪 TEST 2: Sending "OFF" - Expecting "SPENTO"
============================================================
📤 Sending command: "OFF" to topic: home/cucina/frigo/comando
📥 Received response: "SPENTO" (187ms)
✅ TEST 2 PASSED: Response matches expected value

...

============================================================
📊 FINAL TEST REPORT
============================================================

Total Tests: 4
Passed: 4
Failed: 0
Success Rate: 100.0%

🎉 ALL TESTS PASSED! The ESP32 is working correctly.
```

### Esempio di Output con Errori

```
============================================================
🧪 TEST 1: Sending "ON" - Expecting "ACCESO"
============================================================
📤 Sending command: "ON" to topic: home/cucina/frigo/comando
❌ TEST 1 FAILED: Timeout: No response received within 5000ms

...

============================================================
📊 FINAL TEST REPORT
============================================================

Total Tests: 4
Passed: 2
Failed: 2
Success Rate: 50.0%

⚠️  SOME TESTS FAILED. Please check the ESP32 connection and code.
```

## 🔧 Configurazione

### Timeout

Il timeout predefinito per ogni test è di **5 secondi**. Puoi modificarlo nel file `test-mqtt-fridge.js`:

```javascript
const TEST_TIMEOUT = 5000; // 5 seconds
```

### Delay tra Test

Il delay tra un test e l'altro è di **1 secondo**. Puoi modificarlo:

```javascript
const DELAY_BETWEEN_TESTS = 1000; // 1 second
```

### Topic MQTT

I topic MQTT sono configurati come costanti:

```javascript
const COMMAND_TOPIC = 'home/cucina/frigo/comando';
const STATUS_TOPIC = 'home/cucina/frigo/stato';
```

## 🐛 Troubleshooting

### Problema: "Connection error"

**Causa**: Impossibile connettersi al broker MQTT

**Soluzione**:
- Verifica la connessione internet
- Controlla che il broker `broker.hivemq.com` sia raggiungibile
- Prova con un altro broker MQTT pubblico

### Problema: "Timeout: No response received"

**Causa**: L'ESP32 non risponde ai comandi

**Soluzione**:
- Verifica che l'ESP32 sia in esecuzione su Wokwi
- Controlla che l'ESP32 sia connesso al broker MQTT
- Verifica i log dell'ESP32 per errori
- Controlla che i topic MQTT siano corretti

### Problema: "Expected X, got Y"

**Causa**: L'ESP32 risponde con un valore diverso da quello atteso

**Soluzione**:
- Verifica il codice ESP32
- Controlla che i messaggi siano case-sensitive (ON/OFF, ACCESO/SPENTO)
- Verifica la logica di risposta nell'ESP32

## 📝 Note Importanti

1. **Case Sensitivity**: I comandi MQTT sono case-sensitive
   - Comandi: `ON`, `OFF` (tutto maiuscolo)
   - Risposte: `ACCESO`, `SPENTO` (tutto maiuscolo)

2. **Broker Pubblico**: Il broker HiveMQ è pubblico e condiviso
   - Altri utenti potrebbero usare gli stessi topic
   - Per test privati, considera l'uso di topic univoci

3. **Timeout**: Se i test falliscono per timeout, aumenta il valore di `TEST_TIMEOUT`

4. **Wokwi**: Assicurati che il simulatore Wokwi sia attivo durante i test

## 🔗 Integrazione con l'Escape Room

Questo test può essere integrato nell'applicazione React per:

1. **Test Automatici**: Verificare la connessione ESP32 prima di iniziare il gioco
2. **Diagnostica**: Controllare lo stato dei dispositivi IoT
3. **Monitoraggio**: Verificare che tutti i dispositivi rispondano correttamente

Per integrare il test nell'app React, considera l'uso di:
- `mqtt` library nel browser
- WebSocket bridge per MQTT
- Backend proxy per gestire le connessioni MQTT

## 📚 Riferimenti

- **Broker MQTT**: [HiveMQ Public Broker](https://www.hivemq.com/mqtt/public-mqtt-broker/)
- **MQTT.js**: [Documentazione](https://github.com/mqttjs/MQTT.js)
- **Wokwi ESP32**: [Simulatore](https://wokwi.com/)
