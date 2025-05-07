// src/demo-advanced.ts
import { runETL } from "./etl";
import { startServer } from "./server";
import { nl2graphql } from "./compiler";
import fetch from "node-fetch";
import { introspectSDL } from "./compiler";

(async () => {
	try {
		console.log("--- Advanced Demo: Complex Queries on Extended Data ---");

		// Step 1: ETL
		const count = await runETL("movies.json");
		console.log(`✅ ETL loaded ${count} entries`);

		// Step 2: Start server
		const server = await startServer();
		console.log("✅ Server started, introspecting SDL...");

		// Step 3: Fetch SDL
		const url = "http://localhost:4000/graphql";
		let schemaSDL: string;
		try {
			schemaSDL = await introspectSDL(url);
			console.log("✅ SDL fetched successfully");
		} catch (e) {
			console.error("❌ SDL introspection error:", e);
			throw e;
		}

		// Queries to run
		const prompts = [
			"Find all movies released between 1990 and 2000 that have at least one actor born after 1970, sorted by year in descending order.",
			"List directors who collaborated with both Tom Hanks and Meryl Streep, with collaboration counts.",
			'Perform a semantic search for sci-fi movies similar to "Blade Runner" using vector embeddings.',
		];

		for (const prompt of prompts) {
			console.log(`\n📝 Prompt: ${prompt}`);
			let query: string;
			try {
				query = await nl2graphql(prompt, schemaSDL);
				console.log("🔍 Generated Query:\n", query);
			} catch (e) {
				console.error("❌ Error generating query:", e);
				continue;
			}

			let response;
			try {
				response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				});
			} catch (e) {
				console.error("❌ Network error when executing query:", e);
				continue;
			}

			let json: any;
			try {
				json = await response.json();
			} catch (e) {
				console.error("❌ Error parsing JSON response:", e);
				continue;
			}

			console.log("📊 GraphQL Response Data:", JSON.stringify(json.data, null, 2));
			if (json.errors) {
				console.error("❌ GraphQL Errors:", JSON.stringify(json.errors, null, 2));
			}
		}

		await server.stop();
	} catch (err) {
		console.error("❌ Advanced demo failed with error:", err);
		process.exit(1);
	}
})();

/* 
> npm run demo:advanced

> prompt-to-graph-workbench@1.0.0 demo:advanced
> ts-node src/demo-advanced.ts

--- Advanced Demo: Complex Queries on Extended Data ---
🔄 Starting ETL with data file: movies.json
✅ ETL complete: loaded 12 entries
✅ ETL loaded 12 entries
✅ Server started, introspecting SDL...
🚀 Server ready at http://localhost:4000/graphql
✅ SDL fetched successfully

📝 Prompt: Find all movies released between 1990 and 2000 that have at least one actor born after 1970, sorted by year in descending order.
🔍 Generated Query:
 {
  movies(
    where: {
      year_GTE: 1990
      year_LTE: 2000
      actors_SOME: { born_GT: 1970 }
    }
    options: { sort: [{ year: DESC }] }
  ) {
    id
    title
    year
    actors(where: { born_GT: 1970 }) {
      id
      name
      born
    }
  }
}
📊 GraphQL Response Data: {
  "movies": [
    {
      "id": "b4183f6e-bdcf-41e1-8a1a-c3d78e8740c7",
      "title": "Titanic",
      "year": 1997,
      "actors": [
        {
          "id": "0fe74dd0-498a-45c3-a1b7-306b11765f45",
          "name": "Kate Winslet",
          "born": 1975
        },
        {
          "id": "e49a934d-9f87-43b0-b8c0-ddcb559ca5df",
          "name": "Leonardo DiCaprio",
          "born": 1974
        }
      ]
    },
    {
      "id": "d3ca9792-d245-4a5e-bd08-9190482fda95",
      "title": "Romeo + Juliet",
      "year": 1996,
      "actors": [
        {
          "id": "92698d19-dd44-441e-9582-2c2aa6272c1a",
          "name": "Claire Danes",
          "born": 1979
        },
        {
          "id": "e49a934d-9f87-43b0-b8c0-ddcb559ca5df",
          "name": "Leonardo DiCaprio",
          "born": 1974
        }
      ]
    }
  ]
}

📝 Prompt: List directors who collaborated with both Tom Hanks and Meryl Streep, with collaboration counts.
🔍 Generated Query:
 {
  people(
    where: {
      AND: [
        { directed_SOME: { actors_SOME: { name: "Tom Hanks" } } }
        { directed_SOME: { actors_SOME: { name: "Meryl Streep" } } }
      ]
    }
  ) {
    name
    tomHanksCollaborations: directedAggregate(
      where: { actors_SOME: { name: "Tom Hanks" } }
    ) {
      count
    }
    merylStreepCollaborations: directedAggregate(
      where: { actors_SOME: { name: "Meryl Streep" } }
    ) {
      count
    }
  }
}
📊 GraphQL Response Data: {
  "people": [
    {
      "name": "Steven Spielberg",
      "tomHanksCollaborations": {
        "count": 1
      },
      "merylStreepCollaborations": {
        "count": 1
      }
    }
  ]
}

📝 Prompt: Perform a semantic search for sci-fi movies similar to "Blade Runner" using vector embeddings.
🔍 Generated Query:
 {
  movies(
    where: { genres_INCLUDES: "Sci-Fi", year_GTE: 1980 }
    options: { limit: 5, sort: [{ rating: DESC }] }
  ) {
    id
    title
    year
    genres
    rating
    synopsis
  }
}
📊 GraphQL Response Data: {
  "movies": [
    {
      "id": "929911dd-1284-4bb2-823a-d7d9034319b8",
      "title": "Inception",
      "year": 2010,
      "genres": [
        "Sci-Fi",
        "Thriller"
      ],
      "rating": 8.8,
      "synopsis": "A thief enters the dreams of others to steal secrets but is tasked with planting an idea into a target's mind."
    },
    {
      "id": "33515068-9ad5-47c5-99ec-9e2c3e8436f9",
      "title": "The Matrix",
      "year": 1999,
      "genres": [
        "Sci-Fi",
        "Action"
      ],
      "rating": 8.7,
      "synopsis": "A hacker discovers reality is a simulation and joins a rebellion to fight its controllers."
    },
    {
      "id": "66f8c459-19a7-49a0-9a9a-2bbf7a9c7210",
      "title": "Blade Runner",
      "year": 1982,
      "genres": [
        "Sci-Fi",
        "Neo-Noir"
      ],
      "rating": 8.1,
      "synopsis": "A blade runner hunts down escaped synthetic humans in a dystopian Los Angeles."
    },
    {
      "id": "c93eb50b-4b0d-4e59-b799-6bd3021192e7",
      "title": "Jurassic Park",
      "year": 1993,
      "genres": [
        "Sci-Fi",
        "Adventure"
      ],
      "rating": 8.1,
      "synopsis": "Dinosaurs are brought back to life on a remote island theme park, but when the security systems fail, chaos ensues."
    },
    {
      "id": "61b053a6-d352-483d-ac10-bbf5b5c2fe31",
      "title": "Blade Runner 2049",
      "year": 2017,
      "genres": [
        "Sci-Fi",
        "Drama"
      ],
      "rating": 8,
      "synopsis": "A new blade runner uncovers a secret that could plunge what's left of society into chaos."
    }
  ]
}
 */
