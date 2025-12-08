# Audio System

The AudioSystem class provides 3D positional audio, sound effects, and music playback using the Web Audio API.

## Basic Setup

```ts title="Creating AudioSystem"
import * as VOXELIZE from "@voxelize/core";

const audio = new VOXELIZE.AudioSystem({
  masterVolume: 1.0,
  sfxVolume: 1.0,
  musicVolume: 0.5,
  maxDistance: 50,
});

// Initialize (must be after user interaction)
await audio.init();
```

## Loading Sounds

```ts title="Loading Audio"
// Single sound
await audio.load("footstep", "/sounds/footstep.mp3");

// Multiple sounds
await audio.loadAll({
  footstep: "/sounds/footstep.mp3",
  blockBreak: "/sounds/break.mp3",
  ambient: "/sounds/forest.mp3",
  music: "/sounds/background.mp3",
});
```

## Playing Sounds

### Basic Playback

```ts title="Play Sound"
audio.play("footstep");

// With options
audio.play("footstep", {
  volume: 0.8,
  playbackRate: 1.2,
});
```

### 3D Positional Audio

```ts title="3D Audio"
audio.play("explosion", {
  position: new THREE.Vector3(10, 5, 20),
  volume: 1.0,
});

// Attach to moving object
audio.play("engine", {
  attachTo: vehicle,
  loop: true,
});
```

### Music

```ts title="Music Playback"
audio.play("music", {
  category: "music",
  loop: true,
  volume: 0.3,
});

// Crossfade between tracks
audio.crossfade("music1", "music2", 2.0);  // 2 second crossfade
```

## Sound Categories

Three built-in categories with independent volume control:

| Category | Use Case |
|----------|----------|
| `sfx` | Sound effects (default) |
| `music` | Background music |
| `ambient` | Environmental sounds |

```ts title="Category Volume"
audio.setCategoryVolume("music", 0.3);
audio.setCategoryVolume("sfx", 1.0);
audio.setCategoryVolume("ambient", 0.5);
```

## Volume Control

```ts title="Volume Settings"
// Master volume affects everything
audio.setMasterVolume(0.8);

// Category volumes
audio.setCategoryVolume("sfx", 1.0);
audio.setCategoryVolume("music", 0.5);
audio.setCategoryVolume("ambient", 0.7);
```

## Stopping Sounds

```ts title="Stop Sounds"
// Stop specific sound
audio.stop("footstep");

// Stop with fade out
audio.stop("music", 2.0);  // 2 second fade

// Stop all sounds
audio.stopAll();
```

## Listener Position

Update the listener position each frame for proper 3D audio:

```ts title="Update Listener"
function animate() {
  audio.updateListener(camera);
  requestAnimationFrame(animate);
}
```

## Configuration Options

```ts title="Full Options"
new VOXELIZE.AudioSystem({
  masterVolume: 1.0,      // Overall volume
  sfxVolume: 1.0,         // Sound effects volume
  musicVolume: 0.5,       // Music volume
  maxDistance: 50,        // 3D audio cutoff distance
  rolloffFactor: 1,       // Distance attenuation
  refDistance: 1,         // Reference distance for attenuation
});
```

## Browser Autoplay Policy

Modern browsers require user interaction before playing audio:

```ts title="Resume Audio"
// Add to a click handler
document.addEventListener("click", async () => {
  await audio.resume();
}, { once: true });
```

## Sound Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `volume` | number | 1.0 | Volume multiplier |
| `playbackRate` | number | 1.0 | Speed (1 = normal) |
| `loop` | boolean | false | Loop playback |
| `startTime` | number | 0 | Start offset in seconds |
| `position` | Vector3 | null | 3D position |
| `attachTo` | Object3D | null | Follow object |
| `category` | string | "sfx" | Volume category |

## Example: Game Audio Integration

```ts title="Full Implementation"
import * as VOXELIZE from "@voxelize/core";
import * as THREE from "three";

// Setup
const audio = new VOXELIZE.AudioSystem();

// Load all sounds
async function loadAudio() {
  await audio.init();
  await audio.loadAll({
    footstep: "/sounds/footstep.mp3",
    jump: "/sounds/jump.mp3",
    land: "/sounds/land.mp3",
    blockBreak: "/sounds/break.mp3",
    blockPlace: "/sounds/place.mp3",
    ambient: "/sounds/wind.mp3",
    music: "/sounds/background.mp3",
  });

  // Start ambient and music
  audio.play("ambient", { category: "ambient", loop: true, volume: 0.3 });
  audio.play("music", { category: "music", loop: true, volume: 0.2 });
}

// Block interaction sounds
function onBlockBreak(position: THREE.Vector3) {
  audio.play("blockBreak", { position, volume: 0.8 });
}

function onBlockPlace(position: THREE.Vector3) {
  audio.play("blockPlace", { position, volume: 0.6 });
}

// Player movement sounds
let lastFootstep = 0;
function onPlayerMove(position: THREE.Vector3, moving: boolean) {
  if (moving && Date.now() - lastFootstep > 400) {
    audio.play("footstep", { position, volume: 0.5 });
    lastFootstep = Date.now();
  }
}

// Render loop
function animate() {
  audio.updateListener(camera);
  requestAnimationFrame(animate);
}

loadAudio();
animate();
```

## Cleanup

```ts title="Dispose"
audio.dispose();
```
