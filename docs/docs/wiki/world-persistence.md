---
sidebar_position: 1
---

# World Persistence and Saving

Voxelize provides comprehensive world persistence that saves both chunk data and entity states. This guide covers how to configure saving, understand the save format, and implement custom save/load hooks.

## Enabling World Persistence

World persistence is controlled through `WorldConfig`:

```rust
use voxelize::WorldConfig;

let config = WorldConfig::new()
    .saving(true)                    // Enable saving
    .save_dir("./worlds/my_world")  // Save directory
    .save_interval(300)              // Save every 300 ticks (~15 seconds at 20 TPS)
    .save_entities(true)             // Save entities
    .build();
```

### Configuration Options

- **`saving`** (`bool`): Master switch for all saving functionality. When `false`, no data is saved.
- **`save_dir`** (`String`): Directory where world data is stored. Chunks are saved in `save_dir/chunks/` and entities in `save_dir/entities/`.
- **`save_interval`** (`usize`): How often (in ticks) to save data. Default is 300 ticks (~15 seconds at 20 TPS).
- **`save_entities`** (`bool`): Whether to save entity data. Only applies if `saving` is `true`.

## Chunk Saving

Chunks are automatically saved by the `ChunkSavingSystem` every `save_interval` ticks.

### Save Location

Chunks are saved in: `{save_dir}/chunks/{chunk_x}_{chunk_z}.vox`

### Chunk Save Format

Chunks are saved as binary `.vox` files containing:
- Voxel data (block IDs)
- Light data
- Metadata

### Chunk Loading

When a world starts with `saving: true`, chunks are automatically loaded from disk when requested by clients. The `Chunks` manager handles loading:

```rust
// Chunks are automatically loaded when:
// 1. A client requests a chunk
// 2. The chunk exists in the save directory
// 3. The chunk is within the world bounds
```

### Manual Chunk Operations

You can manually save chunks:

```rust
// Save a specific chunk
world.chunks_mut().save(chunk_x, chunk_z);

// Save all loaded chunks
// (Note: This is done automatically by ChunkSavingSystem)
```

## Entity Persistence

Entities are saved by the `DataSavingSystem` every `save_interval` ticks, but only if they have a `MetadataComp` and don't have a `DoNotPersistComp`.

### Save Location

Entities are saved in: `{save_dir}/entities/{etype}-{id}.json`

The filename format is: `{sanitized_etype}-{entity_id}.json`

For example:
- `cow-abc123.json` - A cow entity
- `block::chest-xyz789.json` - A block entity (chest)

### Entity Save Format

Each entity is saved as a JSON file:

```json
{
  "etype": "cow",
  "metadata": {
    "position": [10.5, 64.0, 20.3],
    "health": 100,
    "customData": "value"
  }
}
```

### MetadataComp

The `MetadataComp` is the key to entity persistence. Only data stored in `MetadataComp` is saved:

```rust
use voxelize::{MetadataComp, PositionComp};
use specs::{ReadStorage, System, WriteStorage};

// In your system
let (positions, mut metadatas) = data;

for (position, metadata) in (&positions, &mut metadatas).join() {
    // Add position to metadata for saving
    metadata.insert("position", json!([
        position.0.0,
        position.0.1,
        position.0.2
    ]));
}
```

### Excluding Entities from Saving

Use `DoNotPersistComp` to prevent an entity from being saved:

```rust
use voxelize::DoNotPersistComp;

world
    .create_entity("temp-id", "temporary")
    .with(DoNotPersistComp)
    .build();
```

This is useful for:
- Temporary entities (projectiles, particles)
- Client-only entities
- Entities that should be regenerated on load

### Entity Loading

Entities are loaded when you set an entity loader:

```rust
world.set_entity_loader("cow", |world, metadata| {
    // metadata contains the saved data
    let position = metadata["position"].as_array().unwrap();
    let x = position[0].as_f64().unwrap() as f32;
    let y = position[1].as_f64().unwrap() as f32;
    let z = position[2].as_f64().unwrap() as f32;
    
    world
        .create_entity(&nanoid!(), "cow")
        .with(PositionComp::new(x, y, z))
        .with(MetadataComp::from(metadata.clone()))
        .build()
});
```

The loader receives the saved metadata, allowing you to restore entity state.

## Custom Save/Load Hooks

### Custom Save Logic

You can add custom save logic by creating a system that runs before `DataSavingSystem`:

```rust
use voxelize::{MetadataComp, IDComp, ETypeComp};
use specs::{ReadStorage, System, WriteStorage};

pub struct CustomSaveSystem;

impl<'a> System<'a> for CustomSaveSystem {
    type SystemData = (
        ReadStorage<'a, IDComp>,
        ReadStorage<'a, ETypeComp>,
        WriteStorage<'a, MetadataComp>,
    );

    fn run(&mut self, data: Self::SystemData) {
        let (ids, etypes, mut metadatas) = data;
        
        for (id, etype, metadata) in (&ids, &etypes, &mut metadatas).join() {
            if etype.0 == "custom_entity" {
                // Add custom data to metadata before saving
                metadata.insert("lastSaved", json!(std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs()));
            }
        }
    }
}
```

Register it before `DataSavingSystem`:

```rust
dispatcher
    .with(CustomSaveSystem, "custom-save", &[])
    .with(DataSavingSystem, "entities-saving", &["custom-save"]);
```

### Custom Load Logic

Add custom logic in your entity loader:

```rust
world.set_entity_loader("custom_entity", |world, metadata| {
    // Restore custom state
    let last_saved = metadata["lastSaved"].as_u64().unwrap_or(0);
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let time_since_save = current_time - last_saved;
    
    // Example: Remove entity if it hasn't been saved in 24 hours
    if time_since_save > 86400 {
        return; // Don't load this entity
    }
    
    // Load entity normally
    world
        .create_entity(&nanoid!(), "custom_entity")
        .with(MetadataComp::from(metadata.clone()))
        .build()
});
```

## Save Performance

### Optimization Tips

1. **Adjust save interval**: Higher intervals reduce I/O but increase data loss risk
   - For development: 100-300 ticks
   - For production: 300-600 ticks

2. **Limit saved entities**: Use `DoNotPersistComp` for temporary entities

3. **Minimize metadata size**: Only save essential data in `MetadataComp`

4. **Batch operations**: The saving systems already batch operations, but you can further optimize by:
   - Reducing `save_interval` during low activity
   - Increasing `save_interval` during high activity

### Save System Behavior

- **ChunkSavingSystem**: Saves up to `config.max_saves_per_tick` chunks per tick (default: 2)
- **DataSavingSystem**: Saves all entities in parallel using Rayon

## Backup Strategy

Voxelize doesn't include built-in backups, but you can implement them:

### Simple Backup Script

```bash
#!/bin/bash
# backup-world.sh

WORLD_DIR="./worlds/my_world"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp -r "$WORLD_DIR" "$BACKUP_DIR/world_$TIMESTAMP"
```

### Automated Backups

Use cron or systemd timers to run backups periodically:

```bash
# Run backup every 6 hours
0 */6 * * * /path/to/backup-world.sh
```

## Troubleshooting

### Entities Not Saving

1. Check `config.saving` is `true`
2. Verify `config.save_entities` is `true`
3. Ensure entity has `MetadataComp`
4. Confirm entity doesn't have `DoNotPersistComp`
5. Check entity has `IDComp` and `ETypeComp` (added automatically by `create_entity`)

### Chunks Not Loading

1. Verify `config.saving` is `true`
2. Check chunk files exist in `save_dir/chunks/`
3. Ensure chunk coordinates are within world bounds
4. Check file permissions

### Save Directory Issues

1. Ensure directory exists and is writable
2. Check disk space
3. Verify path is correct (relative vs absolute)

### Performance Issues

1. Increase `save_interval`
2. Reduce `max_saves_per_tick` in config
3. Add `DoNotPersistComp` to temporary entities
4. Minimize `MetadataComp` size

## Example: Complete Save Setup

```rust
use voxelize::{World, WorldConfig, MetadataComp, PositionComp, DoNotPersistComp};

fn main() {
    let config = WorldConfig::new()
        .saving(true)
        .save_dir("./worlds/my_world")
        .save_interval(300)
        .save_entities(true)
        .build();
    
    let mut world = World::new("my_world", &config);
    
    // Set up entity loader
    world.set_entity_loader("npc", |world, metadata| {
        let pos = metadata["position"].as_array().unwrap();
        world
            .create_entity(&nanoid!(), "npc")
            .with(PositionComp::new(
                pos[0].as_f64().unwrap() as f32,
                pos[1].as_f64().unwrap() as f32,
                pos[2].as_f64().unwrap() as f32,
            ))
            .with(MetadataComp::from(metadata.clone()))
            .build()
    });
    
    // Create a persistent entity
    world
        .create_entity("npc-1", "npc")
        .with(PositionComp::new(10.0, 64.0, 20.0))
        .with({
            let mut meta = MetadataComp::default();
            meta.insert("position", json!([10.0, 64.0, 20.0]));
            meta.insert("name", json!("Guard"));
            meta
        })
        .build();
    
    // Create a temporary entity (not saved)
    world
        .create_entity("projectile-1", "projectile")
        .with(PositionComp::new(0.0, 100.0, 0.0))
        .with(DoNotPersistComp)
        .build();
}
```

## Summary

World persistence in Voxelize provides:

- ✅ Automatic chunk saving and loading
- ✅ Entity persistence via `MetadataComp`
- ✅ Configurable save intervals
- ✅ Selective entity saving with `DoNotPersistComp`
- ✅ Custom save/load hooks
- ✅ Parallel saving for performance

By properly configuring saving and using `MetadataComp` effectively, you can create persistent worlds that survive server restarts.
