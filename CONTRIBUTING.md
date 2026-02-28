# Contributing to Meetly

Thanks for your interest in contributing. This project is licensed under the **MIT License** (see [LICENSE](./LICENSE)).

## Demo and overview

- **Demo video**: `public/demo.mp4` shows the main flow (see also the [README](./README.md#demo)).
- **Product**: Meetly lets creators build event/course pages, add packages, and manage enrollments with payments (e.g. Xendit).

## How to contribute

1. **Open an issue** for bugs or feature ideas, or comment on an existing one.
2. **Fork the repo** and create a branch (e.g. `fix/typo` or `feat/new-feature`).
3. **Follow the setup below**, make your changes, and add tests if applicable.
4. **Submit a pull request** with a short description of what changed and why.

## Development setup

1. Clone your fork and install dependencies:

   ```bash
   git clone https://github.com/your-username/rsv.git
   cd rsv
   bun install
   ```

2. Copy env and configure:

   ```bash
   cp .env.example .env.local
   ```

   Fill in database URL, Google OAuth, and any other required env vars.

3. Run migrations:

   ```bash
   bunx prisma migrate dev
   ```

4. Start the dev server:

   ```bash
   bun dev
   ```

   Visit [http://localhost:3000](http://localhost:3000). The homepage uses the demo at `public/demo.mp4`; you can use that file to verify the UI.

## Code and commit guidelines

- Use the existing style (ESLint, TypeScript, React/Next.js conventions).
- Prefer small, focused commits and clear PR descriptions.
- By contributing, you agree that your contributions will be licensed under the same **MIT License** as the project.

## Questions

Open a [GitHub issue](https://github.com/your-username/rsv/issues) for questions or discussion.
