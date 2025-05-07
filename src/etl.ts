import "dotenv/config";
import { v4 as uuid } from "uuid";
import neo4j from "neo4j-driver";
import fs from "fs";

/**
 * ETL script: Load JSON movies data (with optional runtime, imdbScore, gender) into Neo4j
 * Usage: ts-node src/etl.ts [dataFile]
 */
export async function runETL(dataFile: string = "movies.json"): Promise<number> {
	console.log(`🔄 Starting ETL with data file: ${dataFile}`);
	// Create driver & session
	const driver = neo4j.driver(
		process.env.NEO4J_URI!,
		neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
		{ encrypted: "ENCRYPTION_OFF" },
	);
	const session = driver.session();

	// Read JSON file
	let raw: string;
	try {
		raw = fs.readFileSync(dataFile, "utf8");
	} catch (err) {
		throw new Error(`Data file not found or unreadable: ${dataFile}`);
	}
	const data: any[] = JSON.parse(raw);

	for (const entry of data) {
		const { title, year, genres, rating, synopsis, director, actors, runtime, imdbScore } = entry;

		// Merge Movie node, include optional props
		const movieParams: any = {
			title,
			id: uuid(),
			year: year ?? null,
			genres: genres ?? [],
			rating: rating ?? null,
			synopsis: synopsis ?? null,
		};
		let movieQuery = `
      MERGE (m:Movie { title: $title })
      ON CREATE SET m.id = $id
      SET m.year = $year,
          m.genres = $genres,
          m.rating = $rating,
          m.synopsis = $synopsis`;
		if (runtime !== undefined) {
			movieQuery += `, m.runtime = $runtime`;
			movieParams.runtime = runtime;
		}
		if (imdbScore !== undefined) {
			movieQuery += `, m.imdbScore = $imdbScore`;
			movieParams.imdbScore = imdbScore;
		}
		await session.run(movieQuery, movieParams);

		// Director relationship
		if (director) {
			await session.run(
				`MERGE (d:Person { name: $director })
           ON CREATE SET d.id = $did
           WITH d
           MATCH (m:Movie { title: $title })
           MERGE (d)-[:DIRECTED]->(m)`,
				{ director, did: uuid(), title },
			);
		}

		// Actors and relationships
		if (Array.isArray(actors)) {
			for (const actor of actors) {
				const name = actor.name ?? null;
				const born = actor.born ?? null;
				const gender = actor.gender ?? null;
				await session.run(
					`MERGE (p:Person { name: $name })
             ON CREATE SET p.id = $pid, p.born = $born, p.gender = $gender
             WITH p
             MATCH (m:Movie { title: $title })
             MERGE (p)-[:ACTED_IN]->(m)`,
					{ name, born, gender, pid: uuid(), title },
				);
			}
		}
	}

	// Close session & driver
	await session.close();
	await driver.close();

	console.log(`✅ ETL complete: loaded ${data.length} entries`);
	return data.length;
}

// CLI entrypoint
if (require.main === module) {
	const dataFileArg = process.argv[2] || "movies-extended-with-gender.json";
	runETL(dataFileArg)
		.then((count) => console.log(`🏁 ETL loaded ${count} entries from ${dataFileArg}`))
		.catch((err) => console.error("❌ ETL failed:", err));
}
