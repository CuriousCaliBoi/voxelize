# Contributing to Voxelize

Thanks for your interest in contributing to Voxelize! This guide will help you get started.

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/installation)
- [cargo-watch](https://crates.io/crates/cargo-watch)
- [protoc](https://grpc.io/docs/protoc-installation/) (Protocol Buffers compiler)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/voxelize/voxelize.git
cd voxelize

# Install dependencies
pnpm install

# Generate protocol buffers
pnpm run proto

# Build all packages
pnpm run build

# Start the demo (in a separate terminal)
pnpm run demo
```

Visit http://localhost:3000 to see the demo.

## Project Structure

```
voxelize/
├── server/           # Rust server library
├── packages/
│   ├── core/         # TypeScript client library
│   ├── protocol/     # Protocol buffer definitions
│   ├── transport/    # WebSocket transport
│   └── ...
├── examples/         # Example projects
│   ├── client/       # Demo client
│   └── server/       # Demo server
├── docs/             # Docusaurus documentation
└── benches/          # Rust benchmarks
```

## Development Workflow

### Running the Demo

```bash
# Start server and client in watch mode
pnpm run demo
```

The server runs on port 4000, and the client runs on port 3000.

### Running Tests

```bash
# Rust tests
cargo test

# TypeScript linting
pnpm run lint
```

### Running Benchmarks

```bash
cargo bench
```

### Building Documentation

```bash
cd docs
pnpm install
pnpm start  # Dev server on port 3040
```

## Making Changes

### Code Style

**Rust:**
- Use `cargo fmt` before committing
- Run `cargo clippy` to catch common issues
- Follow existing patterns in the codebase

**TypeScript:**
- ESLint and Prettier are configured
- Run `pnpm run lint` to check
- Use TypeScript strict mode

### Commit Messages

Write clear commit messages that explain the "why":

```
Good: Fix entity pathfinding through water blocks
Bad:  Fixed bug
```

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes
6. Push to your fork
7. Open a Pull Request

In your PR description:
- Explain what the change does
- Link any related issues
- Include screenshots for UI changes

## Areas to Contribute

### Documentation
- Tutorials and guides
- API documentation improvements
- Example projects

### Server (Rust)
- Performance optimizations
- New terrain generation features
- AI and pathfinding improvements
- Physics enhancements

### Client (TypeScript)
- Visual effects (particles, weather)
- UI components
- Performance improvements
- Mobile support

### Tools
- Development tooling
- Build process improvements
- CI/CD enhancements

## Reporting Issues

When reporting bugs, include:

1. **Description** - What happened vs. what you expected
2. **Steps to reproduce** - Minimal steps to recreate the issue
3. **Environment** - Browser, OS, Voxelize version
4. **Console output** - Any errors or warnings

## Feature Requests

Open an issue with:

1. **Use case** - What problem does this solve?
2. **Proposed solution** - How would you like it to work?
3. **Alternatives** - Any workarounds you've tried?

## Community

- [Discord](https://discord.gg/9483RZtWVU) - Chat with other developers
- [GitHub Discussions](https://github.com/voxelize/voxelize/discussions) - Longer-form discussions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

## Questions?

Feel free to reach out on Discord or open a discussion on GitHub!
