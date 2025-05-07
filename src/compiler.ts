import OpenAI from "openai";
import fetch from "node-fetch";
import { getIntrospectionQuery, buildClientSchema, printSchema, IntrospectionQuery } from "graphql";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function introspectSDL(url: string): Promise<string> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query: getIntrospectionQuery() }),
	});
	const body = (await res.json()) as { data: IntrospectionQuery };
	return printSchema(buildClientSchema(body.data));
}

export async function nl2graphql(prompt: string, schemaSDL: string): Promise<string> {
	const response = await openai.chat.completions.create({
		model: "o4-mini",
		messages: [
			{
				role: "system",
				content: `
You are a GraphQL query generator.
Respond only with the GraphQL query (no backticks or commentary).
Use exactly these root fields:
  • movies(where: MovieWhere): [Movie!]!
  • people(where: PersonWhere): [Person!]!
When you need to fetch the same field multiple times with different arguments, you MUST use aliases. For example:
  tomHanksCount: directedAggregate(where: { actors_SOME: { name: "Tom Hanks" } })
  merylStreepCount: directedAggregate(where: { actors_SOME: { name: "Meryl Streep" } })
  If filtering on gender, match the exact casing used in the database ("male" or "female").
  If the user asks for family-friendly or kids content, convert that to a genres_INCLUDES: "Family" filter.
Here is the schema you should use:
${schemaSDL}
        `.trim(),
			},
			{ role: "user", content: prompt },
		],
	});

	// Extract the raw content and strip fencing/backticks:
	let content = response.choices[0].message
		.content!.trim()
		.replace(/```[a-z]*\r?\n?/gi, "")
		.replace(/```/g, "")
		.replace(/`/g, "")
		.trim();

	// Ensure it starts at the first `{`
	const idx = content.indexOf("{");
	if (idx > 0) content = content.slice(idx).trim();
	return content;
}

export async function nl2graphqlExplain(
	prompt: string,
	schemaSDL: string,
): Promise<{ graphql: string; mapping: { id: string; prompt: string; gql: string }[] }> {
	const functionDef = {
		name: "explainTranslation",
		parameters: {
			type: "object",
			properties: {
				graphql: { type: "string" },
				mapping: {
					type: "array",
					items: {
						type: "object",
						properties: { prompt: { type: "string" }, gql: { type: "string" } },
						required: ["prompt", "gql"],
					},
				},
			},
			required: ["graphql", "mapping"],
		},
	};
	const response = await openai.chat.completions.create({
		model: "o4-mini",
		messages: [
			{ role: "system", content: `Explain using schema:\n${schemaSDL}` },
			{ role: "user", content: prompt },
		],
		functions: [functionDef],
		function_call: { name: "explainTranslation" },
	});
	const args = JSON.parse(response.choices[0].message.function_call!.arguments);
	args.mapping = args.mapping.map((m: any, i: number) => ({ id: `m${i}`, ...m }));
	return { graphql: args.graphql, mapping: args.mapping };
}
