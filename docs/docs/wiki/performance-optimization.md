---
sidebar_position: 2
---

# Performance Optimization Guide

This guide covers tuning Voxelize for optimal performance on both server and client. Learn how to balance visual quality, network usage, and frame rates.

## Server-Side Optimization

### Chunk Processing Limits

Control how many chunks are processed per tick:

```rust title="Chunk Processing Tuning"
let config = WorldConfig::new()
    .max_chunks_per_tick(24)        // Chunks generated per tick
    .max_updates_per_tick(1000)      // Voxel updates per tick
    .max_response_per_tick(4)        // Chunks sent to clients per tick
    .max_saves_per_tick(2)           // Chunks saved per tick
    .build();
```

**Tuning Guidelines:**
- **`max_chunks_per_tick`**: Higher values = faster chunk loading but more CPU usage
  - Default: 4 (conservative)
  - Recommended: 8-16 for fast servers, 24+ for dedicated hardware
- **`max_updates_per_tick`**: Limits block updates to prevent lag spikes
  - Default: 500
  - Increase if you have many simultaneous block changes
- **`max_response_per_tick`**: Prevents network flooding
  - Default: 3
  - Increase for faster initial loading, decrease for stability

### Sub-Chunk Configuration

Sub-chunks divide chunks vertically for more efficient meshing:

```rust title="Sub-Chunk Configuration"
let config = WorldConfig::new()
    .chunk_size(16)                  // Horizontal chunk size
    .sub_chunks(8)                   // Vertical subdivisions
    .max_height(256)                  // Must be divisible by sub_chunks
    .build();
```

**Benefits:**
- Only regenerates mesh for changed sub-chunks
- Reduces memory usage for partial updates
- Default: 8 sub-chunks (32 blocks each for 256 height)

**Tuning:**
- More sub-chunks = finer granularity but more overhead
- Fewer sub-chunks = less overhead but larger update regions
- Recommended: 4-8 sub-chunks

### Thread Configuration

Voxelize uses parallel processing. Configure thread pools:

```rust title="Thread Pool Configuration"
// In your main.rs or server setup
use rayon::ThreadPoolBuilder;

ThreadPoolBuilder::new()
    .num_threads(4)                  // Match CPU cores
    .build_global()
    .unwrap();
```

**Guidelines:**
- Match thread count to CPU cores (physical cores, not hyperthreading)
- Too many threads = context switching overhead
- Too few threads = underutilized CPU

### Pathfinding Performance

Optimize AI pathfinding:

```rust title="Pathfinding Limits"
use std::time::Duration;

PathComp::new(
    100,                              // max_nodes: Shorter paths = faster
    24.0,                            // max_distance: Closer targets = faster
    5000,                            // max_depth_search: Lower = faster
    Duration::from_millis(25),       // max_pathfinding_time: Shorter = faster
)
```

**Performance Tips:**
- Reduce `max_distance` for entities that don't need long-range pathfinding
- Lower `max_depth_search` for simpler terrain
- Use shorter `max_pathfinding_time` to prevent expensive calculations
- Consider disabling pathfinding for distant entities

### Entity Count Management

Limit active entities to prevent performance degradation:

```rust title="Entity Limits"
// Custom system to despawn distant entities
struct EntityCullingSystem;

impl<'a> System<'a> for EntityCullingSystem {
    type SystemData = (
        ReadExpect<'a, Clients>,
        ReadStorage<'a, PositionComp>,
        Entities<'a>,
    );
    
    fn run(&mut self, (clients, positions, entities): Self::SystemData) {
        let max_distance = 100.0; // blocks
        
        for (_, client) in clients.iter() {
            if let Some(client_pos) = client.position {
                for (entity, pos) in (&entities, &positions).join() {
                    let dx = pos.0.0 - client_pos.0;
                    let dz = pos.0.2 - client_pos.2;
                    let distance = (dx * dx + dz * dz).sqrt();
                    
                    if distance > max_distance {
                        // Despawn entity
                        entities.delete(entity).ok();
                    }
                }
            }
        }
    }
}
```

## Client-Side Optimization

### Render Radius

Control how many chunks are rendered:

```typescript title="Render Radius Configuration"
import { World } from "@voxelize/core";

const world = new World({
  defaultRenderRadius: 6,  // Chunks (default: 6)
});

// Dynamically adjust based on performance
world.renderRadius = 8;  // Increase for better visuals
world.renderRadius = 4;  // Decrease for better performance
```

**Tuning Guidelines:**
- Lower values = better performance, less visual range
- Higher values = better visuals, more GPU/CPU usage
- Recommended: 4-8 chunks (64-128 blocks)
- Consider dynamic adjustment based on FPS

### Frustum Culling

Frustum culling is enabled by default. Ensure it's working:

```typescript title="Frustum Culling Check"
// Voxelize automatically frustum culls chunks
// Verify chunks outside view aren't being rendered
// Check browser DevTools Performance tab
```

**Verification:**
- Open browser DevTools → Performance
- Record a session while moving
- Check that chunks outside view aren't being rendered

### Web Worker Pools

Voxelize uses Web Workers for meshing and lighting. Configure pool size:

```typescript title="Worker Pool Configuration"
import { SharedWorkerPool } from "@voxelize/core";

// Worker pools are created automatically
// You can access them if needed:
// - Meshing workers: Used for chunk mesh generation
// - Lighting workers: Used for light calculations
```

**Optimization:**
- More workers = faster processing but more memory
- Default pool sizes are usually optimal
- Monitor CPU usage - too many workers can cause contention

### Chunk Loading Strategy

Optimize chunk loading:

```typescript title="Chunk Loading Optimization"
const world = new World({
  defaultRenderRadius: 6,
  // Chunks load automatically based on render radius
});

// Preload chunks in a direction (e.g., where player is moving)
// This is handled automatically by Voxelize
```

**Tips:**
- Smaller render radius = fewer chunks to load
- Chunks load asynchronously - don't block on chunk availability
- Consider preloading chunks in movement direction

### Memory Management

Monitor and manage memory:

```typescript title="Memory Monitoring"
// Check memory usage
const memory = (performance as any).memory;
console.log("Used:", memory.usedJSHeapSize / 1048576, "MB");
console.log("Total:", memory.totalJSHeapSize / 1048576, "MB");

// Unload distant chunks if memory is high
if (memory.usedJSHeapSize > 500 * 1048576) { // 500 MB
  world.renderRadius = Math.max(4, world.renderRadius - 1);
}
```

**Memory Tips:**
- Lower render radius reduces memory usage
- Unused chunks are automatically garbage collected
- Monitor for memory leaks in custom code

## Network Optimization

### Compression Settings

Protocol buffers are already compressed, but you can optimize further:

```rust title="Network Optimization"
// Voxelize uses protocol buffers which are efficient
// No additional compression needed
// Focus on reducing update frequency instead
```

### Update Throttling

Reduce network traffic by throttling updates:

```rust title="Update Throttling"
// Metadata updates are sent automatically
// Reduce update frequency by batching changes:

struct BatchedUpdateSystem {
    update_counter: u64,
}

impl<'a> System<'a> for BatchedUpdateSystem {
    type SystemData = ReadExpect<'a, Stats>;
    
    fn run(&mut self, stats: Self::SystemData) {
        // Only update metadata every N ticks
        if stats.tick % 10 == 0 {
            // Perform updates
        }
    }
}
```

### Chunk Request Optimization

Optimize chunk requests:

```typescript title="Chunk Request Optimization"
// Chunks are requested automatically based on render radius
// Reduce render radius to request fewer chunks
world.renderRadius = 4;  // Requests fewer chunks
```

## Profiling and Monitoring

### Server Profiling

Profile server performance:

```rust title="Server Profiling"
use std::time::Instant;

struct ProfilingSystem {
    chunk_gen_time: Vec<Duration>,
}

impl<'a> System<'a> for ProfilingSystem {
    type SystemData = ReadExpect<'a, Stats>;
    
    fn run(&mut self, stats: Self::SystemData) {
        let start = Instant::now();
        
        // Your code here
        
        let elapsed = start.elapsed();
        if elapsed > Duration::from_millis(16) { // > 1 frame at 60 TPS
            warn!("Slow system: {:?}", elapsed);
        }
    }
}
```

### Client Profiling

Profile client performance:

```typescript title="Client Profiling"
// Use browser Performance API
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16.67) { // > 1 frame at 60 FPS
      console.warn("Slow operation:", entry.name, entry.duration);
    }
  }
});

observer.observe({ entryTypes: ["measure", "mark"] });

// Mark important operations
performance.mark("chunk-mesh-start");
// ... chunk meshing code ...
performance.mark("chunk-mesh-end");
performance.measure("chunk-meshing", "chunk-mesh-start", "chunk-mesh-end");
```

### Frame Time Monitoring

Monitor frame times:

```typescript title="Frame Time Monitoring"
let lastFrameTime = performance.now();

function measureFrameTime() {
  const now = performance.now();
  const frameTime = now - lastFrameTime;
  lastFrameTime = now;
  
  if (frameTime > 16.67) { // > 60 FPS target
    console.warn(`Frame time: ${frameTime.toFixed(2)}ms`);
  }
  
  requestAnimationFrame(measureFrameTime);
}

requestAnimationFrame(measureFrameTime);
```

## Performance Checklist

### Server Checklist

- [ ] `max_chunks_per_tick` set appropriately (8-16 recommended)
- [ ] `max_updates_per_tick` limits block update spikes
- [ ] `sub_chunks` configured for your world height
- [ ] Thread pool matches CPU cores
- [ ] Pathfinding limits prevent expensive calculations
- [ ] Entity culling removes distant entities
- [ ] Save operations don't block main thread

### Client Checklist

- [ ] Render radius optimized (4-8 chunks)
- [ ] Frustum culling working (check DevTools)
- [ ] Web Workers processing efficiently
- [ ] Memory usage monitored and controlled
- [ ] Frame times consistently < 16.67ms (60 FPS)
- [ ] No memory leaks in custom code
- [ ] Chunk loading doesn't cause stutters

## Common Performance Issues

### Server Lag Spikes

**Symptoms:** Periodic server freezes, high tick times

**Solutions:**
- Reduce `max_chunks_per_tick`
- Lower `max_updates_per_tick`
- Add entity culling
- Profile systems to find bottlenecks
- Increase `max_pathfinding_time` or reduce pathfinding distance

### Client Low FPS

**Symptoms:** Low frame rate, stuttering

**Solutions:**
- Reduce `renderRadius`
- Check frustum culling is working
- Monitor Web Worker CPU usage
- Reduce chunk complexity (fewer blocks per chunk)
- Check for memory leaks
- Profile with browser DevTools

### High Memory Usage

**Symptoms:** Browser crashes, high memory consumption

**Solutions:**
- Lower `renderRadius`
- Unload unused chunks manually
- Check for memory leaks
- Reduce entity count
- Monitor chunk count (should be ~renderRadius²)

### Network Bottlenecks

**Symptoms:** Slow chunk loading, laggy multiplayer

**Solutions:**
- Reduce `max_response_per_tick` (but increase if too low)
- Lower client `renderRadius` to request fewer chunks
- Batch metadata updates
- Check network bandwidth
- Use compression if not already enabled

## Example: Optimized Configuration

```rust title="Optimized Server Config"
let config = WorldConfig::new()
    // Chunk processing
    .max_chunks_per_tick(12)
    .max_updates_per_tick(500)
    .max_response_per_tick(4)
    .sub_chunks(8)
    
    // Performance limits
    .max_saves_per_tick(2)
    .save_interval(300)
    
    .build();
```

```typescript title="Optimized Client Config"
const world = new World({
  defaultRenderRadius: 6,  // Balanced performance/visuals
});

// Monitor and adjust dynamically
let frameTimeHistory: number[] = [];

function optimizeRenderRadius() {
  const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b) / frameTimeHistory.length;
  
  if (avgFrameTime > 20 && world.renderRadius > 4) {
    world.renderRadius--;
    console.log("Reduced render radius for performance");
  } else if (avgFrameTime < 12 && world.renderRadius < 8) {
    world.renderRadius++;
    console.log("Increased render radius for better visuals");
  }
  
  frameTimeHistory = [];
}

// Call optimizeRenderRadius() periodically
```

## Next Steps

- Learn about [World Configuration](../tutorials/basics/world-configuration) for more settings
- Check out [Chunk Meshing](./blocks/chunk-meshing) for mesh optimization
- Explore [Custom Entities](../tutorials/intermediate/custom-entity-creation) for efficient entity design
