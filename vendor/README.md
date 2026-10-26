# Vendored libraries

Third-party code bundled so the demo works offline and without a build step.
They are loaded only when a page needs them (real map, live video analytics, HLS streams).

| Library | Version | Licence | Used for |
| --- | --- | --- | --- |
| Leaflet | 1.9.4 | BSD-2-Clause | real map |
| TensorFlow.js | 4.22.0 | Apache-2.0 | in-browser inference |
| COCO-SSD | 2.2.3 | Apache-2.0 | person and bag detection (model weights are fetched from storage.googleapis.com when first used) |
| hls.js | 1.5.17 | Apache-2.0 | HLS (.m3u8) camera streams |
