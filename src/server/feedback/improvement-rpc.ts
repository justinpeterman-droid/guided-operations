import "server-only";

type RpcError = Readonly<{ code?: string }> | null;
type RpcClient = Readonly<{
  rpc: <T>(
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: T;
    error: RpcError;
  }>;
}>;

/** Narrow server adapter for reviewed API RPCs omitted by the Supabase generator. */
export function improvementRpc<T>(
  client: unknown,
  name: string,
  args: Record<string, unknown>,
) {
  return (client as RpcClient).rpc<T>(name, args);
}
