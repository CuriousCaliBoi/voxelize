---
sidebar_position: 1
---

# World Persistence and Saving

Voxelize includes a comprehensive persistence system that automatically saves chunks and entities to disk. This guide covers how to configure and use the saving system, understand save formats, and implement custom save/load hooks.

## Overview

The persistence system saves two types of data:

1. **Chunks** - Voxel data, lighting, and block states
2. **Entities** - Entity positions, metadata, and component data

Both are saved periodically based on `WorldConfig` settings and can be restored when the world loads.

## Enabling Persistence

Enable saving in your world configuration:

```rust title="Enabling World Saving"
use voxelize::WorldConfig;

let config = WorldConfig::new()
    .saving(true)                    // Enable saving
    .save_dir("./worlds/my_world")   // Save directory
    .save_interval(300)               // Save every 300 ticks (~15 seconds at 20 TPS)
    .save_entities(true)              // Also save entities
    .build();
```

### Save Configuration Options

- **`saving`**: Master switch for all saving functionality
- **`save_dir`**: Directory where world data is stored
- **`save_interval`**: Ticks between save operations (default: 300)
- **`save_entities`**: Whether to save entity data (default: true)
- **`max_saves_per_tick`**: Maximum chunks saved per tick (default: 2)

## Chunk Saving

Chunks are automatically saved by the `ChunkSavingSystem` every `save_interval` ticks.

### Save Location

Chunks are saved in:
```
{save_dir}/chunks/{chunk_x}_{chunk_z}.chunk
```

### Chunk Save Format

Chunks are saved in a binary format containing:
- Voxel IDs (block types)
- Light levels
- Block metadata (if any)

### Chunk Loading

Chunks are automatically loaded when:
1. A client requests a chunk
2. The world preloads chunks (if `preload` is enabled)

The system checks the save directory first, then generates new chunks if not found.

## Entity Saving

Entities are saved by the `DataSavingSystem` every `save_interval` ticks.

### Save Location

Entities are saved in:
```
{save_dir}/entities/{etype}-{id}.json
```

For example:
- `skeleton-abc123.json`
- `block::chest-xyz789.json` (block entities)

### Entity Save Format

Each entity file contains JSON:

```json title="Entity Save File"
{
  "etype": "skeleton",
  "metadata": {
    "position": [10.5, 80.0, 15.3],
    "name": "Bob",
    "health": 100,
    "custom_data": "value"
  }
}
```

### What Gets Saved

Only entities with these components are saved:
- `IDComp` - Entity identifier
- `ETypeComp` - Entity type
- `MetadataComp` - All entity data

Entities with `DoNotPersistComp` are **never** saved.

## MetadataComp and Persistence

`MetadataComp` is the bridge between server components and saved data. Only data stored in `MetadataComp` is saved and sent to clients.

### Saving Component Data

To save component data, add it to `MetadataComp`:

```rust title="Saving Custom Data"
use voxelize::MetadataComp;

#[derive(Serialize, Deserialize)]
struct HealthData {
    current: i32,
    max: i32,
}

// In a system that updates health
impl<'a> System<'a> for HealthSystem {
    type SystemData = (
        ReadStorage<'a, HealthComp>,
        WriteStorage<'a, MetadataComp>,
    );
    
    fn run(&mut self, (healths, mut metadatas): Self::SystemData) {
        for (health, metadata) in (&healths, &mut metadatas).join() {
            let health_data = HealthData {
                current: health.0,
                max: health.1,
            };
            metadata.set("health", &health_data);
        }
    }
}
```

### Loading Saved Data

When entities are loaded, their metadata is passed to the entity loader:

```rust title="Loading from Metadata"
world.set_entity_loader("skeleton", |world, metadata| {
    // Load saved position
    let position = metadata.get::<PositionComp>("position")
        .unwrap_or(PositionComp::default());
    
    // Load custom health data
    let health = metadata.get::<HealthData>("health")
        .unwrap_or(HealthData { current: 100, max: 100 });
    
    // Create entity with loaded data
    world
        .create_entity(&nanoid!(), "skeleton")
        .with(position)
        .with(HealthComp(health.current, health.max))
        // ... other components
});
```

## Custom Save Hooks

You can implement custom save logic by creating systems that run before `DataSavingSystem`:

```rust title="Custom Save System"
use std::fs;

struct CustomSaveSystem;

impl<'a> System<'a> for CustomSaveSystem {
    type SystemData = ReadExpect<'a, WorldConfig>;
    
    fn run(&mut self, config: Self::SystemData) {
        if !config.saving {
            return;
        }
        
        // Custom save logic
        let save_path = format!("{}/custom_data.json", config.save_dir);
        let data = json!({
            "timestamp": std::time::SystemTime::now(),
            "custom_field": "value"
        });
        
        fs::write(&save_path, serde_json::to_string(&data).unwrap())
            .expect("Failed to save custom data");
    }
}
```

Register it in your dispatcher before `DataSavingSystem`:

```rust title="Registering Custom Save System"
world.dispatcher_mut().add(
    CustomSaveSystem,
    "custom_save",
    &[]
);
```

## Custom Load Hooks

Load custom data when the world starts:

```rust title="Custom Load System"
use std::fs;

fn load_custom_data(world: &mut World) {
    let config = world.config();
    let load_path = format!("{}/custom_data.json", config.save_dir);
    
    if let Ok(data) = fs::read_to_string(&load_path) {
        let json: serde_json::Value = serde_json::from_str(&data).unwrap();
        // Process loaded data
        println!("Loaded custom data: {:?}", json);
    }
}

// Call during world initialization
let mut world = World::new(config);
load_custom_data(&mut world);
world.prepare();
```

## Entity Revival

When the world loads (`world.prepare()`), entities are automatically revived:

1. All JSON files in `{save_dir}/entities/` are read
2. Each file's `etype` is used to find the entity loader
3. The loader receives the saved `metadata`
4. The entity is spawned at its saved position

### Entity Loader Requirements

Entity loaders must handle metadata properly:

```rust title="Entity Loader with Metadata"
world.set_entity_loader("mob", |world, metadata| {
    // Always check if metadata exists and has expected fields
    let position = metadata.get::<PositionComp>("position")
        .unwrap_or_else(|| {
            // Fallback if position not found
            PositionComp::new(0.0, 80.0, 0.0)
        });
    
    world
        .create_entity(&nanoid!(), "mob")
        .with(position)
        // ... restore other components from metadata
});
```

## Preventing Entity Persistence

Mark entities that shouldn't be saved:

```rust title="Preventing Persistence"
use voxelize::DoNotPersistComp;

world
    .create_entity(&nanoid!(), "temporary")
    .with(DoNotPersistComp)
    // ... other components
```

Entities with `DoNotPersistComp` are:
- Not saved to disk
- Not restored on world load
- Useful for temporary entities (projectiles, effects, etc.)

## Save Directory Structure

The complete save directory structure:

```
{save_dir}/
├── chunks/
│   ├── 0_0.chunk
│   ├── 0_1.chunk
│   ├── 1_0.chunk
│   └── ...
├── entities/
│   ├── skeleton-abc123.json
│   ├── zombie-xyz789.json
│   ├── block::chest-def456.json
│   └── ...
└── stats.json          # World statistics
```

## Performance Considerations

### Save Interval Tuning

- **Too frequent** (e.g., every 10 ticks): High disk I/O, may impact performance
- **Too infrequent** (e.g., every 10000 ticks): Risk of data loss on crash
- **Recommended**: 300-600 ticks (15-30 seconds at 20 TPS)

### Max Saves Per Tick

Limit how many chunks save per tick:

```rust title="Limiting Save Rate"
let config = WorldConfig::new()
    .max_saves_per_tick(5)  // Save max 5 chunks per tick
    .build();
```

This prevents save operations from blocking the main thread.

### Entity Save Optimization

The `DataSavingSystem` uses parallel processing (`par_join`) to save multiple entities simultaneously. Large numbers of entities will save efficiently.

## Backup Strategies

### Manual Backups

Copy the entire `save_dir` directory:

```bash
cp -r ./worlds/my_world ./worlds/my_world_backup
```

### Automated Backups

Implement a backup system:

```rust title="Backup System"
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

fn backup_world(save_dir: &str) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let backup_dir = format!("{}_backup_{}", save_dir, timestamp);
    fs::rename(save_dir, &backup_dir).expect("Backup failed");
    
    println!("World backed up to: {}", backup_dir);
}

// Call periodically or on shutdown
```

## Troubleshooting

### Entities Not Saving

1. Check `config.saving` is `true`
2. Verify `config.save_entities` is `true`
3. Ensure entities have `IDComp`, `ETypeComp`, and `MetadataComp`
4. Check entities don't have `DoNotPersistComp`
5. Verify `save_interval` has passed (check `Stats.tick % save_interval == 0`)

### Entities Not Loading

1. Check entity files exist in `{save_dir}/entities/`
2. Verify entity loader is registered for the `etype`
3. Check JSON format is valid
4. Ensure entity loader handles missing metadata gracefully

### Chunks Not Saving

1. Verify `config.saving` is `true`
2. Check `save_interval` has passed
3. Ensure chunks have been modified (unchanged chunks may not save)
4. Check disk permissions for `save_dir`

### Save Directory Not Created

The system creates directories automatically, but ensure:
- Parent directory exists
- Process has write permissions
- Disk has sufficient space

## Example: Complete Persistence Setup

```rust title="Complete Persistence Example"
use voxelize::*;

fn setup_persistent_world() -> World {
    let config = WorldConfig::new()
        .saving(true)
        .save_dir("./worlds/persistent_world")
        .save_interval(300)
        .save_entities(true)
        .max_saves_per_tick(5)
        .build();
    
    let mut world = World::new(config);
    
    // Register entity loader that handles saved data
    world.set_entity_loader("mob", |world, metadata| {
        let position = metadata.get::<PositionComp>("position")
            .unwrap_or(PositionComp::new(0.0, 80.0, 0.0));
        
        let health = metadata.get::<i32>("health")
            .unwrap_or(100);
        
        world
            .create_entity(&nanoid!(), "mob")
            .with(position)
            .with(HealthComp(health))
            // ... other components
    });
    
    // Prepare world (loads saved entities)
    world.prepare();
    
    world
}
```

This setup creates a fully persistent world that saves chunks and entities every 15 seconds and restores them on startup.

## Next Steps

- Learn about [Custom Entity Creation](../tutorials/intermediate/custom-entity-creation) for complex entities
- Explore [The Events System](../tutorials/intermediate/events-system) for save/load events
- Check out [World Configuration](../tutorials/basics/world-configuration) for more config options
