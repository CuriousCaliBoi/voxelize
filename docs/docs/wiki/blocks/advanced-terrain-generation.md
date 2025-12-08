---
sidebar_position: 5
---

# Advanced Terrain Generation Guide

Voxelize's terrain system uses layered noise with biome support, height bias/offset splines, and KdTree-based biome selection. This guide covers advanced terrain generation techniques.

## Overview

The terrain system consists of:

- **TerrainLayer** - Noise layers with height bias and offset splines
- **Biomes** - Regions defined by noise values using KdTree
- **Noise Options** - Configurable frequency, octaves, persistence, etc.

## TerrainLayer Basics

A `TerrainLayer` combines noise generation with spline-based height control:

```rust title="Basic TerrainLayer"
use voxelize::{TerrainLayer, NoiseOptions};

let noise_options = NoiseOptions {
    dimension: 2,                    // 2D or 3D noise
    frequency: std::f64::consts::PI * 2.0 / 3.0,
    octaves: 6,
    persistence: 1.0,
    lacunarity: 1.0,
    ridged: false,
    ..Default::default()
};

let mut layer = TerrainLayer::new("base_terrain", &noise_options);
```

## Height Bias Splines

Height bias controls terrain compression as Y-coordinate increases. Higher bias = more compressed terrain at higher elevations.

```rust title="Height Bias Configuration"
layer = layer
    .add_bias_point([-1.0, 0.0])    // At noise -1.0, bias is 0.0 (no compression)
    .add_bias_point([0.0, 0.5])     // At noise 0.0, bias is 0.5 (moderate compression)
    .add_bias_point([1.0, 1.0]);    // At noise 1.0, bias is 1.0 (maximum compression)
```

**How it works:**
- Bias values are interpolated between points
- Higher bias = terrain gets "squished" vertically
- Useful for creating mountains that taper at the top

## Height Offset Splines

Height offset shifts terrain up or down based on noise values:

```rust title="Height Offset Configuration"
layer = layer
    .add_offset_point([-1.0, -0.3])  // Low noise = lower terrain
    .add_offset_point([0.0, 0.0])    // Medium noise = neutral
    .add_offset_point([1.0, 0.5]);   // High noise = raised terrain
```

**How it works:**
- Offset values shift the base height
- Positive offset = terrain raised
- Negative offset = terrain lowered
- Combined with bias for complex terrain shapes

## Multi-Layer Terrain

Combine multiple layers with weights:

```rust title="Multi-Layer Terrain"
use voxelize::Terrain;

let mut terrain = Terrain::new(&config);

// Base terrain layer
let mut base_layer = TerrainLayer::new("base", &NoiseOptions {
    frequency: 0.01,
    octaves: 4,
    ..Default::default()
});
base_layer = base_layer
    .add_bias_point([-1.0, 0.0])
    .add_bias_point([1.0, 0.3])
    .add_offset_point([-1.0, -0.2])
    .add_offset_point([1.0, 0.2]);

terrain.add_layer(&base_layer, 1.0);  // Weight: 1.0

// Mountain detail layer
let mut mountain_layer = TerrainLayer::new("mountains", &NoiseOptions {
    frequency: 0.05,
    octaves: 8,
    ridged: true,                    // Ridged noise for sharp peaks
    ..Default::default()
});
mountain_layer = mountain_layer
    .add_bias_point([-1.0, 0.0])
    .add_bias_point([1.0, 0.8])      // High bias for mountain peaks
    .add_offset_point([-1.0, 0.0])
    .add_offset_point([1.0, 0.6]);   // High offset for mountains

terrain.add_layer(&mountain_layer, 0.5);  // Weight: 0.5 (less influence)
```

**Layer Weights:**
- Higher weight = more influence on final terrain
- Weights are normalized automatically
- Use multiple layers for complex, varied terrain

## Noise Layer Configuration

Noise layers add detail without affecting height bias/offset:

```rust title="Noise Layers"
let mut detail_layer = TerrainLayer::new("detail", &NoiseOptions {
    frequency: 0.1,
    octaves: 3,
    ..Default::default()
});

terrain.add_noise_layer(&detail_layer, 0.2);  // Adds fine detail
```

**Use cases:**
- Fine surface detail
- Cave systems (3D noise)
- Erosion patterns
- Small-scale variations

## Noise Options Explained

### Frequency

Controls how "stretched" noise appears:

```rust title="Frequency Examples"
NoiseOptions {
    frequency: 0.01,  // Very low = large-scale features (continents)
    // ...
}

NoiseOptions {
    frequency: 0.1,   // Medium = regional features (hills)
    // ...
}

NoiseOptions {
    frequency: 1.0,   // High = small-scale features (rocks)
    // ...
}
```

### Octaves

Number of noise samples. More octaves = more detail but slower:

```rust title="Octave Configuration"
NoiseOptions {
    octaves: 3,   // Low detail, fast
    // ...
}

NoiseOptions {
    octaves: 6,   // Balanced (default)
    // ...
}

NoiseOptions {
    octaves: 10,  // High detail, slow
    // ...
}
```

### Persistence

How much each octave contributes:

```rust title="Persistence"
NoiseOptions {
    persistence: 0.5,  // Each octave contributes 50% of previous
    // ...
}

NoiseOptions {
    persistence: 1.0,  // Each octave contributes fully (default)
    // ...
}
```

### Lacunarity

Distance between octave samples:

```rust title="Lacunarity"
NoiseOptions {
    lacunarity: 2.0,  // Each octave samples 2x further apart
    // ...
}
```

### Ridged Noise

Creates sharp, ridged features (mountains, canyons):

```rust title="Ridged Noise"
NoiseOptions {
    ridged: true,
    attenuation: 2.0,  // How sharp the ridges are
    // ...
}
```

## Biome System

Biomes are defined by noise value combinations using KdTree:

```rust title="Biome Configuration"
use voxelize::{Biome, Terrain};

let mut terrain = Terrain::new(&config);

// Add terrain layers first
terrain.add_layer(&base_layer, 1.0);
terrain.add_layer(&mountain_layer, 0.5);

// Define biomes based on noise values
// Each biome point is [layer1_noise, layer2_noise, ...]
terrain.add_biome(&[0.0, 0.0], Biome::new("plains", "grass_block"));
terrain.add_biome(&[0.5, 0.0], Biome::new("hills", "stone"));
terrain.add_biome(&[1.0, 0.8], Biome::new("mountains", "snow_block"));
terrain.add_biome(&[-0.5, 0.0], Biome::new("ocean", "water"));
```

**How it works:**
1. Terrain samples noise from all layers at a position
2. Noise values are weighted by layer weights
3. KdTree finds nearest biome point
4. Returns that biome's test block

**Biome Points:**
- Points are in noise value space (typically -1.0 to 1.0)
- More layers = more dimensions in biome space
- KdTree efficiently finds nearest biome

## Complete Terrain Example

```rust title="Complete Terrain Setup"
use voxelize::{Terrain, TerrainLayer, NoiseOptions, Biome, WorldConfig};

fn create_terrain(config: &WorldConfig) -> Terrain {
    let mut terrain = Terrain::new(config);
    
    // Base terrain - large scale
    let mut base = TerrainLayer::new("base", &NoiseOptions {
        dimension: 2,
        frequency: 0.008,
        octaves: 5,
        persistence: 0.7,
        ..Default::default()
    });
    base = base
        .add_bias_point([-1.0, 0.0])
        .add_bias_point([0.0, 0.2])
        .add_bias_point([1.0, 0.4])
        .add_offset_point([-1.0, -0.4])  // Ocean basins
        .add_offset_point([0.0, 0.0])
        .add_offset_point([1.0, 0.3]);   // Raised land
    
    terrain.add_layer(&base, 1.0);
    
    // Mountain layer - ridged noise
    let mut mountains = TerrainLayer::new("mountains", &NoiseOptions {
        dimension: 2,
        frequency: 0.03,
        octaves: 7,
        persistence: 0.8,
        ridged: true,
        attenuation: 2.5,
        ..Default::default()
    });
    mountains = mountains
        .add_bias_point([-1.0, 0.0])
        .add_bias_point([1.0, 0.9])      // High bias for peaks
        .add_offset_point([-1.0, 0.0])
        .add_offset_point([1.0, 0.7]);   // High mountains
    
    terrain.add_layer(&mountains, 0.6);
    
    // Detail layer - fine surface variation
    let mut detail = TerrainLayer::new("detail", &NoiseOptions {
        dimension: 2,
        frequency: 0.1,
        octaves: 3,
        persistence: 0.5,
        ..Default::default()
    });
    
    terrain.add_noise_layer(&detail, 0.15);
    
    // Define biomes
    terrain
        .add_biome(&[0.0, 0.0], Biome::new("plains", "grass_block"))
        .add_biome(&[0.3, 0.0], Biome::new("hills", "stone"))
        .add_biome(&[0.7, 0.5], Biome::new("mountains", "snow_block"))
        .add_biome(&[-0.5, 0.0], Biome::new("ocean", "water"))
        .add_biome(&[-0.3, 0.0], Biome::new("beach", "sand"));
    
    terrain
}
```

## Terrain Density Calculation

The terrain system calculates density using bias and offset:

```rust title="Density Formula"
// Pseudocode
let (bias, offset) = terrain.get_bias_offset(vx, vy, vz);
let density = terrain.get_density_from_bias_offset(bias, offset, vy);

// Density determines if a voxel is solid or air
if density > 0.0 {
    // Solid block
} else {
    // Air
}
```

**Understanding density:**
- Positive density = solid voxel
- Negative density = air
- Bias compresses terrain vertically
- Offset shifts terrain up/down

## Advanced Techniques

### Cave Generation

Use 3D noise layers for caves:

```rust title="Cave Layer"
let mut cave_layer = TerrainLayer::new("caves", &NoiseOptions {
    dimension: 3,        // 3D noise for caves
    frequency: 0.05,
    octaves: 4,
    ..Default::default()
});

terrain.add_noise_layer(&cave_layer, 0.3);
```

### Erosion Simulation

Simulate erosion with multiple detail layers:

```rust title="Erosion Layers"
// Primary erosion
let mut erosion1 = TerrainLayer::new("erosion1", &NoiseOptions {
    frequency: 0.02,
    octaves: 5,
    ..Default::default()
});

// Secondary erosion (smaller scale)
let mut erosion2 = TerrainLayer::new("erosion2", &NoiseOptions {
    frequency: 0.08,
    octaves: 3,
    ..Default::default()
});

terrain.add_noise_layer(&erosion1, 0.2);
terrain.add_noise_layer(&erosion2, 0.1);
```

### Layered Materials

Use biome system for material layers:

```rust title="Material Layers"
// Surface biome (grass, sand, snow)
terrain.add_biome(&[0.0, 0.0], Biome::new("surface", "grass_block"));

// Underground biome (stone, ore)
terrain.add_biome(&[0.0, -0.5], Biome::new("underground", "stone"));
```

## Performance Considerations

### Layer Count

- More layers = more computation
- Recommended: 2-4 main layers + 1-2 noise layers
- Each layer samples noise independently

### Octave Count

- More octaves = more detail but slower
- Recommended: 4-6 octaves for main layers
- Use fewer octaves for detail layers

### 3D vs 2D Noise

- 2D noise: Faster, good for heightmaps
- 3D noise: Slower, needed for caves/3D features
- Use 2D when possible, 3D only when needed

## Troubleshooting

### Terrain Too Flat

- Increase offset values
- Add more layers with higher weights
- Increase frequency for more variation

### Terrain Too Extreme

- Reduce bias values
- Lower offset values
- Decrease layer weights

### Biomes Not Working

- Ensure layers are added before biomes
- Check biome point values match noise ranges
- Verify `test_block` exists in registry

### Performance Issues

- Reduce octave count
- Use fewer layers
- Prefer 2D noise over 3D
- Cache terrain calculations if possible

## Next Steps

- Learn about [Chunk Generation](../tutorials/basics/chunk-generation) for basic terrain
- Explore [Custom Blocks](./custom-block-rendering) for biome-specific blocks
- Check out [World Configuration](../tutorials/basics/world-configuration) for terrain settings
