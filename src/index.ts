import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { delegateToSchema } from "@graphql-tools/delegate";
import { schemaFromExecutor, wrapSchema } from '@graphql-tools/wrap';
import { fetch } from 'cross-undici-fetch';
import { print } from 'graphql';

const DEFAULT_RPC_ENDPOINT = "https://9c-main-full-state.nine-chronicles.com/graphql";

const getRPCEndpointByAgent = (agentAddress: string): string => {
  const mapping = {
    "0xa1ef9701F151244F9aA7131639990c4664d2aEeF": "https://9c-internal-rpc-1.nine-chronicles.com/graphql",
    "0x019101FEec7ed4f918D396827E1277DEda1e20D4": "https://9c-internal-mead-rpc-1.nine-chronicles.com/graphql",
  };

  return mapping[agentAddress] ?? DEFAULT_RPC_ENDPOINT;
}

const getRPCEndpoint = (query: string, variables: any): string => {
  // FIXME Use AST instead of string
  if (query.indexOf("goldBalance") > 0 && variables["address"]) {
    return getRPCEndpointByAgent(variables["address"]);
  }

  return DEFAULT_RPC_ENDPOINT;
}

export const executor = async ({ document , variables, context }: {document: any, variables: any, context: any}) => {
  const query = print(document);
  const endpoint = getRPCEndpoint(query, variables);
  const fetchResult = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...context?.headers
    },
    body: JSON.stringify({ query, variables })
  })
  return fetchResult.json()
}

export const applicationProxyResolver = ({
  subschemaConfig,
  operation,
  transformedSchema,
}: {
  subschemaConfig: any,
  operation: any,
  transformedSchema: any,
}) => {
  return (_parent: any, _args: any, context: any, info: any) => {
      return delegateToSchema({
          schema: subschemaConfig,
          operation,
          operationName: info!.operation!.name?.value,
          context,
          info,
          transformedSchema,
      });
  };
}

const schema = wrapSchema({
    schema: await schemaFromExecutor(executor),
    executor,
    createProxyingResolver: applicationProxyResolver
});

const server = new ApolloServer({ 
  schema,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`🚀  Server ready at: ${url}`);
