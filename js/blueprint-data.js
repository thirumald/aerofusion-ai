/* AeroFusion AI - the integrated airport security platform blueprint as data.
 * demo: where this app already shows the capability (hash routes). No demo means design only. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {});
  const D = (r) => (r ? (Array.isArray(r) ? r : [r]) : []);

  AF.bpArch = {
    sensors: ['CCTV, PTZ, thermal', 'X-ray, CT, AIT, ETD', 'Boarding and check-in', 'BLE, Wi-Fi, UWB, RFID', 'Door, seat, bag IoT'],
    edge: ['Edge GPU nodes', 'Detect, track', 'Anonymise, embed'],
    core: ['Event bus (Kafka, MQTT)', 'Identity graph (passenger)', 'Video analytics and Re-ID', 'Rules and AI correlation engine', 'Digital twin and heatmaps', 'Case management and MLOps'],
    output: ['Command and control UI', 'Mobile app for guards', 'Alerts and SOP workflow', 'A-CDM, AODB, DCS APIs', 'Audit and evidence vault'],
  };

  AF.bpDomains = [
    { id: 'track', name: 'Passenger tracking', rows: [
      ['Passengers leave one camera view, so tracking breaks across cameras.', 'Multi-camera person Re-ID (appearance, gait and clothing embeddings), a camera topology graph, and time and space gating (a person cannot teleport).', D('#/tracking')],
      ['Crowds and occlusion at security queues, gates and immigration.', 'Overhead and top-down cameras, depth or stereo sensors, and head-and-shoulder detectors. Crowd density estimation replaces individual tracking above a density threshold.', D('#/passengers')],
      ['Camera blind spots, toilets and corridors.', 'Sensor fusion with Wi-Fi, BLE, UWB, door-counter IoT and thermal cameras. Predict the likely location when there is no sighting.', D('#/twin/unattended')],
      ['Lighting changes, glass reflections and outdoor to indoor transitions.', 'WDR and low-light cameras, thermal fusion, domain-adaptive models and per-camera calibration.', []],
      ['Clothing changes, hats, masks and coats removed at security.', 'Clothing-invariant Re-ID with face, gait and body-shape features. Re-anchor identity at the security-lane exit using the boarding pass scan.', D('#/checkpoint')],
      ['Identity drift, where the tracker swaps two people.', 'Track confidence scoring, ID-switch detection and human review above a threshold.', []],
      ['Queue wait time and bottleneck prediction.', 'Flow analytics, queue-length estimation and a digital twin that forecasts congestion, with dynamic lane opening.', D(['#/routing', '#/twin/overload'])],
      ['Geo-location indoors.', 'UWB and BLE beacons, visual positioning and an indoor map matched to camera coordinates.', D('#/geo')],
      ['Late or non-boarding passengers ("final call" tracking).', 'Link DCS (departure control) to the tracking graph and show last-known location and distance to the gate.', []],
      ['Tracking children, the elderly and PRM (passengers with reduced mobility).', 'A PRM flag in the journey graph, wheelchair and escort tracking, and alerts if a PRM is stationary for too long.', []],
    ] },
    { id: 'ident', name: 'Identification', rows: [
      ['Verifying that the person is the document holder at check-in, security and boarding.', '1:1 face match (live face against passport chip, e-gate or ID) with presentation attack detection (liveness).', []],
      ['Fraudulent, forged or borrowed documents.', 'Document authentication (UV, IR, MRZ, RFID chip), ICAO PKD certificate validation, and cross-check of API and PNR data.', []],
      ['Biometric accuracy varies across demographics, age and masks.', 'NIST FRVT-ranked algorithms, bias testing per demographic, multi-modal fallback (iris, fingerprint) and tuned thresholds per use case.', []],
      ['Spoofing with photos, screens, 3D masks and deepfakes.', 'Active and passive liveness, NIR and depth cameras, injection-attack detection and device attestation.', []],
      ['Poor enrolment quality (blurry, angled or low-light images).', 'Guided capture kiosks, quality scoring (ISO/IEC 29794) and re-capture prompts.', []],
      ['Multiple identity systems (airline, border, airport, security) that do not talk to each other.', 'Federated identity using a digital travel credential (ICAO DTC, IATA One ID) with consent-based sharing and tokenised IDs.', D('#/governance')],
      ['Staff, contractor and crew identity (insider threat).', 'Biometric access control, airside permit verification, geofenced access zones and anomaly detection on access patterns.', D('#/twin/tailgate')],
      ['Name matching against watchlists (transliteration, aliases).', 'Fuzzy and phonetic matching, with a human adjudication queue.', []],
      ['Privacy and consent (GDPR, BIPA, DPDP and others).', 'Opt-in enrolment, no template retained after the flight (or after a short retention period), on-device templates, encryption, and a DPIA before deployment.', D('#/governance')],
      ['Passengers who refuse biometrics.', 'Always keep a manual alternative lane with equivalent service levels.', []],
    ] },
    { id: 'screen', name: 'Threat detection: screening', rows: [
      ['Operator fatigue and the low prevalence of real threats.', 'AI automatic threat recognition (ATR) and Threat Image Projection (TIP) to keep operators alert.', D('#/checkpoint')],
      ['Overlapping, cluttered bags hide objects.', 'CT 3D reconstruction, multi-view X-ray and dual-energy material discrimination.', D('#/checkpoint/scripted')],
      ['Liquids, explosives and 3D-printed or ceramic weapons.', 'CT with material density and effective atomic number (Zeff) analysis, plus explosive trace detection (ETD) as secondary.', D(['#/checkpoint/scripted', '#/fusion'])],
      ['High false alarm rate slows throughput.', 'An AI triage that raises operator accuracy, with tuned alarm thresholds and automated "clear" paths for low-risk bags.', D('#/fusion')],
      ['Vendor lock-in across X-ray makers.', 'OSC and DICOS-based open standards, with a vendor-neutral AI layer on top.', []],
      ['New threat types appear over time.', 'Continuous learning with synthetic data (threat compositing) and a controlled model-update pipeline.', []],
      ['Body-worn concealed items.', 'mmWave and AI body scanners with a generic avatar display (no nude images), plus thermal imaging.', D('#/fusion')],
      ['Bag and owner mismatch.', 'The bag ID from the X-ray image is linked to the passenger ID from the scan point.', D('#/checkpoint')],
    ] },
    { id: 'behav', name: 'Threat detection: behaviour and video', rows: [
      ['Weapon detection (gun, knife) on video.', 'Object detection models fine-tuned on weapon datasets, with human verification before response.', []],
      ['Suspicious behaviour (loitering, pacing, hostile approach, running against flow).', 'Behaviour analytics with rule-based and learned anomaly detection. Avoid profiling by appearance or ethnicity.', D('#/incidents')],
      ['Perimeter intrusion, fence jumping and runway incursion.', 'Thermal cameras, radar, fibre-optic fence sensors and drones for verification.', D('#/twin/perimeter')],
      ['Tailgating and piggybacking at secure doors.', 'Door sensors with person counting and anti-tailgate analytics.', D('#/twin/tailgate')],
      ['Violence, fights, falls and medical events.', 'Pose estimation, audio analytics (gunshot, scream) and fall detection.', []],
      ['Watchlist face hits are not always accurate.', 'Treat hits as leads only, with two-person human verification before any action.', []],
      ['Cyber threats against the security systems themselves.', 'Zero trust, network segmentation, signed firmware, SIEM integration and regular pentests.', []],
      ['Alert flood (too many alerts).', 'An event correlation engine that fuses X-ray, VA and IoT signals into a risk score. One incident carries several signals.', D(['#/fusion', '#/incidentdash'])],
    ] },
    { id: 'bag', name: 'Unattended and abandoned baggage', rows: [
      ['Detecting a bag left behind in a busy area.', 'Static-object detection with owner association (who brought it and when they walked away), with a timer (for example 3 minutes) before alert.', D(['#/twin/unattended', '#/cameras/CAM-04'])],
      ['Bag owner identification.', 'Back-trace the video to find the person who arrived with the bag, and push their image to guards.', D('#/tracking')],
      ['Bags placed behind pillars or moved by others.', 'Multi-camera tracking, bag Re-ID, and RFID or BLE tags where available.', D('#/twin/handoff')],
      ['Too many false alarms (a passenger leaves a bag briefly).', 'Owner-proximity logic, dwell-time thresholds per zone, and a risk score that accounts for zone sensitivity.', D('#/twin/unattended')],
      ['Bag handling after detection.', 'An automated SOP workflow: verify, cordon, announce, bomb-disposal dispatch, with a timeline log for audit.', D(['#/incidents', '#/alerts'])],
      ['Checked baggage that is unaccompanied (passenger no-show).', 'Bag-passenger reconciliation with DCS, and offload logic with automatic alerts to ground handling.', D('#/baggage')],
      ['Baggage mishandling (lost or delayed).', 'RFID or barcode scans at each handoff plus an IoT conveyor and belt camera for bag tracking.', D('#/baggage')],
      ['Suspicious items in bins, toilets and shops.', 'Periodic AI checks, smart bins with sensors, and staff patrol reports.', []],
    ] },
    { id: 'missing', name: 'Missing persons', rows: [
      ['Missing child or vulnerable adult (dementia).', 'A fast "last seen" search: upload a photo or description and the system searches live and recorded video by clothing, height and face.', []],
      ['Descriptions only, no photo.', 'Attribute search (for example "red jacket, backpack, child, 120 cm").', []],
      ['Wrongly separated family groups.', 'Group association analytics (people who walked together), with alerts when a child leaves the group alone.', []],
      ['Passenger missing at boarding (no-show after check-in).', 'Locate by journey graph, with an optional push notification to the passenger app and an announcement near their last-seen zone.', D('#/tracking')],
      ['Child abduction response.', 'Zone lockdown workflow, exit-gate alerts and cross-camera tracking with police integration.', []],
      ['Wandering PRMs or lost elderly passengers.', 'Wearable BLE tags offered voluntarily, with geofence alerts.', []],
      ['Search speed across many hours of video.', 'Indexed metadata (attributes plus embeddings) for sub-minute search instead of manual review.', []],
      ['Privacy and abuse of search tools.', 'Role-based access, mandatory reason codes, case numbers and audit logs.', D('#/governance')],
    ] },
    { id: 'face', name: 'Face search and facial recognition', rows: [
      ['Low-resolution faces at long range.', 'PTZ auto-zoom on a detected face, 4K+ cameras at choke points, and quality-gated matching.', []],
      ['Pose, angle, masks and sunglasses.', 'Pose-robust and occlusion-robust models, with 3D face reconstruction and multi-frame fusion.', []],
      ['False matches at scale (1:N over millions).', 'Tuned thresholds, a two-stage match (fast index and then precise re-rank), and mandatory human review.', []],
      ['Watchlist quality.', 'Curated and governed lists with source, expiry and legal basis for each entry, and periodic review.', []],
      ['Retrospective forensic search.', 'Face embeddings indexed in a vector DB (for example FAISS or Milvus) for fast search of past footage by uploaded photo.', []],
      ['Demographic bias.', 'Independent bias audits, balanced training sets and per-group threshold calibration.', []],
      ['Legal restrictions (EU AI Act, local law).', 'A configurable policy engine that enables or disables features per jurisdiction. Retention limits and a clear signage policy.', D('#/governance')],
      ['Template security.', 'Encrypted templates, a HSM or secure enclave and cancellable biometrics.', []],
      ['Deepfake or tampered video as evidence.', 'Signed and hashed video at capture and a tamper-evident evidence chain.', []],
    ] },
    { id: 'cross', name: 'Cross-cutting challenges', rows: [
      ['Integration: many legacy vendors and protocols (ONVIF, OPC-UA, DICOS, MQTT, proprietary).', 'An integration layer with adapters and a canonical event schema, plus open APIs.', D('#/sources')],
      ['Data fusion: different time bases and IDs.', 'NTP/PTP time sync, a global entity resolution service and an identity graph.', D('#/fusion')],
      ['Latency: real-time response is needed at edge sites.', 'Edge inference on GPU or NPU, with only metadata sent to the core.', D('#/sources')],
      ['Scalability: thousands of cameras and streams.', 'Cloud-native microservices, Kubernetes and tiered storage (hot, warm and cold).', []],
      ['Bandwidth and storage: video volume is huge.', 'Event-based recording, H.265 or AV1, smart retention and metadata-first search.', []],
      ['Reliability: the system must work 24/7.', 'Redundancy, graceful degradation (the lane still operates if AI is down), and health monitoring of cameras and sensors.', D('#/maintenance')],
      ['Explainability: operators must trust alerts.', 'Show evidence clips, confidence and the reason an alert fired.', D(['#/fusion', '#/incidents'])],
      ['Model drift: accuracy decays over time.', 'MLOps with monitoring, shadow deployment and scheduled revalidation.', []],
      ['Compliance and ethics: privacy, bias, oversight.', 'DPIA, privacy by design (blur non-alert faces), clear governance and human-in-the-loop.', D('#/governance')],
      ['Operations and training: staff adoption and alert fatigue.', 'Simple UI, SOP-driven workflows, drills and KPI dashboards.', D('#/incidentdash')],
      ['Cybersecurity: large attack surface of IoT devices.', 'Device identity and certificates, patch management, network segmentation and anomaly detection on IoT traffic.', []],
      ['Cost and ROI: high upfront cost.', 'A phased rollout beginning with unattended bags and queue analytics, then identity and face search.', D('#/governance')],
    ] },
    { id: 'iot', name: 'IoT layer to add', rows: [
      ['Door and gate sensors', 'Tailgating detection and secure zone control.', D('#/twin/tailgate')],
      ['BLE, UWB and Wi-Fi positioning', 'Indoor location with passenger consent.', []],
      ['RFID and barcode on bags', 'Chain of custody.', D('#/baggage')],
      ['Smart bins and lockers', 'Weight and tamper sensors.', []],
      ['Environmental sensors (CO, smoke, chemical, gas)', 'Tied to security alerts.', []],
      ['Wearables for staff and for PRMs', 'Panic buttons and location for staff, and voluntary tags for PRMs.', []],
      ['Drones and robots', 'Patrol and verification of alerts.', []],
      ['Occupancy and queue sensors (ToF, radar)', 'Work without cameras.', D('#/twin')],
    ] },
  ];

  AF.bpFusion = [
    { t: 'Bag-passenger match', d: 'The X-ray bag ID, the passenger at the tray and the boarding pass are linked. If an alarmed bag\'s owner walks away, the system locates them automatically.', demo: '#/checkpoint' },
    { t: 'Unattended bag with a suspicious X-ray history', d: 'The score rises when the bag was flagged earlier in the journey.', demo: '#/twin/unattended' },
    { t: 'Missing passenger at the gate', d: 'The journey graph (last security scan, last camera, Wi-Fi position) feeds the gate agent and the final-call announcement.', demo: '#/tracking' },
    { t: 'Watchlist hit plus tailgating plus restricted zone', d: 'Several weak signals combine into one high-priority incident.', demo: '#/twin/tailgate' },
    { t: 'Child lost', d: 'Group association, attribute search and exit-gate watch run together.', demo: null },
  ];

  AF.bpRoadmap = [
    { p: 'Phase 1', when: '0 to 6 months', scope: 'Camera standardisation, VMS integration, event bus, unattended bag and queue analytics, attribute search', why: 'Quick wins that do not need biometrics' },
    { p: 'Phase 2', when: '6 to 12 months', scope: 'AI-assisted X-ray and CT triage, bag-passenger reconciliation, perimeter analytics, IoT door sensors', why: 'Operational throughput and security gain' },
    { p: 'Phase 3', when: '12 to 18 months', scope: 'Consent-based biometric journey (check-in to boarding), missing person workflow, journey graph', why: 'Needs governance and consent processes ready' },
    { p: 'Phase 4', when: '18+ months', scope: 'Face watchlist and forensic face search under legal approval, digital twin, predictive analytics', why: 'Highest legal and ethical risk, so it comes last' },
  ];

  AF.bpKpis = [
    ['Detection rate and false alarm rate per use case', 'Detection 95%+, false alarms under 5%', 'False alarm rate 4.1% (sample)', true],
    ['Time to detect and resolve an unattended bag', 'Detect under 2 min, resolve under 10 min', 'Detect 12 s, resolve 4 min 30 s (scripted twin)', true],
    ['Mean time to locate a missing person', 'Under 5 min', 'Not implemented', false],
    ['Security throughput and queue time', '600 passengers per lane per hour, wait under 6m 30s', '612 per lane per hour, wait 6m 40s (sample)', true],
    ['Operator alert acceptance and alert-fatigue indicators', '80%+ accepted', 'Not measured', false],
    ['Biometric match accuracy by demographic group', 'Parity within an agreed margin', 'Not implemented: no face recognition in this app', false],
    ['Camera and sensor uptime', '99%+', '99.2% (sample)', true],
    ['Privacy metrics: audit exceptions and retention violations', 'Zero', 'Not measured', false],
  ];
})();
