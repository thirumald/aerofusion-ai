# Footage attribution

The camera clips in this folder are real video, taken from the **intel-iot-devkit/sample-videos** collection
(https://github.com/intel-iot-devkit/sample-videos), published under the
**Creative Commons Attribution 4.0 International** licence (https://creativecommons.org/licenses/by/4.0/).

Changes made: each clip was trimmed, resized to the stated width, reduced to 15 fps, stripped of audio and re-encoded
(H.264 MP4 and VP9 WebM). No other edits.

| Camera | Source clip | Used for |
| --- | --- | --- |
| CAM-01 Curbside | car-detection.mp4 | vehicle dwell and traffic |
| CAM-02 Check-in Hall B | store-aisle-detection.mp4 | crowd tokens, person-to-bag links |
| CAM-03 Checkpoint Lane 3 | checkpoint screening demo video (see below) | person-to-bag correlation, X-ray, body scanner, secondary screening |
| CAM-04 Restroom Corridor | people-detection.mp4 | corridor monitoring, unattended items |
| CAM-05 Meeting Plaza | person-bicycle-car-detection.mp4 | open-space tracking and hand-offs |
| CAM-06 Gate B12 | worker-zone-detection.mp4 | ground crew in a restricted zone |

The footage shows unrelated places and is used only as realistic example video for the analytics.
Replace any file with your own clip of the same name to use your own footage.

## CAM-03 checkpoint video

`CAM-03.mp4` / `.webm` is a checkpoint screening demo video supplied by the project owner (silent, 30 s). It was re-encoded
without audio and otherwise unchanged. Its on-screen annotations (anonymous IDs, bag IDs, X-ray results, body scanner
alarms, secondary screening locations) were read by hand into `CAM-03.labels.json`, which drives the Checkpoint, Sensor
fusion and Cameras pages. Confirm you have the right to publish this video before making the repository public: it was
shared as a LinkedIn video and shows identifiable people.

## Library clip

`library/pedestrians.mp4` / `.webm` is OpenCV's `samples/data/vtest.avi` (https://github.com/opencv/opencv, Apache-2.0),
resized to 768 px wide, stripped of audio and re-encoded. It shows people walking in an open plaza.

## Footage that could not be found

No real abandoned-bag, tailgating, fall or night-perimeter clip could be downloaded in the build environment. The
standard abandoned-baggage test set (i-LIDS / AVSS 2007) is available from Queen Mary University of London
(http://www.eecs.qmul.ac.uk/~andrea/avss2007_d.html); place a clip as `footage/CAM-04.mp4` and `.webm` to use it.

## Additional library clips

`footage/library/corridor-pair`, `table-dwell` and `bottles` come from intel-iot-devkit/sample-videos (CC BY 4.0):
face-demographics-walking, one-by-one-person-detection and bottle-detection. They were trimmed, resized to 480 px wide,
reduced to 15 fps, stripped of audio and re-encoded (H.264 MP4 and VP9 WebM). Faces are not analysed.
