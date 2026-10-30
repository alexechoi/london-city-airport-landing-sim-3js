# E190 model and livery

Source: https://github.com/YV3399/E-jet-family-YV at commit 1338d8f4a3cb884171f7136488e069e219d06611. Model, textures and BA livery are GPL-2.0-or-later, separately from the application. The original source, notices and complete license are in source.zip. Credits include Narendran Muraleedharan, Semir Gebran, Stefan Frank, Gabriel Hernandez, D-ECHO, Tobias Dammers, legoboyvldp and the original livery team (full upstream credits in the source archive). The BA atlas originated in the E170 paint set and is applied to the E190 geometry as a visual approximation.

Conversion: scripts/convert-e190.py, Blender 4.3.2. Coordinate conversion, material adaptation and binary glTF export; no FlightGear simulation code is included. Rebuild: `blender -b --python scripts/convert-e190.py -- <unpacked-source> public/models/e190.glb`.
