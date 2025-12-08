import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  MathUtils as ThreeMathUtils,
  Object3D,
  Points,
  PointsMaterial,
  Scene,
  Texture,
  Vector3,
} from "three";

/**
 * Particle emitter configuration options.
 */
export interface ParticleEmitterOptions {
  /**
   * Maximum number of particles this emitter can spawn.
   * @default 1000
   */
  maxParticles?: number;

  /**
   * Particle lifetime in seconds.
   * @default 1.0
   */
  lifetime?: number;

  /**
   * Particle spawn rate (particles per second).
   * @default 10
   */
  spawnRate?: number;

  /**
   * Whether the emitter is currently active.
   * @default true
   */
  active?: boolean;

  /**
   * Whether to loop the emitter.
   * @default false
   */
  loop?: boolean;

  /**
   * Particle size.
   * @default 0.1
   */
  size?: number;

  /**
   * Particle color.
   * @default white
   */
  color?: Color | string | number;

  /**
   * Particle texture (optional).
   */
  texture?: Texture;

  /**
   * Whether particles are affected by gravity.
   * @default true
   */
  gravity?: boolean;

  /**
   * Gravity acceleration.
   * @default -9.8
   */
  gravityValue?: number;

  /**
   * Initial velocity range [min, max] for each axis.
   */
  velocity?: {
    x?: [number, number];
    y?: [number, number];
    z?: [number, number];
  };

  /**
   * Position variance [min, max] for each axis.
   */
  positionVariance?: {
    x?: [number, number];
    y?: [number, number];
    z?: [number, number];
  };

  /**
   * Size variance [min, max].
   */
  sizeVariance?: [number, number];

  /**
   * Lifetime variance [min, max] as multiplier.
   */
  lifetimeVariance?: [number, number];
}

/**
 * Individual particle data.
 */
interface Particle {
  position: Vector3;
  velocity: Vector3;
  lifetime: number;
  maxLifetime: number;
  size: number;
  color: Color;
  active: boolean;
}

/**
 * Particle emitter that spawns and manages particles.
 *
 * @example
 * ```ts
 * const emitter = new ParticleEmitter(scene, {
 *   maxParticles: 500,
 *   spawnRate: 20,
 *   lifetime: 2.0,
 *   color: 0xff0000,
 *   size: 0.2,
 * });
 *
 * emitter.setPosition(10, 80, 10);
 * emitter.start();
 *
 * // Update in animation loop
 * emitter.update(deltaTime);
 * ```
 *
 * @category Effects
 */
export class ParticleEmitter {
  private particles: Particle[] = [];
  private instancedMesh: InstancedMesh | Points | null = null;
  private geometry: BufferGeometry;
  private material: PointsMaterial;
  private scene: Scene;
  private options: Required<ParticleEmitterOptions>;
  private position: Vector3 = new Vector3();
  private spawnTimer: number = 0;
  private activeParticleCount: number = 0;
  private useInstancing: boolean;

  /**
   * Create a new particle emitter.
   *
   * @param scene The Three.js scene to add particles to.
   * @param options Emitter configuration options.
   */
  constructor(scene: Scene, options: ParticleEmitterOptions = {}) {
    this.scene = scene;
    this.options = {
      maxParticles: options.maxParticles ?? 1000,
      lifetime: options.lifetime ?? 1.0,
      spawnRate: options.spawnRate ?? 10,
      active: options.active ?? true,
      loop: options.loop ?? false,
      size: options.size ?? 0.1,
      color: options.color ?? 0xffffff,
      texture: options.texture,
      gravity: options.gravity ?? true,
      gravityValue: options.gravityValue ?? -9.8,
      velocity: options.velocity ?? {
        x: [0, 0],
        y: [1, 3],
        z: [0, 0],
      },
      positionVariance: options.positionVariance ?? {
        x: [0, 0],
        y: [0, 0],
        z: [0, 0],
      },
      sizeVariance: options.sizeVariance ?? [1.0, 1.0],
      lifetimeVariance: options.lifetimeVariance ?? [1.0, 1.0],
    };

    // Use instancing for better performance with many particles
    this.useInstancing = this.options.maxParticles > 100;

    this.geometry = new BufferGeometry();
    this.material = new PointsMaterial({
      size: this.options.size,
      color:
        typeof this.options.color === "string" ||
        typeof this.options.color === "number"
          ? this.options.color
          : this.options.color.getHex(),
      map: this.options.texture,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    if (this.useInstancing) {
      this.instancedMesh = new InstancedMesh(
        this.geometry,
        this.material,
        this.options.maxParticles
      );
      this.instancedMesh.instanceMatrix.setUsage(35048); // DynamicDrawUsage
    } else {
      this.instancedMesh = new Points(this.geometry, this.material);
    }

    this.scene.add(this.instancedMesh);

    // Initialize particle pool
    for (let i = 0; i < this.options.maxParticles; i++) {
      this.particles.push({
        position: new Vector3(),
        velocity: new Vector3(),
        lifetime: 0,
        maxLifetime: 0,
        size: this.options.size,
        color: new Color(this.options.color),
        active: false,
      });
    }
  }

  /**
   * Set the emitter position.
   *
   * @param x X coordinate.
   * @param y Y coordinate.
   * @param z Z coordinate.
   */
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  /**
   * Start emitting particles.
   */
  start(): void {
    this.options.active = true;
  }

  /**
   * Stop emitting particles.
   */
  stop(): void {
    this.options.active = false;
  }

  /**
   * Reset all particles.
   */
  reset(): void {
    for (const particle of this.particles) {
      particle.active = false;
    }
    this.activeParticleCount = 0;
    this.spawnTimer = 0;
  }

  /**
   * Spawn a single particle.
   */
  private spawnParticle(): void {
    if (this.activeParticleCount >= this.options.maxParticles) {
      return;
    }

    // Find inactive particle
    const particle = this.particles.find((p) => !p.active);
    if (!particle) {
      return;
    }

    // Reset particle
    particle.active = true;
    particle.position.copy(this.position);

    // Apply position variance
    const pxVar = this.options.positionVariance.x;
    const pyVar = this.options.positionVariance.y;
    const pzVar = this.options.positionVariance.z;
    particle.position.x += ThreeMathUtils.randFloat(pxVar[0], pxVar[1]);
    particle.position.y += ThreeMathUtils.randFloat(pyVar[0], pyVar[1]);
    particle.position.z += ThreeMathUtils.randFloat(pzVar[0], pzVar[1]);

    // Set velocity
    const vx = this.options.velocity.x;
    const vy = this.options.velocity.y;
    const vz = this.options.velocity.z;
    particle.velocity.set(
      ThreeMathUtils.randFloat(vx[0], vx[1]),
      ThreeMathUtils.randFloat(vy[0], vy[1]),
      ThreeMathUtils.randFloat(vz[0], vz[1])
    );

    // Set lifetime
    const lifetimeMult = ThreeMathUtils.randFloat(
      this.options.lifetimeVariance[0],
      this.options.lifetimeVariance[1]
    );
    particle.maxLifetime = this.options.lifetime * lifetimeMult;
    particle.lifetime = particle.maxLifetime;

    // Set size
    const sizeMult = ThreeMathUtils.randFloat(
      this.options.sizeVariance[0],
      this.options.sizeVariance[1]
    );
    particle.size = this.options.size * sizeMult;

    this.activeParticleCount++;
  }

  /**
   * Update particle system.
   *
   * @param deltaTime Time since last update in seconds.
   */
  update(deltaTime: number): void {
    // Spawn new particles
    if (this.options.active) {
      this.spawnTimer += deltaTime;
      const spawnInterval = 1.0 / this.options.spawnRate;
      while (this.spawnTimer >= spawnInterval) {
        this.spawnParticle();
        this.spawnTimer -= spawnInterval;
      }
    }

    // Update particles
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    let visibleCount = 0;

    for (const particle of this.particles) {
      if (!particle.active) {
        continue;
      }

      // Update lifetime
      particle.lifetime -= deltaTime;
      if (particle.lifetime <= 0) {
        particle.active = false;
        this.activeParticleCount--;
        if (!this.options.loop) {
          continue;
        }
        // Respawn if looping
        if (this.options.active) {
          this.spawnParticle();
        }
        continue;
      }

      // Update physics
      if (this.options.gravity) {
        particle.velocity.y += this.options.gravityValue * deltaTime;
      }

      // Update position
      particle.position.add(
        particle.velocity.clone().multiplyScalar(deltaTime)
      );

      // Fade out as lifetime decreases
      const lifeRatio = particle.lifetime / particle.maxLifetime;
      const alpha = lifeRatio;

      // Store particle data
      positions.push(
        particle.position.x,
        particle.position.y,
        particle.position.z
      );
      colors.push(
        particle.color.r,
        particle.color.g,
        particle.color.b,
        alpha
      );
      sizes.push(particle.size * lifeRatio); // Shrink over time
      visibleCount++;
    }

    // Update geometry
    if (visibleCount > 0) {
      this.geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(positions), 3)
      );
      this.geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(colors), 4)
      );
      this.geometry.setAttribute(
        "size",
        new BufferAttribute(new Float32Array(sizes), 1)
      );
      this.geometry.setDrawRange(0, visibleCount);
    } else {
      this.geometry.setDrawRange(0, 0);
    }

    this.geometry.attributes.position.needsUpdate = true;
    if (this.geometry.attributes.color) {
      this.geometry.attributes.color.needsUpdate = true;
    }
    if (this.geometry.attributes.size) {
      this.geometry.attributes.size.needsUpdate = true;
    }
  }

  /**
   * Dispose of the emitter and clean up resources.
   */
  dispose(): void {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.geometry.dispose();
      this.material.dispose();
      if (this.options.texture) {
        this.options.texture.dispose();
      }
    }
    this.particles = [];
  }
}

/**
 * Particle system manager that handles multiple emitters.
 *
 * @example
 * ```ts
 * const particleSystem = new ParticleSystem(scene);
 *
 * // Create block break effect
 * const breakEffect = particleSystem.createEmitter({
 *   maxParticles: 50,
 *   spawnRate: 50,
 *   lifetime: 0.5,
 *   color: 0x888888,
 *   size: 0.15,
 * });
 *
 * // Emit at block position
 * breakEffect.setPosition(10, 80, 10);
 * breakEffect.start();
 * ```
 *
 * @category Effects
 */
export class ParticleSystem {
  private emitters: ParticleEmitter[] = [];
  private scene: Scene;

  /**
   * Create a new particle system.
   *
   * @param scene The Three.js scene.
   */
  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Create a new particle emitter.
   *
   * @param options Emitter options.
   * @returns The created emitter.
   */
  createEmitter(options: ParticleEmitterOptions = {}): ParticleEmitter {
    const emitter = new ParticleEmitter(this.scene, options);
    this.emitters.push(emitter);
    return emitter;
  }

  /**
   * Remove an emitter.
   *
   * @param emitter The emitter to remove.
   */
  removeEmitter(emitter: ParticleEmitter): void {
    const index = this.emitters.indexOf(emitter);
    if (index !== -1) {
      emitter.dispose();
      this.emitters.splice(index, 1);
    }
  }

  /**
   * Update all emitters.
   *
   * @param deltaTime Time since last update in seconds.
   */
  update(deltaTime: number): void {
    for (const emitter of this.emitters) {
      emitter.update(deltaTime);
    }
  }

  /**
   * Clear all emitters.
   */
  clear(): void {
    for (const emitter of this.emitters) {
      emitter.dispose();
    }
    this.emitters = [];
  }

  /**
   * Dispose of the particle system.
   */
  dispose(): void {
    this.clear();
  }
}

/**
 * Preset particle effects.
 */
export class ParticlePresets {
  /**
   * Create a block break particle effect.
   *
   * @param scene The scene.
   * @param color Particle color (default: gray).
   * @returns Particle emitter configured for block breaking.
   */
  static blockBreak(
    scene: Scene,
    color: Color | string | number = 0x888888
  ): ParticleEmitter {
    return new ParticleEmitter(scene, {
      maxParticles: 50,
      spawnRate: 50,
      lifetime: 0.5,
      loop: false,
      color,
      size: 0.15,
      gravity: true,
      gravityValue: -9.8,
      velocity: {
        x: [-2, 2],
        y: [2, 5],
        z: [-2, 2],
      },
      positionVariance: {
        x: [-0.2, 0.2],
        y: [-0.2, 0.2],
        z: [-0.2, 0.2],
      },
      sizeVariance: [0.8, 1.2],
    });
  }

  /**
   * Create a block place particle effect.
   *
   * @param scene The scene.
   * @param color Particle color.
   * @returns Particle emitter configured for block placing.
   */
  static blockPlace(
    scene: Scene,
    color: Color | string | number = 0xffffff
  ): ParticleEmitter {
    return new ParticleEmitter(scene, {
      maxParticles: 20,
      spawnRate: 20,
      lifetime: 0.3,
      loop: false,
      color,
      size: 0.1,
      gravity: false,
      velocity: {
        x: [-0.5, 0.5],
        y: [0, 1],
        z: [-0.5, 0.5],
      },
      sizeVariance: [0.9, 1.1],
    });
  }

  /**
   * Create an explosion particle effect.
   *
   * @param scene The scene.
   * @param color Particle color (default: orange-red).
   * @returns Particle emitter configured for explosions.
   */
  static explosion(
    scene: Scene,
    color: Color | string | number = 0xff6600
  ): ParticleEmitter {
    return new ParticleEmitter(scene, {
      maxParticles: 200,
      spawnRate: 200,
      lifetime: 1.0,
      loop: false,
      color,
      size: 0.2,
      gravity: true,
      gravityValue: -5.0,
      velocity: {
        x: [-8, 8],
        y: [2, 10],
        z: [-8, 8],
      },
      sizeVariance: [0.5, 1.5],
      lifetimeVariance: [0.5, 1.5],
    });
  }

  /**
   * Create an ambient particle effect (dust, leaves, etc.).
   *
   * @param scene The scene.
   * @param color Particle color (default: light gray).
   * @returns Particle emitter configured for ambient effects.
   */
  static ambient(
    scene: Scene,
    color: Color | string | number = 0xcccccc
  ): ParticleEmitter {
    return new ParticleEmitter(scene, {
      maxParticles: 100,
      spawnRate: 2,
      lifetime: 10.0,
      loop: true,
      color,
      size: 0.05,
      gravity: true,
      gravityValue: -0.5,
      velocity: {
        x: [-0.5, 0.5],
        y: [0, 0.5],
        z: [-0.5, 0.5],
      },
      positionVariance: {
        x: [-5, 5],
        y: [0, 2],
        z: [-5, 5],
      },
      sizeVariance: [0.8, 1.2],
    });
  }
}
