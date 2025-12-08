# Advanced Terrain Generation

Voxelize's terrain system uses noise-based height maps with spline graphs for fine-tuned control over terrain shape.

## Core Concepts

Terrain generation combines:

1. **Noise Functions** - Generate pseudo-random values based on position
2. **Terrain Layers** - Map noise to height bias and offset
3. **Biomes** - Select surface blocks based on noise values
4. **Density Sampling** - Determine solid vs. air at each voxel

## Basic Setup

```rust title="Simple Terrain"
use voxelize::{Terrain, TerrainLayer, NoiseOptions, Biome};

let terrain_noise = NoiseOptions::new()
    .frequency(0.005)
    .octaves(6)
    .persistence(0.5)
    .lacunarity(2.0)
    .seed(config.seed)
    .build();

let layer = TerrainLayer::new("continents", &terrain_noise)
    .add_bias_points(&[
        [-1.0, 0.5],   // Low noise → gentle slopes
        [0.0, 1.0],    // Mid noise → normal terrain
        [1.0, 2.0],    // High noise → steep mountains
    ])
    .add_offset_points(&[
        [-1.0, 0.25],  // Low noise → valleys
        [0.0, 0.4],    // Mid noise → normal height
        [1.0, 0.6],    // High noise → peaks
    ]);

let mut terrain = Terrain::new(&config);
terrain.add_layer(&layer, 1.0);
```

## Noise Options

Configure noise generation:

```rust title="Noise Configuration"
NoiseOptions::new()
    .frequency(0.01)      // Scale of features (lower = larger)
    .octaves(4)           // Detail layers (more = more detail)
    .persistence(0.5)     // Amplitude decay per octave
    .lacunarity(2.0)      // Frequency increase per octave
    .dimension(2)         // 2D (heightmap) or 3D (caves)
    .seed(12345)
    .build()
```

| Parameter | Effect | Typical Range |
|-----------|--------|---------------|
| `frequency` | Feature size | 0.001 - 0.05 |
| `octaves` | Detail levels | 2 - 8 |
| `persistence` | Roughness | 0.3 - 0.7 |
| `lacunarity` | Detail frequency | 1.5 - 3.0 |

## Terrain Layers

Layers control how noise translates to terrain shape.

### Height Bias

Controls terrain steepness. Higher bias = more compressed terrain at higher altitudes.

```rust title="Bias Spline"
// Flat terrain at low noise, mountains at high noise
.add_bias_points(&[
    [-1.0, 0.2],   // Flat (low bias)
    [0.0, 0.8],    // Normal
    [0.5, 1.5],    // Hills
    [1.0, 3.0],    // Steep mountains
])
```

### Height Offset

Controls base terrain height. Range 0.0 to 1.0 (fraction of max_height).

```rust title="Offset Spline"
// Low noise = ocean depth, high noise = mountain peaks
.add_offset_points(&[
    [-1.0, 0.15],  // Deep ocean
    [-0.3, 0.35],  // Shallow water
    [0.0, 0.4],    // Beach level
    [0.5, 0.55],   // Hills
    [1.0, 0.75],   // Mountain peaks
])
```

## Multi-Layer Terrain

Combine layers for complex terrain:

```rust title="Multi-Layer Setup"
// Large-scale continents
let continent_noise = NoiseOptions::new()
    .frequency(0.002)
    .octaves(4)
    .build();

let continent_layer = TerrainLayer::new("continents", &continent_noise)
    .add_bias_points(&[[-1.0, 0.5], [1.0, 1.5]])
    .add_offset_points(&[[-1.0, 0.2], [1.0, 0.6]]);

// Medium-scale hills
let hill_noise = NoiseOptions::new()
    .frequency(0.01)
    .octaves(5)
    .build();

let hill_layer = TerrainLayer::new("hills", &hill_noise)
    .add_bias_points(&[[-1.0, 0.8], [1.0, 1.2]])
    .add_offset_points(&[[-1.0, -0.1], [1.0, 0.15]]);

// Small-scale detail
let detail_noise = NoiseOptions::new()
    .frequency(0.05)
    .octaves(3)
    .build();

let detail_layer = TerrainLayer::new("detail", &detail_noise)
    .add_bias_points(&[[-1.0, 0.9], [1.0, 1.1]])
    .add_offset_points(&[[-1.0, -0.05], [1.0, 0.05]]);

let mut terrain = Terrain::new(&config);
terrain
    .add_layer(&continent_layer, 0.6)   // 60% weight
    .add_layer(&hill_layer, 0.3)        // 30% weight
    .add_layer(&detail_layer, 0.1);     // 10% weight
```

## Biomes

Biomes select surface blocks based on noise values:

```rust title="Biome Setup"
// Define biomes
let plains = Biome::new("plains", "Grass");
let desert = Biome::new("desert", "Sand");
let mountains = Biome::new("mountains", "Stone");
let ocean = Biome::new("ocean", "Water");

// Add biomes at noise coordinates
// Point coordinates match layer count
terrain
    .add_biome(&[-0.5], ocean)      // Low noise → ocean
    .add_biome(&[0.0], plains)      // Mid-low → plains
    .add_biome(&[0.3], desert)      // Mid-high → desert
    .add_biome(&[0.8], mountains);  // High → mountains
```

With multiple layers, biome points are multi-dimensional:

```rust title="Multi-Dimensional Biomes"
// Two layers: temperature and humidity
terrain
    .add_layer(&temperature_layer, 0.5)
    .add_layer(&humidity_layer, 0.5)
    .add_biome(&[-0.5, -0.5], tundra)     // Cold, dry
    .add_biome(&[-0.5, 0.5], taiga)       // Cold, wet
    .add_biome(&[0.5, -0.5], desert)      // Hot, dry
    .add_biome(&[0.5, 0.5], rainforest);  // Hot, wet
```

The biome system uses a KdTree for fast nearest-neighbor lookup.

## Using Terrain in Chunk Generation

```rust title="Chunk Stage with Terrain"
world.set_chunk_stage(
    "terrain",
    Box::new(move |chunk, config, registry, _| {
        let terrain = /* get terrain reference */;

        for vx in 0..config.chunk_size as i32 {
            for vz in 0..config.chunk_size as i32 {
                let wx = chunk.min_x + vx;
                let wz = chunk.min_z + vz;

                // Sample once per column for 2D noise
                let (bias, offset) = terrain.get_bias_offset(wx, 0, wz);

                for vy in 0..config.max_height as i32 {
                    let density = terrain.get_density_from_bias_offset(
                        bias,
                        offset,
                        vy
                    );

                    if density > 0.0 {
                        // Get biome for surface decoration
                        let biome = terrain.get_biome_at(wx, vy, wz);
                        let block_id = registry.get_block_id(&biome.test_block);
                        chunk.set_voxel(vx, vy, vz, block_id);
                    }
                }
            }
        }
    }),
);
```

## 3D Noise for Caves

Add 3D noise layers for cave systems:

```rust title="Cave Layer"
let cave_noise = NoiseOptions::new()
    .frequency(0.03)
    .octaves(4)
    .dimension(3)  // 3D noise
    .build();

let cave_layer = TerrainLayer::new("caves", &cave_noise)
    .add_bias_points(&[[-1.0, -0.5], [1.0, 0.5]])
    .add_offset_points(&[[-1.0, 0.0], [1.0, 0.0]]);

terrain.add_noise_layer(&cave_layer, 0.3);
```

Noise layers are added via `add_noise_layer` instead of `add_layer` and don't affect biome selection.

## Density Function

The density at a position is computed as:

```
density = -bias * (y - offset * max_height) / (offset * max_height)
```

Where:
- `bias` and `offset` are averaged across all layers weighted by their weights
- Positive density = solid block
- Negative density = air

## Example: Complete Terrain Setup

```rust title="Full Terrain Configuration"
use voxelize::{Terrain, TerrainLayer, NoiseOptions, Biome, WorldConfig};

fn create_terrain(config: &WorldConfig) -> Terrain {
    // Continent-scale features
    let continent_noise = NoiseOptions::new()
        .frequency(0.001)
        .octaves(5)
        .persistence(0.5)
        .build();

    let continents = TerrainLayer::new("continents", &continent_noise)
        .add_bias_points(&[
            [-1.0, 0.3],
            [-0.2, 0.6],
            [0.2, 1.0],
            [1.0, 2.5],
        ])
        .add_offset_points(&[
            [-1.0, 0.1],   // Deep ocean
            [-0.5, 0.3],   // Shallow ocean
            [-0.2, 0.38],  // Coast
            [0.0, 0.42],   // Plains
            [0.5, 0.55],   // Hills
            [1.0, 0.7],    // Mountains
        ]);

    // Regional variation
    let regional_noise = NoiseOptions::new()
        .frequency(0.008)
        .octaves(4)
        .build();

    let regional = TerrainLayer::new("regional", &regional_noise)
        .add_bias_points(&[[-1.0, 0.7], [1.0, 1.3]])
        .add_offset_points(&[[-1.0, -0.08], [1.0, 0.1]]);

    // Caves
    let cave_noise = NoiseOptions::new()
        .frequency(0.025)
        .octaves(3)
        .dimension(3)
        .build();

    let caves = TerrainLayer::new("caves", &cave_noise)
        .add_bias_points(&[[-1.0, -0.3], [1.0, 0.3]])
        .add_offset_points(&[[-1.0, 0.0], [1.0, 0.0]]);

    let mut terrain = Terrain::new(config);
    terrain
        .add_layer(&continents, 0.7)
        .add_layer(&regional, 0.3)
        .add_noise_layer(&caves, 0.2);

    // Biomes
    let ocean = Biome::new("ocean", "Water");
    let beach = Biome::new("beach", "Sand");
    let plains = Biome::new("plains", "Grass");
    let forest = Biome::new("forest", "Grass");
    let mountains = Biome::new("mountains", "Stone");

    terrain
        .add_biome(&[-0.6, 0.0], ocean)
        .add_biome(&[-0.2, 0.0], beach)
        .add_biome(&[0.1, -0.3], plains)
        .add_biome(&[0.1, 0.3], forest)
        .add_biome(&[0.7, 0.0], mountains);

    terrain
}
```

## Tips

1. **Start simple** - One layer first, add complexity gradually

2. **Visualize splines** - Graph your bias/offset points to understand the curves

3. **Test at extremes** - Check noise values at -1, 0, and 1 to verify behavior

4. **Balance weights** - Layer weights should sum to a reasonable total (1.0 is common)

5. **Profile generation** - Complex terrain is the slowest part of chunk generation
