/* AeroFusion AI - real video library: which real clip backs which use case, and where no real footage exists. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {});
  AF.videoLibrary = {
    clips: [
      { id: 'checkpoint', file: 'footage/CAM-03', title: 'Checkpoint screening demo', cam: 'CAM-03', src: 'Supplied by the project owner', lic: 'Confirm publishing rights', note: 'People with IDs, bag X-ray cards, body scanner alarms, secondary screening. Labels are in CAM-03.labels.json.' },
      { id: 'crowd', file: 'footage/CAM-02', title: 'Busy aisle, many people', cam: 'CAM-02', src: 'Intel IoT Devkit sample-videos: store-aisle-detection', lic: 'CC BY 4.0', note: 'Several people moving at once, some carrying bags.' },
      { id: 'corridor', file: 'footage/CAM-04', title: 'Indoor corridor', cam: 'CAM-04', src: 'Intel IoT Devkit sample-videos: people-detection', lic: 'CC BY 4.0', note: 'Fixed camera in a hall with long empty periods and a person walking through.' },
      { id: 'lot', file: 'footage/CAM-05', title: 'Open area with a cyclist', cam: 'CAM-05', src: 'Intel IoT Devkit sample-videos: person-bicycle-car-detection', lic: 'CC BY 4.0', note: 'High camera over a car park, one person and a cyclist.' },
      { id: 'zone', file: 'footage/CAM-06', title: 'Ground crew in a marked zone', cam: 'CAM-06', src: 'Intel IoT Devkit sample-videos: worker-zone-detection', lic: 'CC BY 4.0', note: 'People in hi-vis walking in and out of a marked restricted zone.' },
      { id: 'kerb', file: 'footage/CAM-01', title: 'Overhead road with cars', cam: 'CAM-01', src: 'Intel IoT Devkit sample-videos: car-detection', lic: 'CC BY 4.0', note: 'Cars entering, stopping and leaving a road seen from above.' },
      { id: 'plaza', file: 'footage/library/pedestrians', title: 'Pedestrians in an open plaza', cam: null, src: 'OpenCV samples/data/vtest.avi', lic: 'Apache-2.0', note: 'Groups walking together past a camera, with items left on the grass.' },
    ],
    /* quality: direct = shows the situation; indicative = similar setting, different event; none = no real footage available */
    cases: [
      { uc: 'Checkpoint: person-to-bag, X-ray flag, body scanner alarm', rows: 'SCR-1 to SCR-8, IDN-1', clip: 'checkpoint', q: 'direct' },
      { uc: 'Crowds and multi-person tracking', rows: 'TRK-1, TRK-2, TRK-5', clip: 'crowd', q: 'indicative' },
      { uc: 'Groups walking together, people leaving a group', rows: 'MIS-3', clip: 'plaza', q: 'direct' },
      { uc: 'Attribute search by clothing and bags', rows: 'MIS-1, MIS-2, MIS-7', clip: 'plaza', q: 'direct' },
      { uc: 'Restricted zone entry and exit', rows: 'BEH-3, IDN-7', clip: 'zone', q: 'indicative' },
      { uc: 'Vehicle dwell at the kerb', rows: 'BAG-1', clip: 'kerb', q: 'indicative' },
      { uc: 'Corridor monitoring and camera image health', rows: 'TRK-4', clip: 'corridor', q: 'direct' },
      { uc: 'Open-area tracking with several movers', rows: 'TRK-1', clip: 'lot', q: 'indicative' },
      { uc: 'Unattended or abandoned bag', rows: 'BAG-1 to BAG-4', clip: null, q: 'none', why: 'No real abandoned-bag clip could be downloaded here. The standard test set (i-LIDS / AVSS 2007 AB) needs a separate download from QMUL.' },
      { uc: 'Tailgating at a door', rows: 'BEH-4', clip: null, q: 'none', why: 'No openly licensed tailgating footage was found.' },
      { uc: 'Falls, fights and medical events', rows: 'BEH-5', clip: null, q: 'none', why: 'No openly licensed footage found. The fall detector runs on any webcam or file you provide.' },
      { uc: 'Missing child and family separation', rows: 'MIS-1, MIS-3', clip: null, q: 'none', why: 'Footage of children is deliberately not used. The group logic is shown on the plaza clip with adults.' },
      { uc: 'Perimeter intrusion at night', rows: 'BEH-3', clip: null, q: 'none', why: 'No real thermal or night perimeter clip found. The marked-zone clip is the nearest.' },
    ],
  };
})();
