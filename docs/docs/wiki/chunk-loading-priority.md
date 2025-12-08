---
sidebar_position: 3
---

# Chunk Loading Priority System

Voxelize's chunk loading system prioritizes chunks based on distance from players. This guide explains how the priority system works and how to customize it.

## Overview

The chunk loading system (`ChunkRequestsSystem`) handles chunk requests from clients and prioritizes them for generation and sending. Chunks are loaded in order of priority to ensure players see nearby chunks first.

## Default Priority Algorithm

Chunks are prioritized by distance from the requesting player:

```rust title="Default Priority (Pseudocode)"
for each chunk_request from player:
    distance = euclidean_distance(chunk_position, player_position)
    priority = -distance  // Negative so closer = higher priority
    queue_chunk(chunk, priority)
```

**Characteristics:**
- Closer chunks load first
- Circular loading pattern around player
- Automatic prioritization based on player position

## How It Works

### Chunk Request Flow

1. **Client requests chunks** - Based on `renderRadius`
2. **Server receives requests** - Stored in `ChunkRequestsComp`
3. **Chunks prioritized** - By distance from player
4. **Chunks generated** - In priority order (via `Pipeline`)
5. **Chunks sent** - Limited by `max_response_per_tick`

### ChunkRequestsSystem

The system processes requests each tick:

```rust title="Chunk Request Processing"
// Simplified version of ChunkRequestsSystem
for (player_id, chunk_requests) in players_with_requests {
    for chunk_coords in chunk_requests {
        if chunk_is_ready(chunk_coords) {
            // Send immediately if ready
            send_chunk_to_player(chunk_coords, player_id);
        } else {
            // Queue for generation
            if !already_queued(chunk_coords) {
                pipeline.add_chunk(chunk_coords);
            }
        }
    }
}
```

## Custom Priority Hooks

You can customize chunk priority by modifying the request system or creating a custom system:

### Custom Priority System

```rust title="Custom Priority System"
use hashbrown::HashMap;
use std::collections::BinaryHeap;

struct CustomChunkPriority {
    priorities: HashMap<Vec2<i32>, f64>,
}

impl<'a> System<'a> for CustomChunkPriority {
    type SystemData = (
        ReadStorage<'a, PositionComp>,
        ReadStorage<'a, ChunkRequestsComp>,
        WriteExpect<'a, Pipeline>,
    );
    
    fn run(&mut self, (positions, requests, mut pipeline): Self::SystemData) {
        let mut chunk_priorities: HashMap<Vec2<i32>, f64> = HashMap::new();
        
        // Calculate priorities for each requested chunk
        for (pos, chunk_requests) in (&positions, &requests).join() {
            for chunk_coords in &chunk_requests.requests {
                let distance = calculate_distance(&pos.0, chunk_coords);
                
                // Custom priority calculation
                let priority = -distance;  // Base: distance
                
                // Boost priority for chunks in view direction
                let view_direction = get_view_direction(pos);
                let chunk_direction = direction_to_chunk(&pos.0, chunk_coords);
                let dot_product = view_direction.dot(&chunk_direction);
                
                if dot_product > 0.5 {  // Chunk in front of player
                    priority += 10.0;   // Boost priority
                }
                
                // Store highest priority for each chunk
                chunk_priorities
                    .entry(chunk_coords.clone())
                    .and_modify(|p| *p = p.max(priority))
                    .or_insert(priority);
            }
        }
        
        // Add chunks to pipeline in priority order
        let mut sorted_chunks: Vec<_> = chunk_priorities.into_iter().collect();
        sorted_chunks.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        for (coords, _priority) in sorted_chunks {
            pipeline.add_chunk(&coords);
        }
    }
}
```

### Directional Loading

Prioritize chunks in the player's view direction:

```rust title="Directional Priority"
fn calculate_directional_priority(
    player_pos: &Vec3<f32>,
    player_dir: &Vec3<f32>,
    chunk_coords: &Vec2<i32>,
) -> f64 {
    let chunk_center = Vec3(
        (chunk_coords.0 * 16 + 8) as f32,
        player_pos.1,
        (chunk_coords.1 * 16 + 8) as f32,
    );
    
    let to_chunk = (chunk_center - *player_pos).normalize();
    let dot = player_dir.dot(&to_chunk);
    
    // Distance-based priority
    let distance = player_pos.distance(&chunk_center);
    let base_priority = -distance;
    
    // Directional boost (0.0 to 1.0)
    let directional_boost = (dot + 1.0) / 2.0;  // Normalize to 0-1
    
    base_priority + (directional_boost * 20.0)  // Boost up to 20 blocks
}
```

## Priority Strategies

### Distance-Only (Default)

```rust
priority = -distance
```

**Pros:** Simple, predictable  
**Cons:** Doesn't consider player direction

### Directional Loading

```rust
priority = -distance + (view_direction_factor * boost)
```

**Pros:** Loads chunks player is moving toward  
**Cons:** More complex, requires direction tracking

### Radial Expansion

```rust
priority = -distance + (ring_number * ring_boost)
```

**Pros:** Loads complete rings around player  
**Cons:** May load unnecessary chunks

### Hybrid Approach

```rust
priority = -distance + 
           (view_direction_factor * directional_boost) +
           (ring_number * ring_boost)
```

**Pros:** Balances multiple factors  
**Cons:** Most complex, requires tuning

## Implementation Example

Complete example with directional priority:

```rust title="Complete Priority System"
use specs::{ReadStorage, System, WriteExpect};
use voxelize::{ChunkRequestsComp, DirectionComp, Pipeline, PositionComp};

struct DirectionalChunkPriority;

impl<'a> System<'a> for DirectionalChunkPriority {
    type SystemData = (
        ReadStorage<'a, PositionComp>,
        ReadStorage<'a, DirectionComp>,
        ReadStorage<'a, ChunkRequestsComp>,
        WriteExpect<'a, Pipeline>,
    );
    
    fn run(&mut self, (positions, directions, requests, mut pipeline): Self::SystemData) {
        use std::collections::BinaryHeap;
        use std::cmp::Ordering;
        
        #[derive(PartialEq)]
        struct PrioritizedChunk {
            coords: Vec2<i32>,
            priority: f64,
        }
        
        impl Eq for PrioritizedChunk {}
        
        impl Ord for PrioritizedChunk {
            fn cmp(&self, other: &Self) -> Ordering {
                other.priority.partial_cmp(&self.priority).unwrap()
            }
        }
        
        impl PartialOrd for PrioritizedChunk {
            fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
                Some(self.cmp(other))
            }
        }
        
        let mut priority_queue: BinaryHeap<PrioritizedChunk> = BinaryHeap::new();
        
        for (pos, dir, chunk_requests) in (&positions, &directions, &requests).join() {
            for chunk_coords in &chunk_requests.requests {
                let chunk_center = Vec3(
                    (chunk_coords.0 * 16 + 8) as f32,
                    pos.0.1,
                    (chunk_coords.1 * 16 + 8) as f32,
                );
                
                let distance = pos.0.distance(&chunk_center);
                
                // Calculate direction to chunk
                let to_chunk = (chunk_center - pos.0).normalize();
                let view_dot = dir.0.normalize().dot(&to_chunk);
                
                // Priority: distance + directional boost
                let priority = -distance + (view_dot.max(0.0) * 15.0);
                
                priority_queue.push(PrioritizedChunk {
                    coords: chunk_coords.clone(),
                    priority,
                });
            }
        }
        
        // Add chunks to pipeline in priority order
        while let Some(prioritized) = priority_queue.pop() {
            pipeline.add_chunk(&prioritized.coords);
        }
    }
}
```

## Integration with Dispatcher

Register your custom priority system:

```rust title="Registering Priority System"
world.dispatcher_mut().add(
    DirectionalChunkPriority,
    "chunk_priority",
    &["chunk_requests"]  // Run after ChunkRequestsSystem
);
```

## Performance Considerations

### Priority Calculation Cost

- Calculate priorities once per request batch
- Cache priorities if chunks are re-requested
- Use efficient distance calculations

### Queue Management

- Limit priority queue size
- Process highest priority chunks first
- Drop low-priority chunks if queue is full

### Multi-Player Optimization

When multiple players request the same chunk:

```rust title="Multi-Player Priority"
// Use highest priority from all players
let mut chunk_priorities: HashMap<Vec2<i32>, f64> = HashMap::new();

for player in players {
    for chunk in player.requests {
        let priority = calculate_priority(player, chunk);
        chunk_priorities
            .entry(chunk)
            .and_modify(|p| *p = p.max(priority))
            .or_insert(priority);
    }
}
```

## Troubleshooting

### Chunks Loading Too Slowly

- Increase `max_chunks_per_tick`
- Increase `max_response_per_tick`
- Check priority calculation isn't too expensive
- Verify chunks are being prioritized correctly

### Wrong Chunks Loading First

- Verify priority calculation logic
- Check distance calculations are correct
- Ensure priority queue ordering is correct
- Debug print priorities to verify

### Performance Issues

- Profile priority calculation
- Cache distance calculations
- Limit priority queue size
- Use efficient data structures (BinaryHeap)

## Best Practices

1. **Keep it simple** - Default distance-based priority works well
2. **Profile first** - Measure before optimizing
3. **Test thoroughly** - Priority bugs cause poor loading
4. **Consider players** - Multi-player needs different handling
5. **Monitor performance** - Priority calculation shouldn't be expensive

## Next Steps

- Learn about [Performance Optimization](./performance-optimization) for tuning
- Check out [Chunk Generation](../tutorials/basics/chunk-generation) for basics
- Explore [World Configuration](../tutorials/basics/world-configuration) for limits
