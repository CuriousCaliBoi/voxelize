# Contributing to Voxelize

Thank you for your interest in contributing to Voxelize! This guide will help you get started with development and submitting contributions.

## Development Setup

### Prerequisites

Before starting, make sure you have installed:

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/en/download/) (v18 or later)
- [pnpm](https://pnpm.io/installation)
- [cargo-watch](https://crates.io/crates/cargo-watch) (`cargo install cargo-watch`)
- [protoc](https://grpc.io/docs/protoc-installation/) (Protocol Buffer compiler)

### Getting Started

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
   Visit http://localhost:3000

## Development Workflow

### Project Structure

- `server/` - Rust server code
- `packages/` - TypeScript/JavaScript client packages
- `docs/` - Docusaurus documentation
- `examples/` - Example projects
- `benches/` - Rust benchmarks
- `tests/` - Rust tests

### Hot Reload Development

**Server (Rust):**
```bash
cargo watch -x "run --bin server"
```

**Client (TypeScript):**
The Vite dev server automatically reloads on file changes.

**Protocol Buffers:**
After modifying `messages.proto`, run:
```bash
pnpm run proto
```

### Running Tests

**Rust Tests:**
```bash
cargo test
```

**TypeScript Tests:**
```bash
cd packages/core
pnpm test
```

### Running Benchmarks

**Rust Benchmarks:**
```bash
cargo bench
```

## Making Changes

### Code Style

**Rust:**
- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` to format code
- Use `cargo clippy` to check for linting issues

**TypeScript:**
- Follow the existing code style
- Use ESLint (configuration in `.eslintrc`)
- Use Prettier for formatting

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat: Add particle system for block breaking effects
fix: Resolve pathfinding issue with diagonal movement
docs: Add AI and pathfinding tutorial
```

### Pull Request Process

1. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clear, maintainable code
   - Add tests for new features
   - Update documentation as needed

3. **Test your changes:**
   - Run tests: `cargo test` and `pnpm test`
   - Test the demo: `pnpm run demo`
   - Check for linting issues

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: Description of your change"
   ```

5. **Push and create a PR:**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a pull request on GitHub.

### PR Requirements

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventional commits
- [ ] PR description explains the changes and motivation

## Areas for Contribution

### Documentation

- Tutorial improvements
- API documentation
- Code examples
- Performance guides

### Features

- New block types
- Entity behaviors
- Terrain generation improvements
- Client-side features (particles, audio, etc.)

### Bug Fixes

- Check [GitHub Issues](https://github.com/shaoruu/voxelize/issues)
- Look for "good first issue" labels
- Fix bugs and submit PRs

### Performance

- Optimize chunk generation
- Improve mesh generation
- Reduce memory usage
- Benchmark improvements

## Documentation Development

The documentation uses Docusaurus. To work on docs:

1. **Navigate to docs directory:**
   ```bash
   cd docs
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start dev server:**
   ```bash
   pnpm start
   ```

4. **Build docs:**
   ```bash
   pnpm build
   ```

Documentation files are in `docs/docs/`:
- `tutorials/` - Tutorial guides
- `wiki/` - Reference documentation
- `api/` - Auto-generated API docs

## Protocol Buffer Changes

When modifying `messages.proto`:

1. Make your changes to `messages.proto`
2. Run `pnpm run proto` to regenerate code
3. Update both Rust and TypeScript code that uses the protocol
4. Test thoroughly - protocol changes affect network communication

## Testing Guidelines

### Server Tests

- Test new systems in `server/tests/`
- Use Specs ECS test utilities
- Mock world state when needed

### Client Tests

- Test utilities in `packages/core/src/utils/`
- Test components in isolation
- Use mock network transports

### Integration Tests

- Test server-client communication
- Test multiplayer scenarios
- Test persistence and saving

## Getting Help

- **Discord:** [Join our Discord server](https://discord.gg/9483RZtWVU)
- **GitHub Issues:** [Open an issue](https://github.com/shaoruu/voxelize/issues)
- **Documentation:** [Read the docs](https://docs.voxelize.io)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

Thank you for contributing to Voxelize! 🎉
