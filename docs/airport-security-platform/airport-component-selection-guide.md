# Vendor-Neutral Component Selection Guide: Integrated Airport Security Platform

Companion to `airport-security-architecture.md`. It describes what to buy or build per component, which criteria to score, which tests to run, and what contract terms to require. It names no vendors. Run the shortlist against your own market scan.

---

## 1. How to use this guide

1. **Classify each component** as *Buy* (commodity or regulated), *Build* (differentiating or integration glue) or *Hybrid* (buy engine, build wrapper).
2. **Write mandatory requirements first** (pass/fail gates). Score only vendors that pass all of them.
3. **Score weighted criteria** (section 3) on a 0–5 scale using evidence, not slideware.
4. **Run a proof-of-value (PoV) on your own data**: your cameras, your lighting, your passenger mix, your threat set. Public benchmark numbers are a filter, not a decision.
5. **Check exit cost** before signing: data export, model portability, API openness.

---

## 2. Buy / Build / Hybrid map

| Component | Recommendation | Reason |
|---|---|---|
| Cameras, lenses, thermal | Buy | Commodity; ONVIF is the interface |
| VMS (video management) | Buy | Mature market; avoid custom |
| Edge GPU servers | Buy | Hardware |
| Video analytics (detection, tracking, attributes) | Hybrid | Buy base models; fine-tune on site data; own the output schema |
| Re-ID / cross-camera tracking | Hybrid / Build | Core differentiator; depends on your topology and journey graph |
| Unattended object logic | Build (on bought detectors) | Zone rules, owner lookback and SOPs are site-specific |
| Face recognition engine | Buy | Needs independent benchmarks and PAD; do not build |
| Liveness / PAD | Buy | Needs certification (ISO/IEC 30107-3 testing) |
| Document authentication | Buy | Requires security-feature databases |
| X-ray / CT / AIT / ETD equipment | Buy (regulator-approved only) | Certification-gated |
| ATR (automatic threat recognition) | Buy (OEM or third-party via open interface) | Regulated; needs approved detection performance |
| Event bus, stream processing | Buy (open source/managed) | Standard infrastructure |
| Journey graph / identity service | Build | Core IP; encodes your data model and policy |
| Correlation / risk engine | Build (rules runtime bought) | Your SOPs and thresholds |
| Incident / case management | Hybrid | Buy workflow engine; build domain model and UI |
| C2 / operator UI | Hybrid | Buy PSIM/C2 if it meets open-API tests; otherwise build |
| IoT platform / MQTT broker | Buy | Commodity |
| Positioning (BLE/UWB) | Buy | Hardware + SDK |
| Search (vector + attribute) | Buy (open source/managed) | Standard engines |
| IAM, secrets, policy | Buy | Do not invent crypto/IAM |
| Audit / SIEM | Buy | Standard |
| MLOps | Buy / assemble | Standard tooling |

---

## 3. Universal scoring criteria (apply to every component)

| Criterion | Weight (default) | What to verify |
|---|---|---|
| Functional fit | 20% | Mandatory requirements met without custom work |
| Open interfaces | 15% | Documented API/SDK, standards support, no proprietary-only data formats |
| Performance on your data | 15% | PoV results (section 5) |
| Security | 10% | Secure development evidence, pen-test reports, SBOM, patch SLA, device identity |
| Privacy and compliance | 10% | Data-minimisation controls, deletion APIs, DPIA support, regional processing |
| Scalability and resilience | 8% | Tested at 2× your target; HA design; graceful degradation |
| Operability | 7% | Monitoring, remote update, diagnostics, low operator effort |
| Vendor viability | 5% | Financials, reference sites at comparable airports, support footprint |
| Total cost of ownership (5-yr) | 5% | Licences, hardware, integration, retraining, support, upgrades |
| Exit and portability | 5% | Data export formats, model/config export, termination assistance |

Adjust weights per component: for example, raise *Performance* and *Compliance* for face recognition, and raise *Open interfaces* for the C2 layer.

**Red-flag list (any one is a reason to reject or renegotiate):**
- No documented API for raw events or results.
- The vendor insists on storing biometrics or video in its own cloud with no on-prem option.
- Accuracy claims only from vendor-run tests, with no independent evaluation.
- No way to export your configuration, labels or enrolments.
- Unpatched critical vulnerabilities or default credentials.
- Per-camera or per-face licence models that make scaling unpredictable.

---

## 4. Component-by-component guidance

### 4.1 Cameras and sensors

| Item | Selection guidance |
|---|---|
| Fixed cameras | Resolution by task (see below), WDR ≥ 120 dB at windows and entrances, low-light colour performance, H.265, ONVIF Profile S/T, on-camera analytics optional but never mandatory |
| PTZ | Fast preset recall, auto-tracking API, usable for face zoom at long range |
| Thermal | For perimeter and low-light; radiometric option for fever/heat anomalies |
| Overhead / people-counting | Depth (stereo/ToF) for counting and queue lengths without faces |
| Face-capture cameras | Narrow field of view, NIR illumination, controlled lighting, ≥ 80–120 px interocular distance at the capture point |
| Tray / divest cameras | Fixed geometry, high frame rate, mounted to see tray and face |

Guideline pixel densities (pixels per metre at target distance): detection ≥ 25 px/m, recognition of attributes ≥ 125 px/m, identification of face ≥ 250 px/m (≈ 80+ px between the eyes). Plan camera placement from these numbers, not from vendor "megapixel" marketing.

Must-haves: ONVIF conformance, secure boot, signed firmware, per-device certificates, disable unused services, NDAA/ regional compliance as required by your authority, tamper detection.

### 4.2 Video management system (VMS)

| Criterion | Test |
|---|---|
| Open SDK / API | Retrieve live and recorded streams, bookmarks, and push metadata |
| Metadata handling | Store and search third-party analytics metadata alongside video |
| Edge recording failover | Pull from camera SD after network outage |
| Scale | 2× target cameras per recording server; federation across terminals |
| Evidence workflow | Hash on export, case bundles, redaction tools |
| Security | Encrypted streams, RBAC, audit log |

### 4.3 Edge compute and inference runtime

| Criterion | Guidance |
|---|---|
| Accelerator | GPU or NPU with a mainstream inference runtime (ONNX/TensorRT/OpenVINO); avoid closed model formats |
| Density | Benchmark streams per server with *your* model set, at your frame rate and resolution |
| Serving layer | Needs batching, model versioning, A/B or shadow mode, hot reload |
| Management | Remote fleet management, rollback, GPU health telemetry |
| Resilience | Active/standby; local event buffer ≥ 72 h |

### 4.4 Video analytics (detection, tracking, attributes)

| Capability | Must-have | Test |
|---|---|---|
| Person, bag, vehicle detection | High recall in crowded scenes | Labelled clips from busiest hours, day and night |
| Single-camera tracking | Low ID switches | MOTA/IDF1 on your footage |
| Attribute extraction | Colour, carried item, age band (child/adult/senior only) | Confusion matrices by lighting condition |
| Static-object detection | Low false alerts from trolleys, signage changes | 7-day soak test in a live terminal |
| Behaviour analytics | Rule-based first; ML anomaly second | Alert precision at agreed alert volume |
| Open model contract | Outputs conform to your `Detections` schema | Contract tests |
| Fine-tuning | Vendor lets you retrain or fine-tune with your data, or provides a documented process | Written commitment |
| Prohibited inference | Must be able to disable emotion, ethnicity and gender inference | Configuration proof |

Key metrics: recall at fixed false alarms per camera per day, ID switches per 1,000 tracks, latency per frame, GPU cost per stream.

### 4.5 Re-ID and journey tracking

Likely a build or hybrid. If buying, require:
- Embedding export (so you can re-index in your own vector store).
- Topology-aware association (camera adjacency, travel-time gating).
- Confidence scores and alternative candidates, not just a single answer.
- Multi-hypothesis support.
- Measured rank-1/mAP on your multi-camera test set, with clothing-change cases.

### 4.6 Face recognition engine

| Criterion | Requirement |
|---|---|
| Independent accuracy | Recent results in the NIST FRTE/FATE programmes in the relevant tracks (1:1 verification, 1:N identification, visa/border-quality, mugshot, in-the-wild). Check the actual operating point, not a headline number |
| Demographic fairness | Published differential error rates; ability to set thresholds per use case and to audit by group |
| Presentation attack detection | Independently tested against ISO/IEC 30107-3 (levels A/B), including injection-attack defences |
| Template handling | Protected templates, no reversible storage, export in standard format (ISO/IEC 19794-5 / 39794) or documented migration |
| Deployment | On-prem or private cloud; SDK or container; offline capable |
| Throughput | Matches/s per core or GPU at your gallery size (flight gallery vs. watchlist) |
| Quality assessment | Reports capture quality per ISO/IEC 29794 and rejects poor images |
| Features | Mask and glasses tolerance, age-gap tolerance, multi-frame fusion |
| Governance | Per-feature switches (1:N CCTV matching disabled by default), full audit hooks |

Operating points are your decision, not the vendor's: choose FAR and FRR separately for e-gate verification (strict FAR), lane convenience (balanced) and forensic search (high recall with human review).

### 4.7 Document authentication and travel credentials

- ICAO 9303 MRZ and chip reading, active/passive authentication, PKD/master list support.
- Support for digital travel credentials (DTC) and mobile IDs as they mature.
- Update cadence of document template databases.
- Fraud-feature coverage tests with a set of genuine and fake documents provided by your border authority.
- Offline operation at the kiosk and graceful fallback to manual inspection.

### 4.8 Screening equipment (X-ray, CT, AIT, ETD)

This choice is largely **regulator-driven**. Use the approved-equipment lists of your authority (for example ECAC/EU, TSA, or national equivalent) as the first filter.

| Criterion | Guidance |
|---|---|
| Certification | Standard in force for your jurisdiction (e.g. liquids, explosives detection standard level) and a roadmap for the next tier |
| Open architecture | Image/data export in DICOS; an interface for third-party ATR and for operator-console integration; open lane-control protocol where available |
| Throughput | Bags per hour in real operation including divest/re-compose, not lab numbers |
| Divest reduction | Whether laptops and liquids can stay in the bag, which affects passenger flow |
| Image quality | 3D CT with material discrimination; detection of thin sheet, liquid and non-metallic threats |
| Operator interface | Rotation, material colour modes, annotation, auto-clear paths |
| ATR | Detection performance at the approved standard, plus false alarm rate in your bag mix |
| Software lifecycle | Update path for threat libraries; remote diagnostics; cyber hardening |
| Maintenance | MTBF, spare-parts availability, local support time |
| Radiation safety | Compliance with local dose limits and shielding |
| AIT (body scanners) | Generic-avatar output only (no body images), low false-alarm rate, accessibility for PRMs and passengers with prostheses |
| ETD | Sampling speed, consumables cost, calibration |

Integration must-haves: tray ID/RFID read, scan-complete events, alarm and adjudication events, TIP support, and a documented way to push ATR outputs into the platform.

### 4.9 ATR (if separate from equipment)

- Runs on DICOS volumes with documented input/output.
- Performance evidence from the regulator's test, not only vendor testing.
- Ability to add new threat classes by controlled update, with regression tests.
- Explainable output: ROI localisation, class and score.
- Latency budget compatible with lane throughput.
- Update and rollback process approved by the regulator.

### 4.10 Event bus and stream processing

| Option class | Choose when |
|---|---|
| Kafka-compatible log (self-managed or managed) | Core platform, replay, many consumers, strong ecosystem |
| Lightweight messaging (NATS JetStream / MQTT) | Edge nodes and IoT |
| Stream processor (Flink / Kafka Streams / similar) | Windowed joins, event-time handling, exactly-once needs |

Criteria: ordering guarantees per key, schema registry support, exactly-once or idempotent processing, multi-site replication, operational maturity in your team, observability, security (mTLS, ACLs).

### 4.11 Data stores

| Need | Store class | Selection notes |
|---|---|---|
| Transactional | Relational DB (PostgreSQL class) | Row-level security, partitioning, geospatial extension |
| Journey graph | Property graph DB, or relational + graph extension | Pick on traversal depth and ops familiarity |
| Vector search | Dedicated vector DB or a database with vector index | Test recall@k and latency at 100M+ vectors with metadata filters |
| Attribute search | Search engine (inverted index) | Hybrid with vector search |
| Time series / analytics | Columnar store | Compression, retention policies |
| Objects (video, images, DICOS) | S3-compatible object store | Object lock/WORM, lifecycle tiers, erasure coding |
| Biometric vault | Hardened relational store + HSM/KMS | Separate network zone, per-record keys |

### 4.12 Workflow, incident and case management

- BPMN or equivalent engine with human tasks, timers, escalation.
- SOP versioning and audit.
- Mobile task delivery with offline tolerance.
- Open API for external agencies (police, fire, medical).
- Evidence packaging with integrity proof.
- Many off-the-shelf PSIM/C2 products exist: require open APIs and the right to bring your own analytics. If the platform insists on its own analytics only, treat as a lock-in risk.

### 4.13 C2 / operator UI

| Criterion | Test |
|---|---|
| Map-based situational awareness | Digital floor plan, live tracks, incident layers |
| Alarm management | Prioritisation, grouping, acknowledgement times, no alert storms |
| Evidence view | Clip + snapshot + scan image + timeline in one screen |
| Role-based views | Screener, guard, supervisor, coordinator |
| Accessibility and human factors | Operator testing, fatigue-aware workload, ≥ 2 monitors usable with minimum clicks |
| Resilience | Works when parts of the backend are degraded |

### 4.14 IoT layer

| Item | Guidance |
|---|---|
| Protocols | MQTT 5, OPC-UA, BACnet, Modbus gateways; avoid proprietary-only |
| Device management | Provisioning, certificate rotation, OTA updates, inventory |
| Positioning | BLE 5.x AoA or UWB where < 1 m accuracy is needed; Wi-Fi RTT/BLE RSSI for coarse; privacy-preserving (rotating IDs, opt-in app) |
| RFID | UHF for bag tags (IATA RP 1740c); read-rate tests on belts |
| Access control | Open protocol readers, anti-passback, forced-door sensors, people-counting at doors |
| Sensors | IP rating, tamper alarms, battery life, sampling rates |

### 4.15 Identity, policy and security services

- IAM: OIDC/SAML SSO, MFA, SCIM; support for external agency federation.
- Policy: attribute-based (OPA-style) with decision logging; ability to express *case + reason + time + zone*.
- Secrets/keys: HSM-backed KMS; BYOK.
- Audit: append-only, hash-chained or WORM; export to SIEM.
- Consent: purpose-scoped, time-bound, withdrawable; API for passenger apps.

### 4.16 MLOps

- Dataset versioning and labelling tools with privacy controls (annotator access limits, face blurring where possible).
- Model registry with approval gates, model cards, bias test results.
- Shadow/canary deployment and drift monitoring.
- Reproducible training; ability to retrain without vendor involvement for owned models.

---

## 5. Proof-of-value (PoV) test plan

### 5.1 General PoV rules

- Use **your** sites, cameras and a representative data set (day/night, peak/off-peak, seasons, crowded/empty).
- Hold out a **blind test set** the vendor never sees.
- Define acceptance thresholds before testing.
- Run for at least **2–4 weeks live** for VA components (to expose false alarm behaviour), not only lab clips.
- Record operator workload during PoV.
- Test failure modes: network cut, GPU failure, clock drift, camera obstruction.

### 5.2 Test matrix

| Component | Dataset / scenario | Metrics | Example acceptance |
|---|---|---|---|
| Person/bag detection | 50+ hours labelled across cameras | Recall @ 1 FP/camera/day | ≥ 95% persons, ≥ 90% bags |
| Single-camera tracking | Crowded checkpoint footage | IDF1, ID switches/1000 | IDF1 ≥ 0.85 |
| Cross-camera Re-ID | Multi-camera routes with clothing changes | Rank-1, mAP, false merge rate | Rank-1 ≥ 80% (no clothing change); false merge ≤ 2% |
| Unattended object | Scripted drops (staff) + 7-day live | Detection rate, false alerts/zone/day, time to alert | ≥ 95% scripted drops detected; ≤ 3 false alerts/zone/day |
| Owner lookback | 100 scripted cases | Correct owner identified | ≥ 90% |
| Face 1:1 (lane/gate) | Volunteers, diverse demographics, lighting | FRR @ FAR 1e-4, transaction time, failure-to-acquire | FRR ≤ 2–3%; ≤ 8 s per pax |
| Face 1:N flight gallery | Gallery size = A380 load | Rank-1 hit rate, latency | ≥ 98% / ≤ 1 s |
| Face forensic search | 10,000 identities, in-the-wild probes | Recall@10 at fixed FAR | Agreed with legal/ops, human review mandatory |
| PAD | Print, replay, 3D mask, injection | APCER/BPCER | APCER ≤ 1% (level A), per standard |
| Demographic fairness | Stratified sets | Differential FMR/FNMR | Within agreed ratio |
| ATR / CT | Regulator test bags + your bag mix | Pd per threat class, false alarm rate | Meets approved standard; FAR sustainable for throughput |
| Throughput (screening) | Peak-hour live | Bags/hour/lane incl. alarms | Meets design throughput |
| IoT door/tailgate | Scripted tailgate trials | Detection rate, false alarms | ≥ 95% / ≤ 1 per door per day |
| Positioning | Walk routes | Median / 95th percentile error | ≤ 1–3 m depending on tech |
| Bus/stream | Load test | Events/s, p99 latency, loss | 2× peak, p99 < 500 ms, 0 loss |
| Vector search | 100M vectors | Recall@k, p95 latency | ≥ 0.95 / ≤ 500 ms |
| Failure / resilience | Kill node, cut link, drift clock | Recovery time, data loss | Meets RTO/RPO |
| Security | Pen-test, device audit | Findings by severity | No criticals open |
| Usability | 10+ real operators, scenario drills | Time to resolve, errors, SUS | Agreed targets |

---

## 6. Integration compatibility checklist

For every candidate, ask for a one-page integration sheet:

| Question | Pass condition |
|---|---|
| Which standard interfaces are supported (ONVIF, DICOS, MQTT, OPC-UA, REST/gRPC, OIDC)? | All that apply to the component |
| Can we receive all events/results as structured data in real time? | Yes, documented schema |
| Can we send commands (open lane, tag alarm, set threshold) via API? | Yes |
| Can analytics run on third-party VMS and cameras? | Yes |
| Can we export all configuration, enrolments, labels and logs? | Yes, documented format |
| Is there a sandbox / simulator for integration testing? | Yes |
| What is the release cadence and API deprecation policy? | ≥ 12 months notice |
| What is required from our network (ports, cloud calls, licence servers)? | Documented; no mandatory outbound dependency for core function |
| Time sync | PTP/NTP supported |
| Can the product run air-gapped or in degraded mode? | Yes, with defined behaviour |

---

## 7. Contract and commercial terms

- **Data ownership:** all data, models fine-tuned on your data, labels and logs belong to the operator.
- **Processing limits:** no vendor use of passenger data for its own training or product improvement without explicit written approval.
- **Residency:** processing and storage in agreed jurisdictions.
- **Performance SLAs:** accuracy and false-alarm commitments measured at site acceptance; remedies if not met; periodic re-testing.
- **Security:** patch SLAs (critical ≤ 14 days), vulnerability disclosure, SBOM, right to audit and to pen-test.
- **Open interfaces:** API access included, no extra charge per integration; API stability commitments.
- **Escrow and exit:** source or model escrow for critical components, termination assistance, data return and certified deletion.
- **Licensing:** prefer capacity-based (per site/per lane/per server) over per-face or per-event pricing that penalises growth; cap annual uplifts.
- **Regulatory change:** vendor obligations to adapt to new rules (e.g. AI Act obligations, certification updates) within a fixed time.
- **Support:** 24×7 for security-critical systems, response times, on-site spares, named escalation.
- **Liability:** appropriate caps for security failures and data breaches.

---

## 8. Evaluation scorecard template

Score each criterion 0–5 (0 = fails, 3 = meets, 5 = exceeds with evidence). Multiply by weight.

| Criterion | Weight | Vendor A | Vendor B | Vendor C | Evidence reference |
|---|---|---|---|---|---|
| Functional fit | 20% | | | | PoV report §… |
| Open interfaces | 15% | | | | Integration sheet |
| Performance on our data | 15% | | | | PoV metrics |
| Security | 10% | | | | Pen-test summary |
| Privacy & compliance | 10% | | | | DPIA input |
| Scalability & resilience | 8% | | | | Load test |
| Operability | 7% | | | | Ops workshop |
| Vendor viability | 5% | | | | References |
| 5-year TCO | 5% | | | | Cost model |
| Exit & portability | 5% | | | | Export test |
| **Weighted total** | 100% | | | | |

Decision rules: reject any vendor with a failed mandatory gate; require the top two to complete a live PoV; if scores are within 5%, decide on exit cost and open interfaces.

---

## 9. Reference selection by airport size (starting profiles)

| Profile | Likely approach |
|---|---|
| Small regional (< 2 M pax) | Commercial VMS + cloud-managed analytics for queue and unattended objects; approved 2D/3D X-ray with basic ATR; no 1:N face; consent-based 1:1 only if airline-led |
| Medium (2–15 M pax) | On-prem edge GPU, open event bus, CT adoption roadmap, journey graph with biometric option at gates, incident workflow, IoT door control |
| Large hub (15 M+ pax) | Full platform: multi-site Kafka, dedicated vector search, DICOS-integrated ATR, digital twin, federated identity (airline/border), 24×7 SOC integration, redundancy across sites |

---

## 10. Common selection mistakes

1. Buying on headline accuracy without an operating-point test on local conditions.
2. Choosing an all-in-one suite whose analytics cannot be replaced.
3. Under-sizing camera placement (resolution and angle matter more than model quality).
4. Ignoring alarm volume: a 3% false alarm rate on 30 M passengers is nearly a million alarms.
5. Treating privacy as a late add-on instead of a selection criterion.
6. Skipping the exit test (export your data on day 1 of the PoV).
7. Evaluating only in a lab or only on daytime footage.
8. Letting screening-equipment procurement run separately from platform integration. Open interfaces must be in the equipment tender.
