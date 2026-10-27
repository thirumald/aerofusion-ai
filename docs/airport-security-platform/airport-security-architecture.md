# Integrated Airport Security Platform — Technical Architecture, Data Schemas and Event Definitions

Version 1.0 · Scope: Video Analytics (VA), Screening (X-ray/CT/AIT/ETD), IoT, Identity/Biometrics, Journey Graph, Incident Management

---

## 1. Design principles

1. **Event-first.** Every sensor, analytic and system emits immutable, timestamped events to one bus. State is derived from events.
2. **Edge for perception, core for reasoning.** Raw video stays at the edge or site. Only metadata (events, embeddings, short evidence clips) moves up.
3. **Tokenised identity.** Analytics never see names or document numbers. They see `subject_id` (a pseudonymous token). The linkage to the real identity lives in a separate, tightly controlled vault.
4. **Biometrics isolated.** Face/iris templates live in a Biometric Vault with its own keys, access policy and retention.
5. **Human in the loop.** Watchlist hits, weapon detections and abandoned-bag alarms are leads. A trained operator confirms before any action.
6. **Vendor-neutral.** Adapters convert vendor protocols to the canonical schema. Models are swappable behind a stable inference contract.
7. **Policy-driven features.** A policy engine switches features (e.g. 1:N face search) on/off per jurisdiction, zone and role.
8. **Degrade gracefully.** If AI or the core is down, checkpoints and cameras still work in manual mode. Edge nodes buffer events.

---

## 2. Logical architecture

```
┌────────────────────────────── L0 DEVICES ───────────────────────────────┐
│ CCTV/PTZ/Thermal | X-ray/CT/AIT/ETD | Kiosk/E-gate/Boarding | BLE/UWB/Wi-Fi │
│ Door/Lock/Seat/Bin sensors | RFID readers | Belt cameras | Radar/Fence | Drones │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ ONVIF/RTSP, DICOS, OPC-UA, MQTT, REST, SFTP
┌───────────────▼─────────── L1 EDGE (per terminal zone) ──────────────────┐
│ Device Adapters │ Stream Ingest │ Edge Inference (detect/track/ReID/ATR) │
│ Local Event Buffer (NATS JetStream/Kafka-lite) │ Anonymiser │ Edge Policy  │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ mTLS, Protobuf/JSON events, evidence clips (S3 API)
┌───────────────▼──────────── L2 SITE/CORE PLATFORM ───────────────────────┐
│ Event Bus (Kafka)                                                         │
│ ├─ Stream processors (Flink/Kafka Streams): fusion, dedupe, windowing     │
│ ├─ Identity & Journey Service  ── Journey Graph (Postgres + Neo4j/AGE)    │
│ ├─ Biometric Service ── Biometric Vault (HSM-backed) ── 1:1 / 1:N match   │
│ ├─ Screening Service (ATR results, bag↔subject binding)                   │
│ ├─ Unattended Object Service                                              │
│ ├─ Search Service (attribute + vector search: OpenSearch + Milvus)        │
│ ├─ Correlation & Risk Engine (rules + ML score)                           │
│ ├─ Incident & Case Service + SOP Workflow (Camunda/Temporal)              │
│ ├─ Policy Engine (OPA) │ Consent Service │ Audit Service                  │
│ ├─ Digital Twin / Analytics (ClickHouse/TimescaleDB)                      │
│ └─ Object store (video, images, DICOS) with WORM evidence bucket          │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ REST/gRPC/WebSocket/GraphQL, Webhooks
┌───────────────▼────────────── L3 CONSUMERS ──────────────────────────────┐
│ Command & Control UI │ Screener workstation │ Guard mobile app            │
│ AODB/A-CDM │ DCS (airline) │ BHS │ Border/Police │ Passenger app │ SIEM   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Component responsibilities

| Component | Responsibility | Suggested tech |
|---|---|---|
| Device Adapters | Translate vendor protocol → canonical event / media | Go/Rust, ONVIF, DICOS lib, OPC-UA, MQTT |
| Edge Inference | Person/object detection, tracking, Re-ID embeddings, attribute extraction, ATR inference, face quality | NVIDIA Triton/DeepStream, TensorRT, OpenVINO |
| Event Bus | Durable ordered log, replay | Kafka (core), NATS JetStream (edge) |
| Stream Processing | Cross-camera association, bag-owner binding, dwell timers, dedupe | Flink / Kafka Streams |
| Journey Graph | Entities and relationships: subject, bag, boarding pass, flight, tracks | PostgreSQL + Apache AGE or Neo4j |
| Biometric Service | Enrol, 1:1 verify, 1:N identify, liveness verdicts | Vendor SDK behind gRPC contract |
| Biometric Vault | Encrypted templates, per-record keys, TTL | PostgreSQL + pgcrypto/HSM or dedicated vault |
| Search Service | Attribute filters + embedding similarity over recorded sightings | OpenSearch + Milvus/FAISS |
| Correlation/Risk Engine | Fuse signals into scored incidents | Drools/CEL rules + gradient-boosted model |
| Incident/Case + Workflow | Lifecycle, SOP steps, tasks, evidence | Temporal/Camunda, PostgreSQL |
| Policy Engine | Authorisation + feature gating | Open Policy Agent |
| Consent Service | Records, scope and expiry of passenger consent | PostgreSQL |
| Audit Service | Tamper-evident log of every sensitive query/action | Append-only store with hash chain |
| Time-series / Analytics | Queue times, heatmaps, KPIs | ClickHouse / TimescaleDB |
| Object Store | Clips, snapshots, DICOS images | S3-compatible with object lock |

### 2.2 Deployment topology

- **Edge nodes:** 1 per terminal zone (~100–200 camera streams per GPU server, depending on models). Active/standby pair.
- **Site core:** 3-node Kafka + Kubernetes cluster at airport data centre. A second site or cloud region for DR.
- **Optional cloud:** model training, long-term analytics. Never raw biometrics unless policy allows.
- **Networks:** separate VLANs/VRFs for (a) cameras/IoT, (b) screening equipment, (c) platform, (d) external integrations. One-way gateways to the airline and border systems where required.

---

## 3. Event bus design

### 3.1 Topic naming

`<env>.<domain>.<entity>.<event>.v<major>` — e.g. `prod.va.track.updated.v1`

| Topic | Partition key | Retention | Notes |
|---|---|---|---|
| `va.detection.observed.v1` | `camera_id` | 24 h | High volume; edge-local mostly |
| `va.track.updated.v1` | `local_track_id` | 7 d | Single-camera tracks |
| `va.sighting.recorded.v1` | `subject_id` or `anon_track_id` | 30 d (policy) | Cross-camera sightings (indexed) |
| `va.object.static_detected.v1` | `zone_id` | 7 d | Candidate abandoned objects |
| `va.behaviour.anomaly.v1` | `zone_id` | 30 d | |
| `id.biometric.verified.v1` | `subject_id` | 30 d | No template in payload |
| `id.biometric.identified.v1` | `subject_id` | 30 d | |
| `id.document.verified.v1` | `subject_id` | 30 d | |
| `scr.scan.completed.v1` | `bag_id` | 90 d | Bag + ATR verdict |
| `scr.alarm.raised.v1` | `lane_id` | 90 d | |
| `scr.alarm.adjudicated.v1` | `lane_id` | 90 d | |
| `bag.bag.status_changed.v1` | `bag_id` | 90 d | RFID/BHS |
| `iot.sensor.reading.v1` | `device_id` | 7 d | |
| `iot.door.state_changed.v1` | `door_id` | 90 d | |
| `iot.position.updated.v1` | `device_ref` | 24 h | BLE/UWB/Wi-Fi |
| `jny.subject.created.v1` etc. | `subject_id` | 1 y | Journey lifecycle |
| `jny.boarding.status_changed.v1` | `flight_id` | 1 y | |
| `inc.incident.*.v1` | `incident_id` | 7 y (or legal) | |
| `case.missing_person.*.v1` | `case_id` | per law | |
| `sys.audit.recorded.v1` | `actor_id` | 7 y | WORM |
| `sys.device.health.v1` | `device_id` | 30 d | |

### 3.2 Canonical event envelope (CloudEvents 1.0 compatible)

```json
{
  "specversion": "1.0",
  "id": "01JC7K3Y8N5Q6W2R9T4V1XZ0AB",
  "source": "urn:airport:XYZ:edge:T1-ZoneB:cam-0412",
  "type": "va.sighting.recorded",
  "dataschema": "https://schemas.airport.example/va/sighting-recorded/1.0.0",
  "time": "2026-10-26T09:41:12.381Z",
  "subject": "sub_9f3c...",
  "datacontenttype": "application/json",
  "correlationid": "01JC7K3Y8N5Q6W2R9T4V1XZ0AA",
  "causationid": "01JC7K3Y8N5Q6W2R9T4V1XZ099",
  "ext": {
    "site": "XYZ",
    "terminal": "T1",
    "zone_id": "T1-B-CHK-02",
    "classification": "RESTRICTED",
    "retention_class": "R30",
    "producer_version": "edge-va@2.4.1",
    "model": { "name": "reid-r50", "version": "2026.08" },
    "clock": { "source": "PTP", "skew_ms": 3 },
    "signature": "base64(ed25519)"
  },
  "data": { }
}
```

Rules:
- `id` is a ULID (sortable, unique). Consumers deduplicate on `id`.
- `time` is event time (UTC, ms). Ingest time is added by the bus.
- All devices sync to PTP/NTP. Events with skew > 500 ms are flagged.
- `data` is validated against JSON Schema (or Protobuf for high-volume topics) in a Schema Registry. Backward-compatible changes only within a major version.
- Events are signed by the producing edge node for evidentiary use.

---

## 4. Event catalogue (payloads)

Common types used below:

```yaml
BBox:        { x: float, y: float, w: float, h: float }   # normalised 0..1
GeoPoint:    { map_id: string, x_m: float, y_m: float, floor: int, accuracy_m: float }
Confidence:  float  # 0..1
MediaRef:    { uri: string, sha256: string, start: ts, end: ts, kind: SNAPSHOT|CLIP|DICOS }
```

### 4.1 Video analytics

#### `va.detection.observed` (edge-local, high volume)
```json
{
  "camera_id": "cam-0412",
  "frame_ts": "2026-10-26T09:41:12.340Z",
  "objects": [
    { "det_id": "d1", "class": "PERSON", "bbox": {"x":0.41,"y":0.22,"w":0.07,"h":0.31}, "conf": 0.97 },
    { "det_id": "d2", "class": "BAG", "subclass": "BACKPACK", "bbox": {"x":0.44,"y":0.45,"w":0.04,"h":0.08}, "conf": 0.91 }
  ]
}
```
Classes: `PERSON, BAG, BACKPACK, SUITCASE, TROLLEY, WHEELCHAIR, CHILD, WEAPON_SUSPECT_GUN, WEAPON_SUSPECT_KNIFE, VEHICLE, DRONE, ANIMAL`.

#### `va.track.updated`
```json
{
  "camera_id": "cam-0412",
  "local_track_id": "cam-0412:8812",
  "class": "PERSON",
  "state": "ACTIVE|LOST|ENDED",
  "bbox": {"x":0.41,"y":0.22,"w":0.07,"h":0.31},
  "world_pos": {"map_id":"T1-L1","x_m":112.4,"y_m":38.1,"floor":1,"accuracy_m":0.6},
  "velocity_mps": {"vx":0.9,"vy":0.2},
  "attributes": {
    "height_cm_est": 172, "upper_color": "RED", "lower_color": "BLACK",
    "has_backpack": true, "carrying_child": false, "wheelchair": false,
    "age_band": "ADULT", "hat": false, "mask": false
  },
  "reid_embedding_ref": "emb_7f2a...",
  "face": { "present": true, "quality": 0.82, "face_embedding_ref": null },
  "conf": 0.94
}
```
`age_band` is limited to `CHILD|ADULT|SENIOR` (for safeguarding use cases only). No gender/ethnicity/emotion inference is produced.

#### `va.sighting.recorded` (cross-camera association result)
```json
{
  "sighting_id": "sg_01JC...",
  "subject_id": "sub_9f3c...",
  "anon_track_id": "atk_44b1...",
  "association": { "method": "REID_FACE_TOPOLOGY", "score": 0.91, "alt_candidates": [{"anon_track_id":"atk_55c2","score":0.62}] },
  "camera_id": "cam-0412",
  "zone_id": "T1-B-CHK-02",
  "world_pos": {"map_id":"T1-L1","x_m":112.4,"y_m":38.1,"floor":1,"accuracy_m":0.6},
  "first_seen": "2026-10-26T09:41:09Z",
  "last_seen": "2026-10-26T09:41:12Z",
  "evidence": { "uri": "s3://evidence/2026/10/26/cam-0412/sg_01JC.jpg", "sha256": "…", "kind": "SNAPSHOT" },
  "attributes_ref": "attr_21aa..."
}
```
`subject_id` is null until linked (e.g. via boarding pass scan). `anon_track_id` always exists.

#### `va.object.static_detected`
```json
{
  "object_id": "obj_01JC...",
  "class": "SUITCASE",
  "camera_ids": ["cam-0412","cam-0413"],
  "zone_id": "T1-B-HALL",
  "zone_sensitivity": "MEDIUM",
  "world_pos": {"map_id":"T1-L1","x_m":120.0,"y_m":40.5,"floor":1,"accuracy_m":0.4},
  "static_since": "2026-10-26T09:36:50Z",
  "static_duration_s": 262,
  "candidate_owner": {
    "anon_track_id": "atk_44b1...",
    "subject_id": null,
    "last_seen": "2026-10-26T09:37:02Z",
    "distance_m": 38.2,
    "confidence": 0.78
  },
  "owner_proximity_state": "OWNER_ABSENT|OWNER_NEAR|UNKNOWN",
  "evidence": [{"uri":"s3://…/obj_01JC_arrival.mp4","kind":"CLIP","sha256":"…"}]
}
```

#### `va.behaviour.anomaly`
```json
{
  "anomaly_id": "anm_…",
  "type": "LOITERING|COUNTER_FLOW|RUNNING|FALL|FIGHT|CROWD_SURGE|TAILGATING|PERIMETER_INTRUSION|RESTRICTED_ZONE_ENTRY|LOITERING_AT_CHECKPOINT",
  "zone_id": "T1-AIRSIDE-DOOR-17",
  "actors": ["atk_44b1…","atk_90dd…"],
  "score": 0.86,
  "rule_or_model": "tailgate-v3",
  "window": {"start":"2026-10-26T09:41:00Z","end":"2026-10-26T09:41:06Z"},
  "evidence": [{"uri":"…","kind":"CLIP","sha256":"…"}]
}
```

### 4.2 Identity and biometrics

#### `id.document.verified`
```json
{
  "subject_id": "sub_9f3c...",
  "touchpoint": "CHECKIN|BAGDROP|SECURITY|BOARDING|BORDER",
  "doc_type": "PASSPORT|NATIONAL_ID|DTC|BOARDING_PASS_ONLY",
  "checks": {
    "mrz_valid": true, "chip_auth": "PASS", "pki_chain": "PASS",
    "visual_security_features": "PASS", "expired": false
  },
  "doc_ref_hash": "sha256(salt+docnumber)",
  "verdict": "PASS|FAIL|REVIEW"
}
```

#### `id.biometric.verified` (1:1)
```json
{
  "subject_id": "sub_9f3c...",
  "touchpoint": "SECURITY_LANE_04",
  "modality": "FACE",
  "liveness": { "method": "PASSIVE_NIR", "verdict": "LIVE", "score": 0.99 },
  "match": { "score": 0.987, "threshold": 0.95, "decision": "MATCH|NO_MATCH|INCONCLUSIVE" },
  "capture_quality": 0.88,
  "algorithm": { "vendor": "X", "version": "5.2", "nist_frvt_ref": "…" },
  "consent_id": "cns_…"
}
```

#### `id.biometric.identified` (1:N watchlist/gallery)
```json
{
  "search_id": "srch_…",
  "gallery": "WATCHLIST_AUTHORISED_2026Q4",
  "probe_source": "cam-0412|ENROL|UPLOAD",
  "candidates": [
    { "rank": 1, "entry_ref": "wl_8812", "score": 0.93, "threshold": 0.90 }
  ],
  "status": "PENDING_REVIEW",
  "review_required": 2,
  "legal_basis_ref": "lb_2026_014",
  "operator_id": null
}
```
Names and photos of watchlist entries are fetched by the reviewing UI under policy — they are not carried on the bus.

### 4.3 Screening

#### `scr.scan.completed`
```json
{
  "scan_id": "scn_…",
  "lane_id": "SEC-L04",
  "equipment": { "id":"CT-0412", "type":"CT|XRAY_2D|XRAY_MV|AIT|ETD", "vendor":"…" },
  "bag_id": "bag_…",
  "tray_id": "tray_0991",
  "subject_id": "sub_9f3c...",
  "binding": { "method": "TRAY_CAMERA_FACE|RFID_TRAY|OPERATOR", "confidence": 0.96 },
  "atr": {
    "model": "atr-ct-2026.07",
    "verdict": "CLEAR|ALARM|NOT_ASSESSED",
    "findings": [
      { "category":"EXPLOSIVE_SUSPECT|WEAPON_FIREARM|WEAPON_BLADE|LIQUID|LAPTOP_UNDECLARED|OTHER_PROHIBITED",
        "score":0.88, "roi":{"x":120,"y":88,"z":40,"w":30,"h":22,"d":15} }
    ]
  },
  "image_ref": { "uri":"s3://scan/…dicos", "kind":"DICOS", "sha256":"…" },
  "duration_ms": 6800
}
```

#### `scr.alarm.raised` / `scr.alarm.adjudicated`
```json
{
  "alarm_id": "alm_…",
  "scan_id": "scn_…",
  "bag_id": "bag_…",
  "subject_id": "sub_9f3c...",
  "source": "ATR|OPERATOR|ETD|AIT",
  "category": "WEAPON_BLADE",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "state": "RAISED|SENT_TO_SECONDARY|CLEARED|CONFIRMED|ESCALATED",
  "operator_id": "usr_…",
  "disposition": { "decision":"CONFIRMED_PROHIBITED", "action":"SURRENDER|REFER_POLICE|NONE", "notes": "…" },
  "tip": false
}
```
`tip: true` marks a Threat Image Projection event. TIP events are excluded from incident creation and KPI "real alarms".

### 4.4 Baggage and IoT

#### `bag.bag.status_changed`
```json
{
  "bag_id": "bag_…",
  "tag_id": "0057123456",
  "flight_id": "FL_2026-10-26_AB123_DEP",
  "status": "CHECKED_IN|SCREENED_L1|SCREENED_L2|LOADED|OFFLOADED|UNACCOMPANIED_FLAGGED|MISHANDLED",
  "location": {"type":"BHS|ULD|APRON|CAROUSEL", "ref":"BHS-SORTER-07"},
  "subject_id": "sub_9f3c...",
  "passenger_boarded": false
}
```

#### `iot.door.state_changed`
```json
{
  "door_id": "T1-AIRSIDE-DOOR-17",
  "state": "OPEN|CLOSED|FORCED|HELD_OPEN|LOCKED",
  "credential": { "type":"BADGE|BIOMETRIC|NONE", "staff_id_token":"stf_…", "result":"GRANTED|DENIED" },
  "people_count_in": 2,
  "people_count_expected": 1
}
```

#### `iot.position.updated`
```json
{
  "device_ref": "ble_hash_ab12",
  "ref_type": "PASSENGER_APP|PRM_TAG|STAFF_BADGE|BAG_TAG",
  "subject_id": "sub_9f3c...",
  "pos": {"map_id":"T1-L1","x_m":98.2,"y_m":51.0,"floor":1,"accuracy_m":2.5},
  "tech": "UWB|BLE|WIFI",
  "consent_id": "cns_…"
}
```

#### `iot.sensor.reading`
```json
{ "device_id":"bin-0221", "kind":"WEIGHT|TAMPER|SMOKE|GAS|OCCUPANCY|TEMP", "value":3.2, "unit":"kg", "alert":false }
```

#### `sys.device.health`
```json
{ "device_id":"cam-0412", "type":"CAMERA", "status":"OK|DEGRADED|DOWN|TAMPERED", "metrics":{"fps":24,"latency_ms":80,"gpu_util":0.62,"blur":0.1,"obstructed":false} }
```
`TAMPERED` is raised for blocked, redirected or defocused cameras.

### 4.5 Journey

| Event | Key payload fields |
|---|---|
| `jny.subject.created` | `subject_id`, `origin` (CHECKIN/KIOSK/APP), `flight_id`, `pax_type` (ADULT/CHILD/INFANT/CREW/STAFF), `prm_flag`, `consent_scope[]` |
| `jny.subject.linked` | `subject_id`, `link_type` (BOARDING_PASS/BIOMETRIC/BAG/COMPANION), `target_id`, `confidence` |
| `jny.checkpoint.passed` | `subject_id`, `checkpoint` (CHECKIN, BAGDROP, SECURITY, BORDER, GATE), `ts`, `method` |
| `jny.boarding.status_changed` | `subject_id`, `flight_id`, `status` (NOT_ARRIVED, IN_TERMINAL, AT_GATE, BOARDED, NO_SHOW, OFFLOADED) |
| `jny.group.formed` | `group_id`, `members[]`, `type` (FAMILY/TOUR/UNKNOWN), `confidence` |
| `jny.subject.expired` | `subject_id`, `reason` (FLIGHT_DEPARTED/RETENTION), triggers deletion workflow |

### 4.6 Incident, missing-person, audit

#### `inc.incident.created` / `.updated` / `.closed`
```json
{
  "incident_id": "inc_…",
  "type": "UNATTENDED_BAG|WEAPON_ALERT|WATCHLIST_HIT|MISSING_PERSON|PERIMETER|TAILGATE|BAG_PASSENGER_MISMATCH|CROWD|MEDICAL|CYBER",
  "priority": "P1|P2|P3|P4",
  "risk_score": 0.87,
  "state": "NEW|TRIAGE|VERIFIED|RESPONDING|CONTAINED|RESOLVED|FALSE_ALARM",
  "location": {"zone_id":"T1-B-HALL","pos":{"map_id":"T1-L1","x_m":120,"y_m":40.5,"floor":1,"accuracy_m":0.4}},
  "signals": [
    { "event_id":"01JC…", "type":"va.object.static_detected", "weight":0.35 },
    { "event_id":"01JC…", "type":"scr.alarm.raised", "weight":0.30 }
  ],
  "sop_id": "SOP-UB-01",
  "assigned": ["usr_…","team_bomb_disposal"],
  "timeline_ref": "tl_…"
}
```

#### `case.missing_person.opened` / `.sighting_added` / `.located` / `.closed`
```json
{
  "case_id": "mp_…",
  "reporter_ref": "usr_…",
  "missing": {
    "category": "CHILD|VULNERABLE_ADULT|PASSENGER_NOSHOW",
    "subject_id": "sub_…|null",
    "description": { "height_cm": [100,125], "upper_color":"YELLOW", "lower_color":"BLUE", "carrying":["BACKPACK"], "age_band":"CHILD" },
    "photo_ref": "vault://case-photos/mp_…/1",
    "last_seen": { "zone_id":"T1-B-FOOD","ts":"2026-10-26T09:20:00Z" }
  },
  "search": { "radius_m": 300, "time_window_min": 30, "modes": ["ATTRIBUTE","FACE_IF_AUTHORISED"] },
  "status": "OPEN|SEARCHING|LOCATED|CLOSED",
  "legal_basis_ref": "lb_…"
}
```

#### `sys.audit.recorded`
```json
{
  "audit_id": "aud_…",
  "actor": {"id":"usr_…","role":"SECURITY_SUPERVISOR","ip":"…","device":"ws-12"},
  "action": "FACE_SEARCH|VIEW_VIDEO|EXPORT_EVIDENCE|WATCHLIST_EDIT|CONFIG_CHANGE|OVERRIDE_ALARM",
  "object": {"type":"CASE","id":"mp_…"},
  "reason_code": "MISSING_CHILD",
  "case_ref": "mp_…",
  "result": "ALLOWED|DENIED",
  "policy_decision_id": "pdp_…",
  "prev_hash": "…", "hash": "sha256(prev_hash + canonical(this))"
}
```

---

## 5. Data model

### 5.1 Entity overview

```
Flight 1──* BoardingPass *──1 Subject 1──* Sighting *──1 Camera/Zone
                               │ 1                         
                               ├──* BagBinding *──1 Bag 1──* Scan 1──* Alarm
                               ├──* Consent
                               ├──* GroupMember *──1 Group
                               └──0..1 BiometricRef ──► (Biometric Vault, separate DB)
Incident 1──* IncidentSignal ──► (event_id)      Incident 1──* Task
Case(MissingPerson) 1──* CaseSearch/Sighting     Watchlist 1──* WatchlistEntry (vault)
Device/Zone/Map (reference)                      AuditLog (append-only)
```

### 5.2 Core relational schema (PostgreSQL)

```sql
-- ===== Reference =====
CREATE TABLE zone (
  zone_id        text PRIMARY KEY,
  terminal       text NOT NULL,
  name           text NOT NULL,
  zone_type      text NOT NULL CHECK (zone_type IN
                 ('LANDSIDE','CHECKIN','SECURITY','AIRSIDE','GATE','BHS','APRON','PERIMETER','TOILET','RETAIL')),
  sensitivity    text NOT NULL CHECK (sensitivity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  map_id         text NOT NULL,
  floor          int  NOT NULL,
  polygon        geometry(Polygon) NOT NULL,           -- PostGIS, map coordinates
  unattended_bag_secs int NOT NULL DEFAULT 180,
  loiter_secs    int NOT NULL DEFAULT 300
);

CREATE TABLE device (
  device_id      text PRIMARY KEY,
  type           text NOT NULL CHECK (type IN
                 ('CAMERA','XRAY','CT','AIT','ETD','DOOR','BLE_BEACON','UWB_ANCHOR','RFID_READER','SENSOR','KIOSK','EGATE','DRONE')),
  vendor         text, model text, firmware text,
  zone_id        text REFERENCES zone,
  pos            geometry(Point), fov geometry(Polygon), -- camera field of view
  calibration    jsonb,                                  -- homography to map coordinates
  status         text NOT NULL DEFAULT 'OK',
  last_seen      timestamptz,
  cert_fingerprint text
);

CREATE TABLE camera_adjacency (          -- topology for Re-ID gating
  from_camera text REFERENCES device,
  to_camera   text REFERENCES device,
  min_travel_s int NOT NULL,
  max_travel_s int NOT NULL,
  PRIMARY KEY (from_camera, to_camera)
);

-- ===== Journey =====
CREATE TABLE flight (
  flight_id   text PRIMARY KEY,          -- FL_<date>_<carrier><no>_<DEP|ARR>
  carrier text, number text, std timestamptz, etd timestamptz,
  gate text, status text
);

CREATE TABLE subject (                    -- pseudonymous; no names here
  subject_id   text PRIMARY KEY,          -- sub_<ULID>
  pax_type     text NOT NULL CHECK (pax_type IN ('ADULT','CHILD','INFANT','CREW','STAFF','VISITOR')),
  prm_flag     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,      -- retention enforcement
  state        text NOT NULL DEFAULT 'ACTIVE',
  biometric_ref text,                     -- opaque pointer into vault; NULL if none
  last_zone_id text REFERENCES zone,
  last_seen_at timestamptz
);

CREATE TABLE identity_vault_link (        -- stored in a SEPARATE database/schema with stricter access
  subject_id   text PRIMARY KEY,
  pnr_hash     bytea,                     -- salted hash
  doc_hash     bytea,
  name_enc     bytea,                     -- envelope-encrypted, per-record DEK
  dek_id       text NOT NULL
);

CREATE TABLE boarding_pass (
  bp_id        text PRIMARY KEY,
  subject_id   text REFERENCES subject,
  flight_id    text REFERENCES flight,
  seat text, sequence_no int, bcbp_hash bytea,
  status       text CHECK (status IN ('ISSUED','CHECKED_IN','SECURITY_PASSED','AT_GATE','BOARDED','NO_SHOW','OFFLOADED'))
);

CREATE TABLE consent (
  consent_id   text PRIMARY KEY,
  subject_id   text REFERENCES subject,
  scope        text[] NOT NULL,           -- {'FACE_VERIFY','LOCATION_APP','PRM_TAG'}
  granted_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  withdrawn_at timestamptz,
  channel      text, notice_version text
);

CREATE TABLE subject_group (
  group_id text PRIMARY KEY, group_type text, confidence real
);
CREATE TABLE subject_group_member (
  group_id text REFERENCES subject_group, subject_id text REFERENCES subject,
  role text CHECK (role IN ('GUARDIAN','CHILD','COMPANION','MEMBER')),
  PRIMARY KEY (group_id, subject_id)
);

-- ===== Sightings (hypertable / partitioned by day) =====
CREATE TABLE sighting (
  sighting_id  text,
  ts           timestamptz NOT NULL,
  subject_id   text,                      -- nullable until linked
  anon_track_id text NOT NULL,
  camera_id    text NOT NULL,
  zone_id      text NOT NULL,
  pos          geometry(Point),
  assoc_method text, assoc_score real,
  attributes   jsonb,                     -- colours, height band, carried items
  reid_vec_id  text,                      -- row in vector store
  face_vec_id  text,                      -- only if policy allows
  evidence_uri text, evidence_sha256 text,
  PRIMARY KEY (sighting_id, ts)
) PARTITION BY RANGE (ts);
CREATE INDEX ON sighting (subject_id, ts DESC);
CREATE INDEX ON sighting (zone_id, ts DESC);
CREATE INDEX ON sighting USING gin (attributes jsonb_path_ops);

-- ===== Baggage & screening =====
CREATE TABLE bag (
  bag_id       text PRIMARY KEY,
  tag_id       text UNIQUE,               -- IATA 10-digit licence plate (checked)
  kind         text CHECK (kind IN ('CHECKED','CABIN','TRAY_ITEM')),
  flight_id    text REFERENCES flight,
  status       text,
  last_loc     jsonb,
  created_at   timestamptz
);
CREATE TABLE bag_binding (
  bag_id text REFERENCES bag, subject_id text REFERENCES subject,
  method text, confidence real, bound_at timestamptz,
  PRIMARY KEY (bag_id, subject_id)
);
CREATE TABLE scan (
  scan_id text PRIMARY KEY, lane_id text, equipment_id text REFERENCES device,
  bag_id text REFERENCES bag, tray_id text, subject_id text REFERENCES subject,
  ts timestamptz NOT NULL, atr_model text, atr_verdict text,
  findings jsonb, image_uri text, image_sha256 text, is_tip boolean DEFAULT false
);
CREATE TABLE alarm (
  alarm_id text PRIMARY KEY, scan_id text REFERENCES scan,
  source text, category text, severity text, state text,
  operator_id text, disposition jsonb, raised_at timestamptz, closed_at timestamptz
);

-- ===== Unattended objects =====
CREATE TABLE tracked_object (
  object_id text PRIMARY KEY, class text, zone_id text REFERENCES zone,
  pos geometry(Point), first_static_at timestamptz, last_confirmed_at timestamptz,
  owner_anon_track_id text, owner_subject_id text, owner_confidence real,
  owner_state text CHECK (owner_state IN ('OWNER_NEAR','OWNER_ABSENT','UNKNOWN')),
  state text CHECK (state IN ('CANDIDATE','ALERTED','VERIFIED_ABANDONED','OWNER_RETURNED','CLEARED','DESTROYED'))
);

-- ===== Incident & case =====
CREATE TABLE incident (
  incident_id text PRIMARY KEY, type text, priority text, risk_score real,
  state text, zone_id text REFERENCES zone, pos geometry(Point),
  sop_id text, opened_at timestamptz, closed_at timestamptz, outcome text
);
CREATE TABLE incident_signal (
  incident_id text REFERENCES incident, event_id text, event_type text,
  weight real, added_at timestamptz, PRIMARY KEY (incident_id, event_id)
);
CREATE TABLE incident_task (
  task_id text PRIMARY KEY, incident_id text REFERENCES incident,
  sop_step text, assignee text, due_at timestamptz, state text, completed_at timestamptz
);
CREATE TABLE missing_person_case (
  case_id text PRIMARY KEY, category text, subject_id text, description jsonb,
  photo_ref text, last_seen_zone text, last_seen_ts timestamptz,
  status text, legal_basis_ref text, opened_by text, opened_at timestamptz, closed_at timestamptz
);
CREATE TABLE case_sighting (
  case_id text REFERENCES missing_person_case, sighting_id text, score real,
  reviewed_by text, review_decision text, PRIMARY KEY (case_id, sighting_id)
);

-- ===== Watchlist (lives in the Biometric Vault DB) =====
CREATE TABLE watchlist (
  watchlist_id text PRIMARY KEY, name text, authority text,
  legal_basis_ref text NOT NULL, valid_from date, valid_to date NOT NULL,
  approver_1 text, approver_2 text
);
CREATE TABLE watchlist_entry (
  entry_id text PRIMARY KEY, watchlist_id text REFERENCES watchlist,
  template_enc bytea NOT NULL, dek_id text NOT NULL,
  source_ref text, added_by text, added_at timestamptz, expires_at timestamptz NOT NULL
);

-- ===== Audit (append-only; revoke UPDATE/DELETE) =====
CREATE TABLE audit_log (
  audit_id text PRIMARY KEY, ts timestamptz NOT NULL, actor_id text, role text,
  action text, object_type text, object_id text, reason_code text, case_ref text,
  result text, policy_decision_id text, prev_hash text, hash text
);
```

### 5.3 Journey graph (property graph)

Nodes: `Subject, Bag, BoardingPass, Flight, Group, Zone, Device, Track, Incident`
Edges (with `ts`, `confidence`, `source_event_id`):

```
(Subject)-[:HOLDS]->(BoardingPass)-[:FOR]->(Flight)
(Subject)-[:OWNS {conf}]->(Bag)
(Subject)-[:MEMBER_OF {role}]->(Group)
(Subject)-[:SEEN_AT {ts, cam}]->(Zone)
(Track)-[:ASSOCIATED_TO {score}]->(Subject)
(Bag)-[:SCANNED_BY]->(Device)
(Incident)-[:INVOLVES]->(Subject|Bag|Zone)
```

Example query: "Where is the owner of bag X and what were they last seen wearing?"

```cypher
MATCH (b:Bag {bag_id:$bag})<-[:OWNS]-(s:Subject)-[r:SEEN_AT]->(z:Zone)
WITH s, r, z ORDER BY r.ts DESC LIMIT 1
RETURN s.subject_id, z.zone_id, r.ts,
       [(s)<-[:ASSOCIATED_TO]-(t:Track) | t.attributes][0] AS attrs
```

### 5.4 Vector store collections

| Collection | Vector | Dim | Index | Filter fields | Retention |
|---|---|---|---|---|---|
| `reid_body` | body Re-ID embedding | 512 | HNSW, cosine | `ts, camera_id, zone_id, attrs` | 7–30 d |
| `face_gallery_pax` | face template (consented) | 512 | HNSW/IVF-PQ | `flight_id, subject_id` | until departure + N h |
| `face_forensic` | face embeddings from CCTV | 512 | IVF-PQ | `ts, camera_id` | policy (default off/short) |
| `face_watchlist` | watchlist templates | 512 | flat/HNSW | `watchlist_id` | until entry expiry; stored in the vault |

Search is always two-stage: filtered ANN recall (top-200) → exact re-rank with the vendor matcher → human review.

### 5.5 Time-series (ClickHouse)

```sql
CREATE TABLE queue_metrics (
  ts DateTime64(3), zone_id LowCardinality(String), lane_id LowCardinality(String),
  people_in_queue UInt16, est_wait_s UInt32, throughput_per_h UInt16
) ENGINE = MergeTree PARTITION BY toDate(ts) ORDER BY (zone_id, lane_id, ts);

CREATE TABLE occupancy (
  ts DateTime, zone_id LowCardinality(String), count UInt32, density_pp_m2 Float32
) ENGINE = MergeTree ORDER BY (zone_id, ts);

CREATE TABLE alarm_kpi (
  ts DateTime, lane_id LowCardinality(String), scans UInt32, alarms UInt32,
  confirmed UInt32, false_alarms UInt32, avg_adjudication_s Float32
) ENGINE = SummingMergeTree ORDER BY (lane_id, ts);
```

---

## 6. Processing logic

### 6.1 Cross-camera association (Re-ID)

1. New local track on camera B appears at `t`.
2. Candidate set = tracks that ended on adjacent cameras A with `t - end ∈ [min_travel, max_travel]` (from `camera_adjacency`).
3. Score = `w1·cos(reid) + w2·attr_match + w3·time_plausibility + w4·face_sim(if available)`.
4. If best ≥ `T_hi` and margin over second ≥ `Δ` → merge into same `anon_track_id`. If between `T_lo` and `T_hi` → keep both as hypotheses (multi-hypothesis tracking), resolve later. Otherwise start a new `anon_track_id`.
5. Anchor events (boarding pass scan with face at the lane, e-gate) bind `anon_track_id → subject_id` with confidence.
6. On merge conflicts or ID-switch suspicion, emit `va.sighting.recorded` with `alt_candidates` and lower confidence. Operators see the uncertainty.

### 6.2 Unattended object state machine

```
CANDIDATE ──(static ≥ zone.unattended_bag_secs AND owner_absent)──► ALERTED
CANDIDATE ──(owner returns)──► OWNER_RETURNED
ALERTED ──(operator verifies)──► VERIFIED_ABANDONED ──► incident P1/P2 + SOP
ALERTED ──(operator dismisses)──► CLEARED
```

Owner determination: look back in stored video from `first_static_at` to find the track nearest to the object when it was placed. Compute `distance(owner, object)` continuously. `OWNER_ABSENT` when distance > `D_zone` for > `T_grace`. Thresholds are per zone sensitivity (e.g. HIGH sensitivity: 60 s / 5 m; LOW: 300 s / 15 m).

### 6.3 Bag–passenger binding at screening

1. Tray camera at the divest station captures the tray and subject's face/body. Tray ID read by RFID or barcode.
2. Scan completes → `scr.scan.completed` carries `tray_id`.
3. Binding service joins `tray_id` ↔ tray camera sighting → `anon_track_id` → `subject_id` (via boarding pass scan at lane entry).
4. If ATR alarm → incident engine fetches subject's live position from the journey graph and pushes to the secondary search team.

### 6.4 Risk scoring

```
risk = clamp( 1 - Π(1 - w_i · s_i) )     # noisy-OR over independent signals
```

| Signal | Source | Example weight |
|---|---|---|
| Abandoned object, owner absent | VA | 0.35 |
| Same bag had ATR alarm | SCR | 0.30 |
| Owner entered restricted zone / left via exit | VA/IoT | 0.20 |
| Unaccompanied checked bag | BAG/DCS | 0.25 |
| Watchlist candidate (unverified) | BIO | 0.15 (until adjudicated, then 0.6) |
| Door forced / tailgate nearby | IoT/VA | 0.15 |
| Zone sensitivity multiplier | static | ×1.0–×1.5 |

Priority: P1 ≥ 0.8, P2 ≥ 0.6, P3 ≥ 0.4, otherwise P4/log only. Weights are tuned from historical outcomes and reviewed by the security authority.

### 6.5 Example correlation rules (CEL-style)

```
rule UB_WITH_ALARMED_BAG:
  when  va.object.static_detected as o
  and   scr.alarm.raised as a within 4h
  and   bag_owner(o) == bag_owner(a.bag_id)
  then  create_incident(type=UNATTENDED_BAG, priority=P1, signals=[o,a])

rule PAX_NOSHOW_BAG_ONBOARD:
  when  jny.boarding.status_changed.status == 'NO_SHOW'
  and   bag.status in ('LOADED','SCREENED_L2') for same subject
  then  create_incident(type=BAG_PASSENGER_MISMATCH, priority=P2)
        + notify(DCS, BHS)  # offload request

rule TAILGATE_AIRSIDE:
  when  iot.door.state_changed.people_count_in > people_count_expected
  and   zone.sensitivity >= HIGH
  then  create_incident(type=TAILGATE, priority=P2, attach=nearest_clip)

rule CHILD_ALONE_NEAR_EXIT:
  when  jny.group.formed(role=CHILD) and guardian_distance_m > 30 for 60s
  and   child.zone in exit_zones
  then  create_incident(type=MISSING_PERSON, priority=P1)
```

---

## 7. APIs

### 7.1 External/internal API surface

| API | Type | Examples |
|---|---|---|
| Events ingest | gRPC / REST | `POST /v1/events` (batch, signed) |
| Subject / Journey | REST + GraphQL | `GET /v1/subjects/{id}/timeline`, `GET /v1/flights/{id}/not-boarded` |
| Search | REST | `POST /v1/search/attributes`, `POST /v1/search/face` (policy-gated) |
| Biometric | gRPC | `Enrol`, `Verify1to1`, `Identify1toN`, `Delete` |
| Incident | REST + WebSocket | `GET /v1/incidents?state=NEW`, `WS /v1/stream/incidents` |
| Missing person | REST | `POST /v1/cases/missing`, `POST /v1/cases/{id}/search` |
| Screening | REST | `GET /v1/scans/{id}`, `POST /v1/alarms/{id}/adjudicate` |
| Admin | REST | zones, devices, thresholds, watchlists, policies |
| Webhooks | HTTPS | Outbound incident notifications to AODB/police/SIEM |

### 7.2 Sample requests

**Attribute search (missing child)**
```http
POST /v1/search/attributes
Authorization: Bearer <jwt>
X-Reason-Code: MISSING_CHILD
X-Case-Ref: mp_01JC...

{
  "time_window": {"from":"2026-10-26T09:10:00Z","to":"2026-10-26T09:50:00Z"},
  "zones": ["T1-B-*"],
  "attributes": { "age_band":"CHILD", "upper_color":"YELLOW", "height_cm":[100,125] },
  "limit": 50
}
```
Response: ranked `sighting` objects with thumbnails (blurred by default for non-case roles), score and camera.

**Face search (authorised, audited)**
```http
POST /v1/search/face
X-Reason-Code: MISSING_PERSON
X-Case-Ref: mp_01JC...
Content-Type: multipart/form-data   # probe image

→ 202 { "search_id":"srch_…", "status":"PENDING" }
GET /v1/search/face/srch_… → candidates (need 2nd operator confirmation for LEGAL_HOLD cases)
```
The policy engine rejects calls without a valid case, role and legal basis. Every call writes `sys.audit.recorded`.

**Adjudicate alarm**
```http
POST /v1/alarms/alm_…/adjudicate
{ "decision":"CONFIRMED_PROHIBITED", "action":"SURRENDER", "notes":"folding knife 9cm" }
```

### 7.3 Inference contract (model-agnostic)

```protobuf
service Inference {
  rpc DetectTrack (stream Frame) returns (stream Detections);
  rpc EmbedReid  (CropBatch)     returns (EmbeddingBatch);
  rpc EmbedFace  (FaceBatch)     returns (FaceEmbeddingBatch);   // gated by policy
  rpc ScanATR    (ScanVolume)    returns (AtrResult);
}
message Detections { string camera_id=1; int64 ts_ms=2; repeated Det dets=3; string model=4; string version=5; }
message Det { string cls=1; BBox box=2; float conf=3; map<string,string> attrs=4; }
```

---

## 8. Security architecture

| Layer | Controls |
|---|---|
| Network | Segmented VLANs; device → edge only; edge → core via mTLS; one-way gateway to external parties; IoT on isolated VRF |
| Device identity | X.509 per device (SPIFFE/SPIRE), signed firmware, 802.1X, certificate rotation |
| Platform | Kubernetes with network policies, Pod Security, secrets in Vault/HSM, image signing (cosign), SBOM |
| Data in transit/at rest | TLS 1.3 everywhere; AES-256-GCM at rest; per-record DEKs for identity and biometrics (envelope encryption, KMS/HSM) |
| AuthN/Z | OIDC SSO + MFA; RBAC + ABAC through OPA (role, zone, case, time, reason code) |
| Biometric protection | Template encryption, separate DB/keys, no export API, cancellable templates, liveness/injection-attack detection |
| Evidence integrity | Hash at capture, signed events, WORM bucket (object lock), hash-chained audit log |
| Monitoring | SIEM integration, UEBA on operator behaviour (mass searching, off-hours exports), device-anomaly detection |
| Resilience | Edge buffering ≥ 72 h, active/standby, DR RPO ≤ 5 min / RTO ≤ 30 min for core |
| Supply chain | Vendor security reviews, penetration tests, vulnerability SLAs |

### 8.1 Roles (sample ABAC matrix)

| Role | Live video | Attribute search | Face 1:N | Watchlist edit | Export evidence | Identity vault |
|---|---|---|---|---|---|---|
| Screener | Lane only | – | – | – | – | – |
| Guard / patrol | Assigned zones | In active incident | – | – | – | – |
| Security supervisor | All terminal | Yes (case ref) | With case + 2nd approver | – | Yes (reason) | Pseudonym → name on incident |
| Missing-person coordinator | Zone-limited | Yes | Case-limited | – | Case only | Case subject only |
| Watchlist admin (authority) | – | – | – | Dual approval | – | – |
| Data protection officer | – | – | – | – | Audit review | – |
| System admin | – | – | – | – | – | – (no content access) |

---

## 9. Privacy, retention and governance

| Data | Default retention | Notes |
|---|---|---|
| Live video | 7–30 days (site law) | Event clips kept longer if tied to an incident |
| Body Re-ID embeddings | ≤ 24 h after subject expiry, unless in an incident | Not stored for non-subjects beyond 24 h |
| Face templates (consented pax) | Deleted at flight departure + configurable grace (e.g. 1 h) | Consent withdrawal triggers immediate delete |
| Watchlist templates | Until entry expiry (mandatory `valid_to`) | Dual approval for add/edit |
| Scan images | 30–90 days; incident-linked longer | |
| Incident, case records | Per legal requirement (e.g. 3–7 y) | |
| Audit log | ≥ 7 y, WORM | |

Controls: DPIA before each phase, signage and passenger notice, opt-out lane, bias testing per release, model cards, quarterly access review, transparency reporting, automated deletion jobs driven by `jny.subject.expired` with deletion receipts.

---

## 10. Non-functional targets and sizing (reference)

| Metric | Target |
|---|---|
| Camera → alert latency (abandoned object, weapon) | ≤ 3 s edge-to-UI |
| 1:1 face verify at lane | ≤ 1 s end-to-end, FAR ≤ 1e-4 at chosen FRR (per policy) |
| Cross-camera search over 24 h | ≤ 10 s (indexed) |
| ATR result per CT bag | ≤ 5 s additional |
| Bus availability | 99.95% |
| Event loss | 0 (edge buffering + at-least-once, idempotent consumers) |
| Scale example (30 M pax/y, 1,500 cameras, 40 lanes) | ~5–10 k events/s peak (metadata only); ~1.5–3 PB/yr video at 30-day retention with event-based recording and H.265; ~15–25 edge GPU servers |

---

## 11. Standards and interfaces

- Video: ONVIF (Profiles S/T/M), RTSP, H.264/H.265.
- Screening: DICOS (NEMA IIC), ECAC/TSA/EU-approved equipment standards; OSC/open architecture where available.
- Biometrics: ISO/IEC 19794-5 / 39794, ISO/IEC 30107 (PAD), ISO/IEC 29794 (quality), NIST FRVT/FATE, ICAO Doc 9303 and DTC, IATA One ID.
- Baggage: IATA Resolution 740/753, RP 1745; BCBP (IATA 792) for boarding passes.
- Airport ops: ACRIS, A-CDM, AIDX, IATA PADIS messages.
- Events/data: CloudEvents, OpenTelemetry, JSON Schema/Protobuf, OpenLineage.
- Security: ISO 27001, IEC 62443 (OT), NIST CSF, ICAO Annex 17, local aviation security programme.
- Privacy/AI: GDPR/UK GDPR, local biometric laws, EU AI Act (high-risk system obligations), ISO/IEC 42001.

---

## 12. Sequence flows

### 12.1 Unattended bag with owner trace
```
Camera ─► Edge: detect BAG static ─► va.object.static_detected
Stream processor: lookback → candidate owner track → owner_state=OWNER_ABSENT
Risk engine: score 0.62 (P2) + no other signals → inc.incident.created
Workflow: SOP-UB-01 → task "Guard verify" (mobile push with owner snapshot + path)
Guard: confirms abandoned → state VERIFIED_ABANDONED → priority P1, cordon task, announcement task
Identity service: if owner linked to subject → fetch boarding status → DCS "find passenger"
Search service: live-track owner (Re-ID) → location pushed to responders
Close: owner found / object cleared → audit + outcome recorded
```

### 12.2 Passenger journey with biometric consent
```
Check-in kiosk: doc verify (id.document.verified) + consent + enrol face (vault)
jny.subject.created (subject_id) ── gallery for flight loaded to lane edge
Security lane: face probe → 1:1/1:N (flight gallery) → id.biometric.verified
Tray camera: tray_id ↔ subject → bag_binding
Scan → scr.scan.completed (+ATR) → clear or alarm → secondary
Gate: face match → jny.boarding.status_changed=BOARDED
Flight departed → jny.subject.expired → templates and Re-ID data deleted → deletion receipt
```

### 12.3 Missing child
```
Staff opens case (photo/description) → case.missing_person.opened
Policy check: role + reason + legal basis → search authorised
Search: attribute + (if authorised) face over last 30 min, zones within 300 m radius
Candidate sightings stream to the case; reviewer confirms → live-track via Re-ID
Exit-gate watch rule armed on child's attributes; guards notified in geofence
Located → case.missing_person.located → close, embeddings from case purged per policy
```

### 12.4 Passenger no-show with checked bag
```
DCS: gate closed, subject not boarded → jny.boarding.status_changed=NO_SHOW
Rule PAX_NOSHOW_BAG_ONBOARD → incident P2
BHS: bag located (RFID) → offload task; journey graph supplies last-seen position & staff dispatched
If passenger found: re-board or offload decision; if not: bag offload + re-screen
```

---

## 13. Delivery plan (engineering view)

| Increment | Deliverables |
|---|---|
| I0 Foundations (8–10 wks) | Schema registry, event envelope, bus, device registry, zone/map model, IAM + OPA, audit service, observability, CI/CD |
| I1 VA core (10–12 wks) | Edge inference stack, tracking, attributes, sighting store, attribute search, queue analytics, unattended object service, incident + SOP workflow, C2 UI v1 |
| I2 Screening (10–12 wks) | DICOS adapter, ATR adapter, tray binding, alarm adjudication, TIP handling, bag-passenger reconciliation with DCS/BHS |
| I3 IoT (8 wks) | MQTT/OPC-UA adapters, door/tailgate, positioning, bag RFID, sensor health, tamper detection |
| I4 Identity (12–16 wks) | Consent service, vault, 1:1 verification, journey graph, e-gate/boarding integrations, deletion pipeline |
| I5 Missing person + face search (10 wks) | Case management, forensic face index, 1:N with dual approval, watchlist governance, legal-basis workflow |
| I6 Optimise (continuous) | Digital twin, predictive queues, model drift monitoring, bias audits, red-team exercises |

---

## 14. Open design decisions (to confirm with stakeholders)

1. Jurisdiction and legal basis for 1:N face search and watchlists; whether CCTV face matching is permitted at all.
2. Which party is the identity authority (airport, airline or government) and how tokens are shared.
3. Edge vs. central placement of the biometric matcher for lanes (latency vs. data minimisation).
4. Retention periods and who owns evidence outside incidents.
5. Vendor mix for screening equipment, and whether OEM ATR is used or a third-party ATR via DICOS.
6. Integration pattern with border/police systems (push, pull or one-way).
