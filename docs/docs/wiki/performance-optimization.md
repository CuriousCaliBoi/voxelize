---
sidebar_position: 2
---

# Performance Optimization Guide

Voxelize is designed for high performance, but proper configuration is essential for optimal frame rates and server tick rates. This guide covers tuning server, client, and network performance.

## Server Performance

### Chunk Processing

Control how many chunks are processed per tick:

```rust
let config = WorldConfig::new()
    .max_chunks_per_tick(24)      // Process 24 chunks per tick (default: 4)
    .max_updates_per_tick(1000)   // Process 1000 voxel updates per tick (default: 500)
    .max_response_per_tick(4)     // Send 4 chunk responses per tick (default: 3)
    .build();
```

**Tuning Guidelines:**

- **`max_chunks_per_tick`** - Higher values = faster chunk generation but more CPU usage
  - 4-8: Conservative, good for low-end servers
  - 12-24: Balanced, good for most servers
  - 32-64: Aggressive, requires powerful CPU

- **`max_updates_per_tick`** - Higher values = more voxel changes processed per tick
  - 500: Conservative
  - 1000-2000: Balanced
  - 5000+: Aggressive (may cause lag spikes)

- **`max_response_per_tick`** - Limits chunk sending rate to prevent network bottlenecks
  - 3-4: Good for most cases
  - 6-8: For fast networks

### Sub-Chunks

Sub-chunks divide chunks into smaller pieces for more efficient meshing:

```rust
let config = WorldConfig::new()
    .sub_chunks(8)  // Divide each chunk into 8 sub-chunks (default: 8)
    .build();
```

**Sub-chunk Count:**
- More sub-chunks = better parallelization but more overhead
- 4-8 sub-chunks is optimal for most cases
- 16+ sub-chunks may reduce performance due to overhead

### Thread Configuration

Voxelize uses Rayon for parallel processing. Configure thread count:

```rust
use rayon::ThreadPoolBuilder;

ThreadPoolBuilder::new()
    .num_threads(4)  // Use 4 threads (default: CPU count)
    .build_global()
    .unwrap();
```

**Thread Count:**
- Default (CPU count): Usually optimal
- 2-4 threads: For low-end servers
- 8-16 threads: For high-end servers with many cores

### Pathfinding Performance

Limit pathfinding computation to prevent lag:

```rust
use std::time::Duration;

let path_comp = PathComp::new(
    100,                          // max_nodes: Limit path length
    32.0,                         // max_distance: Limit search distance
    10000,                        // max_depth_search: Limit A* exploration
    Duration::from_millis(50),     // max_pathfinding_time: Time limit
);
```

**Tuning:**
- Reduce `max_distance` for entities that shouldn't pathfind far
- Lower `max_depth_search` to cap computation
- Decrease `max_pathfinding_time` to prevent expensive searches

### Saving Performance

Control save rate to prevent I/O lag:

```rust
let config = WorldConfig::new()
    .max_saves_per_tick(2)    // Save 2 chunks per tick (default: 2)
    .save_interval(300)       // Save every 300 ticks (default: 300)
    .build();
```

**Tuning:**
- Increase `max_saves_per_tick` for fast storage (SSD)
- Increase `save_interval` to reduce save frequency
- Use `DoNotPersistComp` for temporary entities

## Client Performance

### Render Radius

Control how many chunks are rendered:

```typescript
const world = new World(registry, {
  renderRadius: 8,  // Render chunks within 8 chunks (default: 8)
});
```

**Render Radius:**
- 4-6: Low-end devices, mobile
- 8-12: Balanced, most devices
- 16+: High-end devices only

### Chunk Loading

```typescript
const world = new World(registry, {
  loadRadius: 12,      // Load chunks within 12 chunks
  unloadRadius: 16,    // Unload chunks beyond 16 chunks
});
```

**Tuning:**
- Keep `unloadRadius` > `loadRadius` to prevent thrashing
- Lower values = less memory usage but more loading

### Web Worker Pools

Configure worker pools for meshing and lighting:

```typescript
import { SharedWorkerPool } from "@voxelize/core";

// Configure mesh worker pool
const meshPool = new SharedWorkerPool({
  maxWorkers: 4,  // Use 4 workers for meshing
  workerPath: "/workers/mesh-worker.js",
});

// Configure light worker pool
const lightPool = new SharedWorkerPool({
  maxWorkers: 2,  // Use 2 workers for lighting
  workerPath: "/workers/light-worker.js",
});
```

**Worker Count:**
- 2-4 workers: Good for most devices
- 4-8 workers: For powerful devices
- More workers = better parallelization but more memory

### Frustum Culling

Frustum culling hides chunks outside the camera view:

```typescript
const world = new World(registry, {
  frustumCull: true,  // Enable frustum culling (default: true)
});
```

**Benefits:**
- Reduces rendered chunks by ~30-50%
- Significant FPS improvement
- Should always be enabled

### Chunk Mesh Optimization

```typescript
const world = new World(registry, {
  greedyMeshing: true,  // Use greedy meshing (default: true)
  aoEnabled: true,      // Enable ambient occlusion (default: true)
});
```

**Options:**
- `greedyMeshing`: Combines faces for fewer triangles
- `aoEnabled`: Adds ambient occlusion (slight performance cost)

### Texture Optimization

```typescript
// Use compressed textures
const texture = new AtlasTexture({
  format: THREE.RGBAFormat,
  generateMipmaps: true,  // Generate mipmaps for better performance
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter,
});
```

**Tips:**
- Use texture atlases to reduce draw calls
- Enable mipmaps for distant chunks
- Use compressed texture formats (DXT, ETC2) when possible

## Network Performance

### Compression

Voxelize uses protocol buffers which are already efficient, but you can add additional compression:

```rust
// Server-side: Compress messages before sending
use flate2::Compression;

let compressed = compress_message(message, Compression::fast());
```

### Update Throttling

Limit update frequency to reduce bandwidth:

```typescript
// Client-side: Throttle position updates
const network = new Network(transport);
network.setUpdateInterval(50);  // Update every 50ms instead of every frame
```

### Chunk Prioritization

Prioritize chunks by distance and view direction:

```typescript
// Chunks closer to player are loaded first
// Chunks in view direction are prioritized
// This happens automatically
```

## Memory Optimization

### Entity Cleanup

Remove entities that are no longer needed:

```rust
// Mark temporary entities for cleanup
world.remove_entity("projectile-id");
```

### Chunk Unloading

Chunks are automatically unloaded when beyond `unloadRadius`, but you can force unload:

```typescript
world.chunks.unloadChunk(chunkX, chunkZ);
```

### Texture Memory

Limit texture resolution:

```typescript
const texture = new AtlasTexture({
  width: 512,   // Use 512x512 instead of 1024x1024
  height: 512,
});
```

## Profiling

### Server Profiling

Use Rust profiling tools:

```rust
// Add to Cargo.toml
[profile.release]
debug = true  # Enable debug symbols for profiling

// Use perf or flamegraph
cargo install flamegraph
cargo flamegraph --bin server
```

### Client Profiling

Use browser DevTools:

```typescript
// Enable performance monitoring
const stats = new Stats();
document.body.appendChild(stats.dom);

// Profile specific operations
console.time("chunk-generation");
// ... chunk generation code ...
console.timeEnd("chunk-generation");
```

## Performance Checklist

### Server
- [ ] Set `max_chunks_per_tick` based on CPU
- [ ] Configure `sub_chunks` (4-8 optimal)
- [ ] Limit pathfinding parameters
- [ ] Tune save interval and rate
- [ ] Use appropriate thread count

### Client
- [ ] Set `renderRadius` based on device
- [ ] Configure worker pools (2-4 workers)
- [ ] Enable frustum culling
- [ ] Use greedy meshing
- [ ] Optimize texture sizes

### Network
- [ ] Enable message compression if needed
- [ ] Throttle frequent updates
- [ ] Monitor bandwidth usage

## Common Performance Issues

### Low FPS

**Causes:**
- Render radius too high
- Too many entities
- Complex shaders
- Large textures

**Solutions:**
- Reduce render radius
- Enable frustum culling
- Optimize shaders
- Reduce texture resolution

### Server Lag

**Causes:**
- Too many chunks processed per tick
- Expensive pathfinding
- Too many entity updates
- Slow disk I/O

**Solutions:**
- Reduce `max_chunks_per_tick`
- Limit pathfinding distance/time
- Batch entity updates
- Use faster storage (SSD)

### High Memory Usage

**Causes:**
- Too many loaded chunks
- Large textures
- Memory leaks

**Solutions:**
- Reduce load radius
- Use smaller textures
- Check for memory leaks
- Force garbage collection (client)

## Benchmarking

### Server Benchmarks

Voxelize includes built-in benchmarks:

```bash
cargo bench
```

### Client Benchmarks

Create custom benchmarks:

```typescript
function benchmarkChunkGeneration() {
  const iterations = 100;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Generate chunk
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b) / times.length;
  console.log(`Average: ${avg}ms`);
}
```

## Summary

Performance optimization involves:

- ✅ Tuning server chunk processing rates
- ✅ Configuring client render radius and workers
- ✅ Optimizing network update frequency
- ✅ Managing memory with proper unloading
- ✅ Profiling to identify bottlenecks

Start with conservative settings and gradually increase based on your hardware and requirements!
