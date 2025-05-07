# Prompt-to-Graph Workbench

A toolkit that converts natural-language prompts into executable GraphQL queries over a Neo4j knowledge graph. It provides ETL scripts, an Apollo/Neo4jGraphQL server with custom queries, and three demo pipelines showcasing its capabilities.

## Prerequisites

- **Node.js** v16+ and npm
- **Neo4j** (Desktop, Docker, or Homebrew) listening on `bolt://127.0.0.1:7687`
- **OpenAI API Key** with access to GPT-o4-mini and embedding models

## Installation & Configuration

1. **Clone the repo**

2. **Install dependencies**
   ```bash
   npm install
   ````

3. **Copy & edit environment variables**

   ```bash
   cp .env.template .env
   ```

   Update `.env`:


   ```ini
   NEO4J_URI=bolt://127.0.0.1:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your_neo4j_password
   OPENAI_API_KEY=sk-...
   ````

## ETL: Loading Data into Neo4j

Run the ETL script to ingest one JSON file:

```bash
# Default dataset:
ts-node src/etl.ts

# Or specify a file:
ts-node src/etl.ts catalog.json
```

Expected output:

```
🔄 Starting ETL with data file: catalog.json
✅ ETL complete: loaded 5 entries
```

This creates `Movie` and `Person` nodes, sets properties (`year`,`genres`,`rating`,`runtime`,`imdbScore`,`born`,`gender`), and relationships (`ACTED_IN`,`DIRECTED`).

## Building the Server

Compile TypeScript and start the GraphQL server:

```bash
npm run build
node dist/server.js
```

The server listens on **[http://localhost:4000/graphql](http://localhost:4000/graphql)**.

## Demos

Each demo script runs its own ETL (overwriting data), starts the server, generates queries via OpenAI, and prints results.

### 1. Basic Pipeline

```bash
npm run demo
```

- Ingests `movies.json`.
- Introspects schema.
- Generates a simple query: e.g., “List titles of movies acted by Tom Hanks.”
- Executes it and logs the GraphQL result.

### 2. Advanced Demo

```bash
npm run demo:advanced
```

Demonstrates complex prompt handling:

1. **Filter & sort** by year and actor birth date.
2. **Aggregations & aliases**: directors collaborating with multiple actors.
3. **Semantic search**: vector-based similarity over movie synopses.

### 3. Catalog Demo

```bash
npm run demo:catalog
```

Simulates a streaming service catalog search:

- Sci‑fi comedy with Tom Hanks & high rating.
- 2010s thriller with female lead and runtime < 2h.
- Family‑friendly animation recommendations

## Custom Queries & Playground

Use the built‑in GraphQL Playground at [http://localhost:4000/graphql](http://localhost:4000/graphql) to:

- Run custom queries
- Invoke `translateExplain(prompt)` to see NL→GraphQL mappings
- Call `semanticSearchMovies(query, topK)` directly

---

With this setup, you can ingest custom data, explore NL‑to‑GraphQL translation, and integrate a powerful prompt‑engineered GraphQL API powered by knowledge graphs and OpenAI.
