/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { gql } from "graphql-tag";
import type { DocumentNode } from "graphql";
import { Neo4jGraphQL } from "../../../src";
import { formatCypher, formatParams, translateQuery } from "../utils/tck-test-utils";

describe("https://github.com/neo4j/graphql/issues/1628", () => {
    let typeDefs: DocumentNode;
    let neoSchema: Neo4jGraphQL;

    beforeAll(() => {
        typeDefs = gql`
            type frbr__Work @node(additionalLabels: ["Resource"]) @exclude(operations: [CREATE, UPDATE, DELETE]) {
                """
                IRI
                """
                iri: ID! @unique @alias(property: "uri")
                dcterms__title: [dcterms_title!]! @relationship(type: "dcterms__title", direction: OUT)
            }

            type dcterms_title @node(additionalLabels: ["property"]) @exclude(operations: [CREATE, UPDATE, DELETE]) {
                value: String
            }
        `;

        neoSchema = new Neo4jGraphQL({
            typeDefs,
        });
    });

    test("Filter generated by query doesn't utilise index", async () => {
        const query = gql`
            {
                frbrWorks(options: { limit: 10000 }, where: { dcterms__title: { value_CONTAINS: "0777" } }) {
                    iri
                    dcterms__title(where: { value_CONTAINS: "0777" }) {
                        value
                    }
                }
            }
        `;

        const result = await translateQuery(neoSchema, query);

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`frbr__Work\`:\`Resource\`)
            WHERE EXISTS {
                MATCH (this)-[:dcterms__title]->(this0:\`dcterms_title\`:\`property\`)
                WHERE this0.value CONTAINS $param0
            }
            WITH *
            LIMIT $param1
            CALL {
                WITH this
                MATCH (this)-[this1:dcterms__title]->(this2:\`dcterms_title\`:\`property\`)
                WHERE this2.value CONTAINS $param2
                WITH this2 { .value } AS this2
                RETURN collect(this2) AS var3
            }
            RETURN this { iri: this.uri, dcterms__title: var3 } AS this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`
            "{
                \\"param0\\": \\"0777\\",
                \\"param1\\": {
                    \\"low\\": 10000,
                    \\"high\\": 0
                },
                \\"param2\\": \\"0777\\"
            }"
        `);
    });
});
