# 📦 Specifiche Modelli 3D - Escape Room

## Formato
- **File**: `.glb` (GLTF Binary)
- **Uno per stanza**: cucina.glb, soggiorno.glb, bagno.glb, camera.glb
- **Contenuto**: Ambiente completo + tutti oggetti in UN file

## Nomi File Richiesti
```
public/models/cucina.glb
public/models/soggiorno.glb
public/models/bagno.glb
public/models/camera.glb
```

## Oggetti Interattivi (Nomi Blender)

### 🍳 Cucina
- `Forno` 
- `Frigo`
- `Cassetto`
- `ValvolaGas`
- `Finestra`

### 📺 Soggiorno
- `TV`
- `QuadroElettrico`
- `Tende`
- `Luci`

### 🚿 Bagno
- `Rubinetto`
- `Specchio`
- `Ventola`

### 🛏️ Camera
- `Letto`
- `Armadio`
- `Lampade`

## ⚠️ IMPORTANTE
Gli oggetti cliccabili DEVONO avere ESATTAMENTE questi nomi in Blender (case-sensitive).

## Specifiche Tecniche
- **Scala**: 1 unità = 1 metro
- **Dimensioni stanza**: ~4m x 4m x 3m altezza
- **Poligoni**: Max 500k triangoli per stanza
- **Texture**: Max 2048x2048px
- **Materiali**: PBR (Metallic/Roughness)
- **Pivot**: Centro oggetto
- **File size**: <5MB per stanza

## Esportazione Blender
Quando esporti:
- ✓ Format: glTF Binary (.glb)
- ✓ Include: Selected Objects
- ✓ Transform: +Y Up
- ✓ Geometry: Apply Modifiers
- ✓ Materials: Export
- ✓ Compression: Draco (opzionale se <2MB)

## Test Pre-Consegna
1. Apri in https://gltf-viewer.donmccurdy.com/
2. Verifica nomi oggetti nel pannello "Scene"
3. Controlla dimensioni file
4. Testa rotazione/zoom camera

## Consigli Ottimizzazione
- Unisci mesh non interattivi
- Atlas texture dove possibile
- Riduci poligoni su oggetti lontani
- Usa normal maps per dettagli

---

## ✅ CHECKLIST MODELLI 3D

□ 4 file .glb (cucina, soggiorno, bagno, camera)
□ Ogni file contiene stanza completa (ambiente + oggetti)
□ Oggetti cliccabili con nomi ESATTI da documento
□ Nomi case-sensitive (es. "Forno" non "forno")
□ Scala 1:1 (1 unità = 1 metro)
□ File <5MB per stanza
□ Testato in gltf-viewer
□ Materiali PBR applicati
□ Tutti gli oggetti hanno pivot corretto
