# Sideline Documentation

Technical documentation for the Sideline sports team management platform, intended for **contributors and operators**.

> **End-user product docs** (guides for players, captains, and admins) live at `applications/docs/` and are served at `/docs` on every deployed environment. This `docs/` folder is not the end-user site — it is the internal reference for developers and operators.

## Guides

- [Deployment and Operations](deployment.md) — Architecture overview, environment variables, CI/CD pipelines, monitoring, local development setup, and troubleshooting
- [Discord Bot](discord-bot.md) — Slash commands, button/modal interactions, gateway event handlers, and RPC sync workers

## Reference

- [API Documentation](api.md) — All REST API endpoints with request/response schemas, authentication, and error codes
- [Database Schema](database.md) — Table definitions, column types, constraints, migration history, and design patterns

## Thesis

- [ER Diagrams](thesis/er-diagram.md) — Entity-relationship diagrams for the database schema
