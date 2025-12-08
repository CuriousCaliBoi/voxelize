# Particle System

The Particles class provides GPU-instanced particle rendering for visual effects like block breaking, explosions, and ambient particles.

## Basic Setup

```ts title="Creating Particles"
import * as VOXELIZE from "@voxelize/core";
import * as THREE from "three";

const particles = new VOXELIZE.Particles({
  maxParticles: 10000,
  gravity: new THREE.Vector3(0, -9.8, 0),
});

world.add(particles);
```

## Emitting Particles

### Single Particle

```ts title="Single Particle"
particles.emit({
  position: new THREE.Vector3(10, 5, 10),
  velocity: new THREE.Vector3(0, 2, 0),
  lifetime: 1.5,
  size: 0.1,
  color: new THREE.Color("#ff5500"),
  gravity: 1.0,
  drag: 0.2,
});
```

### Using Presets

Built-in presets for common effects:

```ts title="Preset Effects"
// Block breaking particles
particles.emitPreset("blockBreak", position, {
  color: new THREE.Color("#8B4513"),  // Brown
});

// Block placement dust
particles.emitPreset("blockPlace", position);

// Explosion
particles.emitPreset("explosion", position, {
  color: new THREE.Color("#ff6600"),
});

// Floating dust
particles.emitPreset("dust", position);

// Rising smoke
particles.emitPreset("smoke", position);

// Sparkles
particles.emitPreset("sparkle", position, {
  color: new THREE.Color("#ffff00"),
});
```

### Burst Patterns

Emit multiple particles at once:

```ts title="Burst"
particles.burst(50, position, {
  lifetime: 1.0,
  size: 0.08,
  color: new THREE.Color("#00ff00"),
  velocitySpread: 3.0,
  velocityBias: new THREE.Vector3(0, 2, 0),  // Upward bias
});
```

## Particle Properties

| Property | Type | Description |
|----------|------|-------------|
| `position` | Vector3 | Starting position |
| `velocity` | Vector3 | Initial velocity |
| `lifetime` | number | Duration in seconds |
| `size` | number | Particle size |
| `color` | Color | Particle color |
| `gravity` | number | Gravity multiplier (1.0 = normal) |
| `drag` | number | Air resistance (0-1) |
| `sizeDecay` | number | Size reduction per second |
| `fadeColor` | Color | Color to fade to over lifetime |

## Configuration

```ts title="System Options"
new VOXELIZE.Particles({
  maxParticles: 10000,          // Particle pool size
  gravity: new Vector3(0, -9.8, 0),
  additiveBlending: false,     // Glow effect
  sizeAttenuation: true,       // Size changes with distance
  depthWrite: false,           // Transparency handling
  transparent: true,
});
```

## Update Loop

Call `update()` each frame with delta time:

```ts title="Animation Loop"
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  particles.update(delta);
  requestAnimationFrame(animate);
}
```

## Block Breaking Integration

Emit particles when blocks are broken:

```ts title="Block Break Particles"
import { getBlockParticleColor } from "@voxelize/core";

// When a block is broken
const blockId = world.getVoxelAt(x, y, z);
const color = getBlockParticleColor(world, position, blockId);

particles.emitPreset("blockBreak", position, { color });
```

## Example: Complete Integration

```ts title="Full Implementation"
import * as VOXELIZE from "@voxelize/core";
import * as THREE from "three";

// Setup
const particles = new VOXELIZE.Particles({ maxParticles: 10000 });
world.add(particles);

// Block breaking with particles
inputs.on("click", () => {
  if (voxelInteract.target) {
    const [vx, vy, vz] = voxelInteract.target;
    const blockId = world.getVoxelAt(vx, vy, vz);
    
    // Emit break particles
    const pos = new THREE.Vector3(vx + 0.5, vy + 0.5, vz + 0.5);
    const color = VOXELIZE.getBlockParticleColor(world, pos, blockId);
    particles.emitPreset("blockBreak", pos, { color });
    
    // Remove block
    world.updateVoxel(vx, vy, vz, 0);
  }
});

// Render loop
const clock = new THREE.Clock();
function animate() {
  particles.update(clock.getDelta());
  renderer.render(world, camera);
  requestAnimationFrame(animate);
}
animate();
```

## Performance

- Particles are GPU-instanced for efficiency
- Pool size (`maxParticles`) determines memory usage
- Active particles are compacted in the buffer
- Use `particles.count` to monitor active particles
- Call `particles.clear()` to reset all particles
