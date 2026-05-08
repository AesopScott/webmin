# Webmin

Web-based content management tool for CMC (cmcenters.org).

## Stack

- **Client:** React + Vite + Tailwind CSS
- **Server:** Node.js + Express
- **Data:** GitHub API (reads/writes JSON files in the CMC repo)
- **Auth:** JWT, email/password per user

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. Generate password hashes: `node server/scripts/hash-password.js <password>`
3. Install: `npm run setup`
4. Run: `npm run dev`

## Users & Roles

Defined in `server/src/config/users.js`. Each user has an email, bcrypt password hash (from env var), and a list of sections they can edit (`*` = all sections).

## Sections

| Section | Data source |
|---|---|
| Providers | `src/data/providers.json` |
| Locations | `src/data/locations.json` |
| Services | `src/data/services.json` |
| News | `src/data/posts.json` |
| Careers | Astro page (phase 2) |
| Patients | Static Astro pages (phase 2) |
