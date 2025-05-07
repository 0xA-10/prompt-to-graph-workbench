import { runETL } from "./etl";
import { startServer } from "./server";
import { introspectSDL, nl2graphql } from "./compiler";
import fetch from "node-fetch";

(async () => {
	try {
		console.log("--- Demo: Full Pipeline ---");
		const count = await runETL();
		console.log(`✅ ETL loaded ${count} entries`);
		const server = await startServer();
		console.log("✅ Server started, now introspecting…");
		const schemaSDL = await introspectSDL("http://localhost:4000/graphql");
		console.log("✅ Got SDL, generating query…");
		const query = await nl2graphql('List titles of movies acted by "Tom Hanks"', schemaSDL);
		console.log("🔍 Generated Query:\n", query);
		const response = await fetch("http://localhost:4000/graphql", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		});
		const result = await response.json();
		console.log("📊 GraphQL Result:\n", JSON.stringify(result, null, 2));
		await server.stop();
	} catch (err) {
		console.error("❌ Demo failed with error:", err);
		process.exit(1);
	}
})();

/* 
> npm run demo

> prompt-to-graph-workbench@1.0.0 demo
> ts-node src/demo.ts

--- Demo: Full Pipeline ---
🔄 Starting ETL with data file: movies.json
✅ ETL complete: loaded 12 entries
✅ ETL loaded 12 entries
✅ Server started, now introspecting…
🚀 Server ready at http://localhost:4000/graphql
✅ Got SDL, generating query…
🔍 Generated Query:
 {
  movies(where: { actors_SOME: { name: "Tom Hanks" } }) {
    title
  }
}
📊 GraphQL Result:
 {
  "data": {
    "movies": [
      {
        "title": "The Post"
      },
      {
        "title": "Forrest Gump"
      }
    ]
  }
}
 */