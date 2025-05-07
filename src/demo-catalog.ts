import { runETL } from "./etl";
import { startServer } from "./server";
import { nl2graphql, introspectSDL } from "./compiler";
import fetch from "node-fetch";

(async () => {
	console.log("--- Catalog Demo w/ Introspection ---");
	await runETL("catalog.json");
	const serverPromise = startServer();
	await new Promise((res) => setTimeout(res, 2000));
	const url = "http://localhost:4000/graphql";
	const schemaSDL = await introspectSDL(url);
	const prompts = [
		"I want a light-hearted sci-fi comedy with Tom Hanks and a high IMDb-style rating",
		"Find me thriller movies from the 2010s with female leads and a runtime under 2 hours",
		"Recommend family-friendly animated films similar in tone to Toy Story that kids would love",
	];
	for (const prompt of prompts) {
		console.log(`
User: ${prompt}`);
		const query = await nl2graphql(prompt, schemaSDL);
		console.log("Generated:", query);
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		});
		const json = await res.json();
		console.log("Result:", JSON.stringify((json as any).data, null, 2));
	}
	(await serverPromise).stop();
})();

/* 
> npm run demo:catalog

> prompt-to-graph-workbench@1.0.0 demo:catalog
> ts-node src/demo-catalog.ts

--- Catalog Demo w/ Introspection ---
🔄 Starting ETL with data file: catalog.json
✅ ETL complete: loaded 5 entries
🚀 Server ready at http://localhost:4000/graphql

User: I want a light-hearted sci-fi comedy with Tom Hanks and a high IMDb-style rating
Generated: {
  movies(
    where: {
      AND: [
        { genres_INCLUDES: "Sci-Fi" }
        { genres_INCLUDES: "Comedy" }
        { actors_SOME: { name: "Tom Hanks" } }
        { rating_GTE: 8.0 }
      ]
    }
  ) {
    id
    title
    year
    genres
    rating
    synopsis
  }
}
Result: {
  "movies": [
    {
      "id": "1a12bb75-4af8-4ffd-85c9-828d4398ddfb",
      "title": "Galactic Giggles",
      "year": 2022,
      "genres": [
        "Sci-Fi",
        "Comedy"
      ],
      "rating": 8.5,
      "synopsis": "An interstellar road trip comedy where two unlikely heroes accidentally save the galaxy with humor and heart."
    }
  ]
}

User: Find me thriller movies from the 2010s with female leads and a runtime under 2 hours
Generated: {
  movies(
    where: {
      genres_INCLUDES: "Thriller"
      year_GTE: 2010
      year_LTE: 2019
      runtime_LT: 120
      actors_SOME: { gender: "female" }
    }
  ) {
    id
    title
    year
    runtime
    genres
  }
}
Result: {
  "movies": [
    {
      "id": "27eec662-f05d-4b9f-8e9a-6d10a170bf1b",
      "title": "10 Cloverfield Lane",
      "year": 2016,
      "runtime": 104,
      "genres": [
        "Thriller",
        "Sci-Fi"
      ]
    }
  ]
}

User: Recommend family-friendly animated films similar in tone to Toy Story that kids would love
Generated: {
  movies(
    where: {
      AND: [
        { genres_INCLUDES: "Family" }
        { genres_INCLUDES: "Animation" }
      ]
    }
    options: { sort: [{ rating: DESC }], limit: 10 }
  ) {
    title
    year
    rating
    synopsis
    genres
  }
}
Result: {
  "movies": [
    {
      "title": "Toy Story",
      "year": 1995,
      "rating": 8.3,
      "synopsis": "A cowboy doll is profoundly threatened and jealous when a new spaceman figure supplants him as top toy in a boy's room.",
      "genres": [
        "Animation",
        "Family"
      ]
    },
    {
      "title": "Cloudy with a Chance of Meatballs",
      "year": 2009,
      "rating": 7,
      "synopsis": "Inventor Flint Lockwood's latest experiment sends food from the sky, turning a small town into a delicious disaster zone.",
      "genres": [
        "Animation",
        "Family",
        "Comedy"
      ]
    }
  ]
}
 */
