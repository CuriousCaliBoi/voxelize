---
sidebar_position: 14
---

# AI and Pathfinding

Voxelize includes a sophisticated AI and pathfinding system that allows entities to intelligently navigate the world, track targets, and move along computed paths. This tutorial covers how to use the AI components and systems to create entities that can chase players, navigate obstacles, and exhibit complex behaviors.

## Overview

The AI system in Voxelize consists of three main components:

- **`BrainComp`** - Controls entity movement behavior (walking, jumping, sprinting)
- **`TargetComp`** - Allows entities to scan and track nearby targets
- **`PathComp`** - Stores computed A* paths and pathfinding parameters

These components work together with several systems that run automatically:

- `EntityTreeSystem` - Builds spatial index for fast entity lookups
- `EntityObserveSystem` - Finds closest targets for entities
- `PathFindingSystem` - Computes A* paths to targets
- `WalkTowardsSystem` - Moves entities along computed paths

## BrainComp - Movement Control

The `BrainComp` component controls how an entity moves. It contains movement state and configurable physics parameters.

### BrainState

The brain maintains internal state about the entity's movement:

```rust
pub struct BrainState {
    pub heading: f32,        // Direction entity is facing (radians)
    pub running: bool,       // Whether entity is walking
    pub jumping: bool,       // Whether entity should jump
    pub sprinting: bool,     // Whether entity is sprinting
    pub jump_count: u32,     // Number of air jumps used
    pub is_jumping: bool,    // Currently in jump animation
    pub current_jump_time: f32, // Time remaining in current jump
}
```

### BrainOptions

Configure movement behavior with `BrainOptions`:

```rust
let brain_options = BrainOptions {
    max_speed: 6.0,              // Maximum movement speed
    move_force: 12.0,             // Force applied for movement
    responsiveness: 120.0,        // How quickly entity responds to direction changes
    running_friction: 0.4,        // Friction when moving
    standing_friction: 2.0,       // Friction when standing still
    
    air_move_mult: 0.7,           // Movement multiplier in air
    jump_impulse: 8.0,            // Initial jump impulse
    jump_force: 1.0,              // Continuous jump force
    jump_time: 50.0,              // Jump duration in milliseconds
    air_jumps: 0,                 // Number of mid-air jumps allowed
    sprint_speed_mult: 1.2,       // Speed multiplier when sprinting
    sprint_force_mult: 1.5,       // Force multiplier when sprinting
};
```

### BrainComp Methods

Control entity movement with these methods:

```rust
brain.walk();           // Start walking
brain.stop();          // Stop walking
brain.jump();          // Start jumping
brain.stop_jumping();  // Stop jumping
brain.sprint();        // Start sprinting
brain.stop_sprinting(); // Stop sprinting
```

### Creating an Entity with BrainComp

```rust
use voxelize::{BrainComp, BrainOptions, RigidBodyComp, InteractorComp, PositionComp};
use voxelize::physics::{RigidBody, AABB};

let body = RigidBody::new(&AABB::new()
    .scale_x(0.6)
    .scale_y(1.8)
    .scale_z(0.6)
    .build());
let interactor = world.physics_mut().register(&body);

world
    .create_entity("entity-id", "mob")
    .with(PositionComp::default())
    .with(RigidBodyComp::new(&body))
    .with(InteractorComp::new(&interactor))
    .with(BrainComp::new(BrainOptions::default()))
    .build();
```

## TargetComp - Target Tracking

The `TargetComp` allows entities to scan their surroundings and track the closest target. The system automatically finds and updates the target position.

### TargetType

Filter what types of entities can be targeted:

```rust
pub enum TargetType {
    All,      // Target any entity or player
    Players,  // Only target players
    Entities, // Only target non-player entities
}
```

### Creating TargetComp

```rust
use voxelize::TargetComp;

// Target all entities and players
let target = TargetComp::all();

// Target only players
let target = TargetComp::players();

// Target only non-player entities
let target = TargetComp::entities();

// Custom target with specific position
let target = TargetComp::new(
    TargetType::Players,
    Some(Vec3(10.0, 5.0, 10.0)),
    Some("player-id".to_string())
);
```

### Accessing Target Data

The `EntityObserveSystem` automatically updates the `TargetComp` with the closest target:

```rust
// In a custom system
use specs::{ReadStorage, System, WriteStorage};
use voxelize::TargetComp;

fn run(&mut self, (targets,): Self::SystemData) {
    for target in targets.join() {
        if let Some(target_position) = &target.position {
            // Entity has a target at target_position
            if let Some(target_id) = &target.id {
                // Target entity ID is available
            }
        }
    }
}
```

## PathComp - Pathfinding

The `PathComp` stores pathfinding configuration and computed paths. The `PathFindingSystem` automatically computes A* paths for entities with both `PathComp` and `TargetComp`.

### PathComp Parameters

```rust
use std::time::Duration;

let path_comp = PathComp::new(
    100,                           // max_nodes: Maximum path length
    32.0,                          // max_distance: Maximum pathfinding distance
    10000,                         // max_depth_search: Maximum A* search depth
    Duration::from_millis(50),     // max_pathfinding_time: Time limit for pathfinding
);
```

**Parameters Explained:**

- `max_nodes` - Maximum number of nodes in the computed path. Longer paths are rejected.
- `max_distance` - Maximum Euclidean distance (in blocks) from start to goal. Prevents pathfinding across the entire world.
- `max_depth_search` - Maximum number of nodes to explore in A* search. Prevents expensive searches.
- `max_pathfinding_time` - Time limit for pathfinding computation. Prevents lag spikes.

### Path Smoothing

The pathfinding system automatically smooths paths using:

- **RDP Simplification** - Removes unnecessary waypoints
- **Direct Path Validation** - Checks if shortcuts are walkable
- **Corner Detection** - Handles tight turns gracefully

### Accessing Computed Paths

```rust
// In a custom system
use specs::{ReadStorage, System};
use voxelize::PathComp;

fn run(&mut self, (paths,): Self::SystemData) {
    for path in paths.join() {
        if let Some(path_nodes) = &path.path {
            // Path is available as Vec<Vec3<i32>>
            for node in path_nodes {
                // Process each waypoint
            }
        } else {
            // No path found (target unreachable, too far, etc.)
        }
    }
}
```

## WalkTowardsSystem - Path Following

The `WalkTowardsSystem` automatically moves entities along their computed paths. It handles:

- **Node Advancement** - Moves to next waypoint when close enough
- **Smooth Blending** - Blends between current and next waypoint for smooth turns
- **Jump Detection** - Automatically jumps when path goes upward
- **Corner Handling** - Slows down for tight turns

The system uses the `BrainComp` to control movement, so entities will automatically walk, jump, and sprint as needed to follow their path.

## Complete Example: Chasing Enemy

Here's a complete example of creating an enemy that chases players:

```rust
use std::time::Duration;
use voxelize::{
    BrainComp, BrainOptions, PathComp, TargetComp, TargetType,
    RigidBodyComp, InteractorComp, PositionComp
};
use voxelize::physics::{RigidBody, AABB};

world.set_entity_loader("enemy", |world, metadata| {
    // Create physics body
    let body = RigidBody::new(&AABB::new()
        .scale_x(0.6)
        .scale_y(1.8)
        .scale_z(0.6)
        .build());
    let interactor = world.physics_mut().register(&body);

    // Configure brain for fast, responsive movement
    let brain_options = BrainOptions {
        max_speed: 8.0,
        move_force: 15.0,
        responsiveness: 150.0,
        running_friction: 0.3,
        standing_friction: 2.0,
        air_move_mult: 0.6,
        jump_impulse: 9.0,
        jump_force: 1.2,
        jump_time: 60.0,
        air_jumps: 1,  // Allow one air jump
        sprint_speed_mult: 1.3,
        sprint_force_mult: 1.6,
        ..Default::default()
    };

    // Configure pathfinding
    let path_comp = PathComp::new(
        150,                          // Allow longer paths
        48.0,                         // Search up to 48 blocks away
        15000,                        // Explore more nodes
        Duration::from_millis(100),   // Allow more time for complex paths
    );

    world
        .create_entity(&nanoid!(), "enemy")
        .with(PositionComp::default())
        .with(RigidBodyComp::new(&body))
        .with(InteractorComp::new(&interactor))
        .with(BrainComp::new(brain_options))
        .with(TargetComp::players())  // Chase players
        .with(path_comp)
        .build()
});
```

## Custom AI Behavior Patterns

You can create custom AI behaviors by writing systems that interact with the AI components.

### Example: Fleeing Behavior

Create an entity that runs away from players:

```rust
use specs::{ReadStorage, System, WriteStorage};
use voxelize::{TargetComp, BrainComp, PositionComp, Vec3};

pub struct FleeSystem;

impl<'a> System<'a> for FleeSystem {
    type SystemData = (
        ReadStorage<'a, PositionComp>,
        ReadStorage<'a, TargetComp>,
        WriteStorage<'a, BrainComp>,
    );

    fn run(&mut self, (positions, targets, mut brains): Self::SystemData) {
        use specs::Join;

        for (position, target, brain) in (&positions, &targets, &mut brains).join() {
            if let Some(target_pos) = &target.position {
                // Calculate direction away from target
                let dx = position.0.0 - target_pos.0;
                let dz = position.0.2 - target_pos.2;
                let distance = (dx * dx + dz * dz).sqrt();

                if distance < 10.0 {
                    // Too close! Run away
                    let flee_target = Vec3(
                        position.0.0 + dx * 5.0,
                        position.0.1,
                        position.0.2 + dz * 5.0,
                    );
                    brain.walk();
                    brain.sprint();
                    brain.operate(&flee_target, &mut body.0, delta);
                } else {
                    brain.stop();
                }
            }
        }
    }
}
```

### Example: Patrol Behavior

Create an entity that patrols between waypoints:

```rust
use specs::{Component, VecStorage, System, WriteStorage};
use voxelize::{BrainComp, PositionComp, Vec3};
use serde::{Serialize, Deserialize};

#[derive(Component, Serialize, Deserialize)]
#[storage(VecStorage)]
struct PatrolComp {
    waypoints: Vec<Vec3<f32>>,
    current_waypoint: usize,
    wait_time: f32,
    current_wait: f32,
}

pub struct PatrolSystem;

impl<'a> System<'a> for PatrolSystem {
    type SystemData = (
        ReadExpect<'a, Stats>,
        ReadStorage<'a, PositionComp>,
        ReadStorage<'a, PatrolComp>,
        WriteStorage<'a, BrainComp>,
    );

    fn run(&mut self, (stats, positions, patrols, mut brains): Self::SystemData) {
        use specs::Join;

        let delta = stats.delta;

        for (position, patrol, brain) in (&positions, &patrols, &mut brains).join() {
            if patrol.waypoints.is_empty() {
                continue;
            }

            let target = &patrol.waypoints[patrol.current_waypoint];
            let dx = position.0.0 - target.0;
            let dz = position.0.2 - target.2;
            let distance = (dx * dx + dz * dz).sqrt();

            if distance < 1.0 {
                // Reached waypoint, wait
                brain.stop();
                
                if patrol.current_wait >= patrol.wait_time {
                    // Move to next waypoint
                    let next = (patrol.current_waypoint + 1) % patrol.waypoints.len();
                    // Note: You'd need to modify PatrolComp to update current_waypoint
                    // This requires WriteStorage which we don't have here
                }
            } else {
                // Move towards waypoint
                brain.walk();
                brain.operate(target, &mut body.0, delta);
            }
        }
    }
}
```

## Pathfinding Configuration Tips

### Performance Tuning

- **Reduce `max_distance`** for entities that shouldn't pathfind far (e.g., 16 blocks for guards)
- **Lower `max_depth_search`** to prevent expensive searches (e.g., 5000 for simple mobs)
- **Decrease `max_pathfinding_time`** to cap computation time (e.g., 20ms for many entities)

### Behavior Tuning

- **Increase `max_nodes`** for entities that need to navigate complex terrain
- **Adjust `BrainOptions.responsiveness`** for smoother or snappier movement
- **Set `air_jumps`** to allow entities to jump gaps

### Common Issues

**Entity gets stuck:**
- Check that target position is in a passable block
- Verify `max_distance` is large enough
- Ensure path isn't being rejected due to `max_nodes`

**Entity moves too slowly:**
- Increase `BrainOptions.max_speed`
- Increase `BrainOptions.move_force`
- Check that `running_friction` isn't too high

**Entity can't reach target:**
- Verify target is within `max_distance`
- Check that path isn't too long (exceeds `max_nodes`)
- Ensure terrain is walkable (no walls, proper ground)

## Advanced: Custom Pathfinding

For advanced use cases, you can implement custom pathfinding by:

1. Computing your own path and setting it directly:

```rust
use voxelize::PathComp;

// In your custom system
if let Some(mut path) = paths.get_mut(entity) {
    path.path = Some(my_custom_path);
}
```

2. Modifying the pathfinding system's walkable function by forking the codebase

3. Using `TargetComp` with a fixed position instead of automatic targeting

## Summary

The AI and pathfinding system provides:

- ✅ Automatic target detection and tracking
- ✅ A* pathfinding with configurable constraints
- ✅ Smooth path following with jump detection
- ✅ Customizable movement behavior
- ✅ Extensible for custom AI patterns

Combine `BrainComp`, `TargetComp`, and `PathComp` to create intelligent entities that can navigate your voxel world!
