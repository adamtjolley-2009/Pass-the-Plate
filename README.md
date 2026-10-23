# Pass the Plate

Keep your recipes in one place, scale servings and have the ingredients adjust
automatically, add friends and borrow their recipes, and sort friends into groups
(like Family).

- **Frontend:** React + Vite + TypeScript + Tailwind (shadcn/ui), hosted on Vercel
- **Backend:** Supabase (Postgres with row-level security, Auth, Storage, Edge Functions)
- **Sign-in:** email/password and Google

## Local development

Requires Node.js 20+.

```sh
npm install
cp .env.example .env   # then fill in the publishable key
npm run dev            # http://localhost:8080
```

Checks:

```sh
npm test               # unit tests (Vitest)
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

## Project layout

- `src/pages/` - Login, ResetPassword, CompleteProfile (first sign-in), Index (the app)
- `src/components/` - library, recipe detail, add recipe, friends, groups, profile
- `src/hooks/` - all Supabase reads and writes (React Query)
- `src/lib/` - shared helpers (ingredient parsing/formatting, profile rules)
- `supabase/migrations/` - database schema; apply new migrations in order
- `supabase/functions/parse-recipe-url/` - "Import from URL": reads the schema.org
  recipe data most sites publish, and falls back to Claude for other pages

## Configuration

**Vercel** (Project Settings -> Environment Variables):
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

**Supabase:**

- Authentication -> URL Configuration: set Site URL to the Vercel domain and add
  `https://<your-domain>/**` (and `http://localhost:8080/**` for local dev) to Redirect URLs.
- Authentication -> Sign In / Providers -> Google: add a Google OAuth client ID and secret.
- Authentication -> Sign In / Providers -> Email: "Confirm email" can be turned off
  so new accounts sign in immediately; minimum password length is 6.
- Edge Functions -> Secrets: `ANTHROPIC_API_KEY` enables the Claude fallback for recipe import.

Deploy the edge function with the Supabase CLI:

```sh
supabase functions deploy parse-recipe-url --project-ref cjzltkdtcmmuhkvywabm
```
