export interface SecretManager {
  storeSecret(secretId: string, plaintext: string): Promise<string>;
  retrieveSecret(secretId: string): Promise<string>;
  deleteSecret(secretId: string): Promise<void>;
}
