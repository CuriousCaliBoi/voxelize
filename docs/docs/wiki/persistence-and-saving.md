---
sidebar_position: 5
---

# World Persistence and Saving

Voxelize can persist worlds to disk—including chunks, stats, and entities—so servers can be stopped and restarted without losing progress.

This guide explains how world saving works, how to configure it via `WorldConfig`, and how entity persistence integrates with `MetadataComp`.

## WorldConfig Saving Options

Saving behavior is controlled by a few `WorldConfig` fields:

```rust title="Enabling World Saving"
use voxelize::WorldConfig;

let config = WorldConfig::new()
    .saving(true)                 // Turn on saving
    .save_dir("worlds/my-world")  // Directory for chunks, entities, stats
    .save_interval(1000)          // How often to save entities & stats (ticks)
    .max_saves_per_tick(4)        // How many chunks can be written per tick
    .save_entities(true)          // Whether non-client entities are persisted
    .build();
```

Relevant fields:

- **`saving: bool`**
  - Global on/off switch for all persistence (chunks, entities, stats).
  - If `false`, nothing is written to disk even if other options are set.
- **`save_dir: String`**
  - Base directory for all saved files.
  - Must be non-empty when `saving(true)`; otherwise `WorldConfig::build()` will panic.
  - On Windows, forward slashes are normalized to `\`.
- **`save_interval: usize`**
  - How often (in ticks) the entity + stats saving pass runs.
  - If `save_interval = 1000` and the world ticks at ~60 FPS, entities/stats are saved about every 16–17 seconds.
- **`max_saves_per_tick: usize`**
  - Upper bound on how many chunks can be flushed to disk in a single tick.
  - Helps avoid frame spikes when many chunks are dirty.
- **`save_entities: bool`**
  - Whether entities are persisted to disk.
  - Only effective if `saving` is also `true`.

When a `World` is constructed, it ensures the `save_dir` exists and initializes supporting resources:

- `Chunks::new(config)` – chunk storage with a queue of chunks to save
- `EntitiesSaver::new(config)` – handles writing entity metadata
- `Stats::new(config.saving, &config.save_dir, config.default_time)` – loads/saves tick/time info

## Chunk Saving Behavior

Chunk saving is handled by `ChunkSavingSystem` and the `Chunks` resource.

### Save Queue

`Chunks` maintains a queue of chunk coordinates to be saved:

```rust title="Chunk Save Queue (Simplified)"
pub(crate) to_save: VecDeque<Vec2<i32>>;

pub fn add_chunk_to_save(&mut self, coords: &Vec2<i32>, prioritized: bool) {
    if !self.to_save.contains(coords) {
        if prioritized {
            self.to_save.push_front(coords.to_owned());
        } else {
            self.to_save.push_back(coords.to_owned());
        }
    }
}
```

Chunks are added to this queue whenever they become dirty or are generated:

- `ChunkUpdatingSystem` – after block updates and lighting changes:

```rust title="Marking Chunks Dirty After Updates"
// server/world/systems/chunk/updating.rs
if !chunks.cache.is_empty() {
    let cache = chunks.cache.drain().collect::<Vec<Vec2<i32>>>();

    cache.iter().for_each(|coords| {
        chunks.add_chunk_to_save(coords, true); // prioritized
    });

    // ... re-mesh updated chunks ...
}
```

- `ChunkGeneratingSystem` – after new chunks are generated:

```rust title="Saving Newly Generated Chunks"
// server/world/systems/chunk/generating.rs
chunks.add_chunk_to_save(&coords, false); // background priority
```

### ChunkSavingSystem

Each tick, `ChunkSavingSystem` drains part of the save queue:

```rust title="ChunkSavingSystem Behavior"
pub struct ChunkSavingSystem;

impl<'a> System<'a> for ChunkSavingSystem {
    type SystemData = (ReadExpect<'a, WorldConfig>, WriteExpect<'a, Chunks>);

    fn run(&mut self, (config, mut chunks): Self::SystemData) {
        if !config.saving {
            return;
        }

        let mut count = 0;

        while !chunks.to_save.is_empty() && count < config.max_saves_per_tick {
            count += 1;

            if let Some(coords) = chunks.to_save.pop_front() {
                if !chunks.save(&coords) {
                    // Requeue if saving failed
                    chunks.add_chunk_to_save(&coords, false);
                }
            }
        }
    }
}
```

Key points:

- If `config.saving` is `false`, no chunk I/O occurs.
- The system respects `max_saves_per_tick` to spread out disk writes.
- Failed saves are re-queued to avoid permanent data loss.

### What Gets Saved

Chunks are persisted under `save_dir` (implementation details may change across versions), but conceptually:

- **Voxel data** – block IDs per voxel
- **Lighting** – baked light data per voxel
- **Chunk metadata** – status flags, height maps, etc.

Chunks are reloaded automatically as clients request them; no manual chunk loading is required for most games.

## Entity Persistence with MetadataComp

Entity saving is handled by `DataSavingSystem` and `EntitiesSaver`.

### DataSavingSystem

This system runs periodically based on `save_interval`:

```rust title="DataSavingSystem Overview"
pub struct DataSavingSystem;

impl<'a> System<'a> for DataSavingSystem {
    type SystemData = (
        ReadExpect<'a, Stats>,
        ReadExpect<'a, WorldConfig>,
        ReadExpect<'a, EntitiesSaver>,
        ReadStorage<'a, IDComp>,
        ReadStorage<'a, ETypeComp>,
        ReadStorage<'a, DoNotPersistComp>,
        WriteStorage<'a, MetadataComp>,
    );

    fn run(&mut self, data: Self::SystemData) {
        let (stats, config, entities_saver, ids, etypes, do_not_persist, mut metadatas) = data;

        if !config.saving {
            return;
        }

        // Only run on configured intervals
        if stats.tick % config.save_interval as u64 != 0 {
            return;
        }

        if config.save_entities {
            let entities_saver = Arc::new(entities_saver);

            (&ids, &etypes, !&do_not_persist, &mut metadatas)
                .par_join()
                .for_each(|(id, etype, _, metadata)| {
                    entities_saver.save(&id.0, &etype.0, etype.1, &metadata);
                });
        }

        stats.save();
    }
}
```

Entities are saved when **all** of the following are true:

- `WorldConfig.saving == true`
- `WorldConfig.save_entities == true`
- The current tick is a multiple of `save_interval`
- The entity:
  - Has `IDComp`
  - Has `ETypeComp`
  - Does **not** have `DoNotPersistComp`

Stats (tick/time) are written to `stats.json` in the same directory.

### EntitiesSaver and File Layout

`EntitiesSaver` manages the entity files under `save_dir/entities`:

```rust title="EntitiesSaver Overview"
#[derive(Clone)]
pub struct EntitiesSaver {
    pub folder: PathBuf,
    pub saving: bool,
}

impl EntitiesSaver {
    pub fn new(config: &WorldConfig) -> Self {
        let mut folder = PathBuf::from(&config.save_dir);
        folder.push("entities");

        if config.saving && config.save_entities {
            fs::create_dir_all(&folder)
                .expect("Unable to create entities directory...");
        }

        Self {
            saving: config.saving && config.save_entities,
            folder,
        }
    }

    pub fn save(&self, id: &str, etype: &str, is_block: bool, metadata: &MetadataComp) {
        if !self.saving {
            return;
        }

        let mut map = HashMap::new();
        let etype_value = if is_block {
            format!(
                "block::{}",
                etype.to_lowercase().trim_start_matches("block::")
            )
        } else {
            etype.to_lowercase()
        };

        map.insert("etype".to_owned(), json!(etype_value));
        map.insert("metadata".to_owned(), json!(metadata));

        // Filenames look like "<etype>-<id>.json"
        let sanitized_filename = etype_value
            .replace("::", "-")
            .replace(' ', "-");
        let new_filename = format!("{}-{}.json", sanitized_filename, id);

        // Backwards-compatible fallback: "<id>.json"
        // ...
    }
}
```

Entity files are JSON objects with at least:

- `etype` – the entity type (e.g. `"enemy"`, `"block::chest"`)
- `metadata` – serialized `MetadataComp`

Block entities are treated specially:

- `etype` is normalized to `block::<name>`
- On load, block entities are restored into `chunks.block_entities` and keyed by voxel position

### Controlling Which Entities Persist

Use `DoNotPersistComp` to exclude entities from persistence:

```rust title="Non-Persisted Entities"
use voxelize::DoNotPersistComp;

world.set_entity_loader("temporary-effect", |world, _| {
    world
        .create_entity(&nanoid!(), "temporary-effect")
        .with(PositionComp::default())
        .with(DoNotPersistComp) // Never saved to disk
        // ...
});
```

Typical patterns:

- **Persisted**:
  - Mobs/NPCs you want to re-appear after restart
  - Block entities (chests, signs, machines)
  - Long-lived projectiles or structures
- **Non-persisted**:
  - Short-lived visual effects
  - Temporary debug entities
  - Entities that can be reconstructed from other data

### Entity Revival on World Load

When a world is prepared (`world.prepare()`), saved entities are automatically revived:

```rust title="Entity Loading Flow (Simplified)"
fn load_entities(&mut self) {
    if self.config().saving {
        let paths = fs::read_dir(self.read_resource::<EntitiesSaver>().folder.clone()).unwrap();
        let mut loaded_entities = HashMap::new();

        for path in paths {
            // Read JSON file
            // Extract "etype" and "metadata"
            // Call self.revive_entity(&id, &etype, metadata)
        }

        // Bookkeeping keeps a list of loaded entities
    }
}
```

`World::revive_entity` works differently for block vs non-block entities:

- **Block entities (`etype` starts with `"block::"`)**:
  - Extract `VoxelComp` from metadata to find the voxel position.
  - Create an entity with `create_block_entity(...)`.
  - Register it in `chunks.block_entities`.
- **Regular entities**:
  - Look up the entity loader by `etype`.
  - Call the loader with the `MetadataComp` so you can rebuild components from metadata.
  - Attach standard components (`IDComp`, `ETypeComp`, `MetadataComp`, `CollisionsComp`, etc.).

If revival fails (e.g. loader panicked or entity type no longer exists), the entity file is removed to avoid repeated errors.

## Designing Metadata for Persistence

`MetadataComp` is your main hook for custom entity persistence:

- Anything you put into `MetadataComp` will be serialized to JSON and written to disk.
- On load, your entity loader receives the same `MetadataComp` back.

Example: storing health and custom state:

```rust title="Storing Custom Persistent Data"
#[derive(Serialize, Deserialize, Default)]
pub struct EnemySaveData {
    pub health: i32,
    pub last_seen_player: Option<String>,
}

world.set_entity_loader("enemy", |world, metadata| {
    let save: EnemySaveData = metadata
        .get("save")
        .unwrap_or(EnemySaveData::default());

    let body = /* ... create RigidBody ... */;

    world
        .create_entity(&nanoid!(), "enemy")
        // ...
        .with(MetadataComp::default().with("save", &save))
        // add components based on `save`
});
```

In your gameplay systems, update the same `save` key on `MetadataComp` so it is written back out during `DataSavingSystem`.

## Custom Save/Load Hooks

Voxelize exposes several extension points if you need more control over persistence:

- **Custom systems before saving**
  - Insert your own system **before** `DataSavingSystem` in the dispatcher to:
    - Copy transient component data into `MetadataComp`
    - Compact or sanitize metadata before it hits disk
- **Custom save triggers**
  - Expose a method to force a save:

```rust title="Manual Save Method"
world.set_method_handle("save-world", |world, _client_id, _payload| {
    // Save stats immediately
    world.stats().save();

    // Optionally bump tick so DataSavingSystem runs soon,
    // or customize the dispatcher to run your own save pass here.
});
```

- **Custom loading**
  - In addition to built-in `load_entities`, you can:
    - Call `revive_entity` yourself for external save formats.
    - Spawn entities with `spawn_entity_with_metadata` using data loaded from your own files or databases.

For most games, the default behavior (configured via `WorldConfig`) is enough—chunks, entities, and stats are all persisted automatically. Custom hooks are mainly useful for migrating old saves, integrating with external storage, or implementing specialized save slots.

