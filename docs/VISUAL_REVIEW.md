# Visual review

Compared the in-browser scene to London City Airport's [published east-to-west aerial photograph](https://images.ctfassets.net/lmkdg513arga/Zad75iAnQxHw3FSbWi268/5b11d71922eeaf1f282436bfeff6b1b7/lcy-sky-view.png).

Screenshot passes drove these changes:

1. The first pass had sparse generic boxes and flat water. Replaced the city grid with OSM footprints, roads and dock polygons; added Ultra-Water FFT surface slopes.
2. The second pass still had uniform ground. Added CC0 asphalt/concrete/grass photography and regional Sentinel-2 imagery, aligned to the same geographic frame.
3. Checked the default west approach, BA aircraft side view, runway markings, dock proportions, skyline, desktop controls, and mobile layout. Added a runway selector and retained the east approach.
4. Checked the deployed HTTPS page in Chromium: WebGL initialized, runway 09 was selected, and Take the controls entered flight without browser errors.

The final scene uses real geographic footprints with estimated heights where OSM lacks them. Airport buildings and aircraft are procedural approximations. This is a browser game with simplified physics, not photogrammetry or a certified simulator.

Final images: [title](../public/screenshots/title.png), [approach](../public/screenshots/approach.jpg). The [flythrough](../public/flythrough.mp4) captures the live Three.js renderer.
