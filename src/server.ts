import "dotenv/config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { readFileSync } from "fs";
import { join } from "path";
import depthLimit from "graphql-depth-limit";
import { createComplexityLimitRule } from "graphql-validation-complexity";
import { printSchema } from "graphql";
import { nl2graphqlExplain } from "./compiler";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function startServer() {
	const app = express();
	const typeDefs = readFileSync(join(__dirname, "schema.graphql"), "utf8");
	const driver = neo4j.driver(
		process.env.NEO4J_URI!,
		neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
	);
	const neoGraph = new Neo4jGraphQL({ typeDefs, driver });
	const schema = await neoGraph.getSchema();
	const sdlString = printSchema(schema);

	const resolvers = {
		Query: {
			semanticSearchMovies: (
				_parent: any,
				{ query, topK }: { query: string; topK: number },
				{ driver }: { driver: any },
			) => {
				console.log("Aaaaaaa");
				return (async () => {
					console.log("▶️ semanticSearchMovies called with:", { query, topK });
					try {
						// 1) Load all movie synopses
						const session = driver.session();
						const result = await session.run("MATCH (m:Movie) RETURN m.id AS id, m.synopsis AS text");
						console.log("📥 Loaded", result.records.length, "synopses");
						await session.close();

						const items = result.records.map((r: any) => ({
							id: r.get("id"),
							text: r.get("text") || "",
						}));
						console.log("📦 Prepared", items.length, "items for embedding");

						// 2) Embed the user query
						const qEmbRes = await openai.embeddings.create({
							model: "text-embedding-ada-002",
							input: [query],
						});
						console.log("📥 Received query embedding");
						const qEmb = qEmbRes.data[0].embedding;

						// 3) Embed each synopsis and compute similarity
						const sims: { id: string; score: number }[] = [];
						for (const { id, text } of items) {
							const embRes = await openai.embeddings.create({
								model: "text-embedding-ada-002",
								input: [text],
							});
							const emb = embRes.data[0].embedding;
							const score = emb.reduce((sum, v, i) => sum + v * qEmb[i], 0);
							sims.push({ id, score });
						}
						console.log("🔢 Computed similarity for", sims.length, "items");

						sims.sort((a, b) => b.score - a.score);
						const topIds = sims.slice(0, topK).map((x) => x.id);
						console.log("🏆 Top IDs:", topIds);

						// 4) Fetch top-K movies
						const session2 = driver.session();
						const moviesRes = await session2.run("MATCH (m:Movie) WHERE m.id IN $ids RETURN m", { ids: topIds });
						console.log("📊 Retrieved", moviesRes.records.length, "movies");
						await session2.close();

						const movies = moviesRes.records.map((r: any) => r.get("m").properties);
						console.log("✅ semanticSearchMovies returning", movies.length);
						return movies;
					} catch (err) {
						console.error("❗ semanticSearchMovies caught error:", err);
						return [];
					}
				})();
			},
		},
		Mutation: { translateExplain: (_: any, { prompt }: { prompt: string }) => nl2graphqlExplain(prompt, sdlString) },
	};

	const server = new ApolloServer({
		schema,
		resolvers,
		context: { driver },
		// validationRules: [depthLimit(6), createComplexityLimitRule(2000)],
	});
	await server.start();
	server.applyMiddleware({ app });
	app.listen({ port: 4000 }, () => console.log("🚀 Server ready at http://localhost:4000/graphql"));
	return server;
}
