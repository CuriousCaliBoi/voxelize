---
sidebar_position: 4
---

# Advanced Terrain Generation

Voxelize provides a powerful layered terrain generation system using noise functions, spline maps, and biome classification. This guide covers how to create complex, multi-layered terrain with custom biomes.

## Overview

The terrain system uses:

- **TerrainLayer** - Noise-based layers with height bias and offset splines
- **Biome System** - KdTree-based biome classification using layer values
- **Multi-layer Composition** - Combine multiple layers with weights
- **Noise Layers** - Additional noise for detail and variation

## TerrainLayer

A `TerrainLayer` consists of:

- **Noise Configuration** - Controls noise generation (scale, octaves, etc.)
- **Height Bias Spline** - Controls terrain compression at different heights
- **Height Offset Spline** - Controls vertical shifting of terrain

### Creating a TerrainLayer

```rust
use voxelize::generators::{TerrainLayer, NoiseOptions};

// Create noise options
let noise_options = NoiseOptions {
    scale: 0.01,        // Noise scale (smaller = larger features)
    octaves: 4,         // Number of noise octaves
    persistence: 0.5,   // How much each octave contributes
    lacunarity: 2.0,    // Frequency multiplier between octaves
    dimension: 2,       // 2D (x,z) or 3D (x,y,z) noise
    ..Default::default()
};

// Create terrain layer
let layer = TerrainLayer::new("mountains", &noise_options)
    .add_bias_points(&[
        [-1.0, 0.0],   // At noise value -1.0, bias is 0.0 (no compression)
        [0.0, 0.3],    // At noise value 0.0, bias is 0.3 (some compression)
        [1.0, 1.0],    // At noise value 1.0, bias is 1.0 (full compression)
    ])
    .add_offset_points(&[
        [-1.0, -0.5],  // At noise value -1.0, offset is -0.5 (lower)
        [0.0, 0.0],    // At noise value 0.0, offset is 0.0 (neutral)
        [1.0, 0.5],    // At noise value 1.0, offset is 0.5 (higher)
    ]);
```

### Height Bias

Height bias controls how much terrain is "compressed" as the Y coordinate increases. Higher bias values create steeper terrain.

**Bias Values:**
- `0.0` - No compression, flat terrain
- `0.5` - Moderate compression, rolling hills
- `1.0` - Full compression, steep mountains

### Height Offset

Height offset shifts the entire terrain up or down based on noise values. This creates height variation across the world.

**Offset Values:**
- Negative values - Lower terrain (valleys, oceans)
- `0.0` - Neutral height
- Positive values - Higher terrain (hills, mountains)

### Noise Options

```rust
pub struct NoiseOptions {
    pub scale: f64,           // Noise scale (0.001 - 0.1 typical)
    pub octaves: u32,         // Number of octaves (1-8 typical)
    pub persistence: f64,     // Octave contribution (0.0-1.0)
    pub lacunarity: f64,      // Frequency multiplier (1.5-3.0 typical)
    pub dimension: u32,       // 2 for 2D (x,z), 3 for 3D (x,y,z)
    pub seed: u32,            // Noise seed
}
```

**Scale:**
- Small values (0.001-0.01) - Large features (continents, mountain ranges)
- Medium values (0.01-0.05) - Medium features (hills, valleys)
- Large values (0.05-0.1) - Small features (rocks, bumps)

**Octaves:**
- More octaves = more detail but slower generation
- 3-6 octaves is typical for good detail/performance balance

**Dimension:**
- `2` - 2D noise (only uses x,z coordinates) - Faster, good for heightmaps
- `3` - 3D noise (uses x,y,z coordinates) - Slower, creates overhangs and caves

## Multi-Layer Terrain

Combine multiple layers with weights to create complex terrain:

```rust
use voxelize::generators::{Terrain, TerrainLayer, NoiseOptions};

let mut terrain = Terrain::new(&config);

// Base terrain layer (large features)
let base_layer = TerrainLayer::new("base", &NoiseOptions {
    scale: 0.005,
    octaves: 4,
    dimension: 2,
    ..Default::default()
})
.add_bias_points(&[[-1.0, 0.0], [0.0, 0.2], [1.0, 0.8]])
.add_offset_points(&[[-1.0, -0.3], [0.0, 0.0], [1.0, 0.3]]);

terrain.add_layer(&base_layer, 1.0);  // Weight: 1.0

// Mountain layer (steep peaks)
let mountain_layer = TerrainLayer::new("mountains", &NoiseOptions {
    scale: 0.01,
    octaves: 6,
    dimension: 2,
    ..Default::default()
})
.add_bias_points(&[[-1.0, 0.0], [0.0, 0.5], [1.0, 1.0]])
.add_offset_points(&[[-1.0, 0.0], [0.0, 0.2], [1.0, 0.6]]);

terrain.add_layer(&mountain_layer, 0.5);  // Weight: 0.5 (less influence)

// Detail layer (small variations)
let detail_layer = TerrainLayer::new("detail", &NoiseOptions {
    scale: 0.05,
    octaves: 3,
    dimension: 2,
    ..Default::default()
})
.add_bias_points(&[[-1.0, 0.0], [0.0, 0.1], [1.0, 0.2]])
.add_offset_points(&[[-1.0, -0.1], [0.0, 0.0], [1.0, 0.1]]);

terrain.add_layer(&detail_layer, 0.2);  // Weight: 0.2 (minor influence)
```

Layers are combined by:
1. Sampling each layer's noise value
2. Calculating bias and offset from splines
3. Weighted average of all layers
4. Final terrain height = average_bias * (y - average_offset * max_height)

## Noise Layers

Noise layers add additional variation without affecting biome classification:

```rust
// Add noise layer for caves/overhangs
let cave_layer = TerrainLayer::new("caves", &NoiseOptions {
    scale: 0.02,
    octaves: 3,
    dimension: 3,  // 3D for overhangs
    ..Default::default()
})
.add_bias_points(&[[-1.0, 0.0], [0.0, -0.3], [1.0, -0.6]])  // Negative bias creates caves
.add_offset_points(&[[-1.0, 0.0], [0.0, 0.0], [1.0, 0.0]]);

terrain.add_noise_layer(&cave_layer, 0.3);
```

Noise layers are added to the final density calculation but don't affect biome selection.

## Biome System

Biomes are classified using a KdTree that maps layer values to biome types.

### Adding Biomes

```rust
use voxelize::generators::Biome;

// Add biomes after all layers are added
terrain.add_biome(&[-1.0, -1.0], Biome::new("ocean", "water"));
terrain.add_biome(&[-0.5, -0.5], Biome::new("beach", "sand"));
terrain.add_biome(&[0.0, 0.0], Biome::new("plains", "grass"));
terrain.add_biome(&[0.5, 0.5], Biome::new("hills", "stone"));
terrain.add_biome(&[1.0, 1.0], Biome::new("mountains", "snow"));
```

The point array `[x, y]` corresponds to normalized noise values from each layer:
- First value = noise from first layer
- Second value = noise from second layer
- etc.

### Biome Selection

Biomes are selected using nearest-neighbor search in the KdTree:

```rust
// Get biome at a specific position
let biome = terrain.get_biome_at(vx, vy, vz);
println!("Biome: {}", biome.name);
println!("Test block: {}", biome.test_block);
```

The system finds the nearest biome point in the layer value space and returns that biome.

### Multi-Layer Biome Example

With 3 layers, biome points have 3 values:

```rust
// Layer 1: Base terrain (low = ocean, high = land)
// Layer 2: Temperature (low = cold, high = hot)
// Layer 3: Humidity (low = dry, high = wet)

terrain.add_biome(&[-1.0, 0.0, 0.0], Biome::new("ocean", "water"));
terrain.add_biome(&[0.0, -1.0, -1.0], Biome::new("tundra", "snow"));
terrain.add_biome(&[0.0, 1.0, -1.0], Biome::new("desert", "sand"));
terrain.add_biome(&[0.0, 0.0, 1.0], Biome::new("swamp", "mud"));
terrain.add_biome(&[1.0, 0.0, 0.0], Biome::new("mountains", "stone"));
```

## Complete Example

Here's a complete terrain generation setup:

```rust
use voxelize::{World, WorldConfig};
use voxelize::generators::{Terrain, TerrainLayer, Biome, NoiseOptions};

fn setup_terrain(config: &WorldConfig) -> Terrain {
    let mut terrain = Terrain::new(config);

    // Base terrain - large continental features
    let base = TerrainLayer::new("base", &NoiseOptions {
        scale: 0.003,
        octaves: 5,
        persistence: 0.5,
        lacunarity: 2.0,
        dimension: 2,
        ..Default::default()
    })
    .add_bias_points(&[
        [-1.0, 0.0],
        [-0.5, 0.1],
        [0.0, 0.3],
        [0.5, 0.6],
        [1.0, 0.9],
    ])
    .add_offset_points(&[
        [-1.0, -0.4],  // Deep ocean
        [-0.5, -0.2],  // Shallow ocean
        [0.0, 0.0],    // Sea level
        [0.5, 0.2],    // Lowlands
        [1.0, 0.5],    // Highlands
    ]);

    terrain.add_layer(&base, 1.0);

    // Mountain layer - steep peaks
    let mountains = TerrainLayer::new("mountains", &NoiseOptions {
        scale: 0.008,
        octaves: 6,
        persistence: 0.6,
        lacunarity: 2.2,
        dimension: 2,
        ..Default::default()
    })
    .add_bias_points(&[
        [-1.0, 0.0],
        [0.0, 0.4],
        [1.0, 1.0],
    ])
    .add_offset_points(&[
        [-1.0, 0.0],
        [0.0, 0.3],
        [1.0, 0.7],
    ]);

    terrain.add_layer(&mountains, 0.4);

    // Detail layer - small variations
    let detail = TerrainLayer::new("detail", &NoiseOptions {
        scale: 0.04,
        octaves: 3,
        persistence: 0.4,
        lacunarity: 2.0,
        dimension: 2,
        ..Default::default()
    })
    .add_bias_points(&[
        [-1.0, 0.0],
        [0.0, 0.05],
        [1.0, 0.15],
    ])
    .add_offset_points(&[
        [-1.0, -0.05],
        [0.0, 0.0],
        [1.0, 0.05],
    ]);

    terrain.add_layer(&detail, 0.15);

    // Add biomes
    terrain.add_biome(&[-1.0, -1.0, -1.0], Biome::new("deep_ocean", "water"));
    terrain.add_biome(&[-0.5, -0.5, -0.5], Biome::new("ocean", "water"));
    terrain.add_biome(&[0.0, 0.0, 0.0], Biome::new("plains", "grass"));
    terrain.add_biome(&[0.3, 0.5, 0.3], Biome::new("hills", "dirt"));
    terrain.add_biome(&[0.7, 0.7, 0.5], Biome::new("mountains", "stone"));
    terrain.add_biome(&[1.0, 1.0, 1.0], Biome::new("peaks", "snow"));

    terrain
}
```

## Tips and Best Practices

### Performance

- Use 2D noise (`dimension: 2`) when possible - it's much faster than 3D
- Limit octaves to 4-6 for good detail/performance balance
- Use fewer layers for better performance

### Terrain Quality

- Start with a base layer for large features
- Add detail layers with higher scale values
- Use negative bias values in noise layers to create caves
- Experiment with spline points to get desired terrain shapes

### Biome Design

- Place biome points at corners of your layer value space for clear boundaries
- Use intermediate points for smooth transitions
- Consider using 2-3 layers for biome classification (terrain, temperature, humidity)

### Common Patterns

**Island World:**
```rust
base_layer.add_bias_points(&[[-1.0, 0.0], [0.0, 0.5], [1.0, 1.0]])
          .add_offset_points(&[[-1.0, -0.5], [0.0, 0.0], [1.0, 0.3]]);
```

**Flat Plains:**
```rust
base_layer.add_bias_points(&[[-1.0, 0.0], [1.0, 0.1]])
          .add_offset_points(&[[-1.0, 0.0], [1.0, 0.0]]);
```

**Mountainous:**
```rust
base_layer.add_bias_points(&[[-1.0, 0.0], [0.0, 0.7], [1.0, 1.0]])
          .add_offset_points(&[[-1.0, -0.2], [0.0, 0.2], [1.0, 0.6]]);
```

## Summary

The terrain generation system provides:

- ✅ Layered noise-based terrain
- ✅ Spline-based height control
- ✅ Multi-layer composition with weights
- ✅ KdTree-based biome classification
- ✅ Flexible noise configuration
- ✅ Support for 2D and 3D noise

Experiment with different layer combinations, spline curves, and biome placements to create unique worlds!
