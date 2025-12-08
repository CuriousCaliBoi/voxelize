# Contributing to Voxelize

Thank you for your interest in contributing to Voxelize! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/en/download/) (v18 or later)
- [pnpm](https://pnpm.io/installation)
- [cargo-watch](https://crates.io/crates/cargo-watch) (`cargo install cargo-watch`)
- [protoc](https://grpc.io/docs/protoc-installation/) (Protocol Buffer compiler)

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shaoruu/voxelize.git
   cd voxelize
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Generate protocol buffers:**
   ```bash
   pnpm run proto
   ```

4. **Build the project:**
   ```bash
   pnpm run build
   ```

5. **Run the demo:**
   ```bash
   pnpm run demo
   ```

Visit http://localhost:3000 to see the demo.

## Development Workflow

### Project Structure

- `server/` - Rust server code (ECS, physics, world generation)
- `packages/core/` - TypeScript client library (Three.js, rendering)
- `packages/protocol/` - Protocol buffer definitions
- `docs/` - Docusaurus documentation
- `examples/` - Example projects

### Making Changes

1. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Follow existing code style
   - Add tests if applicable
   - Update documentation

3. **Test your changes:**
   ```bash
   # Run Rust tests
   cd server && cargo test

   # Run TypeScript tests (if any)
   cd packages/core && pnpm test

   # Build to check for errors
   pnpm run build
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

5. **Push and create a Pull Request:**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style

### Rust

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` to format code
- Use `cargo clippy` to check for issues
- Document public APIs with doc comments

### TypeScript

- Use TypeScript strict mode
- Follow existing naming conventions
- Use JSDoc for public APIs
- Format with Prettier (configured in project)

## Documentation

### Writing Documentation

- Server docs: Use Rust doc comments (`///`)
- Client docs: Use JSDoc (`/** */`)
- Tutorials: Markdown files in `docs/docs/tutorials/`
- Wiki pages: Markdown files in `docs/docs/wiki/`

### Building Documentation

```bash
cd docs
yarn install
yarn start  # Development server
yarn build   # Production build
```

## Testing

### Server Tests

```bash
cd server
cargo test
```

### Client Tests

```bash
cd packages/core
pnpm test
```

### Integration Tests

Run the demo and test manually:
```bash
pnpm run demo
```

## Pull Request Process

1. **Ensure your code:**
   - Follows code style guidelines
   - Includes tests (if applicable)
   - Updates documentation
   - Builds without errors

2. **Create a PR with:**
   - Clear title and description
   - Reference related issues
   - Screenshots/videos for visual changes

3. **Respond to feedback:**
   - Address review comments
   - Update PR as needed
   - Keep PR focused (one feature/fix per PR)

## Areas for Contribution

### High Priority

- **Documentation**: Tutorials, API docs, examples
- **Performance**: Optimizations, profiling
- **Features**: See [Feature Proposals](docs/feature-proposals.md)

### Bug Fixes

- Check [Issues](https://github.com/shaoruu/voxelize/issues)
- Fix bugs and add tests
- Document the fix

### Examples

- Create example projects
- Add to `examples/` directory
- Document usage

## Protocol Buffers

When modifying protocol definitions:

1. Edit `.proto` files in `packages/protocol/`
2. Regenerate code: `pnpm run proto`
3. Update both Rust and TypeScript code that uses the protocol

## Questions?

- Check [Documentation](https://docs.voxelize.io)
- Ask in [Discord](https://discord.gg/9483RZtWVU)
- Open an [Issue](https://github.com/shaoruu/voxelize/issues)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

Thank you for contributing to Voxelize! 🎮
