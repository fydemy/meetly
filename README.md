# Meetly

Create instant courses beautifully and effortlessly. Build event pages, sell packages, and manage enrollments in one place.

## Demo

The homepage includes a short demo of the app. The video is in this repo at **`public/demo.mp4`** (MIT licensed with the rest of the project).

![Meetly demo](./public/demo.mp4)

You can also run the app (`bun dev`) and open the homepage to see the demo in the UI.

## Tech stack

- **Framework**: Next.js 16 (App Router, TypeScript, React 19)
- **API**: tRPC 11
- **Data**: Prisma + PostgreSQL
- **Auth**: better-auth with Google OAuth
- **UI**: Tailwind CSS, Radix UI / shadcn-style components
- **Editor**: Editor.js (paragraph, header, list, image, code, quote, link, embed, custom package tool)
- **Payments**: Xendit (e.g. Indonesia)

## Getting started

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Environment**

   ```bash
   cp .env.example .env.local
   ```

   Set your database URL, auth (Google OAuth), and any payment/env vars you need.

3. **Database**

   ```bash
   bunx prisma migrate dev
   ```

4. **Run the dev server**

   ```bash
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with Google to reach the dashboard.

## Project structure

- `src/app` — Next.js App Router (pages, layouts, API routes)
- `src/components` — React components (editor, header, UI)
- `src/lib` — Auth, tRPC, Prisma, Xendit, etc.
- `prisma` — Schema and migrations
- `public` — Static assets (e.g. `demo.mp4`, logo)

## License

MIT. See [LICENSE](./LICENSE).
