import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  Points,
  PointsMaterial,
  Texture,
  Vector3,
} from "three";

/**
 * Configuration for a single particle.
 */
export type ParticleConfig = {
  /** Initial position */
  position: Vector3;
  /** Initial velocity */
  velocity: Vector3;
  /** Particle lifetime in seconds */
  lifetime: number;
  /** Particle size */
  size: number;
  /** Particle color */
  color: Color;
  /** Gravity multiplier (1.0 = normal gravity) */
  gravity?: number;
  /** Air resistance (0 = none, 1 = full) */
  drag?: number;
  /** Size decay per second */
  sizeDecay?: number;
  /** Color to fade to over lifetime */
  fadeColor?: Color;
};

/**
 * Configuration for the particle system.
 */
export type ParticleSystemOptions = {
  /** Maximum number of particles */
  maxParticles?: number;
  /** World gravity vector */
  gravity?: Vector3;
  /** Optional sprite texture for particles */
  texture?: Texture;
  /** Use additive blending for glow effects */
  additiveBlending?: boolean;
  /** Particle size attenuation with distance */
  sizeAttenuation?: boolean;
  /** Enable depth write */
  depthWrite?: boolean;
  /** Transparency enabled */
  transparent?: boolean;
};

/**
 * Configuration for emitter presets.
 */
export type EmitterPreset =
  | "blockBreak"
  | "blockPlace"
  | "explosion"
  | "dust"
  | "smoke"
  | "sparkle";

interface Particle {
  position: Vector3;
  velocity: Vector3;
  color: Color;
  fadeColor: Color | null;
  size: number;
  sizeDecay: number;
  gravity: number;
  drag: number;
  lifetime: number;
  age: number;
  active: boolean;
}

/**
 * A GPU-instanced particle system for visual effects like block breaking, explosions, and ambient particles.
 *
 * # Example
 * ```ts
 * // Create particle system
 * const particles = new VOXELIZE.Particles({ maxParticles: 10000 });
 * world.add(particles);
 *
 * // Emit block break particles
 * particles.emitPreset("blockBreak", new THREE.Vector3(10, 5, 10), {
 *   color: new THREE.Color("#8B4513"),  // Brown for dirt
 * });
 *
 * // Custom particle emission
 * particles.emit({
 *   position: new THREE.Vector3(0, 10, 0),
 *   velocity: new THREE.Vector3(Math.random() - 0.5, 2, Math.random() - 0.5),
 *   lifetime: 2.0,
 *   size: 0.1,
 *   color: new THREE.Color("#ff0000"),
 *   gravity: 1.0,
 *   drag: 0.1,
 * });
 *
 * // Update in render loop
 * function animate() {
 *   particles.update(delta);  // delta in seconds
 *   requestAnimationFrame(animate);
 * }
 * ```
 *
 * @category Effects
 */
export class Particles extends Group {
  /**
   * Particle system options.
   */
  public options: Required<ParticleSystemOptions>;

  /**
   * Internal particle pool.
   */
  private particles: Particle[] = [];

  /**
   * Active particle count.
   */
  private activeCount = 0;

  /**
   * The points mesh for rendering.
   */
  private points: Points;

  /**
   * Buffer geometry for particle positions.
   */
  private geometry: BufferGeometry;

  /**
   * Position attribute buffer.
   */
  private positionAttribute: BufferAttribute;

  /**
   * Color attribute buffer.
   */
  private colorAttribute: BufferAttribute;

  /**
   * Size attribute buffer.
   */
  private sizeAttribute: BufferAttribute;

  /**
   * Create a new particle system.
   *
   * @param options Configuration options for the particle system.
   */
  constructor(options: ParticleSystemOptions = {}) {
    super();

    this.options = {
      maxParticles: options.maxParticles ?? 10000,
      gravity: options.gravity ?? new Vector3(0, -9.8, 0),
      texture: options.texture ?? null,
      additiveBlending: options.additiveBlending ?? false,
      sizeAttenuation: options.sizeAttenuation ?? true,
      depthWrite: options.depthWrite ?? false,
      transparent: options.transparent ?? true,
    };

    // Initialize particle pool
    for (let i = 0; i < this.options.maxParticles; i++) {
      this.particles.push({
        position: new Vector3(),
        velocity: new Vector3(),
        color: new Color(),
        fadeColor: null,
        size: 1,
        sizeDecay: 0,
        gravity: 1,
        drag: 0,
        lifetime: 1,
        age: 0,
        active: false,
      });
    }

    // Create geometry with dynamic buffers
    this.geometry = new BufferGeometry();

    const positions = new Float32Array(this.options.maxParticles * 3);
    const colors = new Float32Array(this.options.maxParticles * 3);
    const sizes = new Float32Array(this.options.maxParticles);

    this.positionAttribute = new BufferAttribute(positions, 3);
    this.positionAttribute.setUsage(DynamicDrawUsage);

    this.colorAttribute = new BufferAttribute(colors, 3);
    this.colorAttribute.setUsage(DynamicDrawUsage);

    this.sizeAttribute = new BufferAttribute(sizes, 1);
    this.sizeAttribute.setUsage(DynamicDrawUsage);

    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    this.geometry.setAttribute("size", this.sizeAttribute);

    // Create material
    const material = new PointsMaterial({
      size: 1,
      vertexColors: true,
      transparent: this.options.transparent,
      depthWrite: this.options.depthWrite,
      sizeAttenuation: this.options.sizeAttenuation,
      blending: this.options.additiveBlending
        ? AdditiveBlending
        : undefined,
    });

    if (this.options.texture) {
      material.map = this.options.texture;
      material.alphaTest = 0.1;
    }

    // Create points mesh
    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.add(this.points);

    // Initialize draw range
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Emit a single particle.
   *
   * @param config Particle configuration.
   * @returns Whether the particle was emitted (false if pool is full).
   */
  emit = (config: ParticleConfig): boolean => {
    // Find inactive particle
    const particle = this.particles.find((p) => !p.active);
    if (!particle) return false;

    particle.position.copy(config.position);
    particle.velocity.copy(config.velocity);
    particle.color.copy(config.color);
    particle.fadeColor = config.fadeColor ?? null;
    particle.size = config.size;
    particle.sizeDecay = config.sizeDecay ?? 0;
    particle.gravity = config.gravity ?? 1;
    particle.drag = config.drag ?? 0;
    particle.lifetime = config.lifetime;
    particle.age = 0;
    particle.active = true;

    this.activeCount++;
    return true;
  };

  /**
   * Emit multiple particles with a preset configuration.
   *
   * @param preset The preset type.
   * @param position Center position for emission.
   * @param overrides Optional overrides for the preset.
   */
  emitPreset = (
    preset: EmitterPreset,
    position: Vector3,
    overrides: Partial<ParticleConfig> = {}
  ): void => {
    const configs = this.getPresetConfigs(preset, position, overrides);
    for (const config of configs) {
      this.emit(config);
    }
  };

  /**
   * Emit particles in a burst pattern.
   *
   * @param count Number of particles to emit.
   * @param position Center position.
   * @param config Base configuration (velocity will be randomized).
   */
  burst = (
    count: number,
    position: Vector3,
    config: Omit<ParticleConfig, "position" | "velocity"> & {
      velocitySpread?: number;
      velocityBias?: Vector3;
    }
  ): void => {
    const spread = config.velocitySpread ?? 1;
    const bias = config.velocityBias ?? new Vector3(0, 0, 0);

    for (let i = 0; i < count; i++) {
      const velocity = new Vector3(
        (Math.random() - 0.5) * spread + bias.x,
        (Math.random() - 0.5) * spread + bias.y,
        (Math.random() - 0.5) * spread + bias.z
      );

      this.emit({
        ...config,
        position: position.clone(),
        velocity,
      });
    }
  };

  /**
   * Update all particles. Call this each frame.
   *
   * @param delta Time since last update in seconds.
   */
  update = (delta: number): void => {
    const gravity = this.options.gravity;
    let activeIdx = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      if (!particle.active) continue;

      // Update age
      particle.age += delta;

      // Check lifetime
      if (particle.age >= particle.lifetime) {
        particle.active = false;
        this.activeCount--;
        continue;
      }

      // Apply physics
      // Gravity
      particle.velocity.x += gravity.x * particle.gravity * delta;
      particle.velocity.y += gravity.y * particle.gravity * delta;
      particle.velocity.z += gravity.z * particle.gravity * delta;

      // Drag
      if (particle.drag > 0) {
        const dragFactor = 1 - particle.drag * delta;
        particle.velocity.multiplyScalar(Math.max(0, dragFactor));
      }

      // Position update
      particle.position.x += particle.velocity.x * delta;
      particle.position.y += particle.velocity.y * delta;
      particle.position.z += particle.velocity.z * delta;

      // Size decay
      if (particle.sizeDecay > 0) {
        particle.size = Math.max(0, particle.size - particle.sizeDecay * delta);
      }

      // Color fade
      if (particle.fadeColor) {
        const t = particle.age / particle.lifetime;
        particle.color.lerp(particle.fadeColor, t * delta * 2);
      }

      // Update buffers
      const idx3 = activeIdx * 3;
      this.positionAttribute.array[idx3] = particle.position.x;
      this.positionAttribute.array[idx3 + 1] = particle.position.y;
      this.positionAttribute.array[idx3 + 2] = particle.position.z;

      this.colorAttribute.array[idx3] = particle.color.r;
      this.colorAttribute.array[idx3 + 1] = particle.color.g;
      this.colorAttribute.array[idx3 + 2] = particle.color.b;

      this.sizeAttribute.array[activeIdx] = particle.size;

      activeIdx++;
    }

    // Update GPU buffers
    this.positionAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;

    // Update draw range
    this.geometry.setDrawRange(0, activeIdx);
  };

  /**
   * Clear all active particles.
   */
  clear = (): void => {
    for (const particle of this.particles) {
      particle.active = false;
    }
    this.activeCount = 0;
    this.geometry.setDrawRange(0, 0);
  };

  /**
   * Get the current active particle count.
   */
  get count(): number {
    return this.activeCount;
  }

  /**
   * Dispose of the particle system resources.
   */
  dispose = (): void => {
    this.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  };

  /**
   * Generate configurations for a preset.
   */
  private getPresetConfigs(
    preset: EmitterPreset,
    position: Vector3,
    overrides: Partial<ParticleConfig>
  ): ParticleConfig[] {
    const configs: ParticleConfig[] = [];
    const color = overrides.color ?? new Color("#888888");

    switch (preset) {
      case "blockBreak": {
        // Cubic particle burst
        for (let i = 0; i < 20; i++) {
          configs.push({
            position: position.clone().add(
              new Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
              )
            ),
            velocity: new Vector3(
              (Math.random() - 0.5) * 3,
              Math.random() * 2 + 1,
              (Math.random() - 0.5) * 3
            ),
            lifetime: overrides.lifetime ?? 0.8 + Math.random() * 0.4,
            size: overrides.size ?? 0.08 + Math.random() * 0.04,
            color: color.clone(),
            gravity: overrides.gravity ?? 1.2,
            drag: overrides.drag ?? 0.2,
            ...overrides,
          });
        }
        break;
      }

      case "blockPlace": {
        // Subtle dust puff
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          configs.push({
            position: position.clone().add(new Vector3(0, 0.1, 0)),
            velocity: new Vector3(
              Math.cos(angle) * 0.5,
              0.2,
              Math.sin(angle) * 0.5
            ),
            lifetime: overrides.lifetime ?? 0.4,
            size: overrides.size ?? 0.05,
            color: color.clone(),
            gravity: overrides.gravity ?? 0.5,
            drag: overrides.drag ?? 0.8,
            sizeDecay: 0.15,
            ...overrides,
          });
        }
        break;
      }

      case "explosion": {
        // Large radial burst
        for (let i = 0; i < 50; i++) {
          const dir = new Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
          ).normalize();
          const speed = 3 + Math.random() * 5;

          configs.push({
            position: position.clone(),
            velocity: dir.multiplyScalar(speed),
            lifetime: overrides.lifetime ?? 0.5 + Math.random() * 0.5,
            size: overrides.size ?? 0.1 + Math.random() * 0.1,
            color: color.clone(),
            fadeColor: new Color("#000000"),
            gravity: overrides.gravity ?? 0.3,
            drag: overrides.drag ?? 0.3,
            sizeDecay: 0.2,
            ...overrides,
          });
        }
        break;
      }

      case "dust": {
        // Slow floating particles
        for (let i = 0; i < 5; i++) {
          configs.push({
            position: position.clone().add(
              new Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 2
              )
            ),
            velocity: new Vector3(
              (Math.random() - 0.5) * 0.2,
              Math.random() * 0.1,
              (Math.random() - 0.5) * 0.2
            ),
            lifetime: overrides.lifetime ?? 2 + Math.random() * 2,
            size: overrides.size ?? 0.03,
            color: color.clone(),
            gravity: overrides.gravity ?? -0.1, // Float upward
            drag: overrides.drag ?? 0.5,
            ...overrides,
          });
        }
        break;
      }

      case "smoke": {
        // Rising smoke particles
        for (let i = 0; i < 10; i++) {
          configs.push({
            position: position.clone().add(
              new Vector3(
                (Math.random() - 0.5) * 0.3,
                0,
                (Math.random() - 0.5) * 0.3
              )
            ),
            velocity: new Vector3(
              (Math.random() - 0.5) * 0.3,
              0.5 + Math.random() * 0.5,
              (Math.random() - 0.5) * 0.3
            ),
            lifetime: overrides.lifetime ?? 1.5 + Math.random(),
            size: overrides.size ?? 0.15 + Math.random() * 0.1,
            color: new Color("#555555"),
            fadeColor: new Color("#333333"),
            gravity: overrides.gravity ?? -0.3,
            drag: overrides.drag ?? 0.3,
            sizeDecay: -0.05, // Grow over time
            ...overrides,
          });
        }
        break;
      }

      case "sparkle": {
        // Bright point sparkles
        for (let i = 0; i < 12; i++) {
          const dir = new Vector3(
            Math.random() - 0.5,
            Math.random(),
            Math.random() - 0.5
          ).normalize();

          configs.push({
            position: position.clone(),
            velocity: dir.multiplyScalar(1 + Math.random()),
            lifetime: overrides.lifetime ?? 0.3 + Math.random() * 0.3,
            size: overrides.size ?? 0.04 + Math.random() * 0.02,
            color: overrides.color ?? new Color("#ffff88"),
            gravity: overrides.gravity ?? 0.2,
            drag: overrides.drag ?? 0.1,
            sizeDecay: 0.15,
            ...overrides,
          });
        }
        break;
      }
    }

    return configs;
  }
}

/**
 * Helper function to create block-colored particles.
 *
 * @param world The voxelize world instance.
 * @param position The block position.
 * @param blockId The block ID.
 * @returns A color for the particles based on the block texture.
 */
export const getBlockParticleColor = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  world: any,
  position: Vector3,
  blockId: number
): Color => {
  // Default brown color as fallback
  const defaultColor = new Color("#8B4513");

  try {
    const block = world.getBlockById(blockId);
    if (block && block.faces && block.faces.length > 0) {
      // Try to get an average color from the block name
      const name = block.name.toLowerCase();
      if (name.includes("grass")) return new Color("#567d46");
      if (name.includes("dirt")) return new Color("#8B4513");
      if (name.includes("stone")) return new Color("#888888");
      if (name.includes("sand")) return new Color("#c2b280");
      if (name.includes("water")) return new Color("#3498db");
      if (name.includes("wood") || name.includes("log"))
        return new Color("#8B5A2B");
      if (name.includes("leaf") || name.includes("leaves"))
        return new Color("#228B22");
    }
  } catch {
    // Ignore errors
  }

  return defaultColor;
};
