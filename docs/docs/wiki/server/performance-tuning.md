# Performance Tuning

Optimize your Voxelize server and client for different hardware and player counts.

## Server Configuration

### Chunk Processing

Control how many chunks process per tick:

```rust title="Chunk Settings"
let config = WorldConfig::new()
    .max_chunks_per_tick(4)       // Chunks generated per tick (default: 4)
    .max_response_per_tick(3)     // Chunks sent to clients per tick (default: 3)
    .max_updates_per_tick(500)    // Voxel updates processed per tick (default: 500)
    .max_saves_per_tick(2)        // Chunks saved per tick (default: 2)
    .build();
```

| Setting | Low-End | Standard | High-End |
|---------|---------|----------|----------|
| `max_chunks_per_tick` | 2 | 4 | 8-12 |
| `max_response_per_tick` | 2 | 3 | 4-6 |
| `max_updates_per_tick` | 250 | 500 | 1000 |
| `max_saves_per_tick` | 1 | 2 | 4 |

### Sub-Chunks

Split chunks vertically for more efficient meshing:

```rust title="Sub-Chunk Configuration"
let config = WorldConfig::new()
    .max_height(256)
    .sub_chunks(8)    // 256 / 8 = 32 blocks per sub-chunk
    .build();
```

More sub-chunks means:
- Smaller mesh updates when voxels change
- More draw calls on the client
- Trade-off depends on how often chunks change

### World Preloading

Pre-generate chunks at startup to avoid lag spikes:

```rust title="Preloading"
let config = WorldConfig::new()
    .preload(true)
    .preload_radius(8)    // Preload 8-chunk radius around origin
    .build();
```

Use this for spawn areas where players always arrive.

### World Bounds

Limit the world size to prevent infinite expansion:

```rust title="World Bounds"
let config = WorldConfig::new()
    .min_chunk([-100, -100])
    .max_chunk([100, 100])
    .build();
```

This caps the world at a 200x200 chunk area.

## Client Configuration

### Render Distance

Set via `ChunkRequestsComp` on the server or client-side world config:

```ts title="Client Render Distance"
import * as VOXELIZE from "@voxelize/core";

const world = new VOXELIZE.World({
  renderRadius: 8,     // Chunks to render
  requestRadius: 10,   // Chunks to request (slightly larger)
});
```

| Hardware | renderRadius | requestRadius |
|----------|--------------|---------------|
| Low-end | 4-6 | 6-8 |
| Mid-range | 8-10 | 10-12 |
| High-end | 12-16 | 14-18 |

### Worker Pools

Meshing and lighting run in Web Workers. Configure pool size:

```ts title="Worker Pool Configuration"
const world = new VOXELIZE.World({
  maxMeshWorkers: 4,    // Parallel mesh generation
  maxLightWorkers: 2,   // Parallel light calculation
});
```

Match worker count to available CPU cores. More workers = faster chunk loading but higher memory.

### Frustum Culling

Enabled by default. Skips rendering chunks outside the camera view:

```ts title="Frustum Culling"
// Built into VOXELIZE.World, but can be tuned
world.chunks.frustumCulling = true;

// Optionally expand the frustum slightly to reduce pop-in
world.chunks.frustumMargin = 0.1;  // 10% margin
```

## Network Optimization

### Update Compression

Protocol buffers handle compression automatically. For further optimization:

```rust title="Server Update Batching"
// These are internal but affect network load
// max_response_per_tick limits chunk messages per tick
// MessageQueue batches entity updates
```

### Client Update Throttling

Reduce position update frequency for distant entities:

```ts title="Entity Update Throttling"
const entities = new VOXELIZE.Entities({
  updateInterval: 50,  // ms between updates (default: 16.67 = 60fps)
});
```

### Interest Management

Only send entity data to clients in range:

```rust title="Chunk Interests"
// Built into Voxelize's ChunkInterests system
// Entities only send updates to clients whose loaded chunks contain them
```

## AI and Pathfinding

### Pathfinding Limits

Constrain A* search to prevent server stalls:

```rust title="Pathfinding Constraints"
.with(PathComp::new(
    100,                           // max_nodes (shorter = faster)
    32.0,                          // max_distance (blocks)
    10000,                         // max_depth_search
    Duration::from_millis(50),     // time budget per tick
))
```

For many AI entities, reduce these values:

| Entity Count | max_nodes | max_distance | max_pathfinding_time |
|--------------|-----------|--------------|---------------------|
| 1-10 | 150 | 48.0 | 75ms |
| 10-50 | 100 | 32.0 | 50ms |
| 50+ | 50 | 16.0 | 25ms |

### Entity Tree Updates

The KdTree rebuilds every tick. With many entities, consider:

```rust title="Custom Dispatcher"
// Run EntityTreeSystem less frequently
use specs::DispatcherBuilder;

let dispatcher = DispatcherBuilder::new()
    // ... other systems
    .with(EntityTreeSystem, "entity_tree", &[])
    // Consider batching or throttling for large entity counts
    .build();
```

## Memory Management

### Chunk Unloading

Chunks unload when no clients need them. Monitor memory:

```rust title="Chunk Count Monitoring"
// In a custom system
fn run(&mut self, chunks: Read<Chunks>) {
    let count = chunks.len();
    if count > 10000 {
        warn!("High chunk count: {}", count);
    }
}
```

### Entity Cleanup

Remove entities when they're no longer needed:

```rust title="Entity Cleanup"
// Remove specific entity
world.remove_entity("entity-id");

// Or use a cleanup system
pub struct CleanupOldEntitiesSystem;

impl<'a> System<'a> for CleanupOldEntitiesSystem {
    // Check entity age, distance from players, etc.
}
```

## Profiling

### Server Profiling

Voxelize includes basic tick stats:

```rust title="Accessing Stats"
use voxelize::Stats;

// In a system
fn run(&mut self, stats: Read<Stats>) {
    println!("Delta: {}ms, Tick: {}", stats.delta * 1000.0, stats.tick);
}
```

### Client Profiling

Use browser dev tools and the Debug class:

```ts title="Client Debug"
const debug = new VOXELIZE.Debug(world);
debug.attach(document.body);

// Shows:
// - FPS
// - Chunk count
// - Entity count
// - Memory usage (if available)
```

## Benchmarks

The codebase includes benchmarks for critical systems:

```bash title="Running Benchmarks"
cargo bench
```

Benchmarks cover:
- `lights_bench.rs` - Light propagation
- `mesher_bench.rs` - Chunk meshing

## Quick Checklist

**Server slow?**
- Reduce `max_chunks_per_tick`
- Lower pathfinding limits
- Check entity count
- Enable preloading for spawn area

**Client laggy?**
- Reduce render distance
- Check worker pool sizes
- Enable/verify frustum culling
- Profile with browser dev tools

**Network bottleneck?**
- Reduce `max_response_per_tick`
- Check client interest ranges
- Monitor update frequency

## Example: Optimized Production Config

```rust title="Production Server Config"
let config = WorldConfig::new()
    .seed(12345)
    // Chunk processing
    .max_chunks_per_tick(6)
    .max_response_per_tick(4)
    .max_updates_per_tick(750)
    // Memory management
    .preload(true)
    .preload_radius(5)
    .min_chunk([-500, -500])
    .max_chunk([500, 500])
    // Persistence (less frequent for performance)
    .saving(true)
    .save_dir("./world")
    .save_interval(1200)  // Every 20 seconds at 60 TPS
    .max_saves_per_tick(3)
    .build();
```
