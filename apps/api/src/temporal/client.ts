import { Connection, Client } from '@temporalio/client';

export async function createTemporalConnection() {
  const address = process.env.TEMPORAL_ADDRESS!;
  const apiKey = process.env.TEMPORAL_API_KEY;

  const connectionOptions: any = {
    address,
  };

  // Only add TLS/auth for Cloud
  if (apiKey) {
    connectionOptions.tls = {};
    connectionOptions.metadata = {
      authorization: `Bearer ${apiKey}`,
    };
  }

  return await Connection.connect(connectionOptions);
}

export async function createTemporalClient() {
  const connection = await createTemporalConnection();
  return new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });
}

