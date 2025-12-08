---
sidebar_position: 2
---

# Performance Optimization Guide

This guide covers performance tuning for both server and client to ensure smooth gameplay even with many players and complex worlds.

## Server-Side Optimization

### Chunk Processing

#### max_chunks_per_tick

Controls how many chunks are processed per server tick:

```rust
WorldConfig::new()
    .max_chunks_per_tick(4)  // Default: 4 chunks/tick
```

**Guidelines:**
- **Low (2-4)**: Better for single-player or small servers
- **Medium (4-8)**: Balanced for most multiplayer servers
- **High (8-16)**: For powerful servers with many players

**Trade-offs:**
- Higher values = faster chunk generation but more CPU usage per tick
- Lower values = smoother tick times but slower world loading

#### sub_chunks

Divides chunks vertically for better frustum culling:

```rust
WorldConfig::new()
    .sub_chunks(8)  // Default: 8 sub-chunks
```

**How it works:**
- A 256-block tall chunk with `sub_chunks(8)` = 8 sections of 32 blocks each
- Each section can be culled independently

**Guidelines:**
- **Low (4)**: Fewer draw calls, less culling precision
- **Medium (8)**: Balanced (recommended)
- **High (16)**: More draw calls, aggressive culling

**Trade-offs:**
- More sub-chunks = better frustum culling but more draw calls
- Fewer sub-chunks = fewer draw calls but less efficient culling

### Voxel Updates

#### max_updates_per_tick

Limits voxel updates processed per tick:

```rust
WorldConfig::new()
    .max_updates_per_tick(500)  // Default: 500 updates/tick
```

**Guidelines:**
- **Low (200-500)**: Prevents lag spikes from mass block updates
- **Medium (500-1000)**: Balanced for most servers
- **High (1000+)**: For servers handling many simultaneous edits

**When to adjust:**
- Increase if players report slow block placement/breaking
- Decrease if server tick time is inconsistent

### Network Optimization

#### max_response_per_tick

Limits chunk responses sent to clients per tick:

```rust
WorldConfig::new()
    .max_response_per_tick(3)  // Default: 3 chunks/tick
```

**Guidelines:**
- **Low (2-3)**: Prevents network bottlenecks
- **Medium (3-5)**: Balanced for most cases
- **High (5+)**: For high-bandwidth servers

**Trade-offs:**
- Higher = faster chunk loading but more network usage
- Lower = smoother network but slower world loading

### Saving Performance

#### max_saves_per_tick

Limits chunks saved per tick:

```rust
WorldConfig::new()
    .max_saves_per_tick(2)  // Default: 2 saves/tick
```

**Guidelines:**
- Keep low (1-2) to prevent I/O blocking
- Increase only if you have fast storage (SSD)

#### save_interval

How often to save (in ticks):

```rust
WorldConfig::new()
    .save_interval(300)  // Default: 300 ticks (~15 seconds at 20 TPS)
```

**Guidelines:**
- **Development**: 100-300 ticks (frequent saves)
- **Production**: 300-600 ticks (balanced)
- **High-performance**: 600+ ticks (less frequent saves)

**Trade-offs:**
- More frequent = less data loss but more I/O
- Less frequent = better performance but more data loss risk

### Thread Tuning

Voxelize uses Rayon for parallel processing. You can control thread count:

```rust
use rayon::ThreadPoolBuilder;

ThreadPoolBuilder::new()
    .num_threads(4)  // Match your CPU cores
    .build_global()
    .unwrap();
```

**Guidelines:**
- Match thread count to CPU cores
- Leave 1-2 cores for the OS and other processes
- For servers: Use 75% of available cores

## Client-Side Optimization

### Render Radius

Controls how many chunks are loaded and rendered:

```typescript
world.renderRadius = 8;  // Default: 8 chunks
```

**Guidelines:**
- **Low (4-6)**: Mobile devices, low-end hardware
- **Medium (8-12)**: Desktop, balanced
- **High (12-16)**: High-end hardware, large screens

**Impact:**
- Each chunk = ~16x16x256 blocks
- Render radius 8 = ~2016 chunks loaded
- Render radius 12 = ~4524 chunks loaded

**Trade-offs:**
- Higher = better view distance but more memory/GPU usage
- Lower = better performance but shorter view distance

### Web Worker Configuration

#### Mesh Workers

Mesh generation runs in Web Workers. Configure via `WorldOptions`:

```typescript
const world = new World(registry, {
    maxMeshWorkers: 4,  // Default: navigator.hardwareConcurrency
});
```

**Guidelines:**
- Match to CPU cores (usually 4-8)
- More workers = faster meshing but more memory
- Fewer workers = less memory but slower meshing

#### Light Workers

Light calculations can run in workers:

```typescript
const world = new World(registry, {
    maxLightWorkers: 2,      // Default: 2
    useLightWorkers: true,   // Default: true
});
```

**Guidelines:**
- Keep low (1-2) - light calculation is CPU-intensive
- Disable (`useLightWorkers: false`) if CPU is bottleneck

### Frustum Culling

Frustum culling is automatic and uses `sub_chunks` from server config. No client-side configuration needed, but understanding helps:

- Chunks outside view frustum are not rendered
- Sub-chunks allow partial chunk culling
- More sub-chunks = better culling but more draw calls

### Network Workers

Network packet decoding uses workers:

```typescript
// Configured automatically, but you can check:
network.concurrentWorkers;  // Number of active workers
```

**Optimization:**
- Workers are created automatically based on load
- No manual configuration needed
- Monitor `concurrentWorkers` to see if more are needed

## Memory Optimization

### Chunk Unloading

Chunks are automatically unloaded when outside render radius. You can manually unload:

```typescript
// Unload specific chunk
world.unloadChunk(chunkX, chunkZ);

// Unload all chunks (use carefully!)
world.chunks.clear();
```

### Texture Atlas

Use texture atlases to reduce draw calls:

```typescript
// Already handled by Voxelize's AtlasTexture
// All block textures are combined into a single atlas
```

**Benefits:**
- Single draw call for all blocks
- Reduced GPU state changes
- Better batching

### Object Pooling

For custom entities/effects, use object pooling:

```typescript
class ParticlePool {
    private pool: Particle[] = [];
    
    acquire(): Particle {
        return this.pool.pop() || new Particle();
    }
    
    release(particle: Particle) {
        particle.reset();
        this.pool.push(particle);
    }
}
```

## Profiling and Monitoring

### Server Profiling

Monitor tick time:

```rust
use voxelize::Stats;

// In your system
let stats = world.read_resource::<Stats>();
println!("Tick time: {}ms", stats.delta * 1000.0);
```

**Targets:**
- Tick time < 50ms for 20 TPS
- Consistent tick times (low variance)
- Monitor during peak load

### Client Profiling

Use browser DevTools:

1. **Performance tab**: Record frame times
2. **Memory tab**: Monitor chunk memory
3. **Network tab**: Check chunk loading

**Targets:**
- 60 FPS = 16.67ms per frame
- GPU time < 10ms
- Memory usage stable (no leaks)

### Benchmarking

Voxelize includes Rust benchmarks:

```bash
# Run mesher benchmarks
cargo bench --bench mesher_bench

# Run lighting benchmarks
cargo bench --bench lights_bench
```

## Common Performance Issues

### Issue: Low FPS on Client

**Causes:**
- Render radius too high
- Too many entities/effects
- GPU bottleneck

**Solutions:**
1. Reduce `renderRadius`
2. Limit entity count
3. Check GPU usage in DevTools
4. Reduce visual effects

### Issue: Slow Chunk Loading

**Causes:**
- `max_chunks_per_tick` too low
- `max_response_per_tick` too low
- Network latency

**Solutions:**
1. Increase `max_chunks_per_tick` (if CPU allows)
2. Increase `max_response_per_tick` (if bandwidth allows)
3. Check network conditions
4. Preload chunks (`preload: true`)

### Issue: Server Lag Spikes

**Causes:**
- Too many chunk updates
- Pathfinding overload
- Saving blocking

**Solutions:**
1. Reduce `max_updates_per_tick`
2. Limit pathfinding entities
3. Increase `save_interval`
4. Profile to find bottlenecks

### Issue: High Memory Usage

**Causes:**
- Too many loaded chunks
- Memory leaks
- Large textures

**Solutions:**
1. Reduce `renderRadius`
2. Check for memory leaks (DevTools)
3. Optimize texture sizes
4. Unload unused chunks

## Performance Checklist

### Server Setup
- [ ] `max_chunks_per_tick` set appropriately (4-8)
- [ ] `sub_chunks` balanced (8 recommended)
- [ ] `max_updates_per_tick` prevents lag (500-1000)
- [ ] `save_interval` optimized (300-600)
- [ ] Thread count matches CPU cores

### Client Setup
- [ ] `renderRadius` appropriate for hardware (8-12)
- [ ] Worker counts match CPU cores
- [ ] Frustum culling enabled (automatic)
- [ ] Texture atlas used (automatic)

### Monitoring
- [ ] Server tick time < 50ms
- [ ] Client FPS > 60
- [ ] Memory usage stable
- [ ] Network usage reasonable

## Example: Optimized Configuration

### High-Performance Server

```rust
WorldConfig::new()
    .max_chunks_per_tick(8)
    .sub_chunks(8)
    .max_updates_per_tick(1000)
    .max_response_per_tick(5)
    .save_interval(600)
    .max_saves_per_tick(2)
    .build()
```

### Balanced Server

```rust
WorldConfig::new()
    .max_chunks_per_tick(4)
    .sub_chunks(8)
    .max_updates_per_tick(500)
    .max_response_per_tick(3)
    .save_interval(300)
    .max_saves_per_tick(2)
    .build()
```

### High-Performance Client

```typescript
const world = new World(registry, {
    renderRadius: 12,
    maxMeshWorkers: 8,
    maxLightWorkers: 2,
    useLightWorkers: true,
});
```

### Mobile Client

```typescript
const world = new World(registry, {
    renderRadius: 6,
    maxMeshWorkers: 2,
    maxLightWorkers: 1,
    useLightWorkers: false,  // Disable if CPU is weak
});
```

## Summary

Performance optimization involves:

- ✅ Balancing server tick time with chunk processing
- ✅ Configuring client render radius and workers
- ✅ Monitoring and profiling both server and client
- ✅ Adjusting parameters based on hardware and load
- ✅ Using appropriate settings for your use case

By tuning these parameters and monitoring performance, you can achieve smooth gameplay even with many players and complex worlds.
