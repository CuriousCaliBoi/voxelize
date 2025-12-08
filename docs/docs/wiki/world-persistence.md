---
sidebar_position: 1
---

# World Persistence and Saving

Voxelize provides a comprehensive persistence system that automatically saves chunks and entities to disk. This guide covers how to configure world saving, understand the saving behavior, and customize persistence for your needs.

## Overview

The persistence system in Voxelize consists of:

- **Chunk Saving** - Automatically saves modified chunks to disk
- **Entity Saving** - Persists entity data with metadata
- **Stats Saving** - Saves world statistics (tick count, time of day)

All saving is handled by dedicated systems that run periodically based on your configuration.

## Enabling World Saving

Enable saving when creating your world:

```rust
use voxelize::WorldConfig;

let config = WorldConfig::new()
    .saving(true)                    // Enable saving
    .save_dir("./worlds/my-world")   // Directory to save to
    .save_interval(300)               // Save every 300 ticks
    .save_entities(true)              // Also save entities
    .build();

let world = World::new(config);
```

### Configuration Options

- **`saving: bool`** - Master switch for all saving functionality. Default: `false`
- **`save_dir: String`** - Directory path where world data is saved. Default: `""`
- **`save_interval: usize`** - Number of ticks between saves. Default: `300` (15 seconds at 20 TPS)
- **`save_entities: bool`** - Whether to save entity data. Only applies if `saving` is true. Default: `false`
- **`max_saves_per_tick: usize`** - Maximum chunks saved per tick to prevent lag spikes. Default: `2`

## Chunk Saving

Chunks are automatically saved when:

1. They have been modified (voxels changed)
2. The save interval has elapsed
3. The chunk is marked as ready to save

### Chunk Save Directory Structure

```
save_dir/
  chunks/
    chunk_0_0.json    # Chunk at coordinates (0, 0)
    chunk_1_0.json
    chunk_0_1.json
    ...
```

Chunk files are named using the pattern `chunk_{x}_{z}.json` where `x` and `z` are chunk coordinates.

### Chunk Save Behavior

- **Automatic Saving** - Modified chunks are queued for saving
- **Rate Limiting** - Only `max_saves_per_tick` chunks are saved per tick to prevent lag
- **Incremental** - Only modified chunks are saved, not the entire world
- **Format** - Chunks are saved as JSON files containing voxel data

### Manual Chunk Saving

You can manually save chunks:

```rust
// Save a specific chunk
world.chunks_mut().save(chunk_x, chunk_z);

// Save all modified chunks (respects max_saves_per_tick)
// This happens automatically, but you can trigger it manually
```

## Entity Saving

Entities are saved with their metadata to allow full restoration of entity state.

### Entity Save Directory Structure

```
save_dir/
  entities/
    mob-abc123.json           # Entity with etype "mob" and id "abc123"
    player-xyz789.json
    block::chest-def456.json  # Block entity
    ...
```

Entity files are named using the pattern `{etype}-{id}.json` where:
- `etype` is the entity type (lowercased, with `::` replaced by `-`)
- `id` is the entity's unique ID

### What Gets Saved

Entities are saved with:

- **Entity Type** (`etype`) - Identifies what kind of entity this is
- **Metadata** - All data stored in `MetadataComp`

### MetadataComp

The `MetadataComp` is a JSON-compatible component that stores arbitrary data:

```rust
use voxelize::MetadataComp;
use serde_json::json;

// Create metadata
let mut metadata = MetadataComp::default();
metadata.insert("health", json!(100));
metadata.insert("inventory", json!(["sword", "shield"]));
metadata.insert("position", json!([10.5, 64.0, 20.3]));

// Add to entity
world
    .create_entity("my-id", "mob")
    .with(metadata)
    .build();
```

### Excluding Entities from Saving

Mark entities to exclude from saving:

```rust
use voxelize::DoNotPersistComp;

world
    .create_entity("temp-id", "projectile")
    .with(DoNotPersistComp)  // Won't be saved
    .build();
```

### Entity Loading

Entities are automatically loaded when the world starts if saving is enabled:

```rust
// Entities are loaded automatically from save_dir/entities/
// Use set_entity_loader to define how entities are created
world.set_entity_loader("mob", |world, metadata| {
    // metadata contains the saved data
    let health = metadata.get("health")
        .and_then(|v| v.as_u64())
        .unwrap_or(100);
    
    // Create entity with saved state
    world
        .create_entity(&nanoid!(), "mob")
        .with(MetadataComp::from(metadata.clone()))
        .build()
});
```

## Stats Saving

World statistics are automatically saved:

- **Tick Count** - Current world tick
- **Time of Day** - Current time (if time ticking is enabled)

Stats are saved to `save_dir/stats.json` and automatically loaded when the world starts.

## Save Interval Tuning

The `save_interval` controls how frequently saves occur:

```rust
// Save every 5 seconds (at 20 TPS: 5 * 20 = 100 ticks)
.save_interval(100)

// Save every minute (at 20 TPS: 60 * 20 = 1200 ticks)
.save_interval(1200)

// Save every 5 minutes (at 20 TPS: 5 * 60 * 20 = 6000 ticks)
.save_interval(6000)
```

**Considerations:**

- **Lower interval** (e.g., 100 ticks) - More frequent saves, less data loss on crash, more disk I/O
- **Higher interval** (e.g., 6000 ticks) - Less frequent saves, more data loss on crash, less disk I/O

## Custom Save Hooks

You can hook into the saving process by creating custom systems that run before or after the saving systems.

### Before Saving

Run logic before entities are saved:

```rust
use specs::{ReadExpect, System};
use voxelize::{WorldConfig, Stats};

pub struct PreSaveSystem;

impl<'a> System<'a> for PreSaveSystem {
    type SystemData = (
        ReadExpect<'a, Stats>,
        ReadExpect<'a, WorldConfig>,
    );

    fn run(&mut self, (stats, config): Self::SystemData) {
        // Only run on save ticks
        if stats.tick % config.save_interval as u64 == 0 {
            // Prepare data for saving
            // Update metadata, etc.
        }
    }
}
```

### After Saving

Run logic after entities are saved:

```rust
pub struct PostSaveSystem;

impl<'a> System<'a> for PostSaveSystem {
    type SystemData = (
        ReadExpect<'a, Stats>,
        ReadExpect<'a, WorldConfig>,
    );

    fn run(&mut self, (stats, config): Self::SystemData) {
        // Only run after save ticks
        if stats.tick % config.save_interval as u64 == 0 {
            // Cleanup, backup, etc.
        }
    }
}
```

Add to dispatcher:

```rust
dispatcher
    .with(PreSaveSystem, "pre-save", &[])
    .with(DataSavingSystem, "entities-saving", &["pre-save"])
    .with(PostSaveSystem, "post-save", &["entities-saving"]);
```

## Backup Strategy

Voxelize doesn't include built-in backups, but you can implement your own:

### Manual Backup

```rust
use std::fs;
use std::path::PathBuf;

fn backup_world(save_dir: &str) {
    let backup_dir = format!("{}-backup-{}", save_dir, 
        chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    
    fs::create_dir_all(&backup_dir).unwrap();
    
    // Copy chunks
    fs::copy(
        format!("{}/chunks", save_dir),
        format!("{}/chunks", backup_dir)
    ).unwrap();
    
    // Copy entities
    fs::copy(
        format!("{}/entities", save_dir),
        format!("{}/entities", backup_dir)
    ).unwrap();
    
    // Copy stats
    fs::copy(
        format!("{}/stats.json", save_dir),
        format!("{}/stats.json", backup_dir)
    ).unwrap();
}
```

### Periodic Backups

Run backups in a custom system:

```rust
pub struct BackupSystem;

impl<'a> System<'a> for BackupSystem {
    type SystemData = ReadExpect<'a, Stats>;

    fn run(&mut self, stats: Self::SystemData) {
        // Backup every hour (at 20 TPS: 60 * 60 * 20 = 72000 ticks)
        if stats.tick % 72000 == 0 {
            backup_world("./worlds/my-world");
        }
    }
}
```

## Performance Considerations

### Disk I/O Impact

Saving can impact performance:

- **`max_saves_per_tick`** - Limits how many chunks are saved per tick
- **Save interval** - More frequent saves = more disk I/O
- **Entity count** - More entities = more files to write

### Optimization Tips

1. **Increase `max_saves_per_tick`** if you have fast storage (SSD)
2. **Increase `save_interval`** to reduce save frequency
3. **Use `DoNotPersistComp`** for temporary entities (projectiles, particles)
4. **Batch metadata updates** before save ticks

## Troubleshooting

### Entities Not Saving

- Check that `saving` is `true`
- Verify `save_entities` is `true`
- Ensure entities don't have `DoNotPersistComp`
- Check that `save_dir` is writable

### Chunks Not Saving

- Verify `saving` is `true`
- Check that chunks have been modified
- Ensure `save_dir` is writable
- Check `max_saves_per_tick` isn't too low

### Save Directory Issues

```rust
// Ensure directory exists and is writable
let save_dir = "./worlds/my-world";
std::fs::create_dir_all(save_dir).expect("Failed to create save directory");
```

### Loading Issues

- Verify entity loaders are registered for all saved entity types
- Check that metadata format matches what loaders expect
- Ensure `MetadataComp` contains required fields

## Example: Complete Saving Setup

```rust
use voxelize::{World, WorldConfig};

fn main() {
    let config = WorldConfig::new()
        .saving(true)
        .save_dir("./worlds/my-world")
        .save_interval(300)  // Save every 15 seconds
        .save_entities(true)
        .max_saves_per_tick(4)  // Save 4 chunks per tick
        .build();

    let mut world = World::new(config);

    // Register entity loader
    world.set_entity_loader("mob", |world, metadata| {
        let health = metadata.get("health")
            .and_then(|v| v.as_u64())
            .unwrap_or(100) as f32;
        
        // Create entity with saved state
        world
            .create_entity(&nanoid!(), "mob")
            .with(MetadataComp::from(metadata.clone()))
            .build()
    });

    // Entities and chunks will now be saved automatically
}
```

## Summary

Voxelize's persistence system provides:

- ✅ Automatic chunk saving
- ✅ Entity persistence with metadata
- ✅ Configurable save intervals
- ✅ Rate-limited saving to prevent lag
- ✅ Easy entity loading
- ✅ Extensible with custom save hooks

Configure `saving`, `save_dir`, and `save_interval` to enable automatic world persistence!
