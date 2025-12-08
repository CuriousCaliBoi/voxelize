---
sidebar_position: 14
---

# AI and Pathfinding

Voxelize includes a sophisticated AI system with A* pathfinding that allows entities to navigate the voxel world intelligently. This tutorial covers how to create AI entities that can chase players, navigate obstacles, and follow custom behavior patterns.

## Overview

The AI system consists of three main components:

- **`BrainComp`** - Controls entity movement (walking, jumping, sprinting)
- **`TargetComp`** - Enables entities to scan and track targets
- **`PathComp`** - Stores computed A* paths and pathfinding parameters

These components work together with several systems that run automatically:

1. `EntityTreeSystem` - Builds a spatial index (KdTree) of all entities
2. `EntityObserveSystem` - Finds the closest target for entities with `TargetComp`
3. `PathFindingSystem` - Computes A* paths to targets
4. `WalkTowardsSystem` - Moves entities along their computed paths

## BrainComp - Movement Control

`BrainComp` controls how an entity moves through the world. It handles physics-based movement including walking, jumping, sprinting, and air control.

### BrainOptions

The `BrainOptions` struct configures movement behavior:

```rust
use voxelize::BrainOptions;

let options = BrainOptions {
    max_speed: 6.0,              // Maximum movement speed
    move_force: 12.0,            // Force applied for movement
    responsiveness: 120.0,       // How quickly entity responds to direction changes
    running_friction: 0.4,       // Friction when moving
    standing_friction: 2.0,      // Friction when stationary
    
    air_move_mult: 0.7,         // Movement multiplier in air
    jump_impulse: 8.0,          // Initial jump impulse
    jump_force: 1.0,            // Sustained jump force
    jump_time: 50.0,            // Jump duration in milliseconds
    air_jumps: 0,               // Number of mid-air jumps allowed
    sprint_speed_mult: 1.2,     // Speed multiplier when sprinting
    sprint_force_mult: 1.5,     // Force multiplier when sprinting
};
```

### BrainState

The `BrainState` tracks the current movement state:

- `heading` - Direction the entity is facing (radians)
- `running` - Whether the entity is moving
- `jumping` - Whether the entity should jump
- `sprinting` - Whether the entity is sprinting
- `jump_count` - Number of air jumps used
- `is_jumping` - Whether currently jumping
- `current_jump_time` - Remaining jump time

### Creating a BrainComp

```rust
use voxelize::{BrainComp, BrainOptions};

let brain = BrainComp::new(BrainOptions::default());

// Or with custom options
let custom_options = BrainOptions {
    max_speed: 8.0,
    jump_impulse: 10.0,
    ..BrainOptions::default()
};
let brain = BrainComp::new(custom_options);
```

### Manual Brain Control

You can manually control the brain:

```rust
brain.walk();           // Start walking
brain.stop();           // Stop walking
brain.jump();           // Start jumping
brain.stop_jumping();   // Stop jumping
brain.sprint();         // Start sprinting
brain.stop_sprinting(); // Stop sprinting
```

## TargetComp - Target Tracking

`TargetComp` enables entities to scan their surroundings and track the closest target.

### TargetType

The `TargetType` enum filters what entities can target:

```rust
use voxelize::TargetType;

TargetType::All      // Target any entity or player
TargetType::Players  // Target only players
TargetType::Entities // Target only non-player entities
```

### Creating a TargetComp

```rust
use voxelize::{TargetComp, TargetType};

// Target all entities and players
let target = TargetComp::all();

// Target only players
let target = TargetComp::players();

// Target only non-player entities
let target = TargetComp::entities();

// Or create with specific type
let target = TargetComp::new(
    TargetType::Players,
    None,  // Initial position (None = auto-detect)
    None,  // Initial ID (None = auto-detect)
);
```

### Target Data

After `EntityObserveSystem` runs, the `TargetComp` will contain:

- `position` - `Option<Vec3<f32>>` - Position of the closest target
- `id` - `Option<String>` - ID of the target entity

## PathComp - Pathfinding Configuration

`PathComp` stores the computed A* path and configures pathfinding behavior.

### Pathfinding Parameters

```rust
use std::time::Duration;
use voxelize::PathComp;

let path = PathComp::new(
    100,                           // max_nodes - Maximum path length
    32.0,                          // max_distance - Maximum search distance
    10000,                         // max_depth_search - Maximum A* nodes to explore
    Duration::from_millis(50),    // max_pathfinding_time - Time limit for pathfinding
);
```

**Parameter Guidelines:**

- `max_nodes`: Keep under 200 for performance. 50-100 works well for most cases.
- `max_distance`: Maximum Euclidean distance to search. 32.0 blocks is a good default.
- `max_depth_search`: Limits A* exploration. 5000-10000 prevents expensive searches.
- `max_pathfinding_time`: Prevents pathfinding from blocking the server. 50ms is reasonable.

### Path Data

After `PathFindingSystem` runs, `PathComp` contains:

- `path` - `Option<Vec<Vec3<i32>>>` - The computed path as voxel coordinates

The path is automatically smoothed using the Ramer-Douglas-Peucker algorithm and validated for walkability.

## Creating an AI Entity

Here's a complete example of creating an enemy that chases players:

```rust
use std::time::Duration;
use voxelize::{
    BrainComp, BrainOptions, PathComp, TargetComp, TargetType,
    RigidBody, AABB, PositionComp, RigidBodyComp, InteractorComp,
};

world.set_entity_loader("enemy", |world, metadata| {
    // Create physics body
    let body = RigidBody::new(
        &AABB::new()
            .scale_x(0.6)   // Width
            .scale_y(1.8)   // Height
            .scale_z(0.6)   // Depth
            .build()
    );
    let interactor = world.physics_mut().register(&body);

    // Configure movement
    let brain_options = BrainOptions {
        max_speed: 5.0,
        move_force: 10.0,
        jump_impulse: 7.0,
        sprint_speed_mult: 1.3,
        ..BrainOptions::default()
    };

    // Create entity with AI components
    world
        .create_entity(&nanoid!(), "enemy")
        .with(PositionComp::default())
        .with(RigidBodyComp::new(&body))
        .with(InteractorComp::new(&interactor))
        .with(BrainComp::new(brain_options))
        .with(TargetComp::players())  // Target players
        .with(PathComp::new(
            80,                          // max_nodes
            24.0,                        // max_distance
            8000,                         // max_depth_search
            Duration::from_millis(40),   // max_pathfinding_time
        ))
        .build()
});
```

## Custom AI Behavior Patterns

You can create custom AI behaviors by adding systems that modify the brain state based on conditions.

### Example: Fleeing Behavior

Create a system that makes entities run away from players:

```rust
use voxelize::{BrainComp, PositionComp, TargetComp, RigidBodyComp};
use specs::{ReadStorage, System, WriteStorage};

pub struct FleeSystem;

impl<'a> System<'a> for FleeSystem {
    type SystemData = (
        ReadStorage<'a, PositionComp>,
        ReadStorage<'a, TargetComp>,
        ReadStorage<'a, RigidBodyComp>,
        WriteStorage<'a, BrainComp>,
    );

    fn run(&mut self, data: Self::SystemData) {
        use specs::Join;
        
        let (positions, targets, bodies, mut brains) = data;
        
        for (position, target, body, brain) in 
            (&positions, &targets, &bodies, &mut brains).join() 
        {
            if let Some(target_pos) = target.position {
                let entity_pos = body.0.get_position();
                
                // Calculate direction away from target
                let dx = entity_pos.0 - target_pos.0;
                let dz = entity_pos.2 - target_pos.2;
                
                // Set target position away from player
                let flee_distance = 10.0;
                let distance = (dx * dx + dz * dz).sqrt();
                
                if distance < flee_distance {
                    let angle = dx.atan2(dz);
                    let flee_target = Vec3(
                        entity_pos.0 + angle.cos() * flee_distance,
                        entity_pos.1,
                        entity_pos.2 + angle.sin() * flee_distance,
                    );
                    
                    // Manually operate brain to move away
                    brain.walk();
                    brain.sprint();
                    brain.operate(&flee_target, &mut body.0, 0.016); // ~60fps
                }
            }
        }
    }
}
```

### Example: Patrol Behavior

Create a system for entities that patrol between waypoints:

```rust
use voxelize::{BrainComp, PositionComp, RigidBodyComp, MetadataComp};
use specs::{ReadStorage, System, WriteStorage};

#[derive(Component)]
#[storage(VecStorage)]
struct PatrolComp {
    waypoints: Vec<Vec3<f32>>,
    current_waypoint: usize,
    waypoint_threshold: f32,
}

pub struct PatrolSystem;

impl<'a> System<'a> for PatrolSystem {
    type SystemData = (
        ReadStorage<'a, PositionComp>,
        ReadStorage<'a, PatrolComp>,
        ReadStorage<'a, RigidBodyComp>,
        WriteStorage<'a, BrainComp>,
    );

    fn run(&mut self, data: Self::SystemData) {
        use specs::Join;
        
        let (positions, patrols, bodies, mut brains) = data;
        
        for (position, patrol, body, brain) in 
            (&positions, &patrols, &bodies, &mut brains).join() 
        {
            if patrol.waypoints.is_empty() {
                continue;
            }
            
            let current_waypoint = &patrol.waypoints[patrol.current_waypoint];
            let entity_pos = body.0.get_position();
            
            let dx = current_waypoint.0 - entity_pos.0;
            let dz = current_waypoint.2 - entity_pos.2;
            let distance = (dx * dx + dz * dz).sqrt();
            
            if distance < patrol.waypoint_threshold {
                // Move to next waypoint
                let next_index = (patrol.current_waypoint + 1) % patrol.waypoints.len();
                // Note: You'd need WriteStorage<PatrolComp> to update this
            }
            
            brain.walk();
            brain.operate(current_waypoint, &mut body.0, 0.016);
        }
    }
}
```

## Pathfinding Tips

### Performance Optimization

1. **Limit pathfinding distance**: Keep `max_distance` reasonable (16-32 blocks)
2. **Cap path length**: Use `max_nodes` to prevent long paths (50-100 nodes)
3. **Time limits**: Set `max_pathfinding_time` to prevent blocking (30-50ms)
4. **Reduce search depth**: Lower `max_depth_search` for faster but less optimal paths

### Pathfinding Quality

1. **Increase search depth**: Higher `max_depth_search` finds better paths but is slower
2. **Adjust thresholds**: The pathfinding system uses walkability checks - ensure your blocks have correct `is_passable` flags
3. **Path smoothing**: Paths are automatically smoothed, but you can disable it by modifying the `PathFindingSystem`

### Common Issues

**Entities get stuck:**
- Check that blocks have correct `is_passable` flags
- Ensure entities have proper AABB size
- Verify pathfinding parameters aren't too restrictive

**Pathfinding is slow:**
- Reduce `max_depth_search`
- Lower `max_distance`
- Decrease `max_nodes`
- Reduce `max_pathfinding_time`

**Entities don't follow paths:**
- Ensure `WalkTowardsSystem` is registered in the dispatcher
- Check that `BrainComp` is properly configured
- Verify `PathComp` has a valid path (check `path` field)

## Advanced: Custom Pathfinding

You can create custom pathfinding by implementing your own system that computes paths:

```rust
use voxelize::{PathComp, Chunks, Registry};
use specs::{ReadExpect, ReadStorage, System, WriteStorage};

pub struct CustomPathfindingSystem;

impl<'a> System<'a> for CustomPathfindingSystem {
    type SystemData = (
        ReadExpect<'a, Chunks>,
        ReadExpect<'a, Registry>,
        WriteStorage<'a, PathComp>,
    );

    fn run(&mut self, data: Self::SystemData) {
        let (chunks, registry, mut paths) = data;
        
        for path in (&mut paths).join() {
            // Your custom pathfinding logic here
            // Compute path and set:
            // path.path = Some(vec![Vec3(x1, y1, z1), Vec3(x2, y2, z2), ...]);
        }
    }
}
```

## Summary

The AI and pathfinding system in Voxelize provides:

- ✅ Automatic target detection and tracking
- ✅ A* pathfinding with configurable parameters
- ✅ Smooth path following with jumping and cornering
- ✅ Customizable movement physics
- ✅ Extensible architecture for custom behaviors

By combining `BrainComp`, `TargetComp`, and `PathComp`, you can create sophisticated AI entities that navigate the voxel world intelligently.
