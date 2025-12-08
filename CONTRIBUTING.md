# Contributing to Voxelize

Thank you for your interest in contributing to Voxelize! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/en/download/) (v18 or higher)
- [cargo-watch](https://crates.io/crates/cargo-watch) (`cargo install cargo-watch`)
- [protoc](https://grpc.io/docs/protoc-installation/) (Protocol Buffer compiler)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/shaoruu/voxelize.git
   cd voxelize
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Generate protocol buffers**
   ```bash
   pnpm run proto
   ```

4. **Build the project**
   ```bash
   pnpm run build
   ```

5. **Run the demo**
   ```bash
   pnpm run demo
   ```
   Visit http://localhost:3000

## Development Workflow

### Branch Strategy

- `main` - Stable, production-ready code
- `develop` - Development branch (if exists)
- Feature branches - `feature/your-feature-name`
- Bug fixes - `fix/your-bug-description`

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style (see below)
   - Write tests if applicable
   - Update documentation

3. **Test your changes**
   ```bash
   # Run Rust tests
   cargo test
   
   # Run TypeScript tests (if any)
   pnpm test
   
   # Build to check for errors
   pnpm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
   
   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `perf:` - Performance improvements
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style

### Rust

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` to format code
- Use `cargo clippy` to check for linting issues
- Document public APIs with doc comments

### TypeScript

- Use TypeScript strict mode
- Follow existing code style (2 spaces, semicolons)
- Use ESLint and Prettier (configured in `.eslintrc` and `.prettierrc`)
- Document public APIs with JSDoc comments

## Project Structure

```
voxelize/
├── server/          # Rust server code
│   └── world/       # ECS world, systems, components
├── packages/        # TypeScript packages
│   ├── core/        # Core client library
│   ├── protocol/    # Protocol buffer definitions
│   └── ...
├── docs/            # Docusaurus documentation
├── examples/        # Example projects
└── tests/           # Integration tests
```

## Areas for Contribution

### Documentation

- Tutorial improvements
- API documentation
- Code examples
- Performance guides

### Features

- New block types
- Entity systems
- Visual effects
- Performance optimizations

### Bug Fixes

- Check existing issues
- Create a minimal reproduction
- Submit a fix with tests

## Testing

### Rust Tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_name

# Run with output
cargo test -- --nocapture
```

### Benchmarks

```bash
# Run mesher benchmarks
cargo bench --bench mesher_bench

# Run lighting benchmarks
cargo bench --bench lights_bench
```

### Manual Testing

1. Start the demo server
2. Test your changes in the browser
3. Check for console errors
4. Verify multiplayer functionality

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** (if exists)
5. **Write a clear PR description**:
   - What changes were made
   - Why they were made
   - How to test them

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Commit messages follow conventions

## Reporting Issues

### Bug Reports

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, browser, versions)
- Screenshots if applicable

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered
- Additional context

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints

## Getting Help

- **Discord**: [Join our Discord server](https://discord.gg/9483RZtWVU)
- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: [docs.voxelize.io](https://docs.voxelize.io)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Recognition

Contributors will be recognized in:
- README.md contributors section (if exists)
- Release notes
- Project documentation

Thank you for contributing to Voxelize! 🎉
