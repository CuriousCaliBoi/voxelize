---
sidebar_position: 14
---

# AI and Pathfinding

Voxelize includes a full AI stack on the server, built from ECS components and systems:

- `BrainComp` – movement brain that applies forces to a `RigidBody`
- `TargetComp` – selects what this entity is interested in (players, entities, etc.)
- `PathComp` – stores pathfinding settings and the current path
- `PathFindingSystem` – runs A* over the voxel world to compute paths
- `WalkTowardsSystem` – drives `BrainComp` along the path

This tutorial walks through how to use these pieces to create enemies that chase players and how to tune their behavior.

## Core Components

### BrainComp – Movement Brain

`BrainComp` encapsulates walking, sprinting, and jumping logic for an entity with a `RigidBody`:

```rust title="BrainComp Overview"
#[derive(Default, Component, Serialize, Deserialize)]
#[storage(VecStorage)]
pub struct BrainComp {
    pub state: BrainState,
    pub options: BrainOptions,
}

impl BrainComp {
    pub fn new(options: BrainOptions) -> Self { /* ... */ }

    pub fn stop(&mut self) { /* ... */ }
    pub fn walk(&mut self) { /* ... */ }
    pub fn jump(&mut self) { /* ... */ }
    pub fn sprint(&mut self) { /* ... */ }
    pub fn stop_jumping(&mut self) { /* ... */ }
    pub fn stop_sprinting(&mut self) { /* ... */ }

    /// Apply forces to the rigid body to move toward `target`
    pub fn operate(&mut self, target: &Vec3<f32>, body: &mut RigidBody, dt: f32) { /* ... */ }
}
```

Key `BrainOptions` fields:

- `max_speed` – target horizontal speed when walking
- `move_force` – maximum horizontal force per tick
- `running_friction` / `standing_friction` – friction when moving vs idle
- `air_move_mult` – movement control in air
- `jump_impulse`, `jump_force`, `jump_time`, `air_jumps` – jumping behavior
- `sprint_speed_mult`, `sprint_force_mult` – sprint modifiers

`WalkTowardsSystem` sets `BrainComp` to walk, sprint, or jump as needed, then calls `brain.operate()` each tick.

### TargetComp – What to Chase

`TargetComp` tells the AI systems what type of things this entity should look for:

```rust title="TargetComp Overview"
#[derive(Component, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[storage(VecStorage)]
pub struct TargetComp {
    pub target_type: TargetType,
    pub position: Option<Vec3<f32>>,
    pub id: Option<String>,
}

impl TargetComp {
    pub fn all() -> Self { /* ... */ }
    pub fn players() -> Self { /* ... */ }
    pub fn entities() -> Self { /* ... */ }
}
```

- `TargetType::Players` – chase players
- `TargetType::Entities` – chase other entities
- `TargetType::All` – consider both
- `position` – override with an explicit world-space target position
- `id` – optionally identify a specific entity to follow

The path systems (`EntityObserveSystem`, `EntityTreeSystem`, `TargetMetadataSystem`) use this to populate `TargetComp.position` each tick.

### PathComp – Pathfinding Settings

`PathComp` stores both configuration and the resulting path:

```rust title="PathComp Overview"
#[derive(Component, Debug, Serialize, Deserialize, Default)]
#[storage(VecStorage)]
#[serde(rename_all = "camelCase")]
pub struct PathComp {
    pub path: Option<Vec<Vec3<i32>>>,
    pub max_nodes: usize,
    pub max_distance: f64,
    pub max_depth_search: i32,
    pub max_pathfinding_time: Duration,
}

impl PathComp {
    pub fn new(
        max_nodes: usize,
        max_distance: f64,
        max_depth_search: i32,
        max_pathfinding_time: Duration,
    ) -> Self { /* ... */ }
}
```

Parameters:

- **`max_nodes`** – maximum number of nodes allowed in the final path  
  - Higher = longer paths, but more memory and potential CPU cost  
  - If exceeded, the path is discarded (`path = None`)
- **`max_distance`** – maximum straight-line distance between entity and target to even attempt pathfinding  
  - Prevents far-away entities from wasting CPU
- **`max_depth_search`** – maximum number of nodes A* will expand  
  - Protection against huge or impossible searches
- **`max_pathfinding_time`** – wall-clock time budget for A*  
  - Typical values: 10–50 ms per entity

These are enforced inside `PathFindingSystem`.

## Systems Involved

The path module wires everything together:

- `PathFindingSystem` – computes paths using `AStar::calculate`
- `WalkTowardsSystem` – advances along the path and drives `BrainComp`
- `EntityObserveSystem` / `EntityTreeSystem` – maintain nearby target data
- `PathMetadataSystem` / `TargetMetadataSystem` – sync path/target info to metadata

You usually do not call these systems directly; you only:

1. Attach the right components to your entity (`BrainComp`, `TargetComp`, `PathComp`, `RigidBodyComp`)
2. Ensure the world registers and runs the path systems (done in the default world setup)

## Creating an Enemy that Chases Players

This example sets up a basic enemy that chases nearby players using the AI stack.

```rust title="Enemy Entity with AI"
use nanoid::nanoid;
use std::time::Duration;
use voxelize::*;

world.set_entity_loader("enemy", |world, _metadata| {
    // Physics body
    let body = RigidBody::new(
        &AABB::new()
            .scale_x(0.6)
            .scale_y(1.8)
            .scale_z(0.6)
            .build(),
    )
    .build();
    let interactor = world.physics_mut().register(&body);

    world
        .create_entity(&nanoid!(), "enemy")
        .with(PositionComp::default())
        .with(DirectionComp::default())
        .with(RigidBodyComp::new(&body))
        .with(InteractorComp::new(&interactor))
        // Movement brain
        .with(BrainComp::new(BrainOptions {
            max_speed: 4.0,
            move_force: 12.0,
            jump_impulse: 8.0,
            sprint_speed_mult: 1.2,
            sprint_force_mult: 1.5,
            ..Default::default()
        }))
        // Chase players
        .with(TargetComp::players())
        // Pathfinding configuration
        .with(PathComp::new(
            200,                       // max_nodes
            32.0,                      // max_distance (blocks)
            20_000,                    // max_depth_search
            Duration::from_millis(40), // max_pathfinding_time
        ));
});
```

Once this entity type exists and the world is running the path systems, spawning an `"enemy"` will automatically:

1. Find the nearest player (via `TargetComp::players()`)
2. Compute a path toward that player (`PathFindingSystem`)
3. Walk and jump along the path (`WalkTowardsSystem` + `BrainComp`)

### Spawning Enemies from Clients

You can expose a method so clients can spawn enemies from in-game:

```rust title="Enemy Spawn Method"
#[derive(Serialize, Deserialize)]
struct SpawnEnemyPayload {
    position: Vec3<f32>,
}

world.set_method_handle("spawn-enemy", |world, _client_id, payload| {
    let data: SpawnEnemyPayload = serde_json::from_value(payload).unwrap();
    world.spawn_entity_at("enemy", &data.position);
});
```

Client-side:

```ts title="Client Spawn Enemy Call"
method.call("spawn-enemy", {
  position: controls.object.position.toArray(),
});
```

## Tuning Pathfinding Performance

AI pathfinding can be one of the most expensive systems in a voxel game. Use `PathComp` parameters to balance responsiveness vs. CPU usage:

- **Short-range chasers** (e.g. melee mobs)
  - `max_distance`: 16–32
  - `max_nodes`: 100–200
  - `max_depth_search`: 5_000–15_000
  - `max_pathfinding_time`: 10–30 ms
- **Long-range seekers** (e.g. bosses, trackers)
  - `max_distance`: 64–128
  - `max_nodes`: 300–500
  - `max_depth_search`: 20_000–50_000
  - `max_pathfinding_time`: 30–60 ms

Guidelines:

- Decrease `max_distance` and `max_nodes` if the server is CPU-bound.
- Use a larger `max_pathfinding_time` only for very important entities.
- Consider pathfinding only every N ticks instead of every tick (e.g. by enabling/disabling `PathComp` via a custom system).

## Custom AI Behavior Patterns

With the same building blocks, you can implement many AI styles.

### Guard / Sentry

Guard a specific position instead of chasing globally:

```rust title="Guard AI Using Fixed Position"
world.set_entity_loader("guard", |world, _metadata| {
    // ... create body, interactor, brain ...

    let guard_position = Vec3(0.0, 64.0, 0.0);

    world
        .create_entity(&nanoid!(), "guard")
        // ...
        .with(BrainComp::new(BrainOptions::default()))
        .with(TargetComp::new(
            TargetType::All,
            Some(guard_position),
            None,
        ))
        .with(PathComp::new(
            150,
            32.0,
            15_000,
            Duration::from_millis(30),
        ));
});
```

You can combine this with a custom system that periodically switches `TargetComp.position` between the guard point and nearby players, creating “return to post” behavior.

### Wanderers and Patrols

For simple wandering behavior, you can bypass `TargetComp` and write a custom system that:

1. Picks a random reachable voxel near the entity
2. Sets `PathComp.path` directly or updates `TargetComp.position`
3. Lets `WalkTowardsSystem` and `BrainComp` handle movement

```rust title="Simple Wander System (Sketch)"
pub struct WanderSystem;

impl<'a> System<'a> for WanderSystem {
    type SystemData = (
        ReadStorage<'a, PositionComp>,
        WriteStorage<'a, TargetComp>,
        WriteStorage<'a, PathComp>,
    );

    fn run(&mut self, (positions, mut targets, mut paths): Self::SystemData) {
        use rand::Rng;

        let mut rng = rand::thread_rng();

        for (pos, target, path) in (&positions, &mut targets, &mut paths).join() {
            if path.path.is_some() {
                continue; // Already walking somewhere
            }

            // Pick a random offset around the current position
            let dx = rng.gen_range(-8.0..=8.0);
            let dz = rng.gen_range(-8.0..=8.0);

            target.position = Some(Vec3(pos.0 + dx, pos.1, pos.2 + dz));
        }
    }
}
```

This produces wandering mobs that pick a new random destination whenever they reach their current one.

### Fleeing Behavior

To make entities flee from players:

1. Use `TargetComp::players()` to discover the closest player.
2. In a custom system, compute a position opposite that player.
3. Write that position into `TargetComp.position` (or a dedicated `FleeTargetComp`) and rely on the path systems.

## Next Steps

- Read the [Custom Entities](../wiki/entities/custom-entities.md) and existing intermediate tutorials to see more complete examples.
- Combine AI with [collision detection](./7-collision-detection.md) and your own components (health, damage, aggro states) to create rich enemy behaviors.
- Experiment with `BrainOptions` and `PathComp` values on a dev server to find good defaults for your game.

