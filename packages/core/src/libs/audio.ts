import { Camera, Object3D, Vector3 } from "three";

/**
 * Configuration for the audio system.
 */
export type AudioSystemOptions = {
  /** Master volume (0-1) */
  masterVolume?: number;
  /** Sound effects volume (0-1) */
  sfxVolume?: number;
  /** Music volume (0-1) */
  musicVolume?: number;
  /** Maximum distance for 3D audio falloff */
  maxDistance?: number;
  /** Rolloff factor for distance attenuation */
  rolloffFactor?: number;
  /** Reference distance for audio */
  refDistance?: number;
};

/**
 * Configuration for playing a sound.
 */
export type SoundOptions = {
  /** Volume multiplier (0-1) */
  volume?: number;
  /** Playback rate (1 = normal) */
  playbackRate?: number;
  /** Whether to loop the sound */
  loop?: boolean;
  /** Start time in seconds */
  startTime?: number;
  /** 3D position for spatial audio */
  position?: Vector3;
  /** Attach to an object for moving sounds */
  attachTo?: Object3D;
  /** Sound category for volume control */
  category?: "sfx" | "music" | "ambient";
};

interface ActiveSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode?: PannerNode;
  category: "sfx" | "music" | "ambient";
  attachTo?: Object3D;
  baseVolume: number;
}

/**
 * Audio system for 3D positional audio, sound effects, and music.
 *
 * # Example
 * ```ts
 * // Create audio system
 * const audio = new VOXELIZE.AudioSystem();
 *
 * // Load sounds
 * await audio.load("footstep", "/sounds/footstep.mp3");
 * await audio.load("ambient", "/sounds/forest.mp3");
 * await audio.load("music", "/sounds/background.mp3");
 *
 * // Play a sound effect at a position
 * audio.play("footstep", {
 *   position: new THREE.Vector3(10, 0, 10),
 *   volume: 0.5,
 * });
 *
 * // Play background music
 * audio.play("music", {
 *   category: "music",
 *   loop: true,
 *   volume: 0.3,
 * });
 *
 * // Update listener position in render loop
 * function animate() {
 *   audio.updateListener(camera);
 *   requestAnimationFrame(animate);
 * }
 * ```
 *
 * @category Audio
 */
export class AudioSystem {
  /**
   * Audio system options.
   */
  public options: Required<AudioSystemOptions>;

  /**
   * Web Audio API context.
   */
  private context: AudioContext | null = null;

  /**
   * Master gain node.
   */
  private masterGain: GainNode | null = null;

  /**
   * Category-specific gain nodes.
   */
  private categoryGains: Map<string, GainNode> = new Map();

  /**
   * Loaded audio buffers.
   */
  private buffers: Map<string, AudioBuffer> = new Map();

  /**
   * Currently playing sounds.
   */
  private activeSounds: Map<string, ActiveSound[]> = new Map();

  /**
   * Listener position for 3D audio.
   */
  private listenerPosition = new Vector3();

  /**
   * Listener forward direction.
   */
  private listenerForward = new Vector3(0, 0, -1);

  /**
   * Listener up direction.
   */
  private listenerUp = new Vector3(0, 1, 0);

  /**
   * Whether the audio system is initialized.
   */
  private initialized = false;

  /**
   * Sound ID counter for unique keys.
   */
  private soundIdCounter = 0;

  /**
   * Create a new audio system.
   *
   * @param options Configuration options.
   */
  constructor(options: AudioSystemOptions = {}) {
    this.options = {
      masterVolume: options.masterVolume ?? 1.0,
      sfxVolume: options.sfxVolume ?? 1.0,
      musicVolume: options.musicVolume ?? 0.5,
      maxDistance: options.maxDistance ?? 50,
      rolloffFactor: options.rolloffFactor ?? 1,
      refDistance: options.refDistance ?? 1,
    };
  }

  /**
   * Initialize the audio context. Must be called after user interaction.
   *
   * @returns Promise that resolves when initialized.
   */
  init = async (): Promise<void> => {
    if (this.initialized) return;

    try {
      this.context = new AudioContext();

      // Create master gain
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.options.masterVolume;
      this.masterGain.connect(this.context.destination);

      // Create category gains
      for (const category of ["sfx", "music", "ambient"]) {
        const gain = this.context.createGain();
        gain.gain.value =
          category === "music"
            ? this.options.musicVolume
            : this.options.sfxVolume;
        gain.connect(this.masterGain);
        this.categoryGains.set(category, gain);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize audio system:", error);
    }
  };

  /**
   * Resume audio context after browser autoplay policy suspension.
   */
  resume = async (): Promise<void> => {
    if (this.context?.state === "suspended") {
      await this.context.resume();
    }
  };

  /**
   * Load an audio file.
   *
   * @param name Identifier for the sound.
   * @param url URL to the audio file.
   * @returns Promise that resolves when loaded.
   */
  load = async (name: string, url: string): Promise<void> => {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.context) {
      throw new Error("Audio context not initialized");
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    } catch (error) {
      console.error(`Failed to load audio "${name}":`, error);
    }
  };

  /**
   * Load multiple audio files.
   *
   * @param sounds Map of names to URLs.
   * @returns Promise that resolves when all loaded.
   */
  loadAll = async (sounds: Record<string, string>): Promise<void> => {
    const promises = Object.entries(sounds).map(([name, url]) =>
      this.load(name, url)
    );
    await Promise.all(promises);
  };

  /**
   * Play a loaded sound.
   *
   * @param name Sound identifier.
   * @param options Playback options.
   * @returns Sound instance ID for control, or null if failed.
   */
  play = (name: string, options: SoundOptions = {}): string | null => {
    if (!this.context || !this.masterGain) {
      console.warn("Audio system not initialized");
      return null;
    }

    const buffer = this.buffers.get(name);
    if (!buffer) {
      console.warn(`Sound "${name}" not loaded`);
      return null;
    }

    const category = options.category ?? "sfx";
    const categoryGain = this.categoryGains.get(category);
    if (!categoryGain) return null;

    // Create source
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = options.playbackRate ?? 1;

    // Create gain for individual volume control
    const gainNode = this.context.createGain();
    const baseVolume = options.volume ?? 1;
    gainNode.gain.value = baseVolume;

    // Setup audio graph
    let lastNode: AudioNode = source;

    // Add panner for 3D audio
    let pannerNode: PannerNode | undefined;
    if (options.position || options.attachTo) {
      pannerNode = this.context.createPanner();
      pannerNode.panningModel = "HRTF";
      pannerNode.distanceModel = "inverse";
      pannerNode.maxDistance = this.options.maxDistance;
      pannerNode.rolloffFactor = this.options.rolloffFactor;
      pannerNode.refDistance = this.options.refDistance;

      if (options.position) {
        pannerNode.positionX.value = options.position.x;
        pannerNode.positionY.value = options.position.y;
        pannerNode.positionZ.value = options.position.z;
      }

      lastNode.connect(pannerNode);
      lastNode = pannerNode;
    }

    lastNode.connect(gainNode);
    gainNode.connect(categoryGain);

    // Start playback
    source.start(0, options.startTime ?? 0);

    // Track active sound
    const soundId = `${name}_${this.soundIdCounter++}`;
    const activeSound: ActiveSound = {
      source,
      gainNode,
      pannerNode,
      category,
      attachTo: options.attachTo,
      baseVolume,
    };

    if (!this.activeSounds.has(name)) {
      this.activeSounds.set(name, []);
    }
    this.activeSounds.get(name)!.push(activeSound);

    // Clean up when finished
    source.onended = () => {
      const sounds = this.activeSounds.get(name);
      if (sounds) {
        const idx = sounds.indexOf(activeSound);
        if (idx >= 0) sounds.splice(idx, 1);
      }
    };

    return soundId;
  };

  /**
   * Stop all instances of a sound.
   *
   * @param name Sound identifier.
   * @param fadeTime Fade out duration in seconds.
   */
  stop = (name: string, fadeTime = 0): void => {
    const sounds = this.activeSounds.get(name);
    if (!sounds) return;

    for (const sound of sounds) {
      if (fadeTime > 0 && this.context) {
        sound.gainNode.gain.linearRampToValueAtTime(
          0,
          this.context.currentTime + fadeTime
        );
        setTimeout(() => {
          try {
            sound.source.stop();
          } catch {
            // Already stopped
          }
        }, fadeTime * 1000);
      } else {
        try {
          sound.source.stop();
        } catch {
          // Already stopped
        }
      }
    }
  };

  /**
   * Stop all sounds.
   *
   * @param fadeTime Fade out duration in seconds.
   */
  stopAll = (fadeTime = 0): void => {
    for (const name of this.activeSounds.keys()) {
      this.stop(name, fadeTime);
    }
  };

  /**
   * Set the master volume.
   *
   * @param volume Volume level (0-1).
   */
  setMasterVolume = (volume: number): void => {
    this.options.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.options.masterVolume;
    }
  };

  /**
   * Set the volume for a category.
   *
   * @param category The category ("sfx", "music", or "ambient").
   * @param volume Volume level (0-1).
   */
  setCategoryVolume = (
    category: "sfx" | "music" | "ambient",
    volume: number
  ): void => {
    volume = Math.max(0, Math.min(1, volume));

    if (category === "music") {
      this.options.musicVolume = volume;
    } else {
      this.options.sfxVolume = volume;
    }

    const gain = this.categoryGains.get(category);
    if (gain) {
      gain.gain.value = volume;
    }
  };

  /**
   * Update the listener position and orientation. Call this each frame.
   *
   * @param camera The camera to use as the listener.
   */
  updateListener = (camera: Camera): void => {
    if (!this.context) return;

    // Get camera world position and direction
    camera.getWorldPosition(this.listenerPosition);
    camera.getWorldDirection(this.listenerForward);

    // Update Web Audio listener
    const listener = this.context.listener;

    if (listener.positionX) {
      listener.positionX.value = this.listenerPosition.x;
      listener.positionY.value = this.listenerPosition.y;
      listener.positionZ.value = this.listenerPosition.z;
    }

    if (listener.forwardX) {
      listener.forwardX.value = this.listenerForward.x;
      listener.forwardY.value = this.listenerForward.y;
      listener.forwardZ.value = this.listenerForward.z;
      listener.upX.value = this.listenerUp.x;
      listener.upY.value = this.listenerUp.y;
      listener.upZ.value = this.listenerUp.z;
    }

    // Update attached sounds
    for (const sounds of this.activeSounds.values()) {
      for (const sound of sounds) {
        if (sound.attachTo && sound.pannerNode) {
          const pos = new Vector3();
          sound.attachTo.getWorldPosition(pos);
          sound.pannerNode.positionX.value = pos.x;
          sound.pannerNode.positionY.value = pos.y;
          sound.pannerNode.positionZ.value = pos.z;
        }
      }
    }
  };

  /**
   * Check if a sound is currently playing.
   *
   * @param name Sound identifier.
   * @returns Whether any instance of the sound is playing.
   */
  isPlaying = (name: string): boolean => {
    const sounds = this.activeSounds.get(name);
    return sounds !== undefined && sounds.length > 0;
  };

  /**
   * Crossfade between two music tracks.
   *
   * @param fromName Current track name.
   * @param toName New track name.
   * @param duration Crossfade duration in seconds.
   */
  crossfade = (fromName: string, toName: string, duration: number): void => {
    // Start new track quietly
    this.play(toName, {
      category: "music",
      loop: true,
      volume: 0,
    });

    if (!this.context) return;

    // Fade out old track
    const oldSounds = this.activeSounds.get(fromName);
    if (oldSounds) {
      for (const sound of oldSounds) {
        sound.gainNode.gain.linearRampToValueAtTime(
          0,
          this.context.currentTime + duration
        );
      }
    }

    // Fade in new track
    const newSounds = this.activeSounds.get(toName);
    if (newSounds) {
      for (const sound of newSounds) {
        sound.gainNode.gain.linearRampToValueAtTime(
          sound.baseVolume,
          this.context.currentTime + duration
        );
      }
    }

    // Stop old track after fade
    setTimeout(() => this.stop(fromName), duration * 1000);
  };

  /**
   * Dispose of the audio system.
   */
  dispose = (): void => {
    this.stopAll();
    this.buffers.clear();
    this.activeSounds.clear();

    if (this.context) {
      this.context.close();
      this.context = null;
    }

    this.initialized = false;
  };
}

/**
 * Preset sounds for common voxel game events.
 */
export const SOUND_PRESETS = {
  /** Block interaction sounds */
  blocks: {
    break: {
      dirt: "block_break_dirt",
      stone: "block_break_stone",
      wood: "block_break_wood",
      glass: "block_break_glass",
    },
    place: {
      dirt: "block_place_dirt",
      stone: "block_place_stone",
      wood: "block_place_wood",
    },
  },
  /** Player sounds */
  player: {
    footstep: "player_footstep",
    jump: "player_jump",
    land: "player_land",
  },
  /** Ambient sounds */
  ambient: {
    wind: "ambient_wind",
    birds: "ambient_birds",
    cave: "ambient_cave",
  },
};
