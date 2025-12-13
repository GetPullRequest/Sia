import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import type { SecretManager } from './secret-manager';

export class GCPSecretManager implements SecretManager {
  private client: SecretManagerServiceClient;
  private projectId: string;

  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId =
      process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';

    if (!this.projectId) {
      throw new Error(
        'GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is not set'
      );
    }
  }

  private getSecretName(secretId: string): string {
    // Sanitize secret ID to be a valid secret name
    // GCP secret names must match: [a-zA-Z0-9_-]+
    const sanitized = secretId.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `integrations/${sanitized}`;
  }

  async storeSecret(secretId: string, plaintext: string): Promise<string> {
    const secretName = this.getSecretName(secretId);
    const parent = `projects/${this.projectId}`;
    const fullSecretName = `${parent}/secrets/${secretName}`;

    try {
      // Check if secret already exists
      try {
        await this.client.getSecret({ name: fullSecretName });
      } catch (error: any) {
        // Secret doesn't exist, create it
        if (error.code === 5) {
          // NOT_FOUND
          await this.client.createSecret({
            parent,
            secretId: secretName,
            secret: {
              replication: {
                automatic: {},
              },
            },
          });
        } else {
          throw error;
        }
      }

      // Add a new version with the secret value
      await this.client.addSecretVersion({
        parent: fullSecretName,
        payload: {
          data: Buffer.from(plaintext, 'utf8'),
        },
      });

      // Return the secret name as the reference
      return fullSecretName;
    } catch (error) {
      console.error('Error storing secret in GCP Secret Manager:', error);
      throw new Error(
        `Failed to store secret in GCP Secret Manager: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async retrieveSecret(secretId: string): Promise<string> {
    try {
      // secretId is the full secret name from GCP
      const [version] = await this.client.accessSecretVersion({
        name: `${secretId}/versions/latest`,
      });

      if (!version.payload?.data) {
        throw new Error('Secret version has no data');
      }

      const secretValue = version.payload.data.toString();
      return secretValue;
    } catch (error) {
      console.error('Error retrieving secret from GCP Secret Manager:', error);
      throw new Error(
        `Failed to retrieve secret from GCP Secret Manager: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async deleteSecret(secretId: string): Promise<void> {
    try {
      await this.client.deleteSecret({
        name: secretId,
      });
    } catch (error: any) {
      // Ignore NOT_FOUND errors
      if (error.code !== 5) {
        console.error('Error deleting secret from GCP Secret Manager:', error);
        throw new Error(
          `Failed to delete secret from GCP Secret Manager: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }
  }
}
