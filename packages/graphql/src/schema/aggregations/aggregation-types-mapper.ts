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

import { ObjectTypeComposer, SchemaComposer } from "graphql-compose";
import { numericalResolver, idResolver } from "../resolvers";

export class AggregationTypesMapper {
    private requiredAggregationSelectionTypes: Record<string, ObjectTypeComposer<unknown, unknown>>;
    private nullableAggregationSelectionTypes: Record<string, ObjectTypeComposer<unknown, unknown>>;

    constructor(composer: SchemaComposer) {
        this.requiredAggregationSelectionTypes = this.getOrCreateAggregationSelectionTypes({
            composer,
            nullable: false,
        });
        this.nullableAggregationSelectionTypes = this.getOrCreateAggregationSelectionTypes({
            composer,
            nullable: true,
        });
    }

    public getAggregationType({
        fieldName,
        nullable,
    }: {
        fieldName: string;
        nullable: boolean;
    }): ObjectTypeComposer<unknown, unknown> | undefined {
        if (nullable) {
            return this.nullableAggregationSelectionTypes[fieldName];
        }
        return this.requiredAggregationSelectionTypes[fieldName];
    }

    private getOrCreateAggregationSelectionTypes({
        composer,
        nullable,
    }: {
        composer: SchemaComposer;
        nullable: boolean;
    }): Record<string, ObjectTypeComposer<unknown, unknown>> {
        const composeInt = {
            type: this.makeNullable("Int", nullable),
            resolve: numericalResolver,
            args: {},
        };

        const composeFloat = {
            type: this.makeNullable("Float", nullable),
            resolve: numericalResolver,
            args: {},
        };

        const composeId = {
            type: this.makeNullable("ID", nullable),
            resolve: idResolver,
            args: {},
        };

        // Foreach i if i[1] is ? then we will assume it takes on type { min, max }
        const aggregationSelectionTypeMatrix: [string, any?][] = [
            [
                "ID",
                {
                    shortest: composeId,
                    longest: composeId,
                },
            ],
            [
                "String",
                {
                    shortest: this.makeNullable("String", nullable),
                    longest: this.makeNullable("String", nullable),
                },
            ],
            [
                "Float",
                {
                    max: composeFloat,
                    min: composeFloat,
                    average: composeFloat,
                },
            ],
            [
                "Int",
                {
                    max: composeInt,
                    min: composeInt,
                    average: composeFloat,
                },
            ],
            [
                "BigInt",
                {
                    max: this.makeNullable("BigInt", nullable),
                    min: this.makeNullable("BigInt", nullable),
                    average: this.makeNullable("BigInt", nullable),
                },
            ],
            ["DateTime"],
            ["LocalDateTime"],
            ["LocalTime"],
            ["Time"],
            ["Duration"],
        ];

        const aggregationSelectionTypes = aggregationSelectionTypeMatrix.reduce<
            Record<string, ObjectTypeComposer<unknown, unknown>>
        >((res, [name, fields]) => {
            const typeName = this.makeNullable(name, nullable);
            const nullableStr = nullable ? "Nullable" : "NonNullable";

            const type = composer.getOrCreateOTC(`${name}AggregateSelection${nullableStr}`, (tc) => {
                tc.addFields(fields ?? { min: typeName, max: typeName });
            });

            return {
                ...res,
                [name]: type,
            };
        }, {});

        return aggregationSelectionTypes;
    }

    private makeNullable(typeStr: string, isNullable: boolean) {
        return `${typeStr}${isNullable ? "" : "!"}`;
    }
}
