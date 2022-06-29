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

import { PointParam } from "../CypherBuilder";
import { CypherContext } from "../CypherContext";
import { CypherVariable } from "../references/References";

// type Params = Record<string, Param<any>>;
// type WhereInput = Array<[MatchableElement, Params] | WhereOperator>;

export abstract class ScalarFunction {
    private operation: string;

    constructor(operation: string) {
        this.operation = operation;
    }

    public abstract getCypher(context: CypherContext): string;

    protected getOperation(content: string): string {
        return `${this.operation}(${content})`;
    }
}

export class CoalesceFunction extends ScalarFunction {
    constructor(private variable: CypherVariable, private property: string, private coalesceValue: string) {
        super("coalesce");
    }

    public getCypher(context: CypherContext): string {
        const variableId = context.getVariableId(this.variable);
        const functionParamsStr = `${variableId}.${this.property}, ${this.coalesceValue}`;

        return this.getOperation(functionParamsStr);
    }
}

export class DistanceFunction extends ScalarFunction {
    constructor(private property: [CypherVariable, string] | ScalarFunction, private point: PointParam) {
        super("distance");
    }

    public getCypher(context: CypherContext): string {
        let propParam: string;
        if (this.property instanceof ScalarFunction) {
            const propertyCypher = this.property.getCypher(context);
            propParam = propertyCypher;
        } else {
            const [variable, prop] = this.property;
            const variableId = context.getVariableId(variable);
            propParam = `${variableId}.${prop}`;
        }
        const functionParamsStr = `${propParam}, ${this.point.getCypher(context)}`;
        return this.getOperation(functionParamsStr);
    }
}

export function coalesce(variable: CypherVariable, property: string, coalesceValue: string): CoalesceFunction {
    return new CoalesceFunction(variable, property, coalesceValue);
}

export function distance(
    variable: CypherVariable | ScalarFunction,
    property: string,
    point: PointParam
): DistanceFunction {
    if (variable instanceof ScalarFunction) {
        return new DistanceFunction(variable, point);
    }
    return new DistanceFunction([variable, property], point);
}
