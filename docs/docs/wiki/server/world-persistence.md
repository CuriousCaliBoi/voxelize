# World Persistence

Voxelize can save and restore world state including chunk data and entity metadata. Configure persistence through `WorldConfig`.

## Enabling Persistence

```rust title="Enable Saving"
let config = WorldConfig::new()
    .saving(true)
    .save_dir("./world_data")
    .save_interval(300)  // Save every 300 ticks
    .save_entities(true)
    .build();
```

| Option | Default | Description |
|--------|---------|-------------|
| `saving` | `false` | Master switch for persistence |
| `save_dir` | `""` | Directory for saved data |
| `save_interval` | `300` | Ticks between saves |
| `save_entities` | `true` | Whether to persist entities |

## What Gets Saved

### Chunks

Modified chunks save automatically. The data includes:

- Voxel IDs at each position
- Light levels (sunlight and torchlight)
- Voxel rotation states

Chunks are stored in `{save_dir}/chunks/` as binary files named by chunk coordinates.

### Entities

Entities with `MetadataComp` persist to `{save_dir}/entities/` as JSON:

```json title="Entity Save Format"
{
  "etype": "zombie",
  "metadata": {
    "position": [10.5, 80.0, 10.5],
    "direction": [1.0, 0.0, 0.0],
    "health": 100
  }
}
```

The filename format is `{etype}-{id}.json`.

### World Stats

Global stats like the current tick and time save to `{save_dir}/stats.json`.

## Entity Metadata

Add data to `MetadataComp` for persistence:

```rust title="Adding Metadata"
use voxelize::MetadataComp;

// When creating an entity
world
    .create_entity(&nanoid!(), "chest")
    .with(MetadataComp::new()
        .set("items", serde_json::json!([1, 2, 3]))
        .set("locked", false))
```

Update metadata later:

```rust title="Updating Metadata"
let entity = world.entity_by_id("entity-id").unwrap();
let mut metadatas = world.ecs().write_storage::<MetadataComp>();

if let Some(metadata) = metadatas.get_mut(entity) {
    metadata.set("health", 50);
}
```

## Preventing Entity Persistence

Some entities shouldn't save (temporary effects, spawned mobs that should reset):

```rust title="Non-Persistent Entity"
use voxelize::DoNotPersistComp;

world
    .create_entity(&nanoid!(), "particle_effect")
    .with(DoNotPersistComp)
    // other components...
```

The `DoNotPersistComp` is a marker component (null-storage) that tells `DataSavingSystem` to skip this entity.

## Loading Saved Entities

Entity loaders handle restoration. When the server starts, it reads `{save_dir}/entities/` and calls the matching loader:

```rust title="Entity Loader with Metadata"
world.set_entity_loader("chest", |world, metadata| {
    let position: [f32; 3] = metadata
        .get("position")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or([0.0, 80.0, 0.0]);

    let items: Vec<u32> = metadata
        .get("items")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let locked: bool = metadata
        .get("locked")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    world
        .create_entity(&nanoid!(), "chest")
        .with(PositionComp::new(position[0], position[1], position[2]))
        .with(MetadataComp::new()
            .set("items", serde_json::json!(items))
            .set("locked", locked))
});
```

## Block Entities

For entities attached to specific voxel positions (like signs or chests), use `VoxelComp`:

```rust title="Block Entity"
use voxelize::{VoxelComp, JsonComp};

world.set_entity_loader("block::sign", |world, metadata| {
    let voxel: [i32; 3] = metadata
        .get("voxel")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or([0, 0, 0]);

    let text: String = metadata
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    world
        .create_entity(&nanoid!(), "block::sign")
        .with(VoxelComp::new(voxel[0], voxel[1], voxel[2]))
        .with(JsonComp::new(serde_json::json!({ "text": text })))
});
```

Block entities use the `block::` prefix in their etype.

## Manual Save/Load

Trigger saves programmatically:

```rust title="Manual Save"
// In a method handler or system
world.save_all();
```

## Save Directory Structure

```
world_data/
├── chunks/
│   ├── 0_0.bin
│   ├── 0_1.bin
│   └── ...
├── entities/
│   ├── zombie-abc123.json
│   ├── chest-def456.json
│   └── block--sign-ghi789.json
└── stats.json
```

## Removing Saved Entities

When an entity is destroyed, its save file is removed:

```rust title="Removing Entity"
// This removes both the runtime entity and its save file
world.remove_entity("entity-id");
```

## Example: Complete Persistence Setup

```rust title="Full Server with Persistence"
use voxelize::{Server, Voxelize, World, WorldConfig, Registry};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let server = Server::new().port(4000).build();

    let mut registry = Registry::new();
    registry.register_block("Stone", &["stone.png"; 6]);
    registry.generate();

    let config = WorldConfig::new()
        .seed(42)
        .saving(true)
        .save_dir("./saves/main_world")
        .save_interval(600)    // Every 600 ticks (~10 seconds at 60 TPS)
        .save_entities(true)
        .build();

    let mut world = World::new("main", &config);
    world.set_registry(&registry);

    // Register entity loaders for restoration
    world.set_entity_loader("chest", |world, metadata| {
        // ... loader implementation
    });

    server.add_world(world).expect("Failed to add world");

    Voxelize::run(server).await
}
```

## Tips

1. **Set reasonable intervals** - Saving too frequently impacts performance. 300-600 ticks works well.

2. **Use `DoNotPersistComp`** - For temporary entities like particles or respawning mobs.

3. **Keep metadata small** - Only persist what's needed. Large metadata objects slow saves.

4. **Handle missing data** - Entity loaders should use sensible defaults when metadata fields are missing.

5. **Test restoration** - Restart your server during development to verify entities restore correctly.
