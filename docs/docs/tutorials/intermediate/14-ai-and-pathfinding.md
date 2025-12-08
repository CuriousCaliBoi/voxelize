---
sidebar_position: 14
---

# AI and Pathfinding Tutorial

Voxelize includes a sophisticated AI and pathfinding system that allows entities to intelligently navigate the voxel world, chase targets, and avoid obstacles. This tutorial covers how to use the AI components and systems to create enemies, NPCs, and other intelligent entities.

## Overview

The AI system consists of three main components:

- **`BrainComp`** - Controls entity movement behavior (walking, jumping, sprinting)
- **`TargetComp`** - Allows entities to scan and track targets (players, entities, or all)
- **`PathComp`** - Stores computed A* paths and pathfinding parameters

These components work together with several systems that run automatically:

1. **`EntityTreeSystem`** - Builds a spatial index (KdTree) of all entities
2. **`EntityObserveSystem`** - Finds the closest target for entities with `TargetComp`
3. **`PathFindingSystem`** - Computes A* paths to targets
4. **`WalkTowardsSystem`** - Moves entities along their computed paths

## Basic AI Entity Setup

To create an entity that chases players, you need to combine all three AI components:

```rust title="Creating a Chasing Enemy"
use std::time::Duration;
use voxelize::{BrainComp, BrainOptions, PathComp, TargetComp, TargetType};

world.set_entity_loader("zombie", |world, _| {
    let body = RigidBody::new(
        &AABB::new()
            .scale_x(0.6)
            .scale_y(1.8)
            .scale_z(0.6)
            .build()
    ).build();
    let interactor = world.physics_mut().register(&body);

    world
        .create_entity(&nanoid!(), "zombie")
        .with(PositionComp::default())
        .with(RigidBodyComp::new(&body))
        .with(InteractorComp::new(&interactor))
        .with(BrainComp::new(BrainOptions::default()))
        .with(TargetComp::players())
        .with(PathComp::new(
            100,                           // max_nodes
            32.0,                          // max_distance
            10000,                         // max_depth_search
            Duration::from_millis(50),     // max_pathfinding_time
        ))
});
```

This creates a zombie that will automatically:
- Build a spatial index of nearby players
- Find the closest player
- Compute a path to that player
- Walk along the path, jumping over obstacles when needed

## BrainComp Configuration

`BrainComp` controls how entities move. It contains `BrainOptions` which configures movement physics:

```rust title="Customizing Brain Options"
use voxelize::BrainOptions;

let brain_options = BrainOptions {
    max_speed: 4.0,              // Maximum movement speed
    move_force: 12.0,           // Force applied when moving
    responsiveness: 120.0,      // How quickly entity responds to direction changes
    running_friction: 0.4,      // Friction when moving
    standing_friction: 2.0,     // Friction when standing still
    
    air_move_mult: 0.7,         // Movement multiplier in air
    jump_impulse: 8.0,          // Initial jump velocity
    jump_force: 1.0,            // Sustained jump force
    jump_time: 50.0,            // Jump duration in milliseconds
    air_jumps: 0,               // Number of mid-air jumps allowed
    
    sprint_speed_mult: 1.2,     // Speed multiplier when sprinting
    sprint_force_mult: 1.5,     // Force multiplier when sprinting
};

world
    .create_entity(&nanoid!(), "fast-zombie")
    .with(BrainComp::new(brain_options))
    // ... other components
```

### Brain State Control

You can programmatically control an entity's brain state:

```rust title="Controlling Brain State"
// In a custom system
impl<'a> System<'a> for CustomAISystem {
    type SystemData = WriteStorage<'a, BrainComp>;
    
    fn run(&mut self, mut brains: Self::SystemData) {
        for brain in brains.join() {
            // Make entity walk
            brain.walk();
            
            // Make entity jump
            brain.jump();
            
            // Make entity sprint
            brain.sprint();
            
            // Stop movement
            brain.stop();
            brain.stop_jumping();
            brain.stop_sprinting();
        }
    }
}
```

## TargetComp Configuration

`TargetComp` determines what entities will target. There are three target types:

```rust title="Target Types"
use voxelize::TargetComp;

// Target all entities (players and non-players)
let target_all = TargetComp::all();

// Target only players
let target_players = TargetComp::players();

// Target only non-player entities
let target_entities = TargetComp::entities();

// Target a specific position
let target_position = TargetComp::new(
    TargetType::All,
    Some(Vec3(10.0, 80.0, 10.0)),
    None
);

// Target a specific entity by ID
let target_id = TargetComp::new(
    TargetType::All,
    None,
    Some("entity-id-123".to_string())
);
```

The `EntityObserveSystem` automatically updates the `TargetComp.position` field with the closest target's position.

## PathComp Configuration

`PathComp` stores the computed path and configures pathfinding behavior:

```rust title="Pathfinding Configuration"
use std::time::Duration;

let path_comp = PathComp::new(
    100,                           // max_nodes: Maximum path length
    32.0,                          // max_distance: Maximum pathfinding distance
    10000,                         // max_depth_search: Maximum A* search depth
    Duration::from_millis(50),     // max_pathfinding_time: Time limit per pathfinding
);

world
    .create_entity(&nanoid!(), "npc")
    .with(path_comp)
    // ... other components
```

### Pathfinding Parameters Explained

- **`max_nodes`**: Maximum number of nodes in the computed path. Longer paths are rejected.
- **`max_distance`**: Maximum Euclidean distance (in blocks) the entity will pathfind. Targets beyond this distance won't be pursued.
- **`max_depth_search`**: Maximum number of nodes the A* algorithm will explore before giving up. Higher values allow more complex paths but cost more CPU.
- **`max_pathfinding_time`**: Maximum time allowed per pathfinding calculation. Prevents expensive pathfinding from blocking the server.

## Advanced AI Patterns

### Wandering Behavior

Create entities that wander randomly:

```rust title="Wandering AI"
use std::time::Duration;
use rand::Rng;

#[derive(Component)]
#[storage(VecStorage)]
struct WanderComp {
    target_position: Option<Vec3<f32>>,
    last_update: u64,
}

world.ecs_mut().register::<WanderComp>();

world.set_entity_loader("animal", |world, _| {
    // ... create entity with BrainComp and PathComp
    
    world
        .create_entity(&nanoid!(), "animal")
        .with(WanderComp {
            target_position: None,
            last_update: 0,
        })
        // ... other components
});

// Custom system for wandering
struct WanderSystem;

impl<'a> System<'a> for WanderSystem {
    type SystemData = (
        ReadExpect<'a, Stats>,
        WriteStorage<'a, WanderComp>,
        WriteStorage<'a, TargetComp>,
    );
    
    fn run(&mut self, (stats, mut wanders, mut targets): Self::SystemData) {
        for (wander, target) in (&mut wanders, &mut targets).join() {
            // Update target every 5 seconds
            if stats.tick - wander.last_update > 100 {
                let mut rng = rand::thread_rng();
                let new_x = rng.gen_range(-20.0..20.0);
                let new_z = rng.gen_range(-20.0..20.0);
                
                wander.target_position = Some(Vec3(new_x, 80.0, new_z));
                target.position = wander.target_position;
                wander.last_update = stats.tick;
            }
        }
    }
}
```

### Guard Behavior

Entities that patrol between waypoints:

```rust title="Patrol AI"
#[derive(Component)]
#[storage(VecStorage)]
struct PatrolComp {
    waypoints: Vec<Vec3<f32>>,
    current_waypoint: usize,
}

world.set_entity_loader("guard", |world, _| {
    let patrol = PatrolComp {
        waypoints: vec![
            Vec3(10.0, 80.0, 10.0),
            Vec3(20.0, 80.0, 10.0),
            Vec3(20.0, 80.0, 20.0),
            Vec3(10.0, 80.0, 20.0),
        ],
        current_waypoint: 0,
    };
    
    world
        .create_entity(&nanoid!(), "guard")
        .with(patrol)
        // ... other components
});

// System to update patrol targets
struct PatrolSystem;

impl<'a> System<'a> for PatrolSystem {
    type SystemData = (
        ReadStorage<'a, PathComp>,
        WriteStorage<'a, PatrolComp>,
        WriteStorage<'a, TargetComp>,
    );
    
    fn run(&mut self, (paths, mut patrols, mut targets): Self::SystemData) {
        for (path, patrol, target) in (&paths, &mut patrols, &mut targets).join() {
            // If path is empty or None, we've reached the waypoint
            if path.path.is_none() || path.path.as_ref().unwrap().is_empty() {
                patrol.current_waypoint = (patrol.current_waypoint + 1) % patrol.waypoints.len();
                target.position = Some(patrol.waypoints[patrol.current_waypoint]);
            }
        }
    }
}
```

### Fleeing Behavior

Entities that run away from players:

```rust title="Fleeing AI"
struct FleeSystem;

impl<'a> System<'a> for FleeSystem {
    type SystemData = (
        ReadStorage<'a, RigidBodyComp>,
        ReadStorage<'a, TargetComp>,
        WriteStorage<'a, BrainComp>,
    );
    
    fn run(&mut self, (bodies, targets, mut brains): Self::SystemData) {
        for (body, target, brain) in (&bodies, &targets, &mut brains).join() {
            if let Some(target_pos) = target.position {
                let entity_pos = body.0.get_position();
                
                // Calculate direction away from target
                let dx = entity_pos.0 - target_pos.0;
                let dz = entity_pos.2 - target_pos.2;
                let distance = (dx * dx + dz * dz).sqrt();
                
                if distance < 10.0 {
                    // Set target to a position away from the player
                    let flee_distance = 20.0;
                    let angle = dx.atan2(dz);
                    let flee_pos = Vec3(
                        entity_pos.0 + angle.cos() * flee_distance,
                        entity_pos.1,
                        entity_pos.2 + angle.sin() * flee_distance,
                    );
                    
                    // Update target to flee position
                    // Note: You'd need to modify TargetComp or use a custom component
                    // to set a custom position target
                }
            }
        }
    }
}
```

## Pathfinding Algorithm Details

The `PathFindingSystem` uses A* pathfinding with several optimizations:

### Walkability Checks

The system checks if positions are walkable by:
1. Ensuring there's solid ground below
2. Ensuring there's enough vertical clearance for the entity's height
3. Checking for walls and obstacles

### Path Smoothing

Paths are automatically smoothed using:
- **RDP (Ramer-Douglas-Peucker) simplification** - Removes unnecessary waypoints
- **Direct walk validation** - Checks if entities can walk directly between waypoints
- **Corner handling** - Prevents entities from cutting corners too tightly

### Performance Considerations

Pathfinding can be expensive. The system includes several safeguards:

- **Distance limits** - Entities won't pathfind beyond `max_distance`
- **Time limits** - Pathfinding stops after `max_pathfinding_time`
- **Search depth limits** - A* stops exploring after `max_depth_search` nodes
- **Parallel processing** - Pathfinding runs in parallel for multiple entities

## Troubleshooting

### Entity Not Moving

1. Check that `BrainComp`, `PathComp`, and `TargetComp` are all present
2. Verify the entity has a `RigidBodyComp` with proper AABB
3. Ensure the target position is valid and within `max_distance`
4. Check that the pathfinding systems are registered in your dispatcher

### Entity Getting Stuck

1. Increase `max_depth_search` to allow more complex paths
2. Check that the entity's AABB height matches the terrain clearance
3. Verify walkability - the entity might be trying to path through solid blocks
4. Increase `max_pathfinding_time` if paths are timing out

### Poor Path Quality

1. Adjust `max_nodes` - longer paths may be getting truncated
2. The path smoothing algorithm may be too aggressive - this is built into the system
3. Check that terrain is properly marked as passable/non-passable in block registry

## Example: Complete Enemy Entity

Here's a complete example of a hostile enemy that chases players:

```rust title="Complete Enemy Example"
use std::time::Duration;
use voxelize::*;

world.set_entity_loader("skeleton", |world, metadata| {
    let body = RigidBody::new(
        &AABB::new()
            .scale_x(0.6)
            .scale_y(1.8)
            .scale_z(0.6)
            .build()
    ).build();
    let interactor = world.physics_mut().register(&body);

    // Customize brain for aggressive behavior
    let brain_options = BrainOptions {
        max_speed: 5.0,
        move_force: 15.0,
        jump_impulse: 9.0,
        sprint_speed_mult: 1.3,
        ..Default::default()
    };

    world
        .create_entity(&nanoid!(), "skeleton")
        .with(PositionComp::default())
        .with(RigidBodyComp::new(&body))
        .with(InteractorComp::new(&interactor))
        .with(BrainComp::new(brain_options))
        .with(TargetComp::players())
        .with(PathComp::new(
            150,                          // Longer paths for better pursuit
            40.0,                         // Chase from further away
            15000,                        // More search depth
            Duration::from_millis(100),   // More time for complex paths
        ))
        .with(NameComp::new("Skeleton"))
});
```

This skeleton will aggressively chase players, jumping over obstacles and navigating complex terrain to reach its target.

## Next Steps

- Learn about [Custom Entity Creation](./custom-entity-creation) for more entity types
- Explore [The Events System](./events-system) to add combat and interactions
- Check out [Metadata Component](./metadata-component) to sync AI state to clients
